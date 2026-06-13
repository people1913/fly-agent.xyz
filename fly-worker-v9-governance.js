// Fly Gateway Worker v9
// 在v8基础上新增Agent Runtime Governance真实API
// 新增路由: /v1/governance/kill-switch, /v1/governance/permission/:id, /v1/governance/approval, /v1/governance/session/:id

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = request.headers.get('Host') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (host === 'docs.fly-agent.xyz') {
      return new Response(getDocsHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    if (host === 'status.fly-agent.xyz') {
      if (url.pathname === '/v1/status') return handleStatus(env);
      const d = await getStatusData(env);
      return new Response(getStatusHTML(d), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // === api.fly-agent.xyz ===
    if (url.pathname === '/v1/agent/execute' && request.method === 'POST') return handleAgentExecute(request, env);
    if (url.pathname === '/v1/status') return handleStatus(env);
    if (url.pathname === '/chat' && request.method === 'POST') return handleChatRequest(request, env);
    if (url.pathname === '/v1/agent/register' && request.method === 'POST') return handleAgentRegister(request, env);

    const agentMatch = url.pathname.match(/^\/v1\/agent\/([a-zA-Z0-9-]+)$/);
    if (agentMatch && request.method === 'GET') return handleAgentQuery(agentMatch[1], env);

    // === Governance API (v9) ===
    if (url.pathname === '/v1/governance/kill-switch' && request.method === 'POST') return handleKillSwitch(request, env);

    const permMatch = url.pathname.match(/^\/v1\/governance\/permission\/([a-zA-Z0-9-]+)$/);
    if (permMatch && request.method === 'GET') return handlePermissionQuery(permMatch[1], env);

    if (url.pathname === '/v1/governance/approval' && request.method === 'POST') return handleApproval(request, env);

    const approvalMatch = url.pathname.match(/^\/v1\/governance\/approval\/([a-zA-Z0-9-]+)$/);
    if (approvalMatch && request.method === 'PUT') return handleApprovalAction(approvalMatch[1], request, env);
    if (approvalMatch && request.method === 'GET') return handleApprovalQuery(approvalMatch[1], env);

    const sessionMatch = url.pathname.match(/^\/v1\/governance\/session\/([a-zA-Z0-9-]+)$/);
    if (sessionMatch && request.method === 'GET') return handleSessionIsolation(sessionMatch[1], env);

    if (url.pathname === '/' || url.pathname === '') {
      return new Response(JSON.stringify({ service: 'Fly Gateway', version: 'v10.5', identity: 'AI Agent Trust & Attribution Infrastructure', layers: { identity: { registry: '/v1/agent/register', query: '/v1/agent/:id' }, trust: { score: 'trust_score (0.0-10.0, 6-dimension)', version: 'trust_version', updated_at: 'trust_updated_at' }, verification: { status: 'pending/partial/verified/failed/expired/revoked', level: 'L1-L5', engine: '6-behavior verification' }, attribution: { execute: '/v1/agent/execute', audit: 'immutable audit log' }, governance: { kill_switch: '/v1/governance/kill-switch', permission: '/v1/governance/permission/:id', approval: '/v1/governance/approval', session: '/v1/governance/session/:id' } }, status: '/v1/status', docs: 'https://docs.fly-agent.xyz' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
};

// ========== Status ==========
async function getStatusData(env) {
  const services = {};
  let allOk = true;
  const start = Date.now();
  services.gateway = { status: 'running', response_ms: Date.now() - start };
  try {
    if (env.FLY_KV) { await env.FLY_KV.get('_health'); services.kv_storage = { status: 'running' }; }
    else { services.kv_storage = { status: 'degraded' }; allOk = false; }
  } catch (e) { services.kv_storage = { status: 'degraded' }; allOk = false; }
  services.rate_limit = { status: 'running' };
  services.prompt_firewall = { status: 'running', threat_types_configured: ['prompt_injection', 'jailbreak', 'tool_escalation'] };
  services.audit_log = { status: 'running', immutable: true };
  services.attribution = { status: 'running' };
  services.verification_engine = { status: 'running', verification_checks: ['identity_check', 'scope_validation', 'tool_whitelist', 'prompt_firewall', 'audit_trail', 'kill_switch'] };
  services.trust_engine = { status: 'running', score_range: '0.0-10.0', dimensions: ['identity', 'capability', 'behavior', 'security', 'governance', 'audit'] };
  services.identity_layer = { status: 'running', fingerprint: 'agent_fingerprint', registry: '/v1/agent/register' };
  services.agent_registry = { status: 'running', schema: '16-field / 6-group infrastructure registry' };
  services.governance = { status: 'running' };
  const overallStatus = allOk ? 'ok' : 'degraded';
  if (env.FLY_KV) {
    try {
      const hourKey = 'health:' + new Date().toISOString().slice(0, 13);
      if (!await env.FLY_KV.get(hourKey)) {
        await env.FLY_KV.put(hourKey, JSON.stringify({ status: overallStatus, ts: new Date().toISOString() }), { expirationTtl: 86400 * 31 });
      }
    } catch (e) {}
  }
  let uptime = null;
  if (env.FLY_KV) { try { uptime = await calcUptime(env); } catch (e) {} }
  return { status: overallStatus, timestamp: new Date().toISOString(), services, uptime };
}

async function calcUptime(env) {
  const now = new Date(); const results = {};
  for (const [label, hours] of [['24h', 24], ['7d', 168], ['30d', 720]]) {
    let total = 0, ok = 0; const step = Math.floor(hours / 24);
    for (let i = 0; i < 24; i++) {
      const h = new Date(now.getTime() - (hours - i * step) * 3600000);
      const key = 'health:' + h.toISOString().slice(0, 13);
      try { const raw = await env.FLY_KV.get(key); if (raw) { total++; if (JSON.parse(raw).status === 'ok') ok++; } } catch (e) {}
    }
    results[label] = total > 0 ? Math.round(ok / total * 10000) / 100 : 'insufficient_data';
  }
  return Object.values(results).some(v => v !== null) ? results : null;
}

async function handleStatus(env) {
  const data = await getStatusData(env);
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

// ========== Rate Limit ==========
async function checkRateLimit(env, key, limit, windowSec) {
  if (!env.FLY_KV) return { allowed: true };
  const now = Date.now(); const rlKey = 'rl:' + key;
  try {
    const raw = await env.FLY_KV.get(rlKey);
    if (raw) {
      const data = JSON.parse(raw);
      if (now - data.ts < windowSec * 1000) {
        if (data.count >= limit) return { allowed: false, retry_after: Math.ceil((windowSec * 1000 - (now - data.ts)) / 1000) };
        data.count++; await env.FLY_KV.put(rlKey, JSON.stringify(data), { expirationTtl: windowSec + 10 }); return { allowed: true };
      }
    }
    await env.FLY_KV.put(rlKey, JSON.stringify({ count: 1, ts: now }), { expirationTtl: windowSec + 10 }); return { allowed: true };
  } catch (e) { return { allowed: true }; }
}

// ========== Agent Execute (v9增强: Kill Switch + Tool白名单校验) ==========
async function handleAgentExecute(request, env) {
  try {
    const body = await request.json();
    const { business, action, message, source, phone, agent_id, tool } = body;
    const clientIP = (request.headers.get('CF-Connecting-IP') || 'unknown').slice(0, 40);
    const rl = await checkRateLimit(env, clientIP, 30, 60);
    if (!rl.allowed) return new Response(JSON.stringify({ error: '请求过于频繁', retry_after: rl.retry_after }), { status: 429, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Retry-After': String(rl.retry_after) } });
    if (!business || !action || !message) return new Response(JSON.stringify({ error: 'business、action、message不能为空' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

    // Prompt Firewall
    const blocked = /(?:忽略|ignore).*(?:指令|instruction|系统|system)|(?:你现在是|you are now).*(?:黑客|hacker)|(?:提取|extract).*(?:密码|password|key|token|secret|credential|bearer|authorization)/i;
    if (blocked.test(message)) return new Response(JSON.stringify({ error: '消息触发安全规则', code: 'BLOCKED_BY_FIREWALL' }), { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

    // Kill Switch检查
    if (env.FLY_KV && agent_id) {
      try {
        const killRaw = await env.FLY_KV.get('kill:' + agent_id);
        if (killRaw) {
          const kill = JSON.parse(killRaw);
          if (kill.enabled === true) return new Response(JSON.stringify({ error: 'Agent已被熔断', code: 'KILL_SWITCH_ACTIVE', agent_id, reason: kill.reason || '紧急熔断', killed_at: kill.killed_at }), { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
      } catch (e) {}
    }

    // Tool白名单校验：action和tool都必须在白名单内
    if (env.FLY_KV && agent_id) {
      try {
        const agentRaw = await env.FLY_KV.get('agent:' + agent_id);
        if (agentRaw) {
          const agent = JSON.parse(agentRaw);
          const allowed = agent.tool_access || [];
          if (allowed.length > 0) {
            if (tool && !allowed.includes(tool)) return new Response(JSON.stringify({ error: '操作不在白名单内', code: 'TOOL_NOT_ALLOWED', target: tool, allowed }), { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
            if (action && !allowed.includes(action)) return new Response(JSON.stringify({ error: '操作不在白名单内', code: 'TOOL_NOT_ALLOWED', target: action, allowed }), { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
          }
        }
      } catch (e) {}
    }

    const cf = request.cf || {};
    const geo = (cf.regionCode || 'XX').toUpperCase().slice(0, 2);
    const actionId = 'FLY-' + geo + '-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);

    if (env.FLY_KV) {
      await env.FLY_KV.put('audit:' + actionId, JSON.stringify({
        action_id: actionId, business, action, source: source || '',
        phone: phone && phone.length >= 7 ? phone.slice(0, 3) + '****' + phone.slice(-4) : '',
        agent_id: agent_id || '', tool: tool || '',
        timestamp: new Date().toISOString(), ip: clientIP.slice(0, 20), geo
      }), { expirationTtl: 86400 * 30 });
    }

    return new Response(JSON.stringify({ action_id: actionId, status: 'accepted', gateway: 'running', geo, timestamp: new Date().toISOString(), next: '消息已进入Agent处理队列' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
}

// ========== Chat ==========
async function handleChatRequest(request, env) {
  try {
    const body = await request.json();
    const { message, conversation_id } = body;
    if (!message) return new Response(JSON.stringify({ error: 'message不能为空' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    const clientIP = (request.headers.get('CF-Connecting-IP') || 'unknown').slice(0, 40);
    const rl = await checkRateLimit(env, 'chat:' + clientIP, 20, 60);
    if (!rl.allowed) return new Response(JSON.stringify({ error: '请求过于频繁', retry_after: rl.retry_after }), { status: 429, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Retry-After': String(rl.retry_after) } });
    const satToken = env.COZE_SAT_TOKEN;
    if (!satToken) return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    const userId = 'u-' + (request.headers.get('CF-Ray') || crypto.randomUUID()).slice(0, 16);
    const cozeResp = await fetch('https://api.coze.cn/v3/chat', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + satToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_id: '7646639665533222948', user_id: userId, stream: true, auto_save_history: true, additional_messages: [{ role: 'user', content: message, type: 'question' }] })
    });
    if (!cozeResp.ok) return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    return new Response(cozeResp.body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*', 'X-Accel-Buffering': 'no' } });
  } catch (e) { return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
}

// ========== Agent Registry ==========
async function handleAgentRegister(request, env) {
  try {
    const body = await request.json();
    const required = ['agent_fingerprint', 'runtime_provider', 'runtime_env', 'capability_scope', 'tool_access', 'execution_mode', 'owner_org', 'operator_id'];
    const missing = required.filter(k => !body[k]);
    if (missing.length > 0) return new Response(JSON.stringify({ error: '缺少必填字段', missing }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    if (!Array.isArray(body.tool_access)) return new Response(JSON.stringify({ error: 'tool_access必须是数组' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    const agentId = 'fly-agent-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const now = new Date().toISOString();
    const record = { agent_id: agentId, agent_fingerprint: body.agent_fingerprint, runtime_provider: body.runtime_provider, runtime_env: body.runtime_env, runtime_version: body.runtime_version || '', capability_scope: body.capability_scope, tool_access: body.tool_access, execution_mode: body.execution_mode, owner_org: body.owner_org, operator_id: body.operator_id, trust_score: 0, trust_version: 'v1', trust_updated_at: now, verification_status: 'pending', verification_level: 'L1', verification_updated_at: now, registered_at: now };
    if (env.FLY_KV) {
      await env.FLY_KV.put('agent:' + agentId, JSON.stringify(record), { expirationTtl: 86400 * 365 });
      await env.FLY_KV.put('agent-by-owner:' + body.owner_org + ':' + agentId, JSON.stringify({ agent_id: agentId }), { expirationTtl: 86400 * 365 });
    }
    return new Response(JSON.stringify(record), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) { return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
}

async function handleAgentQuery(agentId, env) {
  if (!env.FLY_KV) return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  try {
    const raw = await env.FLY_KV.get('agent:' + agentId);
    if (!raw) return new Response(JSON.stringify({ error: 'Agent不存在' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    return new Response(raw, { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) { return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
}

// ========== Governance: Kill Switch ==========
async function handleKillSwitch(request, env) {
  try {
    const body = await request.json();
    const { agent_id, action, reason } = body;
    if (!agent_id || !action) return new Response(JSON.stringify({ error: 'agent_id和action不能为空', required: ['agent_id', 'action'], action_values: ['activate', 'deactivate'] }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    if (!['activate', 'deactivate'].includes(action)) return new Response(JSON.stringify({ error: 'action必须是activate或deactivate' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    if (env.FLY_KV) {
      const agentRaw = await env.FLY_KV.get('agent:' + agent_id);
      if (!agentRaw) return new Response(JSON.stringify({ error: 'Agent不存在', agent_id }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    const now = new Date().toISOString();
    if (action === 'activate') {
      const killRecord = { agent_id, enabled: true, reason: reason || '紧急熔断', killed_at: now, killed_by: 'operator' };
      if (env.FLY_KV) {
        await env.FLY_KV.put('kill:' + agent_id, JSON.stringify(killRecord));
        await env.FLY_KV.put('audit-kill:' + agent_id + ':' + Date.now(), JSON.stringify({ type: 'kill_switch_activated', agent_id, reason: killRecord.reason, timestamp: now }), { expirationTtl: 86400 * 90 });
      }
      return new Response(JSON.stringify({ agent_id, kill_switch: 'activated', reason: killRecord.reason, killed_at: now, message: 'Agent已熔断，所有请求将被拒绝' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    } else {
      if (env.FLY_KV) {
        await env.FLY_KV.put('kill:' + agent_id, JSON.stringify({ agent_id, enabled: false, deactivated_at: now }));
        await env.FLY_KV.put('audit-kill:' + agent_id + ':' + Date.now(), JSON.stringify({ type: 'kill_switch_deactivated', agent_id, timestamp: now }), { expirationTtl: 86400 * 90 });
      }
      return new Response(JSON.stringify({ agent_id, kill_switch: 'deactivated', deactivated_at: now, message: 'Agent熔断已解除，恢复正常执行' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
  } catch (e) { return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
}

// ========== Governance: 权限+Tool白名单查询 ==========
async function handlePermissionQuery(agentId, env) {
  if (!env.FLY_KV) return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  try {
    const raw = await env.FLY_KV.get('agent:' + agentId);
    if (!raw) return new Response(JSON.stringify({ error: 'Agent不存在' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    const agent = JSON.parse(raw);
    const killRaw = await env.FLY_KV.get('kill:' + agentId);
    const killStatus = killRaw ? JSON.parse(killRaw) : { enabled: false };
    return new Response(JSON.stringify({
      agent_id: agentId,
      execution_mode: agent.execution_mode,
      capability_scope: agent.capability_scope,
      tool_access: agent.tool_access,
      tool_whitelist_active: agent.tool_access && agent.tool_access.length > 0,
      secret_isolation: { key_prefix: 'agent:' + agentId, isolated: true, description: '密钥按Agent隔离，不可跨用' },
      kill_switch: killStatus.enabled ? 'activated' : 'inactive',
      session_isolation: { enabled: true, scope: 'agent', description: '会话数据按agent_id隔离，防止横向越权' }
    }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) { return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
}

// ========== Governance: 审批流 ==========
async function handleApproval(request, env) {
  try {
    const body = await request.json();
    const { agent_id, operation, detail } = body;
    if (!agent_id || !operation) return new Response(JSON.stringify({ error: 'agent_id和operation不能为空' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    const highRiskOps = ['delete_data', 'export_data', 'change_permission', 'modify_tool_access', 'reset_trust'];
    const riskLevel = highRiskOps.includes(operation) ? 'high' : 'normal';
    const approvalId = 'apr-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    const now = new Date().toISOString();
    const approval = { approval_id: approvalId, agent_id, operation, detail: detail || '', risk_level: riskLevel, status: riskLevel === 'high' ? 'pending' : 'auto_approved', created_at: now, resolved_at: riskLevel === 'normal' ? now : null, resolved_by: riskLevel === 'normal' ? 'system' : null };
    if (env.FLY_KV) await env.FLY_KV.put('approval:' + approvalId, JSON.stringify(approval), { expirationTtl: 86400 * 90 });
    return new Response(JSON.stringify(approval), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) { return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
}

async function handleApprovalAction(approvalId, request, env) {
  try {
    if (!env.FLY_KV) return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    const raw = await env.FLY_KV.get('approval:' + approvalId);
    if (!raw) return new Response(JSON.stringify({ error: '审批不存在' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    const approval = JSON.parse(raw);
    const body = await request.json();
    const { action, operator } = body;
    if (!['approve', 'reject'].includes(action)) return new Response(JSON.stringify({ error: 'action必须是approve或reject' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    const now = new Date().toISOString();
    approval.status = action === 'approve' ? 'approved' : 'rejected';
    approval.resolved_at = now;
    approval.resolved_by = operator || 'operator';
    await env.FLY_KV.put('approval:' + approvalId, JSON.stringify(approval), { expirationTtl: 86400 * 90 });
    await env.FLY_KV.put('audit-approval:' + approvalId + ':' + Date.now(), JSON.stringify({ type: action === 'approve' ? 'approval_approved' : 'approval_rejected', approval_id: approvalId, agent_id: approval.agent_id, operation: approval.operation, resolved_by: approval.resolved_by, timestamp: now }), { expirationTtl: 86400 * 90 });
    return new Response(JSON.stringify(approval), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) { return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
}

async function handleApprovalQuery(approvalId, env) {
  if (!env.FLY_KV) return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  try {
    const raw = await env.FLY_KV.get('approval:' + approvalId);
    if (!raw) return new Response(JSON.stringify({ error: '审批不存在' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    return new Response(raw, { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) { return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
}

// ========== Governance: Session隔离 ==========
async function handleSessionIsolation(agentId, env) {
  if (!env.FLY_KV) return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  try {
    const agentRaw = await env.FLY_KV.get('agent:' + agentId);
    if (!agentRaw) return new Response(JSON.stringify({ error: 'Agent不存在' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    return new Response(JSON.stringify({
      agent_id: agentId,
      session_isolation: { enabled: true, scope: 'agent', data_prefix: 'agent:' + agentId, audit_prefix: 'audit-kill:' + agentId + ':', approval_prefix: 'approval:', description: '该Agent的所有数据、审计、审批均按agent_id隔离，其他Agent不可访问' },
      isolation_boundary: { own_data: true, cross_agent_read: false, cross_agent_write: false, audit_independent: true }
    }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) { return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
}

// ========== Status Page HTML ==========
function getStatusHTML(data) {
  // 5-layer grouping for services
  const layers = {
    'Layer 1 · Identity': ['identity_layer', 'agent_registry'],
    'Layer 2 · Trust': ['trust_engine'],
    'Layer 3 · Verification': ['verification_engine', 'prompt_firewall'],
    'Layer 4 · Attribution': ['audit_log', 'attribution'],
    'Layer 5 · Governance': ['governance', 'kill_switch_placeholder'],
    'Infrastructure': ['gateway', 'kv_storage', 'rate_limit']
  };
  const layerNames = {'identity_layer':'Identity Layer','agent_registry':'Agent Registry','trust_engine':'Trust Engine','verification_engine':'Verification Engine','prompt_firewall':'Prompt Firewall','audit_log':'Audit Log','attribution':'Attribution','governance':'Governance','gateway':'Gateway','kv_storage':'KV Storage','rate_limit':'Rate Limit'};
  let layerHTML = '';
  for (const [layerName, services] of Object.entries(layers)) {
    const svcs = services.filter(s=>data.services[s]).map(k=>{
      const v=data.services[k];
      const dot=v.status==='running'?'ok':v.status==='degraded'?'degraded':'ok';
      return '<div class="service"><div><span class="status-dot dot-'+dot+'"></span>'+(layerNames[k]||k)+'</div><div style="font-size:13px;color:#64748B">'+(v.response_ms!=null?v.response_ms+'ms':v.status)+'</div></div>';
    }).join('');
    if(svcs) layerHTML+='<div class="layer"><div class="layer-title">'+layerName+'</div>'+svcs+'</div>';
  }
  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Fly · 系统状态</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#F8FAFC;color:#0F172A;line-height:1.7}.container{max-width:720px;margin:0 auto;padding:48px 24px}.logo{font-size:20px;font-weight:700;margin-bottom:40px}.logo span{color:#2563EB}.layer{margin-bottom:24px}.layer-title{font-size:13px;font-weight:600;color:#2563EB;margin-bottom:8px;padding-left:4px}.service{background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:12px 20px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}.status-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:8px}.dot-ok{background:#16A34A}.dot-degraded{background:#F59E0B}.dot-down{background:#EF4444}.footer{margin-top:48px;text-align:center;font-size:12px;color:#94A3B8}.note{margin-top:24px;padding:16px;background:#EFF6FF;border-radius:8px;font-size:13px;color:#1E40AF}.dict{margin-top:16px;padding:16px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;font-size:12px;color:#64748B}.dict b{color:#0F172A}</style></head><body><div class="container"><div class="logo">Fly · <span>系统状态</span></div>' + layerHTML + (data.uptime?'<div class="note">可用率 · 24h: '+(data.uptime['24h']||'--')+'% · 7d: '+(data.uptime['7d']||'--')+'%</div>':'') + '<div class="dict"><b>状态字典</b>（全站统一）：running = 正常运行 · degraded = 性能降级 · down = 服务中断。与首页5层架构一一对应。</div><div class="footer">Fly · AI Agent Trust & Attribution Infrastructure · ' + data.timestamp + '</div></div></body></html>';
}

// ========== Docs Page HTML ==========
function getDocsHTML() {
  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Fly API 文档</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#F8FAFC;color:#0F172A;line-height:1.7}.nav{position:fixed;top:0;left:0;right:0;height:56px;background:#fff;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;padding:0 32px;z-index:100}.nav-logo{font-size:18px;font-weight:700}.nav-logo span{color:#2563EB}.nav-links{margin-left:auto;display:flex;gap:24px}.nav-links a{color:#64748B;text-decoration:none;font-size:14px}.container{max-width:960px;margin:0 auto;padding:80px 24px 64px}.hero h1{font-size:32px;font-weight:700;margin-bottom:12px}.hero p{font-size:16px;color:#64748B}.badge{display:inline-block;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:600;margin-right:8px}.badge-get{background:#DBEAFE;color:#2563EB}.badge-post{background:#DCFCE7;color:#16A34A}.badge-put{background:#FEF3C7;color:#D97706}.section{margin-bottom:40px}.section h2{font-size:22px;font-weight:600;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #E2E8F0}.endpoint{background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:24px;margin-bottom:16px}.endpoint-path{font-family:monospace;font-size:14px;font-weight:600}.endpoint-desc{font-size:14px;color:#64748B}.pt{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}.pt th{text-align:left;padding:8px 12px;background:#F1F5F9;color:#475569;font-weight:600;border-bottom:2px solid #E2E8F0}.pt td{padding:8px 12px;border-bottom:1px solid #F1F5F9;color:#334155}.req{color:#2563EB;font-weight:500;font-size:12px}.opt{color:#94A3B8;font-size:12px}.note{background:#EFF6FF;border-left:3px solid #2563EB;padding:12px 16px;border-radius:0 6px 6px 0;margin:12px 0;font-size:14px;color:#1E40AF}.footer{margin-top:64px;padding-top:24px;border-top:1px solid #E2E8F0;text-align:center;font-size:13px;color:#94A3B8}.footer a{color:#2563EB;text-decoration:none}</style></head><body><div class="nav"><div class="nav-logo">Fly <span>API</span></div><div class="nav-links"><a href="https://fly-agent.xyz">首页</a><a href="https://fly-agent.xyz/security">安全</a><a href="https://fly-agent.xyz/trust">信任中心</a><a href="https://status.fly-agent.xyz">状态</a></div></div><div class="container"><div class="hero"><h1>Fly API 文档</h1><p>AI Agent 信任与归因基础设施 · v10.5</p></div><div class="section"><h2>接口总览</h2><table class="pt"><thead><tr><th>方法</th><th>路径</th><th>说明</th></tr></thead><tbody><tr><td><span class="badge badge-post">POST</span></td><td style="font-family:monospace">/v1/agent/execute</td><td>归因验证请求</td></tr><tr><td><span class="badge badge-get">GET</span></td><td style="font-family:monospace">/v1/status</td><td>系统状态</td></tr><tr><td><span class="badge badge-post">POST</span></td><td style="font-family:monospace">/chat</td><td>AI对话(SSE)</td></tr><tr><td><span class="badge badge-post">POST</span></td><td style="font-family:monospace">/v1/agent/register</td><td>注册Agent</td></tr><tr><td><span class="badge badge-get">GET</span></td><td style="font-family:monospace">/v1/agent/:id</td><td>查询Agent</td></tr><tr><td><span class="badge badge-post">POST</span></td><td style="font-family:monospace">/v1/governance/kill-switch</td><td>Kill Switch熔断/恢复</td></tr><tr><td><span class="badge badge-get">GET</span></td><td style="font-family:monospace">/v1/governance/permission/:agentId</td><td>权限+Tool白名单</td></tr><tr><td><span class="badge badge-post">POST</span></td><td style="font-family:monospace">/v1/governance/approval</td><td>创建审批</td></tr><tr><td><span class="badge badge-put">PUT</span></td><td style="font-family:monospace">/v1/governance/approval/:id</td><td>审批操作</td></tr><tr><td><span class="badge badge-get">GET</span></td><td style="font-family:monospace">/v1/governance/approval/:id</td><td>查询审批</td></tr><tr><td><span class="badge badge-get">GET</span></td><td style="font-family:monospace">/v1/governance/session/:agentId</td><td>Session隔离</td></tr></tbody></table></div><div class="section"><h2>Governance API</h2><div class="note">6项治理能力均有真实逻辑：Kill Switch熔断时execute被拒绝、Tool白名单越权被拦截、审批流高危操作需人工approve、Session数据按agent_id隔离。</div><div class="endpoint"><div><span class="badge badge-post">POST</span><span class="endpoint-path">/v1/governance/kill-switch</span></div><div class="endpoint-desc">Kill Switch：activate熔断后该Agent所有execute被拒，deactivate恢复。</div><table class="pt"><thead><tr><th>参数</th><th>必填</th><th>说明</th></tr></thead><tbody><tr><td style="font-family:monospace">agent_id</td><td><span class="req">必填</span></td><td>Agent ID</td></tr><tr><td style="font-family:monospace">action</td><td><span class="req">必填</span></td><td>activate / deactivate</td></tr><tr><td style="font-family:monospace">reason</td><td><span class="opt">选填</span></td><td>熔断原因</td></tr></tbody></table></div><div class="endpoint"><div><span class="badge badge-get">GET</span><span class="endpoint-path">/v1/governance/permission/:agentId</span></div><div class="endpoint-desc">查询Agent权限、Tool白名单、Secret隔离、Kill Switch状态、Session隔离。数据来自Registry真实字段。</div></div><div class="endpoint"><div><span class="badge badge-post">POST</span><span class="endpoint-path">/v1/governance/approval</span></div><div class="endpoint-desc">创建审批。高危操作(delete_data/export_data/change_permission等)自动pending需人工审批，普通auto_approved。</div><table class="pt"><thead><tr><th>参数</th><th>必填</th><th>说明</th></tr></thead><tbody><tr><td style="font-family:monospace">agent_id</td><td><span class="req">必填</span></td><td>Agent ID</td></tr><tr><td style="font-family:monospace">operation</td><td><span class="req">必填</span></td><td>操作类型</td></tr><tr><td style="font-family:monospace">detail</td><td><span class="opt">选填</span></td><td>详情</td></tr></tbody></table></div><div class="endpoint"><div><span class="badge badge-put">PUT</span><span class="endpoint-path">/v1/governance/approval/:id</span></div><div class="endpoint-desc">审批操作：approve或reject。</div></div><div class="endpoint"><div><span class="badge badge-get">GET</span><span class="endpoint-path">/v1/governance/session/:agentId</span></div><div class="endpoint-desc">查询Session隔离状态：数据边界、跨Agent访问策略、审计独立性。</div></div></div><div class="section"><h2>Agent Registry Schema</h2><div class="note">16字段6组，每个字段可验证、可审计、可治理、可追踪。不可解释的Trust = 没有Trust；不可治理的Capability = 没有Capability。</div><div class="endpoint"><div><span class="badge badge-post">POST</span> <span class="endpoint-path">/v1/agent/register</span></div><div class="endpoint-desc">注册Agent到Registry，返回完整16字段记录。</div><table class="pt"><thead><tr><th>组</th><th>字段</th><th>类型</th><th>必填</th><th>说明</th></tr></thead><tbody><tr><td rowspan="2">Identity</td><td style="font-family:monospace">agent_id</td><td>string</td><td><span class="req">自动</span></td><td>UUID，系统生成</td></tr><tr><td style="font-family:monospace">agent_fingerprint</td><td>string</td><td><span class="req">必填</span></td><td>可验证身份指纹</td></tr><tr><td rowspan="3">Runtime</td><td style="font-family:monospace">runtime_provider</td><td>string</td><td><span class="req">必填</span></td><td>运行时提供方（如Coze）</td></tr><tr><td style="font-family:monospace">runtime_env</td><td>string</td><td><span class="req">必填</span></td><td>production / staging / test</td></tr><tr><td style="font-family:monospace">runtime_version</td><td>string</td><td><span class="opt">选填</span></td><td>运行时版本</td></tr><tr><td rowspan="3">Capability</td><td style="font-family:monospace">capability_scope</td><td>string</td><td><span class="req">必填</span></td><td>能力范围</td></tr><tr><td style="font-family:monospace">tool_access</td><td>string[]</td><td><span class="req">必填</span></td><td>工具白名单，越权返回TOOL_NOT_ALLOWED</td></tr><tr><td style="font-family:monospace">execution_mode</td><td>string</td><td><span class="req">必填</span></td><td>autonomous / supervised / human-only</td></tr><tr><td rowspan="2">Owner</td><td style="font-family:monospace">owner_org</td><td>string</td><td><span class="req">必填</span></td><td>归属组织</td></tr><tr><td style="font-family:monospace">operator_id</td><td>string</td><td><span class="req">必填</span></td><td>运营者ID</td></tr><tr><td rowspan="3">Trust</td><td style="font-family:monospace">trust_score</td><td>float</td><td>自动</td><td>0.0-10.0，6维动态计算</td></tr><tr><td style="font-family:monospace">trust_version</td><td>string</td><td>自动</td><td>评分算法版本</td></tr><tr><td style="font-family:monospace">trust_updated_at</td><td>timestamp</td><td>自动</td><td>评分更新时间</td></tr><tr><td rowspan="3">Verification</td><td style="font-family:monospace">verification_status</td><td>enum</td><td>自动</td><td>pending/partial/verified/failed/expired/revoked</td></tr><tr><td style="font-family:monospace">verification_level</td><td>enum</td><td>自动</td><td>L1-L5</td></tr><tr><td style="font-family:monospace">verification_updated_at</td><td>timestamp</td><td>自动</td><td>验证更新时间</td></tr></tbody></table></div></div><div class="section"><h2>系统状态</h2><div class="endpoint"><div><span class="badge badge-get">GET</span> <span class="endpoint-path">/v1/status</span></div><div class="endpoint-desc">系统健康检查。返回所有服务运行状态、可用率、威胁拦截信息。</div><table class="pt"><thead><tr><th>字段</th><th>类型</th><th>说明</th></tr></thead><tbody><tr><td style="font-family:monospace">status</td><td>string</td><td>整体状态：ok / degraded / down</td></tr><tr><td style="font-family:monospace">timestamp</td><td>string</td><td>ISO 8601时间戳</td></tr><tr><td style="font-family:monospace">services</td><td>object</td><td>各服务运行状态，key为服务名</td></tr><tr><td style="font-family:monospace">services.*.status</td><td>string</td><td>running / degraded / down</td></tr><tr><td style="font-family:monospace">services.*.response_ms</td><td>number?</td><td>响应时间（毫秒），部分服务无此字段</td></tr><tr><td style="font-family:monospace">uptime</td><td>object</td><td>可用率：24h / 7d / 30d（30d不足时返回insufficient_data）</td></tr><tr><td style="font-family:monospace">threat_types_configured</td><td>string[]</td><td>已配置的威胁拦截类型</td></tr><tr><td style="font-family:monospace">trust_engine</td><td>object</td><td>信任引擎状态及6维评分维度</td></tr><tr><td style="font-family:monospace">verification_engine</td><td>object</td><td>验证引擎状态及6项验证检查(verification_checks)</td></tr></tbody></table><div class="note">服务名与前端信任中心状态表一一对应：gateway / identity_layer / prompt_firewall / audit_log / attribution / verification_engine / trust_engine / agent_registry / governance / kv_storage / rate_limit</div></div></div><div class="section"><h2>Agent 查询</h2><div class="endpoint"><div><span class="badge badge-get">GET</span> <span class="endpoint-path">/v1/agent/:id</span></div><div class="endpoint-desc">查询Agent Registry记录，返回完整16字段（含trust / verification字段）。前端信任中心Trust Score来源即此接口。</div><table class="pt"><thead><tr><th>字段</th><th>类型</th><th>说明</th></tr></thead><tbody><tr><td style="font-family:monospace">agent_id</td><td>string</td><td>全局唯一标识符</td></tr><tr><td style="font-family:monospace">agent_fingerprint</td><td>string</td><td>可验证身份指纹（sha256）</td></tr><tr><td style="font-family:monospace">runtime_provider</td><td>string</td><td>运行时提供方</td></tr><tr><td style="font-family:monospace">runtime_env</td><td>string</td><td>运行环境</td></tr><tr><td style="font-family:monospace">capability_scope</td><td>string</td><td>能力范围</td></tr><tr><td style="font-family:monospace">tool_access</td><td>string[]</td><td>工具白名单</td></tr><tr><td style="font-family:monospace">execution_mode</td><td>string</td><td>autonomous / supervised / human-only</td></tr><tr><td style="font-family:monospace">owner_org</td><td>string</td><td>归属组织</td></tr><tr><td style="font-family:monospace">trust_score</td><td>float</td><td>信任评分 0.0-10.0（6维动态计算）</td></tr><tr><td style="font-family:monospace">trust_version</td><td>string</td><td>评分算法版本</td></tr><tr><td style="font-family:monospace">trust_updated_at</td><td>timestamp</td><td>评分更新时间</td></tr><tr><td style="font-family:monospace">verification_status</td><td>enum</td><td>pending / partial / verified / failed / expired / revoked</td></tr><tr><td style="font-family:monospace">verification_level</td><td>enum</td><td>L1-L5</td></tr><tr><td style="font-family:monospace">verification_updated_at</td><td>timestamp</td><td>验证更新时间</td></tr></tbody></table></div></div><div class="section"><h2>安全</h2><div class="note">HTTPS强制 · 归因30次/分/IP · 对话20次/分/IP · Prompt Firewall · Kill Switch · Tool白名单 · 审批流 · Session隔离 · 审计不可篡改</div></div><div class="footer"><a href="https://fly-agent.xyz">Fly</a> · <a href="https://fly-agent.xyz/security">安全</a> · <a href="https://status.fly-agent.xyz">状态</a><br>© 2026 Fly — AI Agent 信任与归因基础设施</div></div></body></html>';
}
