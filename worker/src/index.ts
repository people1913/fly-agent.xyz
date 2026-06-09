/**
 * Fly API Worker — Cloudflare Worker Entry Point
 * 纯原生Worker API，无第三方依赖
 * 
 * 8层6协议架构：L1-L8
 * 6协议：AIP + FSS + FVP + ATP + FGP + ALP
 * 
 * API端点清单：
 *   GET  /v1/health
 *   POST /v1/agents                    — 漏洞1：Agent注册+身份验证
 *   GET  /v1/agents/:id
 *   POST /v1/action                    — 漏洞2+3：Bearer+HMAC鉴权 + HMAC伪匿名
 *   GET  /v1/status/:actionId
 *   POST /v1/agents/:id/recalc-trust   — 漏洞4：Trust多维计算
 *   POST /v1/verifications             — 漏洞5：三方分离防自证
 *   GET  /s/:actionId                  — 漏洞6：短链Bot检测+信号质量
 *   POST /v1/signal/verify             — 漏洞6：JS回调信号质量升级
 *   GET  /v1/audit/:entityType/:entityId — 漏洞7：审计链查询
 *   POST /v1/governance/assign-role    — 漏洞8：角色授权
 *   POST /v1/governance/check-permission — 漏洞8：权限检查(Default Deny)
 *   POST /v1/governance/update-policy  — 漏洞8：策略更新
 *   GET  /v1/db/query                  — 验收辅助查询
 */

// ============================================================
// Types
// ============================================================
interface Env {
  FLY_D1: D1Database;
  FLY_KV: KVNamespace;
  IP_SALT: string;
  API_KEYS: string;
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
// Router
// ============================================================
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Fly-Signature, X-Fly-Timestamp' } });
    }

    try {
      // === Landing Page ===
      if (path === '/' && method === 'GET') {
        const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fly · 信任与归因基础设施</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;background:#fff;color:#0F172A;min-height:100vh;display:flex;flex-direction:column}nav{display:flex;align-items:center;justify-content:space-between;padding:24px 48px;max-width:1200px;margin:0 auto;width:100%}nav .brand{font-size:16px;font-weight:500;color:#64748b;letter-spacing:0.5px}nav .cta-btn{background:#2563EB;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;transition:background .2s;text-decoration:none}nav .cta-btn:hover{background:#1d4ed8}.hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px 24px 120px;max-width:900px;margin:0 auto}.hero .sub{font-size:14px;color:#94a3b8;letter-spacing:1px;margin-bottom:24px;text-transform:uppercase}.hero h1{font-size:clamp(28px,5vw,48px);font-weight:800;line-height:1.3;color:#0F172A;margin-bottom:32px}.hero .desc{display:flex;flex-direction:column;gap:12px;margin-bottom:40px}.hero .desc p{font-size:18px;color:#2563EB;font-weight:500}.hero .compare{margin-top:32px;padding-top:32px;border-top:1px solid #e2e8f0;width:100%;max-width:560px}.hero .compare .row{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px;font-size:15px}.hero .compare .row .era{color:#94a3b8;font-size:13px}.hero .compare .row .highlight{color:#0F172A;font-weight:700}.footer{text-align:center;padding:24px;color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9}@media(max-width:640px){nav{padding:16px 20px}.hero{padding:60px 20px 80px}.hero .desc p{font-size:15px}}</style></head><body><nav><span class="brand">Fly · 信任与归因基础设施</span><a href="/dashboard" class="cta-btn">溯源 Fly</a></nav><main class="hero"><p class="sub">AI时代的归因与验证基础设施</p><h1>每一次AI推荐，都应该产生可验证收入</h1><div class="desc"><p>Fly 为每一次AI推荐生成唯一Action ID</p><p>让推荐、咨询、成交与佣金形成完整验证链路</p></div><div class="compare"><div class="row"><span class="era">互联网时代——</span><span class="highlight">Google Analytics 证明流量价值</span></div><div class="row"><span class="era">AI时代——</span><span class="highlight">Fly 验证AI是否真正带来收入</span></div></div></main><div class="footer">Fly Attribution Infrastructure &copy; 2026 &mdash; 信任与归因基础设施</div></body></html>`;
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }

      // === Health ===
      if (path === '/v1/health' && method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return json({ status: 'ok', version: '2.0.0' });
        }
        const auth = await verifyBearerToken(authHeader, env);
        if (!auth.ok) return json({ error: auth.error }, 401);
        return json({ status: 'ok', version: '2.0.0', layers: 8, protocols: 6, timestamp: new Date().toISOString(), authenticated: true });
      }

      // === Dashboard: 只读实时数据面板 v2.1 ===
      if (path === '/dashboard' && method === 'GET') {
        try {
        const [agentRow, auditRow, vrfRow, trustRow, recentAuditRaw, trustHistoryRaw, actionsTrendRaw] = await Promise.all([
          env.FLY_D1.prepare("SELECT COUNT(*) as cnt FROM agents").first(),
          env.FLY_D1.prepare("SELECT COUNT(*) as cnt FROM audit_events").first(),
          env.FLY_D1.prepare("SELECT COUNT(*) as cnt FROM verifications").first(),
          env.FLY_D1.prepare("SELECT AVG(trust_score) as avg FROM agents").first(),
          env.FLY_D1.prepare("SELECT event_id, entity_type, entity_id, action, actor_type, actor_id, actor_name, source, reason, before_data, after_data, prev_hash, event_hash, created_at FROM audit_events ORDER BY created_at DESC LIMIT 100").all(),
          env.FLY_D1.prepare("SELECT created_at, after_data FROM audit_events WHERE entity_type = 'agent' AND action = 'updated' ORDER BY created_at ASC").all(),
          env.FLY_D1.prepare("SELECT DATE(created_at) as d, COUNT(*) as cnt FROM audit_events WHERE created_at > datetime('now','-30 days') GROUP BY DATE(created_at) ORDER BY d ASC").all(),
        ]);
        const agents = (agentRow as any)?.cnt ?? 0;
        const auditEvents = (auditRow as any)?.cnt ?? 0;
        const verifications = (vrfRow as any)?.cnt ?? 0;
        const trustScore = parseFloat(((trustRow as any)?.avg ?? 0).toFixed(0));
        const recentAudit = [];
        let chainBroken = 0;
        for (const evt of (recentAuditRaw.results as any[])) {
          const hashInput = '' + evt.prev_hash + evt.event_id + evt.entity_type + evt.entity_id + evt.action + evt.actor_id + evt.created_at;
          const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput));
          const expected = Array.from(new Uint8Array(hashBuf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
          const hv = evt.event_hash === expected;
          if (!hv) chainBroken++;
          recentAudit.push({ event_id: evt.event_id, entity_type: evt.entity_type, entity_id: evt.entity_id, action: evt.action, actor_type: evt.actor_type, actor_id: evt.actor_id, actor_name: evt.actor_name, source: evt.source, reason: evt.reason, before_data: evt.before_data, after_data: evt.after_data, prev_hash: evt.prev_hash, event_hash: evt.event_hash, created_at: evt.created_at, hash_valid: hv });
        }
        const chainChecked = auditEvents;
        const chainValid = chainBroken === 0;
        const chainPercent = chainChecked > 0 ? ((chainChecked - chainBroken) / chainChecked * 100).toFixed(1) : '100.0';
        const trustHistory = [];
        for (const r of (trustHistoryRaw.results as any[])) {
          try { const after = JSON.parse(r.after_data); if (after.trust_score !== undefined) { trustHistory.push({ date: r.created_at, score: after.trust_score }); } } catch(e) {}
        }
        const actionsTrend = (actionsTrendRaw.results as any[]).map(function(r) { return { date: r.d, count: r.cnt }; });
        const dataJson = JSON.stringify({ agents: agents, auditEvents: auditEvents, verifications: verifications, trustScore: trustScore, chainValid: chainValid, chainChecked: chainChecked, chainBroken: chainBroken, chainPercent: chainPercent, trustHistory: trustHistory, actionsTrend: actionsTrend, recentAudit: recentAudit, generatedAt: new Date().toISOString() });
        const htmlPart1 = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fly Dashboard</title><script src="https://cdn.jsdelivr.net/npm/chart.js@4"></` + `script><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0F172A;color:#e2e8f0;min-height:100vh}.header{background:linear-gradient(135deg,#0F172A,#1e293b);border-bottom:1px solid #2563EB;padding:24px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap}.header h1{font-size:24px;color:#60A5FA}.header .meta{font-size:12px;color:#94a3b8}.badge{display:inline-block;background:#2563EB;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px}.readonly{display:inline-block;background:#334155;color:#94a3b8;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;padding:24px 32px;max-width:1200px;margin:0 auto}.card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;transition:transform .2s,border-color .2s}.card:hover{transform:translateY(-2px);border-color:#2563EB}.card .label{font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px}.card .value{font-size:36px;font-weight:700;color:#60A5FA;margin-top:6px}.card .sub{font-size:11px;color:#64748b;margin-top:4px}.card.trust .value{color:#22c55e}.card.chain-green .value{color:#22c55e}.card.chain-yellow .value{color:#fbbf24}.card.chain-red .value{color:#ef4444}.section{padding:0 32px 24px;max-width:1200px;margin:0 auto}.section h2{font-size:16px;color:#e2e8f0;margin-bottom:12px;display:flex;align-items:center;gap:8px}.section h2 .tab{font-size:12px;padding:3px 10px;border-radius:6px;cursor:pointer;background:#334155;color:#94a3b8;border:none}.section h2 .tab.active{background:#2563EB;color:#fff}.chart-box{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;position:relative;height:280px}.chart-box canvas{width:100%!important;height:100%!important}.chart-box .chart-error{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#f87171;font-size:14px;text-align:center}.audit-header{display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}.search{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:8px 14px;color:#e2e8f0;font-size:13px;width:240px;outline:none}.search:focus{border-color:#2563EB}.table-wrap{background:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden}.audit-table{width:100%;border-collapse:collapse;font-size:13px}.audit-table th{background:#0F172A;color:#94a3b8;text-align:left;padding:10px 14px;font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;user-select:none;white-space:nowrap}.audit-table th:hover{color:#60A5FA}.audit-table td{padding:10px 14px;border-top:1px solid #334155;color:#e2e8f0;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.audit-table tr.row:hover{background:#1e293b}.audit-table tr.row{cursor:pointer}.hash{font-family:monospace;font-size:11px;color:#64748b}.tag{display:inline-block;font-size:10px;padding:1px 6px;border-radius:4px;font-weight:500}.tag.ok{background:#064e3b;color:#34d399}.tag.warn{background:#4a3520;color:#fbbf24}.tag.fail{background:#7f1d1d;color:#f87171}.tag.agent{background:#1e3a5f;color:#60a5fa}.tag.action{background:#3b1764;color:#a78bfa}.tag.verification{background:#3b4a2e;color:#86efac}.tag.policy{background:#4a3520;color:#fbbf24}.tag.role_assignment{background:#3b2040;color:#f472b6}.detail-row td{padding:0;border-top:1px solid #334155}.detail-box{background:#0c1222;padding:16px 20px;font-family:monospace;font-size:12px;color:#94a3b8;white-space:pre-wrap;word-break:break-all;line-height:1.6;max-height:300px;overflow-y:auto}.detail-box .k{color:#60a5fa}.detail-box .v{color:#e2e8f0}.pagination{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#94a3b8;font-size:12px}.pagination button{background:#334155;border:none;color:#e2e8f0;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px}.pagination button:hover{background:#2563EB}.pagination button:disabled{opacity:.4;cursor:default}.footer{text-align:center;padding:20px;color:#475569;font-size:11px;border-top:1px solid #1e293b;margin-top:16px}.empty{color:#64748b;text-align:center;padding:40px;font-size:13px}.data-error{background:#1e293b;border:1px solid #ef4444;border-radius:12px;padding:40px;text-align:center;color:#f87171;font-size:16px;margin:24px 32px;max-width:1200px}.data-error h2{font-size:20px;margin-bottom:8px}.data-error p{color:#94a3b8;font-size:13px}</style></head><body><div class="header"><div><h1>Fly Dashboard <span class="badge">v2.1</span><span class="readonly">READ ONLY</span></h1></div><div class="meta" id="genTime"></div></div><div id="mainContent"><div class="grid" id="cards"></div><div class="section"><h2>Trust Score Trend <button class="tab active" onclick="setRange(7)">7d</button><button class="tab" onclick="setRange(14)">14d</button><button class="tab" onclick="setRange(30)">30d</button></h2><div class="chart-box"><canvas id="trustChart"></canvas><div class="chart-error" id="trustChartError" style="display:none"></div></div></div><div class="section"><h2>Audit Events Trend</h2><div class="chart-box"><canvas id="actionsChart"></canvas><div class="chart-error" id="actionsChartError" style="display:none"></div></div></div><div class="section"><h2>Audit Browser</h2><div class="audit-header"><input class="search" id="searchInput" placeholder="Search events..." oninput="renderTable()"></div><div class="table-wrap"><table class="audit-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Hash</th><th>Chain</th></tr></thead><tbody id="auditBody"></tbody></table></div><div class="pagination" id="pagination"></div></div></div><div class="footer">Fly Audit System &copy; 2026 &mdash; Read-only dashboard &bull; No data modification allowed</div><script>var D=`;
        const htmlPart2 = `;</` + `script><script>var PAGE=1,PER=15,EXPANDED={};function init(){if(!D||!D.generatedAt){document.getElementById('mainContent').innerHTML='<div class="data-error"><h2>Data Source Unavailable</h2><p>Unable to load dashboard data. Please check API health and try again.</p></div>';return;}document.getElementById('genTime').textContent='Generated: '+D.generatedAt.slice(0,19).replace('T',' ');renderCards();if(typeof Chart!=='undefined'){renderTrustChart(7);renderActionsChart();}else{document.getElementById('trustChartError').style.display='block';document.getElementById('trustChartError').textContent='Chart.js failed to load';document.getElementById('actionsChartError').style.display='block';document.getElementById('actionsChartError').textContent='Chart.js failed to load';}renderTable();}function getChainCls(pct){var p=parseFloat(pct);if(p>=100)return'chain-green';if(p>=95)return'chain-yellow';return'chain-red';}function getChainTagCls(pct){var p=parseFloat(pct);if(p>=100)return'ok';if(p>=95)return'warn';return'fail';}function renderCards(){var c=document.getElementById('cards');var items=[{label:'Trust Score',value:D.trustScore,sub:'average across agents',cls:'trust'},{label:'Agents',value:D.agents,sub:'registered agents',cls:''},{label:'Audit Events',value:D.auditEvents.toLocaleString(),sub:'total logged events',cls:''},{label:'Chain Valid',value:D.chainPercent+'%',sub:D.chainChecked+' checked, '+D.chainBroken+' broken',cls:getChainCls(D.chainPercent)},{label:'Verifications',value:D.verifications,sub:'verification records',cls:''}];var h='';for(var i=0;i<items.length;i++){var it=items[i];h+='<div class="card '+it.cls+'"><div class="label">'+it.label+'</div><div class="value">'+it.value+'</div><div class="sub">'+it.sub+'</div></div>';}c.innerHTML=h;}var trustChartInstance=null;function renderTrustChart(days){var ctx=document.getElementById('trustChart').getContext('2d');if(trustChartInstance)trustChartInstance.destroy();var cutoff=new Date();cutoff.setDate(cutoff.getDate()-days);var filtered=D.trustHistory.filter(function(p){return new Date(p.date)>=cutoff;});if(filtered.length===0){var now=new Date();filtered=[{date:now.toISOString(),score:D.trustScore}];}var labels=filtered.map(function(p){return p.date.slice(5,10);});var scores=filtered.map(function(p){return p.score;});trustChartInstance=new Chart(ctx,{type:'line',data:{labels:labels,datasets:[{label:'Trust Score',data:scores,borderColor:'#22c55e',backgroundColor:'rgba(34,197,94,0.1)',fill:true,tension:0.3,pointRadius:4,pointBackgroundColor:'#22c55e'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#64748b',font:{size:10}},grid:{color:'#1e293b'}},y:{min:0,max:100,ticks:{color:'#64748b',font:{size:10}},grid:{color:'#1e293b'}}}}});}function setRange(days){var tabs=document.querySelectorAll('.section .tab');for(var i=0;i<tabs.length;i++){tabs[i].classList.remove('active');if(tabs[i].textContent===days+'d')tabs[i].classList.add('active');}renderTrustChart(days);}var actionsChartInstance=null;function renderActionsChart(){var ctx=document.getElementById('actionsChart').getContext('2d');if(actionsChartInstance)actionsChartInstance.destroy();var labels=D.actionsTrend.map(function(p){return p.date.slice(5);});var counts=D.actionsTrend.map(function(p){return p.count;});actionsChartInstance=new Chart(ctx,{type:'bar',data:{labels:labels,datasets:[{label:'Events',data:counts,backgroundColor:'rgba(37,99,235,0.7)',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#64748b',font:{size:10},maxRotation:45},grid:{display:false}},y:{ticks:{color:'#64748b',font:{size:10}},grid:{color:'#1e293b'}}}}});}function renderTable(){var q=document.getElementById('searchInput').value.toLowerCase();var filtered=D.recentAudit.filter(function(e){if(!q)return true;return(e.action+e.actor_name+e.entity_type+e.entity_id+e.event_id).toLowerCase().indexOf(q)>=0;});var total=filtered.length;var pages=Math.ceil(total/PER)||1;if(PAGE>pages)PAGE=pages;var start=(PAGE-1)*PER;var page=filtered.slice(start,start+PER);var body=document.getElementById('auditBody');var h='';for(var i=0;i<page.length;i++){var e=page[i];var eid=e.event_id;var isExp=EXPANDED[eid];var chainTag=getChainTagCls(e.hash_valid?100:0);h+='<tr class="row" onclick="toggleRow(\''+eid+'\')"><td>'+e.created_at.slice(5,19).replace('T',' ')+'</td><td>'+(e.actor_name||e.actor_id)+'</td><td><span class="tag '+e.action+'">'+e.action+'</span></td><td><span class="tag '+e.entity_type+'">'+e.entity_type+':'+e.entity_id.slice(0,12)+'...</span></td><td><span class="hash">'+e.event_hash.slice(0,12)+'...</span></td><td><span class="tag '+chainTag+'">'+(e.hash_valid?'VALID':'BROKEN')+'</span></td></tr>';if(isExp){h+='<tr class="detail-row"><td colspan="6"><div class="detail-box">';var detail={event_id:e.event_id,entity_type:e.entity_type,entity_id:e.entity_id,action:e.action,actor_type:e.actor_type,actor_id:e.actor_id,actor_name:e.actor_name,source:e.source,reason:e.reason,prev_hash:e.prev_hash,event_hash:e.event_hash,chain_valid:e.hash_valid,created_at:e.created_at};if(e.before_data&&e.before_data!=='{}'){try{detail.before=JSON.parse(e.before_data);}catch(x){detail.before=e.before_data;}}if(e.after_data&&e.after_data!=='{}'){try{detail.after=JSON.parse(e.after_data);}catch(x){detail.after=e.after_data;}}h+=formatJson(detail);h+='</div></td></tr>';}}body.innerHTML=h;renderPagination(total,pages);}function formatJson(obj){var lines=JSON.stringify(obj,null,2).split('\n');var out='';for(var i=0;i<lines.length;i++){var line=lines[i];var m=line.match(/^(\s*)"([^"]+)":/);if(m){out+=m[1]+'<span class="k">'+m[2]+'</span>:'+line.slice(m[0].length)+'\n';}else{out+=line+'\n';}}return out;}function toggleRow(eid){EXPANDED[eid]=!EXPANDED[eid];renderTable();}function renderPagination(total,pages){var p=document.getElementById('pagination');if(total<=PER){p.innerHTML='<span>'+total+' events</span>';return;}p.innerHTML='<button onclick="goPage('+(PAGE-1)+')" '+(PAGE<=1?'disabled':'')+'>Prev</button><span>Page '+PAGE+' / '+pages+' ('+total+' events)</span><button onclick="goPage('+(PAGE+1)+')" '+(PAGE>=pages?'disabled':'')+'>Next</button>';}function goPage(p){PAGE=p;renderTable();window.scrollTo({top:document.querySelector('.audit-header').offsetTop-60,behavior:'smooth'});}init();</` + `script></body></html>`;
        const html = htmlPart1 + dataJson + htmlPart2;
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
        } catch(err) {
          const errorHtml = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fly Dashboard</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0F172A;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}</style></head><body><div style="background:#1e293b;border:1px solid #ef4444;border-radius:12px;padding:40px;text-align:center;max-width:500px"><h1 style="color:#f87171;font-size:24px;margin-bottom:12px">Data Source Unavailable</h1><p style="color:#94a3b8;font-size:14px">Unable to connect to database. Please check API health and try again later.</p><p style="color:#64748b;font-size:12px;margin-top:12px">Error: ' + (err.message || 'unknown') + '</p></div></body></html>';
          return new Response(errorHtml, { status: 503, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
        }
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
        const existing = await env.FLY_D1.prepare("SELECT id FROM actions WHERE user_id = ? AND agent_id = ? AND channel = ? AND signal_type = ? AND created_at > datetime('now', '-24 hours') LIMIT 1").bind(body.user_id ?? null, body.agent_id, body.channel, body.signal_type).first();
        if (existing) return json({ success: true, action_id: existing.id, dedup: true });
        const actionId = `act_${crypto.randomUUID()}`;
        const metadata: any = body.metadata || {};
        metadata.signal_quality = body.signal_quality || "raw";
        metadata.human_score = body.human_score || 0;
        await env.FLY_D1.prepare("INSERT INTO actions (id, agent_id, channel, user_id, signal_type, short_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))").bind(actionId, body.agent_id, body.channel, body.user_id ?? null, body.signal_type, body.short_id || null, JSON.stringify(metadata)).run();
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
        // 铁律1：verifier ≠ subject
        if (body.verifier_id === body.agent_id) {
          return json({ error: "verification rejected: verifier cannot be the same as subject (self-verification forbidden)" }, 403);
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
        await env.FLY_D1.prepare("INSERT INTO verifications (id, action_id, verifier, result, confidence, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").bind(verificationId, body.action_id || null, body.verifier_id || body.verifier, body.result || 'pending', body.confidence || 0, JSON.stringify(body.evidence)).run();
        await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'verification', entity_id: verificationId, action: 'created', actor_type: verifierType === 'system' ? 'system' : 'user', actor_id: body.verifier_id, actor_name: body.verifier_name || body.verifier_id, source: 'api', reason: 'verification_created', before: '{}', after: JSON.stringify({ verification_id: verificationId, verifier: body.verifier, verifier_type: verifierType, result: body.result }) });
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
        const ipHash = await hmacUserId(clientIP, env.IP_SALT || 'fly-attribution-salt-2026');
        await env.FLY_D1.prepare("INSERT INTO actions (id, agent_id, channel, user_id, signal_type, short_id, metadata, created_at) VALUES (?, ?, ?, ?, 'click', ?, ?, datetime('now'))").bind(`act_${crypto.randomUUID()}`, action?.agent_id || 'agt_system', action?.channel || 'direct', ipHash, actionId, JSON.stringify({ referrer: request.headers.get('Referer') || '', ua: userAgent.slice(0, 200), signal_quality: signalQuality, bot_name: botResult.botName || null, human_score: 0 })).run();
        return Response.redirect('https://fly-agent.xyz', 302);
      }

      // === 漏洞6：信号质量升级 ===
      if (path === '/v1/signal/verify' && method === 'POST') {
        const body: any = await request.json();
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

      // === 漏洞7：审计链查询 ===
      // === Audit Verify Chain: 全表链验证 ===
      if (path === '/v1/audit/verify-chain' && method === 'POST') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);
        const allEvents = await env.FLY_D1.prepare("SELECT event_id, entity_type, entity_id, action, actor_id, prev_hash, event_hash, created_at FROM audit_events ORDER BY created_at ASC").all();
        let checked = allEvents.results.length;
        let broken = 0;
        for (const evt of allEvents.results as any[]) {
          const hashInput = `${evt.prev_hash}${evt.event_id}${evt.entity_type}${evt.entity_id}${evt.action}${evt.actor_id}${evt.created_at}`;
          const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput));
          const expected = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
          if (evt.event_hash !== expected) broken++;
        }
        return json({ valid: broken === 0, checked, broken });
      }

      // === Audit Export: 下载完整审计JSON ===
      if (path.startsWith('/v1/audit/export/') && method === 'GET') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);
        const parts = path.split('/v1/audit/export/')[1].split('/');
        const rawEntityType = parts[0];
        const entityId = parts[1];
        const entityTypeMap: Record<string, string> = { agents: 'agent', actions: 'action', verifications: 'verification', role_assignments: 'role_assignment', policies: 'policy' };
        const entityType = entityTypeMap[rawEntityType] || rawEntityType.replace(/s$/, '');
        if (!entityId) return json({ error: "entity_id is required" }, 400);
        const events = await env.FLY_D1.prepare("SELECT * FROM audit_events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC").bind(entityType, entityId).all();
        let chainValid = true;
        for (const evt of events.results as any[]) {
          const hashInput = `${evt.prev_hash}${evt.event_id}${evt.entity_type}${evt.entity_id}${evt.action}${evt.actor_id}${evt.created_at}`;
          const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput));
          const expected = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
          if (evt.event_hash !== expected) { chainValid = false; break; }
        }
        const exportData = {
          fly_audit_export: true,
          export_time: new Date().toISOString(),
          entity_type: entityType,
          entity_id: entityId,
          chain_valid: chainValid,
          total_events: events.results.length,
          events: events.results
        };
        return new Response(JSON.stringify(exportData, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="audit-${entityType}-${entityId}.json"`,
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      if (path.startsWith('/v1/audit/') && method === 'GET') {
        const parts = path.split('/v1/audit/')[1].split('/');
        const rawEntityType = parts[0];
        const entityId = parts[1];
        // URL用复数（agents/actions），数据库存单数（agent/action），统一映射
        const entityTypeMap: Record<string, string> = { agents: 'agent', actions: 'action', verifications: 'verification', role_assignments: 'role_assignment', policies: 'policy' };
        const entityType = entityTypeMap[rawEntityType] || rawEntityType.replace(/s$/, '');
        const events = await env.FLY_D1.prepare("SELECT * FROM audit_events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC").bind(entityType, entityId).all();
        // 验证每条记录自身的event_hash是否基于其prev_hash正确计算
        // 全局链跨所有entity，单entity查询只能逐条自验
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
        const roles = await getPrincipalRoles(env, body.principal_type || 'human', body.principal_id || 'usr_owner');
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

      return json({ error: "not found", hint: "try /v1/health" }, 404);
    } catch (err: any) {
      return json({ error: err.message || 'internal server error' }, 500);
    }
  },
};
