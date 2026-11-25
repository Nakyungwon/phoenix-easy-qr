// PWA용 프록시. 브라우저는 CORS 때문에 휘닉스를 직접 부를 수 없어서 이 워커가 대신 호출한다.
// 정적 파일(www/)도 같은 워커가 내려주므로 PWA와 프록시가 같은 출처라 CORS가 없다.
//
// 세션: 휘닉스가 주는 쿠키(JSESSIONID 등)를 X-Session 응답 헤더로 넘기고,
// 브라우저가 다음 요청에 X-Session 요청 헤더로 돌려주면 Cookie 헤더로 바꿔 붙인다. 워커는 아무것도 저장하지 않는다.
const ORIGIN = 'https://phoenixhnr.co.kr';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

// 앱이 쓰는 경로만 열어둔다. 아무 주소나 중계하는 공개 프록시가 되지 않게 한다.
const ALLOWED = new Set([
  'POST /api/member/login',
  'GET /api/member/logout',
  'GET /m/page/mypage/history/snowpark',
  'POST /api/reservation/pyeongchang/snowpark/season/updateFngprtRegDttm',
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/px/')) return env.ASSETS.fetch(request);

    const path = url.pathname.slice(3);
    if (!ALLOWED.has(`${request.method} ${path}`)) return new Response('not allowed', { status: 403 });

    // 앱 화면이 보낸 요청만 받는다. X-App 같은 커스텀 헤더는 다른 사이트의 브라우저 요청에 붙일 수 없고,
    // 다른 출처를 밝힌 요청도 막는다. 스크립트는 둘 다 꾸밀 수 있으므로 아래 IP별 제한이 실제 방어선이다.
    const origin = request.headers.get('Origin');
    if (request.headers.get('X-App') !== 'phoenix-easy-qr' || (origin && origin !== url.origin)) {
      return new Response('forbidden', { status: 403 });
    }
    // 대입 공격으로 휘닉스가 이 워커를 차단하거나 무료 한도를 다 쓰지 않게 IP별로 묶는다. 한도는 wrangler.toml.
    const { success } = await env.PX_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
    if (!success) return new Response('too many requests', { status: 429 });

    const headers = new Headers({ 'User-Agent': UA });
    const contentType = request.headers.get('Content-Type');
    if (contentType) headers.set('Content-Type', contentType);
    const session = request.headers.get('X-Session');
    if (session) headers.set('Cookie', session);

    const upstream = await fetch(ORIGIN + path, {
      method: request.method,
      headers,
      body: request.method === 'GET' ? undefined : request.body,
      redirect: 'manual',
    });

    // 비밀번호가 담긴 요청 본문은 로그로 남기지 않는다. 응답만 그대로 돌려준다.
    const out = new Headers({
      'Content-Type': upstream.headers.get('Content-Type') || 'text/plain',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    const cookies = upstream.headers.getSetCookie().map((c) => c.split(';')[0]);
    if (cookies.length) out.set('X-Session', mergeCookies(session, cookies));
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};

// 기존 세션 쿠키에 새로 받은 쿠키를 이름 기준으로 덮어쓴다.
function mergeCookies(existing, fresh) {
  const jar = new Map();
  for (const c of [...(existing ? existing.split('; ') : []), ...fresh]) {
    const i = c.indexOf('=');
    if (i > 0) jar.set(c.slice(0, i), c);
  }
  return [...jar.values()].join('; ');
}
