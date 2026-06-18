/**
 * Fly API Worker v3.0.0 — Cloudflare Worker Entry Point
 * 纯原生Worker API，无第三方依赖
 * 
 * 5层能力架构：L1 Identity · L2 Proof · L3 Verification · L4 Trust Ledger · L5 Attribution Settlement + 硬边界
 * Governance横切L1-L5，不是线性层
 * 
 * API端点清单：
 *   GET  /v1/health                           — 健康检查（含D1/KV状态）
 *   POST /v1/agents                           — 漏洞1：Agent注册+身份验证
 *   GET  /v1/agents/:id
 *   POST /v1/action                           — 漏洞2+3：Bearer+HMAC鉴权 + HMAC伪匿名
 *   GET  /v1/status/:actionId
 *   POST /v1/agents/:id/recalc-trust          — 漏洞4：Trust多维计算
 *   POST /v1/verifications                    — 漏洞5：三方分离防自证
 *   GET  /s/:actionId                         — 漏洞6：短链Bot检测+信号质量
 *   POST /v1/signal/verify                    — 漏洞6：JS回调信号质量升级
 *   GET  /v1/audit/:entityType/:entityId      — 漏洞7：审计链查询
 *   POST /v1/governance/assign-role           — 漏洞8：角色授权
 *   POST /v1/governance/check-permission      — 漏洞8：权限检查(Default Deny)
 *   POST /v1/governance/update-policy         — 漏洞8：策略更新
 *   GET  /v1/db/query                         — 验收辅助查询
 *   GET  /v1/admin/metrics                    — v2.7.0: 请求指标聚合查询
 *   POST /v1/admin/alert/test                 — v2.7.0: 告警测试
 *   POST /v1/admin/backup                     — v2.7.0: 触发备份
 *   GET  /v1/admin/backup                     — v2.7.0: 备份历史
 *   PUT  /v1/admin/kv                         — v2.9.0: KV写入（仅capacity:前缀）
 *   POST /attribution/ingest                  — v3.0.0: Event-Sourced归因写入（HMAC签名+Nonce防重放）
 *   GET  /attribution/status/:actionId        — v3.0.0: 完整状态机进度查询
 *   GET  /attribution/list                    — v2.11.0: attribution数据概览
 *   POST /attribution/shadow/:actionId        — v3.0.0: Layer 2 — Shadow归因计算
 *   POST /attribution/verify/:actionId        — v3.0.0: Layer 3 — Verification验证
 *   POST /attribution/replay/:actionId        — v3.0.0: 强制重新验证（忽略已有状态）
 *   POST /attribution/settle/:actionId        — v3.0.0: Layer 4 — 结算（验证通过后）
 * 
 * v3.0.0 Event-Sourced Attribution Ledger 改造：
 *   - HMAC-SHA256签名验证（Web Crypto API）
 *   - Nonce防重放（KV存储，TTL 600s）
 *   - 并发锁机制（D1 processing_lock + 5分钟过期）
 *   - Shadow归因纯函数（加权评分）
 *   - Verification纯函数（合规检查+信号完整性）
 *   - 状态机：CREATED → INGESTED → SHADOW_COMPLETED → VERIFICATION_COMPLETED → SETTLED
 *   - 完整审计链（每次状态变更）
 */

// ============================================================
// Types
// ============================================================
interface Env {
  FLY_D1: D1Database;
  FLY_KV: KVNamespace;
  IP_SALT: string;
  API_KEYS: string;
  // v2.7.0: Telegram告警配置
  TELEGRAM_BOT_TOKEN?: string;   // Telegram Bot Token（未配置则静默跳过）
  TELEGRAM_CHAT_ID?: string;     // Telegram Chat ID（未配置则静默跳过）
  // v2.8.0: 邮件告警配置
  ALERT_EMAIL_TO?: string;       // 告警收件邮箱（未配置则静默跳过）
  RESEND_API_KEY?: string;       // Resend API Key（免费3000封/月，未配置则静默跳过）
  // v2.10.0: GitHub workflow_dispatch触发（替代GitHub Scheduler）
  GITHUB_TOKEN?: string;         // GitHub PAT（未配置则静默跳过workflow_dispatch）
  // v3.0.0: Event-Sourced Attribution Ledger
  FLY_API_KEY?: string;          // HMAC签名验证密钥（用于attribution签名校验）
}

type SignalType = "impression" | "click" | "consult" | "booking" | "deal";
type SignalQuality = "raw" | "verified" | "bot" | "unknown";
type VerifierType = "system" | "human" | "audit" | "external";
type GovernanceRole = "owner" | "operator" | "verifier" | "auditor";
type PrincipalType = "human" | "agent" | "system";
type Permission = "agent:create" | "agent:update" | "verification:create" | "verification:approve" | "trust:recalculate" | "audit:view" | "policy:update" | "policy:assign_role" | "data:delete";
type ActorType = "user" | "agent" | "system";
type AuditAction = "created" | "updated" | "deleted" | "status_changed" | "verified" | "confirmed" | "rejected";

const RolePermissions: Record<string, Permission[]> = {
  owner: ["agent:create", "agent:update", "verification:create", "verification:approve", "trust:recalculate", "audit:view", "policy:update", "policy:assign_role", "data:delete"],
  operator: ["agent:create", "agent:update", "verification:create", "audit:view"],
  verifier: ["verification:create", "verification:approve", "audit:view"],
  auditor: ["audit:view", "trust:recalculate"],
};

// ============================================================
// Bot Detection（漏洞6）
// ============================================================
const BotPatterns: { pattern: RegExp; name: string }[] = [
  { pattern: /GPTBot/i, name: "GPTBot" },
  { pattern: /ChatGPT-User/i, name: "ChatGPT" },
  { pattern: /ClaudeBot/i, name: "ClaudeBot" },
  { pattern: /Googlebot/i, name: "Googlebot" },
  { pattern: /Bingbot/i, name: "Bingbot" },
  { pattern: /PerplexityBot/i, name: "PerplexityBot" },
  { pattern: /Bytespider/i, name: "Bytespider" },
  { pattern: /SemrushBot/i, name: "SemrushBot" },
  { pattern: /AhrefsBot/i, name: "AhrefsBot" },
];

function detectBot(userAgent: string): { isBot: boolean; botName?: string } {
  for (const bot of BotPatterns) {
    if (bot.pattern.test(userAgent)) return { isBot: true, botName: bot.name };
  }
  return { isBot: false };
}

function determineSignalQuality(humanScore: number, isBot: boolean): SignalQuality {
  if (isBot) return "bot";
  if (humanScore >= 50) return "verified";
  if (humanScore > 0) return "raw";
  return "unknown";
}

// ============================================================
// Crypto helpers
// ============================================================
async function hmacSha256(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacUserId(plain: string, salt: string): Promise<string> {
  return `hmac_${await hmacSha256(salt, plain)}`;
}

// ============================================================
// v3.0.0: HMAC Signature Verification（Event-Sourced Attribution）
// ============================================================

/**
 * 验证HMAC-SHA256签名
 * 输入格式：${payload}|${nonce}|${timestamp}
 * 使用Web Crypto API计算，与请求方签名比对
 */
async function verifySignature(payload: string, signature: string, nonce: string, timestamp: string, secret: string): Promise<boolean> {
  const input = `${payload}|${nonce}|${timestamp}`;
  const computed = await hmacSha256(secret, input);
  // 时间安全比较（避免timing attack）
  if (computed.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// ============================================================
// v3.0.0: 并发锁机制（D1 processing_lock）
// ============================================================

/**
 * 获取并发锁 — 乐观锁（5分钟过期）
 * 利用D1的processing_lock字段实现分布式锁
 * @returns true=获取成功, false=锁已被占用
 */
async function acquireLock(env: Env, actionId: string): Promise<boolean> {
  try {
    const result = await env.FLY_D1.prepare(
      "UPDATE attribution_payloads SET processing_lock = 'locked', lock_expire_at = datetime('now', '+5 minutes') WHERE action_id = ? AND (processing_lock IS NULL OR lock_expire_at < datetime('now'))"
    ).bind(actionId).run();
    return (result.meta?.changes ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * 释放并发锁
 */
async function releaseLock(env: Env, actionId: string): Promise<void> {
  try {
    await env.FLY_D1.prepare(
      "UPDATE attribution_payloads SET processing_lock = NULL, lock_expire_at = NULL WHERE action_id = ?"
    ).bind(actionId).run();
  } catch {
    // 释放失败不影响主流程（锁会5分钟后自动过期）
  }
}

// ============================================================
// v3.0.0: Shadow Attribution 纯函数（Layer 2）
// ============================================================

/**
 * Shadow归因计算 — 纯函数，无副作用
 * 从payload.signals提取信号，加权计算综合得分
 * 禁止使用 Date.now(), fetch, Math.random() 等非纯函数
 */
function runShadowAttribution(payload: any): { weighted_score: number; breakdown: { visits: number; transactions: number; chats: number; shares: number } } {
  const signals = payload?.signals || {};
  const visits = Number(signals.visits) || 0;
  const transactions = Number(signals.transactions) || 0;
  const chats = Number(signals.chats) || 0;
  const shares = Number(signals.shares) || 0;

  // 加权计算：visits*1.0 + transactions*1.0 + chats*0.5 + shares*0.3
  const weightedScore = visits * 1.0 + transactions * 1.0 + chats * 0.5 + shares * 0.3;

  return {
    weighted_score: Math.round(weightedScore * 100) / 100,
    breakdown: { visits, transactions, chats, shares },
  };
}

// ============================================================
// v3.0.0: Verification 纯函数（Layer 3）
// ============================================================

/**
 * 归因验证 — 纯函数，无副作用
 * 检查合规结果和信号完整性
 * @returns { status: 'pass'|'fail', confidence: 0-1, checks: string[] }
 */
function runVerification(payload: any, shadowResult: any): { status: 'pass' | 'fail'; confidence: number; checks: string[] } {
  const checks: string[] = [];
  let passCount = 0;
  const totalChecks = 2;

  // Check 1: compliance_result 验证（如果存在）
  if (payload?.compliance_result) {
    if (payload.compliance_result.passed === true) {
      checks.push('compliance: passed');
      passCount++;
    } else {
      checks.push('compliance: failed or not passed');
    }
  } else {
    // 没有compliance_result时视为通过（非强制）
    checks.push('compliance: not required (no compliance_result in payload)');
    passCount++;
  }

  // Check 2: signals 完整性检查
  const signals = payload?.signals || {};
  const requiredFields = ['visits', 'transactions', 'chats', 'shares'];
  const presentFields = requiredFields.filter(f => signals[f] !== undefined && signals[f] !== null);
  if (presentFields.length === requiredFields.length) {
    checks.push(`signals: complete (${requiredFields.join(', ')})`);
    passCount++;
  } else {
    const missing = requiredFields.filter(f => !presentFields.includes(f));
    checks.push(`signals: incomplete (missing: ${missing.join(', ')})`);
  }

  const confidence = Math.round((passCount / totalChecks) * 100) / 100;
  const status = passCount === totalChecks ? 'pass' : 'fail';

  return { status, confidence, checks };
}

// ============================================================
// v3.0.0: Auto-Process After Ingest — 后台自动触发 Shadow + Verification
// ============================================================

/**
 * ingest 成功后自动触发 shadow attribution → verification
 * 通过 ctx.waitUntil() 在后台异步执行，不阻塞 ingest 响应
 * 
 * 状态机推进：INGESTED → SHADOW_COMPLETED → VERIFICATION_COMPLETED
 * 失败时：status=FAILED + failure_reason 记录错误
 * 
 * 使用 try-catch-finally 确保 lock 一定释放
 */
async function autoProcessAfterIngest(env: Env, actionId: string): Promise<void> {
  // 获取并发锁
  const locked = await acquireLock(env, actionId);
  if (!locked) {
    console.log(`[autoProcess] Could not acquire lock for ${actionId}, skipping auto-processing`);
    return;
  }

  try {
    // === Step 1: Shadow Attribution ===
    const record = await env.FLY_D1.prepare(
      "SELECT * FROM attribution_payloads WHERE action_id = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(actionId).first();

    if (!record) {
      console.log(`[autoProcess] Record not found for ${actionId}`);
      return;
    }

    const payload = JSON.parse(record.payload_json as string);
    const shadowResult = runShadowAttribution(payload);

    // 更新 D1: SHADOW_COMPLETED
    await env.FLY_D1.prepare(
      "UPDATE attribution_payloads SET shadow_result = ?, status = 'SHADOW_COMPLETED', worker_status = 'shadow_completed' WHERE action_id = ?"
    ).bind(JSON.stringify(shadowResult), actionId).run();

    // 写审计链: shadow completed
    await writeAuditEvent(env, {
      request_id: `req_${crypto.randomUUID()}`,
      entity_type: 'attribution_payload',
      entity_id: record.id as string,
      action: 'status_changed',
      actor_type: 'system',
      actor_id: 'sys_auto_shadow',
      actor_name: 'auto-shadow-attribution',
      source: 'auto_ingest',
      reason: 'auto_shadow_calculation_after_ingest',
      before: 'INGESTED',
      after: JSON.stringify({ status: 'SHADOW_COMPLETED', weighted_score: shadowResult.weighted_score, trigger: 'auto' })
    });

    // === Step 1.5: Delta + Calibration (if legacy_result exists) ===
    const legacyResultStr = record.legacy_result as string | null;
    if (legacyResultStr) {
      try {
        const legacy = JSON.parse(legacyResultStr);
        const legacyValue = legacy.weighted_score ?? legacy.score ?? 0;
        const shadowValue = shadowResult.weighted_score ?? 0;

        let deltaScore: number;
        if (legacyValue === 0 && shadowValue === 0) {
          deltaScore = 0;
        } else if (legacyValue === 0) {
          deltaScore = shadowValue;
        } else {
          deltaScore = Math.abs(shadowValue - legacyValue) / Math.abs(legacyValue);
        }
        deltaScore = Math.round(deltaScore * 10000) / 10000;

        let calibrationStatus: string;
        if (deltaScore <= 0.05) calibrationStatus = 'MATCHED';
        else if (deltaScore <= 0.20) calibrationStatus = 'PARTIAL_DEVIATION';
        else calibrationStatus = 'DRIFT_DETECTED';

        await env.FLY_D1.prepare(
          "UPDATE attribution_payloads SET delta_score = ?, calibration_status = ? WHERE action_id = ?"
        ).bind(deltaScore, calibrationStatus, actionId).run();

        console.log(`[autoProcess] ${actionId} delta=${deltaScore} calibration=${calibrationStatus} (legacy=${legacyValue}, shadow=${shadowValue})`);
      } catch (deltaErr: any) {
        console.error(`[autoProcess] Delta calculation failed for ${actionId}: ${deltaErr.message}`);
        // Non-fatal: continue to verification
      }
    }

    // === Step 2: Verification ===
    const verificationResult = runVerification(payload, shadowResult);
    const verificationId = `vrf_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

    // 更新 D1: VERIFICATION_COMPLETED
    await env.FLY_D1.prepare(
      "UPDATE attribution_payloads SET verification_result = ?, verification_id = ?, status = 'VERIFICATION_COMPLETED', worker_status = 'verification_completed' WHERE action_id = ?"
    ).bind(JSON.stringify(verificationResult), verificationId, actionId).run();

    // 写审计链: verification completed
    await writeAuditEvent(env, {
      request_id: `req_${crypto.randomUUID()}`,
      entity_type: 'attribution_payload',
      entity_id: record.id as string,
      action: 'verified',
      actor_type: 'system',
      actor_id: 'sys_auto_verification',
      actor_name: 'auto-verification-engine',
      source: 'auto_ingest',
      reason: 'auto_verification_after_ingest',
      before: 'SHADOW_COMPLETED',
      after: JSON.stringify({ status: 'VERIFICATION_COMPLETED', verification_id: verificationId, verification_status: verificationResult.status, trigger: 'auto' })
    });

    console.log(`[autoProcess] ${actionId} → VERIFICATION_COMPLETED (shadow_score=${shadowResult.weighted_score}, verification=${verificationResult.status})`);

  } catch (error: any) {
    // === 失败处理：记录 failure_reason，状态设为 FAILED ===
    const failureReason = error?.message || String(error);
    console.error(`[autoProcess] Failed for ${actionId}: ${failureReason}`);

    try {
      await env.FLY_D1.prepare(
        "UPDATE attribution_payloads SET status = 'FAILED', failure_reason = ?, worker_status = 'auto_process_failed' WHERE action_id = ?"
      ).bind(failureReason.slice(0, 500), actionId).run();

      // 写审计链: failed
      await writeAuditEvent(env, {
        request_id: `req_${crypto.randomUUID()}`,
        entity_type: 'attribution_payload',
        entity_id: actionId,
        action: 'status_changed',
        actor_type: 'system',
        actor_id: 'sys_auto_process',
        actor_name: 'auto-process-engine',
        source: 'auto_ingest',
        reason: 'auto_process_failed',
        before: 'INGESTED',
        after: JSON.stringify({ status: 'FAILED', failure_reason: failureReason.slice(0, 500), trigger: 'auto' })
      });
    } catch (innerError: any) {
      console.error(`[autoProcess] Failed to update failure state for ${actionId}: ${innerError.message}`);
    }
  } finally {
    // === 确保锁一定释放 ===
    await releaseLock(env, actionId);
  }
}

/**
 * Pipeline Queue Consumer
 * 由 Worker Cron (每5分钟) 触发，消费 job_queue 中的 PENDING 任务
 * 
 * 流程：
 * 1. 扫描 job_queue WHERE status = 'PENDING'
 * 2. 按 action_id 分组，对每个 action 执行完整的 shadow → verify 链路
 * 3. 更新 job_queue status + attribution_payloads status
 * 4. 失败时记录 failure_reason，retry_count++
 */
async function processJobQueue(env: Env): Promise<void> {
  try {
    // 1. 获取 PENDING 的 jobs（按 created_at 排序，限制50条）
    const pendingJobs = await env.FLY_D1.prepare(
      "SELECT id, action_id, step, retry_count FROM job_queue WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT 50"
    ).all();

    if (!pendingJobs.results || pendingJobs.results.length === 0) {
      return; // 无任务
    }

    // 2. 按 action_id 去重（同一 action 可能有多个 job，只处理最新的）
    const actionIds = [...new Set(pendingJobs.results.map((j: any) => j.action_id))];

    for (const actionId of actionIds) {
      try {
        // 获取锁
        const locked = await acquireLock(env, actionId);
        if (!locked) {
          console.log(`[queue] Skipping ${actionId}: lock held by another process`);
          continue;
        }

        try {
          // 读取当前记录
          const record = await env.FLY_D1.prepare(
            "SELECT * FROM attribution_payloads WHERE action_id = ? ORDER BY created_at DESC LIMIT 1"
          ).bind(actionId).first();

          if (!record) {
            console.log(`[queue] Record not found for ${actionId}, marking jobs as FAILED`);
            await env.FLY_D1.prepare(
              "UPDATE job_queue SET status = 'FAILED', failure_reason = 'record_not_found', updated_at = datetime('now') WHERE action_id = ? AND status = 'PENDING'"
            ).bind(actionId).run();
            continue;
          }

          const currentStatus = record.status as string;
          
          // 如果已经是终态，清理 queue
          if (currentStatus === 'VERIFICATION_COMPLETED' || currentStatus === 'SETTLED') {
            await env.FLY_D1.prepare(
              "UPDATE job_queue SET status = 'DONE', updated_at = datetime('now') WHERE action_id = ? AND status = 'PENDING'"
            ).bind(actionId).run();
            continue;
          }

          // 执行 pipeline: shadow → verify
          const payload = JSON.parse(record.payload_json as string);
          
          // === Step 1: Shadow Attribution ===
          const shadowResult = runShadowAttribution(payload);
          await env.FLY_D1.prepare(
            "UPDATE attribution_payloads SET shadow_result = ?, status = 'SHADOW_COMPLETED', worker_status = 'shadow_completed', updated_at = datetime('now') WHERE action_id = ?"
          ).bind(JSON.stringify(shadowResult), actionId).run();

          // Delta + Calibration
          const legacyResultStr = record.legacy_result as string | null;
          if (legacyResultStr) {
            const legacy = JSON.parse(legacyResultStr);
            const legacyValue = legacy.weighted_score ?? legacy.score ?? 0;
            const shadowValue = shadowResult.weighted_score ?? 0;
            
            let deltaScore: number;
            if (legacyValue === 0 && shadowValue === 0) deltaScore = 0;
            else if (legacyValue === 0) deltaScore = shadowValue;
            else deltaScore = Math.abs(shadowValue - legacyValue) / Math.abs(legacyValue);
            deltaScore = Math.round(deltaScore * 10000) / 10000;

            let calibrationStatus: string;
            if (deltaScore <= 0.05) calibrationStatus = 'MATCHED';
            else if (deltaScore <= 0.20) calibrationStatus = 'PARTIAL_DEVIATION';
            else calibrationStatus = 'DRIFT_DETECTED';

            await env.FLY_D1.prepare(
              "UPDATE attribution_payloads SET delta_score = ?, calibration_status = ?, updated_at = datetime('now') WHERE action_id = ?"
            ).bind(deltaScore, calibrationStatus, actionId).run();
          }

          // === Step 2: Verification ===
          const verificationResult = runVerification(payload, shadowResult);
          const verificationId = `vrf_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
          
          await env.FLY_D1.prepare(
            "UPDATE attribution_payloads SET verification_result = ?, verification_id = ?, status = 'VERIFICATION_COMPLETED', worker_status = 'verification_completed', updated_at = datetime('now') WHERE action_id = ?"
          ).bind(JSON.stringify(verificationResult), verificationId, actionId).run();

          // 写审计链
          await writeAuditEvent(env, {
            request_id: `req_${crypto.randomUUID()}`,
            entity_type: 'attribution_payload',
            entity_id: record.id as string,
            action: 'pipeline_completed',
            actor_type: 'system',
            actor_id: 'sys_queue_consumer',
            actor_name: 'queue-pipeline-executor',
            source: 'scheduled_cron',
            reason: 'queue_triggered_pipeline',
            before: currentStatus,
            after: JSON.stringify({ status: 'VERIFICATION_COMPLETED', shadow_score: shadowResult.weighted_score, verification: verificationResult.status })
          });

          // 标记 job 为 DONE
          await env.FLY_D1.prepare(
            "UPDATE job_queue SET status = 'DONE', updated_at = datetime('now') WHERE action_id = ? AND status = 'PENDING'"
          ).bind(actionId).run();

          console.log(`[queue] ${actionId} → VERIFICATION_COMPLETED (shadow=${shadowResult.weighted_score}, verify=${verificationResult.status})`);

        } finally {
          await releaseLock(env, actionId);
        }
      } catch (err: any) {
        console.error(`[queue] Failed for ${actionId}: ${err.message}`);
        // 更新 retry_count，标记为 FAILED（可由下次 cron 重试）
        await env.FLY_D1.prepare(
          "UPDATE job_queue SET retry_count = retry_count + 1, failure_reason = ?, status = 'FAILED', next_retry_at = datetime('now', '+5 minutes'), updated_at = datetime('now') WHERE action_id = ? AND status = 'PENDING'"
        ).bind((err.message || 'unknown').slice(0, 500), actionId).run();
      }
    }
  } catch (err: any) {
    console.error(`[queue] processJobQueue error: ${err.message}`);
  }
}

// ============================================================
// API Auth（漏洞2：Bearer + HMAC签名）
// ============================================================
async function verifyBearerToken(authHeader: string | null, env: Env): Promise<{ ok: boolean; error?: string; token?: string; agentId?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { ok: false, error: 'missing Authorization header' };
  const token = authHeader.slice(7);
  // 先检查env静态key
  const validKeys = env.API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
  if (validKeys.includes(token)) return { ok: true, token };
  // 再查D1 agent_auth表动态key
  const authRow = await env.FLY_D1.prepare("SELECT agent_id FROM agent_auth WHERE public_key = ? AND verified = 1").bind(token).first();
  if (authRow) return { ok: true, token, agentId: authRow.agent_id as string };
  return { ok: false, error: 'invalid API key' };
}

// ============================================================
// Audit Event Writer（漏洞7）
// ============================================================
async function writeAuditEvent(env: Env, event: {
  request_id: string; entity_type: string; entity_id: string;
  action: string; actor_type: string; actor_id: string;
  actor_name: string; source: string; reason: string;
  before: string; after: string;
}): Promise<string> {
  const eventId = `aud_${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();
  const prevEvent = await env.FLY_D1.prepare("SELECT event_hash FROM audit_events ORDER BY created_at DESC LIMIT 1").first();
  const prevHash = (prevEvent?.event_hash as string) || '0';
  const hashInput = `${prevHash}${eventId}${event.entity_type}${event.entity_id}${event.action}${event.actor_id}${timestamp}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput));
  const eventHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  await env.FLY_D1.prepare(
    `INSERT INTO audit_events (event_id, request_id, entity_type, entity_id, action, actor_type, actor_id, actor_name, source, reason, before_data, after_data, prev_hash, event_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(eventId, event.request_id, event.entity_type, event.entity_id, event.action, event.actor_type, event.actor_id, event.actor_name, event.source, event.reason, event.before, event.after, prevHash, eventHash, timestamp).run();

  return eventId;
}

// ============================================================
// Get Principal Roles（漏洞8）
// ============================================================
async function getPrincipalRoles(env: Env, principalType: string, principalId: string): Promise<string[]> {
  const results = await env.FLY_D1.prepare("SELECT DISTINCT role FROM role_assignments WHERE principal_type = ? AND principal_id = ?").bind(principalType, principalId).all();
  return (results.results as any[]).map(r => r.role as string);
}

// ============================================================
// JSON Response helper
// ============================================================
function json(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Fly-Signature, X-Fly-Timestamp', ...headers },
  });
}

// ============================================================
// v3.1.0: 指标采集 — 5分钟桶 + 内存聚合 + 阈值落盘
// 解决：每请求1次KV PUT → 50次请求或60秒落盘1次
// 预期：500 PUT/天 → 20~50 PUT/天
// ============================================================

/** 指标桶数据结构 */
interface MetricBucket {
  total: number;
  s2xx: number;
  s3xx: number;
  s4xx: number;
  s5xx: number;
  lat_sum: number;
  lat_max: number;
  lat_samples: number[];  // 采样延迟（最多200个/5分钟，用于P95计算）
}

/** 聚合指标结果 */
interface AggregatedMetrics {
  total: number;
  s2xx: number;
  s3xx: number;
  s4xx: number;
  s5xx: number;
  avg_ms: number;
  max_ms: number;
  p95_ms: number;
}

/** 模块级内存缓存 — Worker实例生命周期内有效，被回收时未落盘数据丢失（best-effort） */
let _metricCache: {
  bucketIndex: number;        // 当前5分钟桶索引
  data: MetricBucket;         // 桶内聚合数据
  requestCount: number;       // 自上次落盘以来的请求计数
  lastFlushTime: number;      // 上次落盘时间戳(ms)
} | null = null;

/** 获取5分钟桶索引 */
function getMetricBucketIndex(): number {
  const minute = Math.floor(Date.now() / 60000);
  return Math.floor(minute / 5);
}

/** 获取5分钟桶的KV key */
function getMetricBucketKey(bucketIndex: number): string {
  return `metrics:m5:${bucketIndex}`;
}

/** 初始化内存缓存 */
function initMetricCache(bucketIndex: number): void {
  _metricCache = {
    bucketIndex,
    data: {
      total: 0, s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0,
      lat_sum: 0, lat_max: 0, lat_samples: [],
    },
    requestCount: 0,
    lastFlushTime: Date.now(),
  };
}

/** 落盘阈值常量 */
const METRIC_FLUSH_REQUESTS = 50;    // 每50次请求落盘一次
const METRIC_FLUSH_INTERVAL = 60000; // 每60秒落盘一次

/** 落盘内存缓存到KV */
async function flushMetricCache(env: Env): Promise<void> {
  if (!_metricCache || _metricCache.data.total === 0) return;
  try {
    const key = getMetricBucketKey(_metricCache.bucketIndex);
    await env.FLY_KV.put(key, JSON.stringify(_metricCache.data), { expirationTtl: 3600 });
    _metricCache.lastFlushTime = Date.now();
    _metricCache.requestCount = 0;
  } catch (e) {
    // 落盘失败不影响主流程，静默忽略
  }
}

/**
 * 记录单次请求指标（内存聚合 + 阈值落盘）
 * 落盘条件（任一触发）：50次请求 / 60秒 / 桶切换
 * 异步调用，失败不影响主流程
 */
async function recordRequestMetric(env: Env, status: number, latencyMs: number): Promise<void> {
  try {
    const currentBucket = getMetricBucketIndex();

    // 初始化或处理桶切换
    if (!_metricCache) {
      initMetricCache(currentBucket);
    } else if (_metricCache.bucketIndex !== currentBucket) {
      // 桶切换：先落盘旧桶，再初始化新桶
      await flushMetricCache(env);
      initMetricCache(currentBucket);
    }

    // 更新内存数据
    const data = _metricCache!.data;
    data.total += 1;
    if (status >= 200 && status < 300) data.s2xx += 1;
    else if (status >= 300 && status < 400) data.s3xx += 1;
    else if (status >= 400 && status < 500) data.s4xx += 1;
    else if (status >= 500) data.s5xx += 1;

    data.lat_sum += latencyMs;
    if (latencyMs > data.lat_max) data.lat_max = latencyMs;

    // 采样延迟数据（最多200样本/5分钟，用于P95计算）
    if (data.lat_samples.length < 200) {
      data.lat_samples.push(latencyMs);
    } else {
      const idx = Math.floor(Math.random() * data.total);
      if (idx < 200) data.lat_samples[idx] = latencyMs;
    }

    _metricCache!.requestCount += 1;

    // 检查是否需要落盘
    const now = Date.now();
    if (_metricCache!.requestCount >= METRIC_FLUSH_REQUESTS ||
        (now - _metricCache!.lastFlushTime) >= METRIC_FLUSH_INTERVAL) {
      await flushMetricCache(env);
    }
  } catch (e) {
    // 指标记录失败不影响主流程，静默忽略
  }
}

/**
 * 聚合最近N分钟的指标数据（5分钟桶查询）
 * 查询前会先落盘当前内存缓存，确保数据完整
 */
async function getAggregatedMetrics(env: Env, minutes: number): Promise<AggregatedMetrics | null> {
  try {
    const nowBucket = getMetricBucketIndex();
    const bucketsToRead = Math.max(1, Math.ceil(minutes / 5));

    let total = 0, s2xx = 0, s3xx = 0, s4xx = 0, s5xx = 0;
    let latSum = 0, latMax = 0;
    const allSamples: number[] = [];

    // 查询前落盘当前内存数据，确保查询到最新数据
    if (_metricCache && _metricCache.data.total > 0) {
      await flushMetricCache(env);
    }

    for (let i = 0; i < bucketsToRead; i++) {
      const bucketIndex = nowBucket - i;
      if (bucketIndex < 0) break;
      const key = getMetricBucketKey(bucketIndex);
      const raw = await env.FLY_KV.get(key);
      if (!raw) continue;
      const data: MetricBucket = JSON.parse(raw);
      total += data.total || 0;
      s2xx += data.s2xx || 0;
      s3xx += data.s3xx || 0;
      s4xx += data.s4xx || 0;
      s5xx += data.s5xx || 0;
      latSum += data.lat_sum || 0;
      if ((data.lat_max || 0) > latMax) latMax = data.lat_max;
      if (data.lat_samples && data.lat_samples.length > 0) {
        allSamples.push(...data.lat_samples);
      }
    }

    if (total === 0) return null;

    // 计算P95延迟
    allSamples.sort((a, b) => a - b);
    const p95Index = Math.ceil(allSamples.length * 0.95) - 1;
    const p95 = allSamples.length > 0 ? allSamples[Math.max(0, p95Index)] : 0;

    return {
      total, s2xx, s3xx, s4xx, s5xx,
      avg_ms: Math.round(latSum / total),
      max_ms: latMax,
      p95_ms: p95,
    };
  } catch (e) {
    return null;
  }
}

// ============================================================
// v2.7.0: Telegram告警（已有，保持原样）
// v2.8.0: 扩展支持details参数
// ============================================================

/**
 * 发送Telegram告警消息
 * 未配置TELEGRAM_BOT_TOKEN或TELEGRAM_CHAT_ID时静默跳过
 */
async function sendTelegramAlert(env: Env, level: string, message: string, details: Record<string, any> = {}): Promise<void> {
  // 未配置则静默跳过
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;

  const timestamp = new Date().toISOString();
  const emoji = level === 'P0' ? '🔴' : level === 'P1' ? '🟡' : level === 'TEST' ? '🧪' : '🔵';
  const detailLines = Object.entries(details).map(([k, v]) => `  ${k}: ${v}`).join('\n');

  const text = [
    `${emoji} Fly Attribution ${level} Alert`,
    ``,
    message,
    detailLines ? `\n${detailLines}` : '',
    ``,
    `⏰ ${timestamp}`,
    `📦 v2.9.0`,
  ].join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
    });
  } catch (e) {
    // Telegram发送失败静默忽略，不影响其他通道
  }
}

// ============================================================
// v2.8.0: 邮件告警 — Resend API（免费3000封/月）
// ============================================================

/**
 * 通过Resend API发送邮件告警
 * 未配置RESEND_API_KEY或ALERT_EMAIL_TO时静默跳过
 * 发送地址：onboarding@resend.dev（Resend免费默认）
 */
async function sendEmailAlert(env: Env, level: string, message: string, details: Record<string, any> = {}): Promise<void> {
  // 未配置则静默跳过
  if (!env.RESEND_API_KEY || !env.ALERT_EMAIL_TO) return;

  const timestamp = new Date().toISOString();
  const subject = `[Fly Attribution ${level}] ${message.slice(0, 80)}`;

  // 纯文本邮件正文
  const textBody = [
    `Fly Attribution Worker 告警通知`,
    `================================`,
    ``,
    `告警级别: ${level}`,
    `时间: ${timestamp}`,
    `Worker版本: v2.9.0`,
    ``,
    `告警内容:`,
    message,
    ``,
    `指标详情:`,
    ...Object.entries(details).map(([k, v]) => `  ${k}: ${v}`),
    ``,
    `---`,
    `此邮件由 Fly Attribution Worker v2.9.0 自动发送`,
    `请勿直接回复`,
  ].join('\n');

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: env.ALERT_EMAIL_TO,
        subject,
        text: textBody,
      }),
    });
  } catch (e) {
    // 邮件发送失败静默忽略，不影响Telegram通道
  }
}

// ============================================================
// v2.8.0: 统一告警入口 — 同时触发Telegram + 邮件
// ============================================================

/**
 * 统一告警触发函数
 * 同时向Telegram和邮件两个通道发送告警
 * 任一通道失败不影响另一通道
 */
async function alertTrigger(env: Env, level: string, message: string, details: Record<string, any> = {}): Promise<void> {
  // 并发发送两个通道，任一失败不影响另一个
  await Promise.allSettled([
    sendTelegramAlert(env, level, message, details),
    sendEmailAlert(env, level, message, details),
  ]);
}

// ============================================================
// v2.8.0: 告警去重 — KV TTL机制
// ============================================================

/** 告警去重窗口（秒） */
const ALERT_DEDUP_TTL = 300; // 5分钟内不重复告警

/**
 * 检查告警是否已被去重（5分钟内已发送过相同key的告警）
 * @returns true=已被去红（不应再发），false=可以发送
 */
async function isAlertDeduped(env: Env, alertKey: string): Promise<boolean> {
  try {
    const existing = await env.FLY_KV.get(`alert:${alertKey}`);
    return existing !== null;
  } catch {
    // KV读取失败时允许告警（宁可重复也不漏告警）
    return false;
  }
}

/**
 * 标记告警已发送（设置5分钟TTL）
 */
async function markAlertSent(env: Env, alertKey: string): Promise<void> {
  try {
    await env.FLY_KV.put(`alert:${alertKey}`, new Date().toISOString(), { expirationTtl: ALERT_DEDUP_TTL });
  } catch {
    // 标记失败不影响告警本身
  }
}

// ============================================================
// v2.8.0: 自动告警条件检查
// ============================================================

/**
 * 检查告警条件并触发告警
 * 在每次请求后异步调用（via ctx.waitUntil）
 * 
 * 告警规则：
 *   - 5xx率 > 10%（至少10个请求）→ P0 告警
 *   - 5xx率 > 3%（至少10个请求）→ P1 告警
 *   - P95延迟 > 3000ms → P1 告警
 */
async function checkAlertConditions(env: Env): Promise<void> {
  try {
    // 获取最近5分钟的聚合指标
    const metrics = await getAggregatedMetrics(env, 5);
    if (!metrics || metrics.total < 10) return; // 至少10个请求才计算

    const errorRate = metrics.s5xx / metrics.total;

    // --- P0: 5xx率 > 10% ---
    if (errorRate > 0.10) {
      if (!(await isAlertDeduped(env, '5xx_critical'))) {
        await markAlertSent(env, '5xx_critical');
        await alertTrigger(env, 'P0',
          `5xx错误率严重: ${(errorRate * 100).toFixed(1)}% (${metrics.s5xx}/${metrics.total})`,
          {
            '5xx_count': metrics.s5xx,
            'total_requests': metrics.total,
            'error_rate': `${(errorRate * 100).toFixed(1)}%`,
            'threshold': '>10%',
            'window': '5min',
          });
      }
    }
    // --- P1: 5xx率 > 3%（但 ≤10%）---
    else if (errorRate > 0.03) {
      if (!(await isAlertDeduped(env, '5xx_warning'))) {
        await markAlertSent(env, '5xx_warning');
        await alertTrigger(env, 'P1',
          `5xx错误率偏高: ${(errorRate * 100).toFixed(1)}% (${metrics.s5xx}/${metrics.total})`,
          {
            '5xx_count': metrics.s5xx,
            'total_requests': metrics.total,
            'error_rate': `${(errorRate * 100).toFixed(1)}%`,
            'threshold': '>3%',
            'window': '5min',
          });
      }
    }

    // --- P1: P95延迟 > 3000ms ---
    if (metrics.p95_ms > 3000) {
      if (!(await isAlertDeduped(env, 'p95_high'))) {
        await markAlertSent(env, 'p95_high');
        await alertTrigger(env, 'P1',
          `P95延迟过高: ${metrics.p95_ms}ms`,
          {
            'p95_ms': metrics.p95_ms,
            'avg_ms': metrics.avg_ms,
            'max_ms': metrics.max_ms,
            'threshold': '>3000ms',
            'window': '5min',
          });
      }
    }
  } catch (e) {
    // 告警检查失败不影响主流程
  }
}

// ============================================================
// Router — v2.8.0 增加指标采集和自动告警
// ============================================================
// === Schema Migration Gate（KV一次性锁，禁止进 request hot path 重复执行） ===
async function ensureSchemaOnce(env: Env): Promise<void> {
  const done = await env.FLY_KV.get('migration:attribution:v3');
  if (done === 'true') return;
  await ensureAttributionTable(env);
  await env.FLY_KV.put('migration:attribution:v3', 'true');
}

// === 辅助函数：确保 attribution_payloads 表结构完整（含 ALTER TABLE 扩展字段） ===
async function ensureAttributionTable(env: Env): Promise<void> {
  // 创建基础表
  await env.FLY_D1.prepare(`
    CREATE TABLE IF NOT EXISTS attribution_payloads (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      payload_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      attribution_status TEXT,
      worker_status TEXT DEFAULT 'received',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // ALTER TABLE 添加 v3.0.0 扩展字段（字段已存在时忽略错误）
  const alterStatements = [
    "ALTER TABLE attribution_payloads ADD COLUMN status TEXT DEFAULT 'CREATED'",
    "ALTER TABLE attribution_payloads ADD COLUMN failure_reason TEXT",
    "ALTER TABLE attribution_payloads ADD COLUMN retry_cursor TEXT",
    "ALTER TABLE attribution_payloads ADD COLUMN nonce TEXT",
    "ALTER TABLE attribution_payloads ADD COLUMN payload_timestamp TEXT",
    "ALTER TABLE attribution_payloads ADD COLUMN signature TEXT",
    "ALTER TABLE attribution_payloads ADD COLUMN legacy_result TEXT",
    "ALTER TABLE attribution_payloads ADD COLUMN shadow_result TEXT",
    "ALTER TABLE attribution_payloads ADD COLUMN verification_result TEXT",
    "ALTER TABLE attribution_payloads ADD COLUMN processing_lock TEXT",
    "ALTER TABLE attribution_payloads ADD COLUMN lock_expire_at TEXT",
    "ALTER TABLE attribution_payloads ADD COLUMN verification_id TEXT",
    "ALTER TABLE attribution_payloads ADD COLUMN settled_at TEXT",
    "ALTER TABLE attribution_payloads ADD COLUMN delta_score REAL",
    "ALTER TABLE attribution_payloads ADD COLUMN calibration_status TEXT DEFAULT 'PENDING'",
    "ALTER TABLE attribution_payloads ADD COLUMN settled_amount REAL",
    "ALTER TABLE attribution_payloads ADD COLUMN gmv_amount REAL",
    "ALTER TABLE attribution_payloads ADD COLUMN attribution_weight REAL DEFAULT 1.0",
    "ALTER TABLE attribution_payloads ADD COLUMN currency TEXT DEFAULT 'CNY'",
    "ALTER TABLE attribution_payloads ADD COLUMN settlement_method TEXT DEFAULT 'auto'",
    "ALTER TABLE attribution_payloads ADD COLUMN business_event_id TEXT",
  ];
  for (const sql of alterStatements) {
    try {
      await env.FLY_D1.prepare(sql).run();
    } catch {
      // 字段已存在，忽略错误
    }
  }
}


export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    await ensureSchemaOnce(env);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Fly-Signature, X-Fly-Timestamp' } });
    }

    // v2.8.0: 记录请求开始时间
    const startTime = Date.now();

    // 执行路由处理（保持原有路由代码不变）
    const response = await (async () => {
      try {
        // === Health（v2.8.0: 增加D1/KV健康状态） ===
        if (path === '/v1/health' && method === 'GET') {
          let dbStatus = 'ok';
          let kvStatus = 'ok';
          try {
            await env.FLY_D1.prepare("SELECT 1").first();
          } catch { dbStatus = 'error'; }
          try {
            await env.FLY_KV.put('__health_check', '1', { expirationTtl: 60 });
            const v = await env.FLY_KV.get('__health_check');
            if (v !== '1') kvStatus = 'error';
          } catch { kvStatus = 'error'; }
          const status = dbStatus === 'ok' && kvStatus === 'ok' ? 'ok' : 'degraded';
          return json({ status, version: 'v3.0.0', layers: 5, boundary: 'Payment/Clearing — Fly不进入', db: dbStatus, kv: kvStatus, bridge: 'attribution_payloads', event_sourced: true, timestamp: new Date().toISOString() });
        }

        // === Internal: 手动触发 queue consumer（调试用） ===
        if (path === '/internal/trigger-queue' && method === 'POST') {
          const before = await env.FLY_D1.prepare("SELECT COUNT(*) as cnt FROM job_queue WHERE status = 'PENDING'").first();
          await processJobQueue(env);
          const after = await env.FLY_D1.prepare("SELECT COUNT(*) as cnt FROM job_queue WHERE status = 'PENDING'").first();
          return json({ success: true, before_pending: (before as any)?.cnt, after_pending: (after as any)?.cnt, triggered_at: new Date().toISOString() });
        }

        // === 漏洞1：Agent注册 + 身份验证（Public Endpoint，无需鉴权） ===
        if (path === '/v1/agents' && method === 'POST') {
          const body: any = await request.json();
          const agentId = `agt_${crypto.randomUUID()}`;
          const apiKey = `fly_${crypto.randomUUID().replace(/-/g, '')}`;
          await env.FLY_D1.prepare("INSERT INTO agents (id, owner_id, provider, runtime, version, trust_score, verification_level) VALUES (?, ?, ?, ?, ?, 50.0, 'L0')").bind(agentId, body.owner_id || 'usr_owner', body.provider || body.name || 'default', body.runtime || 'cloudflare', body.version || '1.0').run();
          // 写入agent_auth，api_key作为public_key存储
          await env.FLY_D1.prepare("INSERT INTO agent_auth (agent_id, public_key, signature, verified) VALUES (?, ?, ?, 1)").bind(agentId, apiKey, 'auto-generated').run();
          await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'agent', entity_id: agentId, action: 'created', actor_type: 'user', actor_id: body.owner_id || 'usr_owner', actor_name: body.owner_name || body.name || 'owner', source: 'api', reason: 'agent_registered', before: '{}', after: JSON.stringify({ agent_id: agentId, provider: body.provider || body.name }) });
          return json({ success: true, agent_id: agentId, api_key: apiKey, verification_level: 'L0', trust_score: 50.0 }, 201);
        }

        // === Agent查询 ===
        if (path.startsWith('/v1/agents/') && !path.includes('recalc-trust') && method === 'GET') {
          const id = path.split('/v1/agents/')[1];
          const agent = await env.FLY_D1.prepare("SELECT * FROM agents WHERE id = ?").bind(id).first();
          if (!agent) return json({ error: "not found" }, 404);
          const authRow = await env.FLY_D1.prepare("SELECT * FROM agent_auth WHERE agent_id = ?").bind(id).first();
          return json({ agent, auth: authRow || null });
        }

        // === 漏洞2+3：创建Action Signal ===
        if (path === '/v1/action' && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const body: any = await request.json();
          // 漏洞3：HMAC伪匿名
          if (body.user_id) body.user_id = await hmacUserId(body.user_id, env.IP_SALT || 'fly-attribution-salt-2026');
          const validTypes: SignalType[] = ["impression", "click", "consult", "booking", "deal"];
          if (!validTypes.includes(body.signal_type)) return json({ error: "invalid signal_type" }, 400);
          const validChannels = ["douyin", "xiaohongshu", "wechat", "meituan", "feishu", "geo", "direct"];
          if (!validChannels.includes(body.channel)) return json({ error: "invalid channel" }, 400);
          // 24h去重
          const existing = await env.FLY_D1.prepare("SELECT id FROM actions WHERE user_id = ? AND agent_id = ? AND channel = ? AND signal_type = ? AND created_at > datetime('now', '-24 hours') LIMIT 1").bind(body.user_id || "anonymous", body.agent_id ?? null, body.channel ?? null, body.signal_type ?? null).first();
          if (existing) return json({ success: true, action_id: existing.id, dedup: true });
          const actionId = `act_${crypto.randomUUID()}`;
          const metadata: any = body.metadata || {};
          metadata.signal_quality = body.signal_quality || "raw";
          metadata.human_score = body.human_score || 0;
          await env.FLY_D1.prepare("INSERT INTO actions (id, agent_id, channel, user_id, signal_type, short_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))").bind(actionId, body.agent_id ?? null, body.channel ?? null, body.user_id || "anonymous", body.signal_type ?? null, body.short_id || null, JSON.stringify(metadata)).run();
          await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'action', entity_id: actionId, action: 'created', actor_type: 'system', actor_id: 'sys_api', actor_name: 'api-gateway', source: 'api', reason: 'action_created', before: '{}', after: JSON.stringify({ action_id: actionId, signal_type: body.signal_type, signal_quality: metadata.signal_quality }) });
          return json({ success: true, action_id: actionId, signal_quality: metadata.signal_quality }, 201);
        }

        // === 查询Action状态 ===
        if (path.startsWith('/v1/status/') && method === 'GET') {
          const actionId = path.split('/v1/status/')[1];
          const action = await env.FLY_D1.prepare("SELECT * FROM actions WHERE id = ?").bind(actionId).first();
          if (!action) return json({ error: "not found" }, 404);
          const verifications = await env.FLY_D1.prepare("SELECT * FROM verifications WHERE action_id = ? ORDER BY created_at DESC").bind(actionId).all();
          const attributions = await env.FLY_D1.prepare("SELECT * FROM attributions WHERE action_id = ? ORDER BY created_at DESC").bind(actionId).all();
          return json({ action, verifications: verifications.results, attributions: attributions.results });
        }

        // === 漏洞4：Trust Score多维计算 ===
        if (path.includes('/recalc-trust') && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const agentId = path.split('/v1/agents/')[1]?.replace('/recalc-trust', '');
          const body: any = await request.json().catch(() => ({}));
          const callerType = body.caller_type || 'human';
          const callerId = body.caller_id || 'usr_owner';
          const roles = await getPrincipalRoles(env, callerType, callerId);
          const hasTrustPerm = roles.some(r => (RolePermissions[r] || []).includes("trust:recalculate"));
          if (!hasTrustPerm) return json({ error: "forbidden: no trust:recalculate permission", roles }, 403);
          const agent = await env.FLY_D1.prepare("SELECT * FROM agents WHERE id = ?").bind(agentId).first();
          if (!agent) return json({ error: "agent not found" }, 404);
          const oldScore = agent.trust_score as number;
          const uniqueUsers = await env.FLY_D1.prepare("SELECT COUNT(DISTINCT user_id) as cnt FROM actions WHERE agent_id = ?").bind(agentId).first();
          const channelDiv = await env.FLY_D1.prepare("SELECT COUNT(DISTINCT channel) as cnt FROM actions WHERE agent_id = ?").bind(agentId).first();
          const verifSources = await env.FLY_D1.prepare("SELECT COUNT(DISTINCT verifier) as cnt FROM verifications v JOIN actions a ON v.action_id = a.id WHERE a.agent_id = ?").bind(agentId).first();
          const timeSpan = await env.FLY_D1.prepare("SELECT CAST(julianday('now') - julianday(MIN(created_at)) AS INTEGER) as days FROM actions WHERE agent_id = ?").bind(agentId).first();
          const u = (uniqueUsers?.cnt as number) || 0;
          const ch = (channelDiv?.cnt as number) || 0;
          const vs = (verifSources?.cnt as number) || 0;
          const ts = (timeSpan?.days as number) || 0;
          let newScore = 50 + Math.min(u * 2, 20) + Math.min(ch * 5, 10) + Math.min(vs * 5, 10) + Math.min(ts, 10);
          newScore = Math.min(newScore, 100);
          await env.FLY_D1.prepare("UPDATE agents SET trust_score = ?, updated_at = datetime('now') WHERE id = ?").bind(newScore, agentId).run();
          await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'agent', entity_id: agentId, action: 'updated', actor_type: callerType as ActorType, actor_id: callerId, actor_name: body.caller_name || callerId, source: 'api', reason: 'trust_recalculated', before: JSON.stringify({ trust_score: oldScore }), after: JSON.stringify({ trust_score: newScore, factors: { unique_users: u, channel_diversity: ch, verification_sources: vs, time_span_days: ts } }) });
          return json({ agent_id: agentId, trust_score: { before: oldScore, after: newScore }, factors: { unique_users: u, channel_diversity: ch, verification_sources: vs, time_span_days: ts } });
        }

        // === 漏洞5：Verification三方分离 ===
        if (path === '/v1/verifications' && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const body: any = await request.json();
          // 铁律1：verifier ≠ subject（只有当字段都存在时才比较，避免 undefined===undefined）
          if (body.verifier && body.subject && body.verifier === body.subject) {
            return json({ error: "verification rejected: verifier cannot be the same as subject (self-verification forbidden)" }, 403);
          }
          if (body.verifier_id && body.subject_id && body.verifier_id === body.subject_id) {
            return json({ error: "verification rejected: verifier_id cannot be the same as subject_id (self-verification forbidden)" }, 403);
          }
          // 铁律2：verifier_id必须非空
          if (!body.verifier_id || body.verifier_id.length === 0) return json({ error: "verification rejected: verifier_id is required" }, 400);
          // 铁律3：evidence必须非空
          if (!body.evidence || !Array.isArray(body.evidence) || body.evidence.length === 0) return json({ error: "verification rejected: evidence is required" }, 400);
          // 铁律4：L2+需要audit/external
          const verifierType: VerifierType = body.verifier_type || 'system';
          if (body.target_level && ['L2', 'L3', 'L4'].includes(body.target_level) && verifierType !== 'audit' && verifierType !== 'external') {
            return json({ error: "verification rejected: L2+ requires audit or external verifier" }, 403);
          }
          const verificationId = `vrf_${crypto.randomUUID()}`;
          await env.FLY_D1.prepare("INSERT INTO verifications (id, action_id, verifier, result, confidence, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").bind(verificationId, body.action_id ?? null, body.verifier ?? null, body.result || 'pending', body.confidence || 0, JSON.stringify(body.evidence || [])).run();
          await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'verification', entity_id: verificationId, action: 'created', actor_type: verifierType === 'system' ? 'system' : 'user', actor_id: body.verifier_id, actor_name: body.verifier_name || body.verifier, source: 'api', reason: 'verification_created', before: '{}', after: JSON.stringify({ verification_id: verificationId, verifier: body.verifier, verifier_type: verifierType, result: body.result }) });
          return json({ success: true, verification_id: verificationId, verifier_type: verifierType, rules_checked: ["self_verification_blocked", "verifier_id_required", "evidence_required", "L2_source_check"] }, 201);
        }

        // === 漏洞6：短链Bot检测 ===
        if (path.startsWith('/s/') && method === 'GET') {
          const actionId = path.split('/s/')[1];
          const clientIP = (request.headers.get('CF-Connecting-IP') || 'unknown').slice(0, 40);
          const userAgent = request.headers.get('User-Agent') || '';
          // IP限流
          const rateLimitKey = `ratelimit:${clientIP}`;
          const currentCount = await env.FLY_KV.get(rateLimitKey);
          if (currentCount && parseInt(currentCount) >= 10) return Response.redirect('https://fly-agent.xyz', 302);
          await env.FLY_KV.put(rateLimitKey, (parseInt(currentCount || '0') + 1).toString(), { expirationTtl: 60 });
          const botResult = detectBot(userAgent);
          const signalQuality = determineSignalQuality(0, botResult.isBot);
          const action = await env.FLY_D1.prepare("SELECT * FROM actions WHERE id = ? OR short_id = ?").bind(actionId, actionId).first();
          if (action) {
            // 只有action存在时才记录click（避免外键约束失败）
            const ipHash = await hmacUserId(clientIP, env.IP_SALT || 'fly-attribution-salt-2026');
            await env.FLY_D1.prepare("INSERT INTO actions (id, agent_id, channel, user_id, signal_type, short_id, metadata, created_at) VALUES (?, ?, ?, ?, 'click', ?, ?, datetime('now'))").bind(`act_${crypto.randomUUID()}`, action.agent_id, action.channel, ipHash, actionId, JSON.stringify({ referrer: request.headers.get('Referer') || '', ua: userAgent.slice(0, 200), signal_quality: signalQuality, bot_name: botResult.botName || null, human_score: 0 })).run();
          }
          return Response.redirect('https://fly-agent.xyz', 302);
        }

        // === 漏洞6：信号质量升级 ===
        if (path === '/v1/signal/verify' && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const body: any = await request.json();
          if (!body.action_id) return json({ error: "action_id is required" }, 400);
          const action = await env.FLY_D1.prepare("SELECT * FROM actions WHERE id = ?").bind(body.action_id).first();
          if (!action) return json({ error: "not found" }, 404);
          let hs = 0;
          if (body.has_cookie) hs += 20;
          if (body.js_executed) hs += 30;
          if (body.stay_seconds >= 3) hs += 20;
          const nq = determineSignalQuality(hs, false);
          const om = JSON.parse((action.metadata as string) || '{}');
          const nm = { ...om, signal_quality: nq, human_score: hs };
          await env.FLY_D1.prepare("UPDATE actions SET metadata = ? WHERE id = ?").bind(JSON.stringify(nm), body.action_id).run();
          return json({ action_id: body.action_id, signal_quality: nq, human_score: hs });
        }

        // === v3.0.2: Dashboard数据端点 ===
        if (path === '/dashboard' && method === 'GET') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const version = 'v3.0.2';
          const tables = ['agents', 'actions', 'verifications', 'audit_events', 'role_assignments', 'policies'];
          const counts: Record<string, number> = {};
          let totalRecords = 0;
          for (const table of tables) {
            try {
              const result = await env.FLY_D1.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).first();
              const count = (result?.cnt as number) || 0;
              counts[table] = count;
              totalRecords += count;
            } catch { counts[table] = -1; }
          }
          const latestAudit = await env.FLY_D1.prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 1").first();
          return json({
            version, timestamp: new Date().toISOString(), db: 'ok', kv: 'ok',
            tables: counts, total_records: totalRecords,
            latest_activity: latestAudit ? { event: latestAudit.action, entity: latestAudit.entity_type, at: latestAudit.created_at } : null
          });
        }

        // === v3.0.2: 全局审计链验证 ===
        if (path === '/v1/audit/verify-chain' && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const body: any = await request.json().catch(() => ({}));
          const limit = Math.min(parseInt(body.limit || '1000'), 5000);
          const events = await env.FLY_D1.prepare("SELECT * FROM audit_events ORDER BY created_at ASC LIMIT ?").bind(limit).all();
          let chainValid = true;
          let brokenAt: any = null;
          for (const evt of events.results as any[]) {
            const hashInput = `${evt.prev_hash}${evt.event_id}${evt.entity_type}${evt.entity_id}${evt.action}${evt.actor_id}${evt.created_at}`;
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput));
            const expected = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            if (evt.event_hash !== expected) {
              chainValid = false;
              brokenAt = { event_id: evt.event_id, expected, actual: evt.event_hash };
              break;
            }
          }
          return json({ chain_valid: chainValid, total_events: events.results.length, checked: chainValid ? events.results.length : (events.results as any[]).findIndex((e: any) => e.event_id === brokenAt?.event_id) + 1, broken_at: brokenAt });
        }

        // === 漏洞7：审计链查询 ===
        if (path.startsWith('/v1/audit/') && method === 'GET') {
          const parts = path.split('/v1/audit/')[1].split('/');
          const rawEntityType = parts[0];
          const entityId = parts[1];
          // URL用复数（agents/actions），数据库存单数（agent/action），统一映射
          const entityTypeMap: Record<string, string> = { agents: 'agent', actions: 'action', verifications: 'verification', role_assignments: 'role_assignment', policies: 'policy' };
          const entityType = entityTypeMap[rawEntityType] || rawEntityType.replace(/s$/, '');
          const events = await env.FLY_D1.prepare("SELECT * FROM audit_events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC").bind(entityType, entityId).all();
          // 验证每条记录自身的event_hash是否基于其prev_hash正确计算
          let chainValid = true;
          for (const evt of events.results as any[]) {
            const hashInput = `${evt.prev_hash}${evt.event_id}${evt.entity_type}${evt.entity_id}${evt.action}${evt.actor_id}${evt.created_at}`;
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput));
            const expected = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            if (evt.event_hash !== expected) { chainValid = false; break; }
          }
          return json({ entity_type: entityType, entity_id: entityId, events: events.results, chain_valid: chainValid, total_events: events.results.length });
        }

        // === 漏洞8：角色授权 ===
        if (path === '/v1/governance/assign-role' && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const body: any = await request.json();
          const callerRoles = await getPrincipalRoles(env, "human", body.caller_id || "usr_owner");
          if (!callerRoles.includes("owner")) return json({ error: "only owner can assign roles" }, 403);
          const validRoles = ["owner", "operator", "verifier", "auditor"];
          const validTypes = ["human", "agent", "system"];
          if (!validRoles.includes(body.role)) return json({ error: "invalid role" }, 400);
          if (!validTypes.includes(body.principal_type)) return json({ error: "invalid principal_type" }, 400);
          const existing = await env.FLY_D1.prepare("SELECT id FROM role_assignments WHERE principal_type = ? AND principal_id = ? AND role = ? AND resource_type = ?").bind(body.principal_type, body.principal_id, body.role, body.resource_type).first();
          if (existing) return json({ error: "role already assigned" }, 409);
          const assignmentId = `ra_${crypto.randomUUID()}`;
          await env.FLY_D1.prepare("INSERT INTO role_assignments (id, principal_type, principal_id, role, resource_type, resource_id, granted_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))").bind(assignmentId, body.principal_type, body.principal_id, body.role, body.resource_type, body.resource_id || null, body.caller_id || "usr_owner").run();
          await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'role_assignment', entity_id: assignmentId, action: 'created', actor_type: 'user', actor_id: body.caller_id || "usr_owner", actor_name: body.caller_name || "owner", source: 'api', reason: 'role_assigned', before: '{}', after: JSON.stringify({ principal_type: body.principal_type, principal_id: body.principal_id, role: body.role }) });
          return json({ assignment_id: assignmentId, principal_type: body.principal_type, principal_id: body.principal_id, role: body.role, permissions: RolePermissions[body.role] }, 201);
        }

        // === 漏洞8：权限检查 ===
        if (path === '/v1/governance/check-permission' && method === 'POST') {
          const body: any = await request.json();
          const roles = await getPrincipalRoles(env, body.principal_type || 'human', body.principal_id);
          if (roles.length === 0) return json({ allowed: false, reason: "no roles assigned (default deny)" }, 403);
          const permission = body.permission as Permission;
          const matching = roles.filter(r => (RolePermissions[r] || []).includes(permission));
          if (matching.length === 0) return json({ allowed: false, reason: `no role grants permission: ${permission}`, roles }, 403);
          return json({ allowed: true, roles, matching_roles: matching, permission });
        }

        // === 漏洞8：策略更新 ===
        if (path === '/v1/governance/update-policy' && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const body: any = await request.json();
          const callerRoles = await getPrincipalRoles(env, "human", body.caller_id || "usr_owner");
          if (!callerRoles.includes("owner")) return json({ error: "only owner can update policies" }, 403);
          const oldPolicy = await env.FLY_D1.prepare("SELECT * FROM policies WHERE id = ?").bind(body.policy_id).first();
          if (!oldPolicy) return json({ error: "policy not found" }, 404);
          const newRules = body.rules || JSON.parse(oldPolicy.rules as string);
          await env.FLY_D1.prepare("UPDATE policies SET name = ?, description = ?, rules = ?, updated_at = datetime('now') WHERE id = ?").bind(body.name || oldPolicy.name, body.description || oldPolicy.description, JSON.stringify(newRules), body.policy_id).run();
          await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'policy', entity_id: body.policy_id, action: 'updated', actor_type: 'user', actor_id: body.caller_id || "usr_owner", actor_name: body.caller_name || "owner", source: 'api', reason: 'policy_updated', before: oldPolicy.rules as string, after: JSON.stringify(newRules) });
          return json({ policy_id: body.policy_id, updated: true });
        }

        // === 验收辅助查询 ===
        if (path === '/v1/db/query' && method === 'GET') {
          const type = url.searchParams.get('type');
          const limit = parseInt(url.searchParams.get('limit') || '10');
          if (type === 'actions') { const r = await env.FLY_D1.prepare("SELECT * FROM actions ORDER BY created_at DESC LIMIT ?").bind(limit).all(); return json(r); }
          if (type === 'agents') { const r = await env.FLY_D1.prepare("SELECT * FROM agents ORDER BY created_at DESC LIMIT ?").bind(limit).all(); return json(r); }
          if (type === 'verifications') { const r = await env.FLY_D1.prepare("SELECT * FROM verifications ORDER BY created_at DESC LIMIT ?").bind(limit).all(); return json(r); }
          if (type === 'audit') { const r = await env.FLY_D1.prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?").bind(limit).all(); return json(r); }
          if (type === 'roles') { const r = await env.FLY_D1.prepare("SELECT * FROM role_assignments ORDER BY created_at DESC LIMIT ?").bind(limit).all(); return json(r); }
          if (type === 'policies') { const r = await env.FLY_D1.prepare("SELECT * FROM policies").all(); return json(r); }
          return json({ error: "unknown type. Use: actions, agents, verifications, audit, roles, policies" }, 400);
        }

        // ============================================================
        // v2.7.0: Admin 管理端点
        // ============================================================

        // === 指标聚合查询 ===
        if (path === '/v1/admin/metrics' && method === 'GET') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const minutes = Math.min(parseInt(url.searchParams.get('minutes') || '5'), 60);
          const metrics = await getAggregatedMetrics(env, minutes);
          if (!metrics) {
            return json({ requests: { total: 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 }, latency: { avg_ms: 0, max_ms: 0, p95_ms: 0 }, window_minutes: minutes });
          }
          return json({
            requests: { total: metrics.total, '2xx': metrics.s2xx, '3xx': metrics.s3xx, '4xx': metrics.s4xx, '5xx': metrics.s5xx },
            latency: { avg_ms: metrics.avg_ms, max_ms: metrics.max_ms, p95_ms: metrics.p95_ms },
            window_minutes: minutes,
          });
        }

        // === 告警测试 ===
        if (path === '/v1/admin/alert/test' && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          await alertTrigger(env, 'TEST', '告警测试 - 这是一个测试告警', { trigger: 'manual', version: 'v2.9.0' });
          return json({ success: true, message: 'Test alert sent to all configured channels', channels: { telegram: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID), email: !!(env.RESEND_API_KEY && env.ALERT_EMAIL_TO) } });
        }

        // === 触发备份 ===
        if (path === '/v1/admin/backup' && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const backupId = `bak_${crypto.randomUUID()}`;
          const timestamp = new Date().toISOString();
          // 统计各表记录数
          const tables = ['agents', 'actions', 'verifications', 'audit_events', 'role_assignments', 'policies'];
          let totalRecords = 0;
          const tableCounts: Record<string, number> = {};
          for (const table of tables) {
            try {
              const result = await env.FLY_D1.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).first();
              const count = (result?.cnt as number) || 0;
              tableCounts[table] = count;
              totalRecords += count;
            } catch {
              tableCounts[table] = -1; // 查询失败标记
            }
          }
          const backup = { backup_id: backupId, timestamp, total_records: totalRecords, tables: tableCounts };
          // 存储备份元数据到KV（保留最近30条）
          const historyKey = 'backups:history';
          const historyRaw = await env.FLY_KV.get(historyKey);
          const history = historyRaw ? JSON.parse(historyRaw) : [];
          history.push(backup);
          if (history.length > 30) history.splice(0, history.length - 30);
          await env.FLY_KV.put(historyKey, JSON.stringify(history));
          return json({ success: true, ...backup });
        }

        // === 备份历史查询 ===
        if (path === '/v1/admin/backup' && method === 'GET') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const historyKey = 'backups:history';
          const historyRaw = await env.FLY_KV.get(historyKey);
          const backups = historyRaw ? JSON.parse(historyRaw) : [];
          return json({ success: true, backups });
        }

        // === v2.9.0: KV写入端点（供GA写入容量数据） ===
        if (path === '/v1/admin/kv' && method === 'PUT') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          try {
            const body: any = await request.json();
            const { key, value } = body;
            if (!key || !value) return json({ error: 'key and value required' }, 400);
            // 只允许写capacity:前缀的key（安全限制）
            if (!key.startsWith('capacity:')) return json({ error: 'only capacity: keys allowed' }, 403);
            await env.FLY_KV.put(key, typeof value === 'string' ? value : JSON.stringify(value), { expirationTtl: 86400 });
            return json({ success: true, key });
          } catch (e: any) {
            return json({ error: e.message }, 400);
          }
        }

        // ============================================================
        // v3.0.0: Event-Sourced Attribution Ledger — 连接 attribution.js ↔ Worker API
        // ============================================================

        // === Layer 1: POST /attribution/ingest — Event Emitter（HMAC签名+Nonce防重放） ===
        if (path === '/attribution/ingest' && method === 'POST') {
          // 1. 验证 Authorization Bearer Token
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);

          // 2. 解析 body
          const body: any = await request.json();
          const { payload, signature, nonce, timestamp, action_id, payload_type, legacy_result } = body;

          // 3. 必填字段校验
          if (!payload || !signature || !nonce || !timestamp || !action_id || !payload_type) {
            return json({ error: 'missing required fields: payload, signature, nonce, timestamp, action_id, payload_type' }, 400);
          }

          // 4. 验证 timestamp 在 ±5分钟内
          const tsMs = new Date(timestamp).getTime();
          const nowMs = Date.now();
          if (Math.abs(nowMs - tsMs) > 5 * 60 * 1000) {
            return json({ error: 'expired timestamp' }, 400);
          }

          // 5. 验证 nonce 未被使用（KV防重放）
          const existingNonce = await env.FLY_KV.get(`nonce:${nonce}`);
          if (existingNonce) {
            return json({ error: 'duplicate nonce' }, 400);
          }

          // 6. HMAC-SHA256 签名验证
          const secret = env.FLY_API_KEY || env.IP_SALT || 'fly-attribution-salt-2026';
          const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
          const sigValid = await verifySignature(payloadStr, signature, nonce, timestamp, secret);
          if (!sigValid) {
            return json({ error: 'invalid signature' }, 401);
          }

          // 7. 确保表结构完整

          // 8. 获取并发锁（如果记录已存在）
          const existing = await env.FLY_D1.prepare(
            "SELECT id FROM attribution_payloads WHERE action_id = ?"
          ).bind(action_id).first();

          if (existing) {
            const locked = await acquireLock(env, action_id);
            if (!locked) {
              return json({ error: 'resource is being processed, try again later' }, 409);
            }
            try {
              // 检查当前状态：禁止状态回退
              const currentRecord = await env.FLY_D1.prepare(
                "SELECT id, status FROM attribution_payloads WHERE action_id = ?"
              ).bind(action_id).first();
              
              const txId = existing.id as string;
              const currentStatus = (currentRecord?.status as string) || 'INGESTED';
              const FINAL_STATES = ['VERIFICATION_COMPLETED', 'SETTLED'];
              
              // 如果已经是终态，不允许回退状态，只更新payload
              if (FINAL_STATES.includes(currentStatus)) {
                const legacyStr = legacy_result ? (typeof legacy_result === 'string' ? legacy_result : JSON.stringify(legacy_result)) : null;
                await env.FLY_D1.prepare(
                  "UPDATE attribution_payloads SET payload_json = ?, nonce = ?, payload_timestamp = ?, signature = ?, legacy_result = ?, updated_at = datetime('now') WHERE id = ?"
                ).bind(payloadStr, nonce, timestamp, signature, legacyStr, txId).run();

                // 写审计链
                await writeAuditEvent(env, {
                  request_id: `req_${crypto.randomUUID()}`,
                  entity_type: 'attribution_payload',
                  entity_id: txId,
                  action: 'payload_updated',
                  actor_type: 'system',
                  actor_id: auth.agentId || 'sys_attribution_bridge',
                  actor_name: 'attribution-bridge',
                  source: 'attribution_js',
                  reason: 'payload_update_no_state_change',
                  before: currentStatus,
                  after: JSON.stringify({ action_id, status: currentStatus, nonce, note: 'state_protected' })
                });

                return json({ success: true, transaction_id: txId, status: currentStatus, note: 'payload_updated_state_protected' });
              }

              // 非终态：允许更新状态为INGESTED，触发pipeline
              const legacyStr = legacy_result ? (typeof legacy_result === 'string' ? legacy_result : JSON.stringify(legacy_result)) : null;
              await env.FLY_D1.prepare(
                "UPDATE attribution_payloads SET payload_json = ?, status = 'INGESTED', nonce = ?, payload_timestamp = ?, signature = ?, worker_status = 'ingested', legacy_result = ?, delta_score = NULL, calibration_status = 'PENDING', updated_at = datetime('now') WHERE id = ?"
              ).bind(payloadStr, nonce, timestamp, signature, legacyStr, txId).run();

              // 写审计链
              await writeAuditEvent(env, {
                request_id: `req_${crypto.randomUUID()}`,
                entity_type: 'attribution_payload',
                entity_id: txId,
                action: 'updated',
                actor_type: 'system',
                actor_id: auth.agentId || 'sys_attribution_bridge',
                actor_name: 'attribution-bridge',
                source: 'attribution_js',
                reason: 'event_re_ingested',
                before: currentStatus,
                after: JSON.stringify({ action_id, status: 'INGESTED', nonce })
              });

              // 写 job_queue（由 cron 消费）
              await env.FLY_D1.prepare(
                "INSERT OR REPLACE INTO job_queue (id, action_id, step, status, created_at, updated_at) VALUES (?, ?, 'SHADOW', 'PENDING', datetime('now'), datetime('now'))"
              ).bind(`job_${crypto.randomUUID()}`, action_id).run();

              // Fast-path trigger: waitUntil 秒级触发，job_queue+cron 兜底
              ctx.waitUntil(processJobQueue(env));

              return json({ success: true, transaction_id: txId, status: 'INGESTED', queued: true });
            } finally {
              await releaseLock(env, action_id);
            }
          }

          // 9. 新建记录
          const txId = `tx_${crypto.randomUUID()}`;
          const legacyStrNew = legacy_result ? (typeof legacy_result === 'string' ? legacy_result : JSON.stringify(legacy_result)) : null;
          await env.FLY_D1.prepare(
            "INSERT INTO attribution_payloads (id, action_id, payload_type, payload_json, status, nonce, payload_timestamp, signature, worker_status, legacy_result) VALUES (?, ?, ?, ?, 'INGESTED', ?, ?, ?, 'ingested', ?)"
          ).bind(txId, action_id, payload_type, payloadStr, nonce, timestamp, signature, legacyStrNew).run();

          // 10. 记录 nonce 到 KV（TTL 600秒 = 10分钟）
          await env.FLY_KV.put(`nonce:${nonce}`, '1', { expirationTtl: 600 });

          // 11. 写审计链
          await writeAuditEvent(env, {
            request_id: `req_${crypto.randomUUID()}`,
            entity_type: 'attribution_payload',
            entity_id: txId,
            action: 'created',
            actor_type: 'system',
            actor_id: auth.agentId || 'sys_attribution_bridge',
            actor_name: 'attribution-bridge',
            source: 'attribution_js',
            reason: 'event_ingested',
            before: '{}',
            after: JSON.stringify({ action_id, payload_type, status: 'INGESTED', nonce })
          });

          // 写 job_queue（由 cron 消费）
          await env.FLY_D1.prepare(
            "INSERT INTO job_queue (id, action_id, step, status, created_at, updated_at) VALUES (?, ?, 'SHADOW', 'PENDING', datetime('now'), datetime('now'))"
          ).bind(`job_${crypto.randomUUID()}`, action_id).run();

          // Fast-path trigger: waitUntil 秒级触发，job_queue+cron 兜底
          ctx.waitUntil(processJobQueue(env));

          return json({ success: true, transaction_id: txId, status: 'INGESTED', queued: true }, 201);
        }

        // === Layer 2: POST /attribution/shadow/:actionId — Shadow归因计算 ===
        if (path.startsWith('/attribution/shadow/') && method === 'POST') {
          const actionId = path.split('/attribution/shadow/')[1];
          if (!actionId) return json({ error: 'action_id is required' }, 400);


          // 获取锁
          const locked = await acquireLock(env, actionId);
          if (!locked) return json({ error: 'resource is being processed, try again later' }, 409);

          try {
            // 从 D1 读取 payload_json
            const record = await env.FLY_D1.prepare(
              "SELECT * FROM attribution_payloads WHERE action_id = ? ORDER BY created_at DESC LIMIT 1"
            ).bind(actionId).first();
            if (!record) return json({ error: 'not found', action_id: actionId }, 404);

            const payload = JSON.parse(record.payload_json as string);
            const shadowResult = runShadowAttribution(payload);

            // 更新 D1
            await env.FLY_D1.prepare(
              "UPDATE attribution_payloads SET shadow_result = ?, status = 'SHADOW_COMPLETED', worker_status = 'shadow_completed' WHERE action_id = ?"
            ).bind(JSON.stringify(shadowResult), actionId).run();

            // 写审计链
            await writeAuditEvent(env, {
              request_id: `req_${crypto.randomUUID()}`,
              entity_type: 'attribution_payload',
              entity_id: record.id as string,
              action: 'status_changed',
              actor_type: 'system',
              actor_id: 'sys_shadow_attribution',
              actor_name: 'shadow-attribution',
              source: 'api',
              reason: 'shadow_calculation_completed',
              before: record.status as string || 'INGESTED',
              after: JSON.stringify({ status: 'SHADOW_COMPLETED', weighted_score: shadowResult.weighted_score })
            });

            return json({ success: true, shadow_result: shadowResult, status: 'SHADOW_COMPLETED' });
          } finally {
            await releaseLock(env, actionId);
          }
        }

        // === Layer 3: POST /attribution/verify/:actionId — Verification验证 ===
        if (path.startsWith('/attribution/verify/') && method === 'POST') {
          const actionId = path.split('/attribution/verify/')[1];
          if (!actionId) return json({ error: 'action_id is required' }, 400);


          // 获取锁
          const locked = await acquireLock(env, actionId);
          if (!locked) return json({ error: 'resource is being processed, try again later' }, 409);

          try {
            // 从 D1 读取 payload_json 和 shadow_result
            const record = await env.FLY_D1.prepare(
              "SELECT * FROM attribution_payloads WHERE action_id = ? ORDER BY created_at DESC LIMIT 1"
            ).bind(actionId).first();
            if (!record) return json({ error: 'not found', action_id: actionId }, 404);

            const payload = JSON.parse(record.payload_json as string);
            const shadowResult = record.shadow_result ? JSON.parse(record.shadow_result as string) : null;

            // 调用验证纯函数
            const verificationResult = runVerification(payload, shadowResult);

            // 生成 verification_id
            const verificationId = `vrf_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

            // 更新 D1
            await env.FLY_D1.prepare(
              "UPDATE attribution_payloads SET verification_result = ?, verification_id = ?, status = 'VERIFICATION_COMPLETED', worker_status = 'verification_completed' WHERE action_id = ?"
            ).bind(JSON.stringify(verificationResult), verificationId, actionId).run();

            // 写审计链
            await writeAuditEvent(env, {
              request_id: `req_${crypto.randomUUID()}`,
              entity_type: 'attribution_payload',
              entity_id: record.id as string,
              action: 'verified',
              actor_type: 'system',
              actor_id: 'sys_verification',
              actor_name: 'verification-engine',
              source: 'api',
              reason: 'verification_completed',
              before: record.status as string || 'SHADOW_COMPLETED',
              after: JSON.stringify({ status: 'VERIFICATION_COMPLETED', verification_id: verificationId, verification_status: verificationResult.status })
            });

            return json({ success: true, verification_result: verificationResult, verification_id: verificationId, status: 'VERIFICATION_COMPLETED' });
          } finally {
            await releaseLock(env, actionId);
          }
        }

        // === POST /attribution/replay/:actionId — 强制重新验证（忽略已有状态） ===
        if (path.startsWith('/attribution/replay/') && method === 'POST') {
          const actionId = path.split('/attribution/replay/')[1];
          if (!actionId) return json({ error: 'action_id is required' }, 400);


          // 获取锁
          const locked = await acquireLock(env, actionId);
          if (!locked) return json({ error: 'resource is being processed, try again later' }, 409);

          try {
            // 从 D1 读取 payload_json 和 shadow_result（强制重新计算）
            const record = await env.FLY_D1.prepare(
              "SELECT * FROM attribution_payloads WHERE action_id = ? ORDER BY created_at DESC LIMIT 1"
            ).bind(actionId).first();
            if (!record) return json({ error: 'not found', action_id: actionId }, 404);

            const payload = JSON.parse(record.payload_json as string);
            const shadowResult = record.shadow_result ? JSON.parse(record.shadow_result as string) : null;

            // 调用验证纯函数（强制重新计算，不管之前状态）
            const verificationResult = runVerification(payload, shadowResult);

            // 生成新的 verification_id
            const verificationId = `vrf_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

            // 更新 D1（强制覆盖，不管之前状态）
            await env.FLY_D1.prepare(
              "UPDATE attribution_payloads SET verification_result = ?, verification_id = ?, status = 'VERIFICATION_COMPLETED', worker_status = 'replay_completed', failure_reason = NULL WHERE action_id = ?"
            ).bind(JSON.stringify(verificationResult), verificationId, actionId).run();

            // 写审计链
            await writeAuditEvent(env, {
              request_id: `req_${crypto.randomUUID()}`,
              entity_type: 'attribution_payload',
              entity_id: record.id as string,
              action: 'status_changed',
              actor_type: 'system',
              actor_id: 'sys_replay',
              actor_name: 'replay-engine',
              source: 'api',
              reason: 'forced_replay_verification',
              before: record.status as string || 'UNKNOWN',
              after: JSON.stringify({ status: 'VERIFICATION_COMPLETED', verification_id: verificationId, verification_status: verificationResult.status, replay: true })
            });

            return json({ success: true, verification_result: verificationResult, verification_id: verificationId, status: 'VERIFICATION_COMPLETED' });
          } finally {
            await releaseLock(env, actionId);
          }
        }

        // === Layer 4: POST /attribution/settle/:actionId — 结算 ===
        if (path.startsWith('/attribution/settle/') && method === 'POST') {
          const actionId = path.split('/attribution/settle/')[1];
          if (!actionId) return json({ error: 'action_id is required' }, 400);


          // 获取锁
          const locked = await acquireLock(env, actionId);
          if (!locked) return json({ error: 'resource is being processed, try again later' }, 409);

          try {
            // 从 D1 读取当前状态
            const record = await env.FLY_D1.prepare(
              "SELECT * FROM attribution_payloads WHERE action_id = ? ORDER BY created_at DESC LIMIT 1"
            ).bind(actionId).first();
            if (!record) return json({ error: 'not found', action_id: actionId }, 404);

            // 检查 status 必须是 'VERIFICATION_COMPLETED'
            if (record.status !== 'VERIFICATION_COMPLETED') {
              return json({ error: `cannot settle: status is '${record.status}', expected 'VERIFICATION_COMPLETED'` }, 409);
            }

            // 检查 verification_result 中 status 必须是 'pass'
            if (!record.verification_result) {
              return json({ error: 'cannot settle: no verification_result found' }, 409);
            }
            const verResult = JSON.parse(record.verification_result as string);
            if (verResult.status !== 'pass') {
              return json({ error: `cannot settle: verification status is '${verResult.status}', expected 'pass'` }, 409);
            }

            // 从 payload_json 提取 GMV
            const payload = JSON.parse(record.payload_json as string);
            const gmvAmount = payload.gmv ?? 0;
            const attributionWeight = 1.0; // 当前单touch，权重固定为1
            const settledAmount = gmvAmount * attributionWeight;

            // 生成业务事件ID（唯一标识结算记录）
            const businessEventId = `settle_${crypto.randomUUID()}`;

            // 更新 D1：结算（append-only 记录）
            const settledAt = new Date().toISOString();
            await env.FLY_D1.prepare(
              "UPDATE attribution_payloads SET status = 'SETTLED', settled_at = ?, worker_status = 'settled', settled_amount = ?, gmv_amount = ?, attribution_weight = ?, currency = 'CNY', settlement_method = 'auto', business_event_id = ? WHERE action_id = ?"
            ).bind(settledAt, settledAmount, gmvAmount, attributionWeight, businessEventId, actionId).run();

            // 写审计链
            await writeAuditEvent(env, {
              request_id: `req_${crypto.randomUUID()}`,
              entity_type: 'attribution_payload',
              entity_id: record.id as string,
              action: 'confirmed',
              actor_type: 'system',
              actor_id: 'sys_settlement',
              actor_name: 'settlement-engine',
              source: 'api',
              reason: 'attribution_settled',
              before: 'VERIFICATION_COMPLETED',
              after: JSON.stringify({ 
                status: 'SETTLED', 
                settled_at: settledAt, 
                verification_id: record.verification_id,
                settled_amount: settledAmount,
                gmv_amount: gmvAmount,
                attribution_weight: attributionWeight,
                business_event_id: businessEventId
              })
            });

            return json({ 
              success: true, 
              status: 'SETTLED', 
              settled_at: settledAt,
              settled_amount: settledAmount,
              gmv_amount: gmvAmount,
              attribution_weight: attributionWeight,
              currency: 'CNY',
              business_event_id: businessEventId
            });
          } finally {
            await releaseLock(env, actionId);
          }
        }

        // === GET /attribution/settlements — 查询所有已结算记录（审计用） ===
        if (path === '/attribution/settlements' && method === 'GET') {
          const limit = parseInt(url.searchParams.get('limit') || '50');
          const statusFilter = url.searchParams.get('status') || 'SETTLED';
          
          const results = await env.FLY_D1.prepare(
            `SELECT id, action_id, settled_at, settled_amount, gmv_amount, attribution_weight, 
                    currency, settlement_method, business_event_id, verification_id, created_at
             FROM attribution_payloads 
             WHERE status = ? 
             ORDER BY settled_at DESC 
             LIMIT ?`
          ).bind(statusFilter, limit).all();
          
          // 计算汇总
          let totalSettled = 0;
          let totalGMV = 0;
          for (const record of results.results as any[]) {
            totalSettled += record.settled_amount || 0;
            totalGMV += record.gmv_amount || 0;
          }
          
          return json({ 
            total: results.results.length,
            total_settled_amount: totalSettled,
            total_gmv_amount: totalGMV,
            settlements: results.results 
          });
        }

        // === GET /attribution/settlement/:id — 查询单笔结算详情 ===
        if (path.startsWith('/attribution/settlement/') && method === 'GET') {
          const actionId = path.split('/attribution/settlement/')[1];
          
          const record = await env.FLY_D1.prepare(
            `SELECT id, action_id, payload_type, payload_json, status, settled_at, 
                    settled_amount, gmv_amount, attribution_weight, currency, 
                    settlement_method, business_event_id, verification_id, 
                    shadow_result, verification_result, legacy_result, delta_score,
                    calibration_status, created_at
             FROM attribution_payloads 
             WHERE action_id = ? AND status = 'SETTLED'
             ORDER BY settled_at DESC 
             LIMIT 1`
          ).bind(actionId).first();
          
          if (!record) {
            return json({ 
              error: 'settlement not found', 
              action_id: actionId,
              hint: 'action may not be settled yet'
            }, 404);
          }
          
          return json({ 
            action_id: record.action_id,
            business_event_id: record.business_event_id,
            settlement: {
              settled_at: record.settled_at,
              settled_amount: record.settled_amount,
              gmv_amount: record.gmv_amount,
              attribution_weight: record.attribution_weight,
              currency: record.currency,
              settlement_method: record.settlement_method
            },
            verification: {
              verification_id: record.verification_id,
              verification_result: record.verification_result ? JSON.parse(record.verification_result as string) : null
            },
            attribution: {
              shadow_result: record.shadow_result ? JSON.parse(record.shadow_result as string) : null,
              legacy_result: record.legacy_result ? JSON.parse(record.legacy_result as string) : null,
              delta_score: record.delta_score,
              calibration_status: record.calibration_status
            },
            metadata: {
              payload_type: record.payload_type,
              created_at: record.created_at,
              status: record.status
            }
          });
        }

        // === GET /attribution/status/:actionId — 完整状态机进度查询 ===
        if (path.startsWith('/attribution/status/') && method === 'GET') {
          const actionId = path.split('/attribution/status/')[1];

          const record = await env.FLY_D1.prepare(
            "SELECT * FROM attribution_payloads WHERE action_id = ? ORDER BY created_at DESC LIMIT 1"
          ).bind(actionId).first();
          if (!record) return json({ error: 'not found', action_id: actionId }, 404);

          return json({
            action_id: actionId,
            status: record.status || 'CREATED',
            transaction_id: record.id,
            payload_type: record.payload_type,
            signature_verified: !!record.signature,
            legacy_result: record.legacy_result ? JSON.parse(record.legacy_result as string) : null,
            delta_score: record.delta_score ?? null,
            calibration_status: record.calibration_status || 'PENDING',
            shadow_result: record.shadow_result ? JSON.parse(record.shadow_result as string) : null,
            verification_result: record.verification_result ? JSON.parse(record.verification_result as string) : null,
            verification_id: record.verification_id || null,
            settled_at: record.settled_at || null,
            failure_reason: record.failure_reason || null,
            created_at: record.created_at,
            updated_at: record.created_at, // D1无自动updated_at，用created_at兜底
          });
        }

        // === 查询所有 attribution 数据概览 ===
        if (path === '/attribution/list' && method === 'GET') {
          const limit = parseInt(url.searchParams.get('limit') || '20');
          const results = await env.FLY_D1.prepare(
            "SELECT id, action_id, payload_type, status, attribution_status, worker_status, verification_id, settled_at, created_at FROM attribution_payloads ORDER BY created_at DESC LIMIT ?"
          ).bind(limit).all();
          return json({ total: results.results.length, payloads: results.results });
        }

        return json({ error: "not found", hint: "try /v1/health" }, 404);
      } catch (err: any) {
        // v2.8.0新增：D1/KV操作失败独立告警
        const errMsg = (err?.message || '').toLowerCase();
        if (errMsg.includes('d1') || errMsg.includes('database') || errMsg.includes('sql')) {
          // D1查询失败 → P0告警
          ctx.waitUntil(alertTrigger(env, 'P0', 'D1查询失败', { error: err.message, path }).catch(() => {}));
        } else if (errMsg.includes('kv') || errMsg.includes('namespace')) {
          // KV操作失败 → P0告警
          ctx.waitUntil(alertTrigger(env, 'P0', 'KV操作失败', { error: err.message, path }).catch(() => {}));
        }
        return json({ error: err.message || 'internal server error' }, 500);
      }
    })();

    // v2.8.0: 异步记录请求指标和检查告警条件（不阻塞响应）
    ctx.waitUntil((async () => {
      try {
        const latency = Date.now() - startTime;
        await recordRequestMetric(env, response.status, latency);
        await checkAlertConditions(env);
      } catch (e) {
        // 指标和告警检查失败不影响响应
      }
    })());

    return response;
  },

  // ============================================================
  // v2.9.0: Scheduled Handler — cron定时健康探针 + 指标持久化
  // ============================================================
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      try {
        // === Pipeline Queue Consumer (job_queue) ===
        await processJobQueue(env);
        
        // 0. v2.10.0: 触发GitHub repository_dispatch（替代GitHub Scheduler）
        if (env.GITHUB_TOKEN) {
          try {
            const resp = await fetch(
              'https://api.github.com/repos/fly-marketing-agent/fly-agent.xyz/dispatches',
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
                  'Accept': 'application/vnd.github+json',
                  'User-Agent': 'fly-api-worker',
                },
                body: JSON.stringify({ event_type: 'cf_cron_trigger', client_payload: { source: 'cloudflare-cron', ts: Date.now() } }),
              },
            );
            if (!resp.ok && resp.status !== 204) {
              const body = await resp.text();
              if (!(await isAlertDeduped(env, 'gh_dispatch'))) {
                await markAlertSent(env, 'gh_dispatch');
                await alertTrigger(env, 'P1', `GitHub repository_dispatch触发失败`, {
                  status: resp.status,
                  error: body.slice(0, 200),
                });
              }
            }
          } catch (e: any) {
            if (!(await isAlertDeduped(env, 'gh_dispatch'))) {
              await markAlertSent(env, 'gh_dispatch');
              await alertTrigger(env, 'P1', `GitHub repository_dispatch请求异常`, { error: e.message });
            }
          }
        }

        // 1. D1探针
        try {
          await env.FLY_D1.prepare('SELECT 1 AS ok').first();
        } catch (e: any) {
          if (!(await isAlertDeduped(env, 'd1_probe'))) {
            await markAlertSent(env, 'd1_probe');
            await alertTrigger(env, 'P0', 'D1定时探针失败', { error: e.message });
          }
        }

        // 2. KV探针
        try {
          const probeKey = `__scheduled_probe:${Date.now()}`;
          await env.FLY_KV.put(probeKey, '1', { expirationTtl: 60 });
          const val = await env.FLY_KV.get(probeKey);
          if (val !== '1') throw new Error('KV read mismatch');
        } catch (e: any) {
          if (!(await isAlertDeduped(env, 'kv_probe'))) {
            await markAlertSent(env, 'kv_probe');
            await alertTrigger(env, 'P0', 'KV定时探针失败', { error: e.message });
          }
        }

        // 3. 慢查询检测
        const metrics = await getAggregatedMetrics(env, 5);
        if (metrics && metrics.avg_ms > 2000) {
          if (!(await isAlertDeduped(env, 'slow_query'))) {
            await markAlertSent(env, 'slow_query');
            await alertTrigger(env, 'P1', `查询延迟偏高: avg=${metrics.avg_ms}ms`, {
              avg_ms: metrics.avg_ms, p95_ms: metrics.p95_ms, threshold: '>2000ms', window: '5min'
            });
          }
        }

        // 4. 每日指标持久化（每天0点附近执行一次）
        try {
          const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
          const dailyDoneKey = `daily_metrics:done:${today}`;
          const alreadyDone = await env.FLY_KV.get(dailyDoneKey);
          if (!alreadyDone) {
            // 确保daily_metrics表存在
            await env.FLY_D1.prepare(`
              CREATE TABLE IF NOT EXISTS daily_metrics (
                date TEXT PRIMARY KEY,
                total_requests INTEGER,
                total_5xx INTEGER,
                avg_latency_ms INTEGER,
                p95_latency_ms INTEGER,
                created_at TEXT DEFAULT (datetime('now'))
              )
            `).run();

            // 聚合最近5分钟指标作为当日的采样（首次运行时写入）
            const m = await getAggregatedMetrics(env, 5);
            if (m && m.total > 0) {
              await env.FLY_D1.prepare(
                `INSERT OR REPLACE INTO daily_metrics (date, total_requests, total_5xx, avg_latency_ms, p95_latency_ms) VALUES (?, ?, ?, ?, ?)`
              ).bind(today, m.total, m.s5xx, Math.round(m.avg_ms), Math.round(m.p95_ms)).run();
            }
            // 标记今日已完成（TTL 25小时，确保跨天重置）
            await env.FLY_KV.put(dailyDoneKey, '1', { expirationTtl: 90000 });
          }
        } catch (e: any) {
          // 持久化失败不影响探针
        }

        // 5. D1容量检查（CF D1免费版5GB限额，>80%告警）
        try {
          // 通过PRAGMA查询D1页面数估算大小（D1不直接暴露file_size给Worker）
          // 使用KV缓存的容量数据（由GA trend-check写入）
          const capacityRaw = await env.FLY_KV.get('capacity:d1');
          if (capacityRaw) {
            const cap = JSON.parse(capacityRaw);
            // CF D1免费版限额5GB = 5368709120字节
            const limitBytes = 5368709120;
            const usagePercent = (cap.file_size / limitBytes) * 100;
            if (usagePercent > 80) {
              if (!(await isAlertDeduped(env, 'd1_capacity'))) {
                await markAlertSent(env, 'd1_capacity');
                await alertTrigger(env, 'P1', `D1容量接近限额: ${usagePercent.toFixed(1)}%`, {
                  file_size_mb: `${(cap.file_size / 1048576).toFixed(1)}MB`,
                  limit_gb: '5GB',
                  usage_percent: `${usagePercent.toFixed(1)}%`,
                  threshold: '>80%'
                });
              }
            }
          }
        } catch (e: any) {
          // 容量检查失败不影响探针
        }

        // 6. KV容量检查（CF KV免费版：100k reads/day, 1k writes/day）
        try {
          const kvCapRaw = await env.FLY_KV.get('capacity:kv');
          if (kvCapRaw) {
            const kvCap = JSON.parse(kvCapRaw);
            // 读写量 > 80%限额告警
            const readLimit = 100000;
            const writeLimit = 1000;
            const readPercent = (kvCap.reads / readLimit) * 100;
            const writePercent = (kvCap.writes / writeLimit) * 100;
            if (readPercent > 80 || writePercent > 80) {
              if (!(await isAlertDeduped(env, 'kv_capacity'))) {
                await markAlertSent(env, 'kv_capacity');
                const reasons: string[] = [];
                if (readPercent > 80) reasons.push(`读${kvCap.reads}/${readLimit}(${readPercent.toFixed(1)}%)`);
                if (writePercent > 80) reasons.push(`写${kvCap.writes}/${writeLimit}(${writePercent.toFixed(1)}%)`);
                await alertTrigger(env, 'P1', `KV容量接近限额: ${reasons.join(', ')}`, {
                  reads: kvCap.reads,
                  writes: kvCap.writes,
                  read_limit: readLimit,
                  write_limit: writeLimit,
                  threshold: '>80%'
                });
              }
            }
          }
        } catch (e: any) {
          // 容量检查失败不影响探针
        }

      } catch (e) {
        // scheduled失败静默
      }
    })());
  },
};
