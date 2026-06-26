#!/bin/bash
# Fly D1 Backup Script
# 用法: ./backup_d1.sh
# 
# 功能：
# 1. 调用 Cloudflare D1 Export API 导出完整 SQL
# 2. 下载 SQL 内容
# 3. 推送到 Worker 备份端点存储到 KV
#
# 建议 Cron: 每小时执行一次
# 0 * * * * /path/to/backup_d1.sh >> /var/log/fly_backup.log 2>&1

set -e

ACCOUNT_ID="014fc3114b2e2befeac9aaaf08a09a5b"
DATABASE_ID="71a75dc8-76c5-4563-bf6f-0aa47f76ff95"
CF_API_TOKEN="${CF_API_TOKEN:?请设置环境变量 CF_API_TOKEN}"
WORKER_BACKUP_URL="https://api.fly-agent.xyz/v1/backup/d1"
WORKER_API_KEY="fly_demo_key_2026"

echo "=== Fly D1 Backup $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

# Step 1: 触发导出
echo "[1/4] 触发 D1 Export..."
EXPORT_RESP=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DATABASE_ID/export" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"output_format":"polling"}')

STATUS=$(echo "$EXPORT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('status',''))")
BOOKMARK=$(echo "$EXPORT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('at_bookmark',''))")

if [ -z "$BOOKMARK" ]; then
  echo "ERROR: 无法触发导出"
  echo "$EXPORT_RESP"
  exit 1
fi

echo "  Status: $STATUS"
echo "  Bookmark: $BOOKMARK"

# Step 2: 轮询直到完成
echo "[2/4] 等待导出完成..."
SIGNED_URL=""
for i in $(seq 1 30); do
  sleep 2
  POLL_RESP=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DATABASE_ID/export" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"output_format\":\"polling\",\"current_bookmark\":\"$BOOKMARK\"}")
  
  STATUS=$(echo "$POLL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('status','unknown'))" 2>/dev/null || echo "unknown")
  
  if [ "$STATUS" = "complete" ]; then
    SIGNED_URL=$(echo "$POLL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('result',{}).get('signed_url',''))")
    break
  fi
  
  if [ "$STATUS" = "error" ]; then
    echo "ERROR: 导出失败"
    echo "$POLL_RESP"
    exit 1
  fi
done

if [ -z "$SIGNED_URL" ]; then
  echo "ERROR: 导出超时"
  exit 1
fi

echo "  导出完成"

# Step 3: 下载 SQL
echo "[3/4] 下载 SQL..."
SQL_FILE=$(mktemp)
curl -s "$SIGNED_URL" -o "$SQL_FILE"
SQL_SIZE=$(wc -c < "$SQL_FILE")
echo "  SQL size: $SQL_SIZE bytes"

if [ "$SQL_SIZE" -lt 100 ]; then
  echo "ERROR: SQL 内容过小"
  rm "$SQL_FILE"
  exit 1
fi

# Step 4: 推送到 Worker
echo "[4/4] 推送到备份端点..."
PUSH_RESP=$(curl -s -X POST "$WORKER_BACKUP_URL" \
  -H "Authorization: Bearer $WORKER_API_KEY" \
  -H "Content-Type: application/sql" \
  --data-binary @"$SQL_FILE")

SUCCESS=$(echo "$PUSH_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success', False))")

if [ "$SUCCESS" = "True" ]; then
  BACKUP_ID=$(echo "$PUSH_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('backup',{}).get('id',''))")
  BACKUP_HASH=$(echo "$PUSH_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('backup',{}).get('backup_hash',''))")
  echo "  备份成功!"
  echo "  Backup ID: $BACKUP_ID"
  echo "  Backup Hash: $BACKUP_HASH"
else
  echo "ERROR: 推送失败"
  echo "$PUSH_RESP"
  rm "$SQL_FILE"
  exit 1
fi

rm "$SQL_FILE"
echo "=== 备份完成 ==="
