const ipCache = new Map();
const banCache = new Map();
const MY_SECRET_KEY = 'mozacantik123';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') || 'anon';
    const now = Date.now();
    const key = url.searchParams.get('key');
    const cookie = request.headers.get('Cookie') || '';
    const isMe = key === MY_SECRET_KEY || cookie.includes(MY_SECRET_KEY);

    if (isMe) {
      url.searchParams.delete('key');
      const newReq = new Request(url.toString(), request);
      const res = await env.ASSETS.fetch(newReq);
      const newRes = new Response(res.body, res);
      newRes.headers.set('Set-Cookie', `auth=${MY_SECRET_KEY}; Path=/; Max-Age=86400; Secure; SameSite=Lax`);
      return newRes;
    }

    if (url.pathname.startsWith('/panel')) {
      const banned = banCache.get(ip);
      if (banned && now < banned) return new Response('Banned', { status: 403 });
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

    return env.ASSETS.fetch(request);
  }
}
