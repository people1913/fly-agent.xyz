// Fly Chat Gateway Worker — 独立版本
// 部署方式: Cloudflare Worker (fly-coze-token 或新Worker)
// 路由: api.fly-agent.xyz/chat
// Token永不出服务端，前端零直连扣子

export default {
  async fetch(request, env, ctx) {
    // CORS预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    // 原有 /coze-token 路由（保留）
    const url = new URL(request.url);
    if (url.pathname === '/coze-token' || url.pathname === '/') {
      return handleTokenRequest(request, env);
    }

    // 新增 /chat 路由
    if (url.pathname === '/chat' && request.method === 'POST') {
      return handleChatRequest(request, env);
    }

    return new Response('Not Found', { status: 404 });
  }
};

// ========== 原有Token逻辑 ==========
async function handleTokenRequest(request, env) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT', kid: 'zaIbf7Vxb8_nKufEopm3t8jEZl0FRZiKJhc4fDRvj3U' };
    const payload = {
      iss: '1284658005875',
      iat: now,
      exp: now + 3600,
      jti: crypto.randomUUID()
    };

    function base64url(str) {
      return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signInput = headerB64 + '.' + payloadB64;

    const keyPem = env.PRIVATE_KEY || '';
    const key = await crypto.subtle.importKey(
      'pkcs8', pemToBuffer(keyPem),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
    );

    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signInput));
    const token = signInput + '.' + base64url(String.fromCharCode(...new Uint8Array(sig)));

    return new Response(JSON.stringify({ access_token: token, expires_in: 3600 }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

function pemToBuffer(pem) {
  const b64 = pem.replace(/-----BEGIN.*?-----/g, '').replace(/-----END.*?-----/g, '').replace(/\s/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// ========== 新增Chat逻辑 ==========
async function handleChatRequest(request, env) {
  try {
    const body = await request.json();
    const { message, conversation_id } = body;

    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ error: '消息不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // IP隔离user_id
    const ip = request.headers.get('CF-Connecting-IP') || 'anon';
    const userId = 'web_' + ip.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24);

    // 获取Token（复用token逻辑）
    let token;
    if (env && env.COZE_SAT_TOKEN) {
      token = env.COZE_SAT_TOKEN;
    } else {
      const tokenRes = await handleTokenRequest(request, env);
      const tokenData = await tokenRes.json();
      token = tokenData.access_token;
    }

    if (!token) {
      return new Response(JSON.stringify({ error: '鉴权失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 构造Coze v3/chat请求
    const chatBody = {
      bot_id: '7646639665533222948',
      user_id: userId,
      stream: true,
      auto_save_history: true,
      additional_messages: [{
        role: 'user',
        content: message,
        content_type: 'text'
      }]
    };

    const chatUrl = conversation_id
      ? 'https://api.coze.cn/v3/chat?conversation_id=' + encodeURIComponent(conversation_id)
      : 'https://api.coze.cn/v3/chat';

    const cozeRes = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatBody)
    });

    if (!cozeRes.ok) {
      const errText = await cozeRes.text();
      return new Response(JSON.stringify({ error: 'Coze API错误', detail: errText }), {
        status: cozeRes.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 流式转发SSE
    return new Response(cozeRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
