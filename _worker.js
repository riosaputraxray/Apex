import worker from './worker.js';
const ipCache = new Map();
const banCache = new Map();
const MY_SECRET_KEY = 'mozarivalda123';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') || 'anon';
    const now = Date.now();
    const key = url.searchParams.get('key');
    const cookie = request.headers.get('Cookie') || '';

    if (key === MY_SECRET_KEY || cookie.includes(MY_SECRET_KEY)) {
      const res = await worker.fetch(request, env, ctx);
      const newRes = new Response(res.body, res);
      newRes.headers.set('Set-Cookie', `auth=${MY_SECRET_KEY}; Path=/; Max-Age=86400; HttpOnly`);
      return newRes;
    }

    const banned = banCache.get(ip);
    if (banned && now < banned) {
      return new Response('Banned', { status: 403 });
    }

    let data = ipCache.get(ip);
    if (!data) {
      data = { count: 1, time: now };
      ipCache.set(ip, data);
    } else {
      if (now - data.time < 60000) {
        data.count++;
        if (data.count > 20) {
          banCache.set(ip, now + 86400000);
          ipCache.delete(ip);
          return new Response('Too Many Requests', { status: 429 });
        }
      } else {
        data.count = 1;
        data.time = now;
      }
    }

    const blocked = ['/.env', '/.git', '/wp-admin', '/phpmyadmin', '/config.json'];
    if (blocked.some(p => url.pathname.toLowerCase().includes(p))) {
      return new Response('Not Found', { status: 404 });
    }

    const ua = (request.headers.get('User-Agent') || '').toLowerCase();
    const badUA = ['python', 'curl', 'go-http', 'nikto', 'sqlmap', 'masscan', 'zgrab'];
    if (badUA.some(b => ua.includes(b))) {
      return new Response('Forbidden', { status: 403 });
    }

    const response = await worker.fetch(request, env, ctx);
    const finalRes = new Response(response.body, response);
    finalRes.headers.set('X-Frame-Options', 'DENY');
    finalRes.headers.set('X-Content-Type-Options', 'nosniff');
    return finalRes;
  }
                                        }
