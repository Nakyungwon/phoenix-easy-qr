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

    // 요청마다 한 줄씩 Workers Logs에 남긴다. 헤더(세션 쿠키)와 본문(비밀번호)은 남기지 않는다.
    // reason은 프록시가 막았거나 실패한 이유, 또는 화면이 보고한 오류 종류다.
    const started = Date.now();
    let status = 'exception';
    let reason;
    try {
      const result = await proxy(request, env, url);
      status = result.res.status;
      reason = result.reason;
      return result.res;
    } finally {
      console.log({ method: request.method, path: url.pathname.slice(3), status, reason, country: request.cf?.country, ms: Date.now() - started });
    }
  },
};

const blocked = (status, reason) => ({ res: new Response(reason, { status }), reason });

async function proxy(request, env, url) {
  const path = url.pathname.slice(3);
  // 앱 화면이 보낸 요청만 받는다. X-App 같은 커스텀 헤더는 다른 사이트의 브라우저 요청에 붙일 수 없고,
  // 다른 출처를 밝힌 요청도 막는다. 스크립트는 둘 다 꾸밀 수 있으므로 아래 IP별 제한이 실제 방어선이다.
  const origin = request.headers.get('Origin');
  if (request.headers.get('X-App') !== 'phoenix-easy-qr' || (origin && origin !== url.origin)) {
    return blocked(403, 'bad-origin');
  }
  // 대입 공격으로 휘닉스가 이 워커를 차단하거나 무료 한도를 다 쓰지 않게 IP별로 묶는다. 한도는 wrangler.toml.
  const { success } = await env.PX_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
  if (!success) return blocked(429, 'rate-limit');

  if (request.method === 'POST' && path === '/_error') return clientError(request);
  if (!ALLOWED.has(`${request.method} ${path}`)) return blocked(403, 'path-not-allowed');

  const headers = new Headers({ 'User-Agent': UA });
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  const session = request.headers.get('X-Session');
  if (session) headers.set('Cookie', session);

  let upstream;
  try {
    upstream = await fetch(ORIGIN + path, {
      method: request.method,
      headers,
      body: request.method === 'GET' ? undefined : request.body,
      redirect: 'manual',
    });
  } catch (err) {
    // 502로 돌려주면 화면이 "잠시 후 다시 시도"로 안내한다.
    return blocked(502, `upstream-error: ${err.message}`.slice(0, 200));
  }

  // 비밀번호가 담긴 요청 본문은 로그로 남기지 않는다. 응답만 그대로 돌려준다.
  const out = new Headers({
    'Content-Type': upstream.headers.get('Content-Type') || 'text/plain',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  const cookies = upstream.headers.getSetCookie().map((c) => c.split(';')[0]);
  if (cookies.length) out.set('X-Session', mergeCookies(session, cookies));
  return { res: new Response(upstream.body, { status: upstream.status, headers: out }) };
}

// 화면(PWA)이 보낸 오류 보고. { action: '로그인', code: 'login-failed-200' } 형태만 받아서 reason으로 남긴다.
// 아무 글이나 로그에 남지 않도록 길이와 글자를 제한한다.
async function clientError(request) {
  const text = await request.text();
  let report = {};
  try {
    report = text.length <= 300 ? JSON.parse(text) : {};
  } catch {}
  const action = /^[\w가-힣 ]{1,20}$/.test(report.action) ? report.action : 'invalid';
  const code = /^[\w-]{1,40}$/.test(report.code) ? report.code : 'invalid';
  return { res: new Response(null, { status: 204 }), reason: `client-error ${action}: ${code}` };
}

// 기존 세션 쿠키에 새로 받은 쿠키를 이름 기준으로 덮어쓴다.
function mergeCookies(existing, fresh) {
  const jar = new Map();
  for (const c of [...(existing ? existing.split('; ') : []), ...fresh]) {
    const i = c.indexOf('=');
    if (i > 0) jar.set(c.slice(0, i), c);
  }
  return [...jar.values()].join('; ');
}
