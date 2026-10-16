import worker from './worker.js';

const ipCache = new Map();
const banCache = new Map();
const MY_SECRET_KEY = 'mozacantik123';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ua = (request.headers.get('User-Agent') || '').toLowerCase();
    const ip = request.headers.get('CF-Connecting-IP') || 'anon';
    const now = Date.now();
    const key = url.searchParams.get('key');
    const cookie = request.headers.get('Cookie') || '';

    const isMe = key === MY_SECRET_KEY || cookie.includes(MY_SECRET_KEY);

    if (ua.includes('facebookexternalhit') || ua.includes('facebot') || ua.includes('whatsapp') || ua.includes('twitterbot')) {
      return worker.fetch(request, env, ctx);
    }

    if (isMe) {
      url.searchParams.delete('key');
      const newReq = new Request(url.toString(), request);
      const res = await worker.fetch(newReq, env, ctx);
      const newRes = new Response(res.body, res);
      newRes.headers.set('Set-Cookie', `auth=${MY_SECRET_KEY}; Path=/; Max-Age=86400; Secure; SameSite=Lax`);
      return newRes;
    }

    if (url.pathname.startsWith('/panel') || url.pathname.startsWith('/api') || url.pathname === '/') {
      const banned = banCache.get(ip);
      if (banned && now < banned) return new Response('Not Found', { status: 404 });

      let data = ipCache.get(ip);
      if (!data) {
        data = { count: 1, time: now };
        ipCache.set(ip, data);
      } else {
        if (now - data.time < 60000) {
          data.count++;
          if (data.count > 5) {
            banCache.set(ip, now + 86400000);
            return new Response('Not Found', { status: 404 });
          }
        } else {
          data.count = 1;
          data.time = now;
        }
      }
      return new Response('Not Found', { status: 404 });
    }

    return worker.fetch(request, env, ctx);
  }
        }
