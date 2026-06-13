// Fly Chat Gateway — Cloudflare Pages Function
// 前端 → 本函数 → Coze v3/chat API（SSE流式）
// Token永不出服务端，前端零直连扣子

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const { message, conversation_id } = body;

    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ error: '消息不能为空' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // IP隔离user_id
    const ip = request.headers.get('CF-Connecting-IP') || 'anon';
    const userId = 'web_' + ip.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24);

    // 获取Token：优先环境变量，回退已有token Worker
    let token;
    if (env && env.COZE_SAT_TOKEN) {
      token = env.COZE_SAT_TOKEN;
    } else {
      const tokenRes = await fetch('https://api.fly-agent.xyz/coze-token');
      const tokenData = await tokenRes.json();
      token = tokenData.access_token;
    }

    if (!token) {
      return new Response(JSON.stringify({ error: '鉴权失败' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
