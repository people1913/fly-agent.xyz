#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  CTRS v1.2 一致性测试套件 — 一键运行脚本
# ═══════════════════════════════════════════════════════════════
#
# 使用方式：
#   bash run_all_tests.sh                                    # 默认端点
#   ENDPOINT=https://your-api.com/v1/verify bash run_all_tests.sh  # 自定义端点
#
# 环境变量：
#   ENDPOINT  — 被测实现的 API 端点（默认: https://api.fly-agent.xyz/v1/verify）
#   REGISTRY  — Registry 目录路径（可选）
# ═══════════════════════════════════════════════════════════════

set -e

# 默认端点
ENDPOINT="${ENDPOINT:-https://api.fly-agent.xyz/v1/verify}"

# 脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 统计
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0
RESULTS=()

echo ""
echo "CTRS v1.2 Conformance Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "端点: $ENDPOINT"
echo ""

# 遍历所有测试用例
for test in "$SCRIPT_DIR"/tests/test_*.json; do
    [ -f "$test" ] || continue
    
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    
    # 提取测试 ID
    TEST_NAME=$(basename "$test" .json)
    
    # 构建命令
    CMD="python3 \"$SCRIPT_DIR/conformance_validator.py\" --test \"$test\" --endpoint \"$ENDPOINT\""
    if [ -n "$REGISTRY" ]; then
        CMD="$CMD --registry \"$REGISTRY\""
    fi
    
    # 运行测试，捕获退出码
    if eval "$CMD" > /tmp/ctrs_test_output.txt 2>&1; then
        RESULTS+=("$TEST_NAME: PASS ✅")
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        RESULTS+=("$TEST_NAME: FAIL ❌")
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    # 显示输出
    cat /tmp/ctrs_test_output.txt
    echo ""
done

# 汇总
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CTRS Conformance Test Suite — Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for result in "${RESULTS[@]}"; do
    echo "  $result"
done
echo ""
echo "Total: $PASS_COUNT/$TOTAL_COUNT PASSED"

if [ $FAIL_COUNT -gt 0 ]; then
    echo ""
    echo "⚠  $FAIL_COUNT 个测试失败 — 请检查上方详细输出"
    exit 1
else
    echo ""
    echo "✅ 所有测试通过 — 实现兼容 CTRS v1.2"
    exit 0
fi
