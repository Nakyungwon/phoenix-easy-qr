// 앱에서는 Capacitor가 fetch를 네이티브 HTTP로 바꿔 보내므로 CORS가 없고, 쿠키(JSESSIONID)도 네이티브 쿠키 저장소가 알아서 붙인다.
const BASE = 'https://phoenixhnr.co.kr';
const platform = window.Capacitor ? Capacitor.getPlatform() : 'web';

// 앱(안드로이드/iOS)은 네이티브 HTTP로 휘닉스를 직접 부르고 쿠키도 네이티브가 관리한다.
// 웹(PWA)은 CORS 때문에 같은 출처의 프록시(/px/...)를 거치고, 휘닉스 세션 쿠키를 X-Session 헤더로 주고받는다.
const SESSION_KEY = 'pxSession';
// 휘닉스 서버에 닿지 못한 경우(502~504, Cloudflare 520~527)와 프록시 요청 제한(429)에 걸린 경우다.
// 아이디/비번 문제가 아니라 잠시 뒤 다시 하면 되는 오류라, 상태 코드 대신 그렇게 안내한다.
// 오류에 종류(code)를 붙여 둔다. 화면 문구에는 휘닉스가 보낸 원문이 섞일 수 있어서, 오류 보고에는 종류만 보낸다.
const fail = (code, message) => Object.assign(new Error(message), { code });
const RETRY_LATER = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527]);
// PWA 프록시가 휘닉스에 닿지 못하면 새 요청으로 두 번까지 다시 보낸다. 같은 워커 호출 안에서는 계속 실패해도
// 새 요청은 대부분 성공하는 것을 실측으로 확인했다. 중계하는 경로는 두 번 처리돼도 결과가 같다.
const PROXY_RETRY = new Set([502, 520, 521, 522, 525]);
async function api(path, init = {}) {
  let res = platform === 'web' ? await proxyFetch(path, init) : await fetch(BASE + path, init);
  for (let retry = 0; platform === 'web' && retry < 2 && PROXY_RETRY.has(res.status); retry++) res = await proxyFetch(path, init);
  if (RETRY_LATER.has(res.status)) throw fail(`upstream-${res.status}`, `휘닉스 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요. (${res.status})`);
  if (res.status === 429) throw fail('rate-limit', '요청이 너무 많아요. 1분쯤 뒤에 다시 시도해 주세요.');
  return res;
}
async function proxyFetch(path, init) {
  const headers = new Headers(init.headers);
  headers.set('X-App', 'phoenix-easy-qr');
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session) headers.set('X-Session', session);
  const res = await fetch('/px' + path, { ...init, headers });
  const fresh = res.headers.get('X-Session');
  if (fresh) sessionStorage.setItem(SESSION_KEY, fresh);
  return res;
}
// QR은 KST 자정까지만 유효하다. 받은 QR 번호를 날짜와 함께 둔다.
const QR_KEY = 'qr';
// 마지막으로 신청 API에 보낸 값. 화면 확인용이다.
const TICKET_KEY = 'lastTicket';
const kstToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const nextMidnight = () => Date.parse(`${kstToday()}T00:00:00+09:00`) + 24 * 60 * 60 * 1000;
const $ = (s) => document.querySelector(s);
const NEED_LOGIN = '로그인이 필요해요';

// 저장된 오늘 QR { date, issueNo, img }. 날짜가 지났으면 null.
const todayQr = () => {
  const saved = JSON.parse(localStorage.getItem(QR_KEY) || 'null');
  return saved && saved.date === kstToday() && saved.img ? saved : null;
};

// 서버 메시지에 섞여 오는 HTML(<br>, </br>, &nbsp; 등)을 줄바꿈이 살아 있는 평문으로 바꾼다.
const plainText = (html) => {
  const withBreaks = String(html).replace(/<\/?br\s*\/?>/gi, '\n');
  return new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent.trim();
};

async function login(id, pw) {
  const form = new FormData();
  form.append('mbNo', id);
  form.append('mbPw', pw);
  const res = await api('/api/member/login', { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.logged !== 'Y') throw fail(`login-failed-${res.status}`, body.msg ? plainText(body.msg) : `로그인 실패 (${res.status})`);
}

async function fetchSeasonInfo() {
  const res = await api('/m/page/mypage/history/snowpark');
  if (res.status === 401) throw fail('need-login', NEED_LOGIN);
  if (!res.ok) throw fail(`season-page-${res.status}`, `시즌패스 페이지 실패 (${res.status})`);
  const info = parseSeasonInfo(await res.text());
  showHolder(info);
  return info;
}

// 페이지의 seasonInfo를 보내되, 이전 발급 결과 필드는 미발급 상태로 비워서 보낸다. 실패하면 응답의 responseMessage에 사유가 온다.
async function apply(info) {
  const body = {
    ...info,
    custNo: String(info.custNo),
    mpSstkIssueNo: '',
    mpSstkIssueResult: '',
    ordrBarCd: '',
    fngprtRegYn: 'N',
    qrViewYn: '',
  };
  localStorage.setItem(TICKET_KEY, JSON.stringify(body));
  const res = await api('/api/reservation/pyeongchang/snowpark/season/updateFngprtRegDttm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw fail('need-login', NEED_LOGIN);
  const result = await res.json().catch(() => ({}));
  if (!res.ok || result.responseMessage) throw fail(`apply-failed-${res.status}`, `QR 신청 실패 (${res.status}): ${plainText(result.responseMessage || '')}`);
}

// 페이지의 fngprtRegYn/QR 번호가 자정에 초기화되는지 알 수 없어서, 그날 첫 QR 받기는 항상 신청부터 한다.
async function getIssueNo() {
  await apply(await fetchSeasonInfo());
  const info = await fetchSeasonInfo();
  if (!info.mpSstkIssueNo) throw fail('no-issue-no', `QR 번호가 없어요 (${info.mpSstkIssueResult || '사유 없음'})`);
  return info.mpSstkIssueNo;
}

// 티켓 카드 머리글은 로그인한 계정의 시즌패스 페이지 값으로만 채운다. 로그아웃 상태면 비운다.
function showHolder(info) {
  $('#season').textContent = (info && info.sesnDivNm) || '시즌패스';
  $('#holder').textContent = info ? maskName(info.showKorCustNm) || '-' : '로그인 전';
  // 계정 카드에는 아이디 대신 가린 이름을 보여준다. 이름은 시즌패스 페이지를 읽은 뒤에야 알 수 있다.
  if (info) $('#who').textContent = maskName(info.showKorCustNm) || '휘닉스 회원';
  $('#ticketNo').textContent = (info && info.viewTcktNo) || '';
}

// 사이트와 같은 QR 이미지를 받아 data URL로 바꾼다. 직접 그리면 마스크 패턴이 달라져 모양이 달라진다.
// api.qrserver.com이 CORS를 허용(Access-Control-Allow-Origin: *)해서 캔버스로 옮겨 저장할 수 있다.
function fetchQrImage(issueNo) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(fail('qr-image', 'QR 이미지를 불러오지 못했어요'));
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?qzone=1&data=' + encodeURIComponent(issueNo);
  });
}

// QR이 없으면 QR 자리에 받기 버튼을, 있으면 QR과 초기화 버튼을 보여준다.
// stale: 날이 바뀌었는데 어제와 같은 번호가 온 경우다. 경고를 띄우고 초기화 버튼을 '다시 받기'로 바꾼다.
let staleShown = false;
function showQr(qr, stale = false) {
  staleShown = !!qr && stale;
  $('#qrImg').hidden = !qr;
  $('#qrEmpty').hidden = !!qr;
  $('#clear').hidden = !qr;
  $('#clear').textContent = staleShown ? '다시 받기' : 'QR 초기화';
  $('#qrImg').src = qr ? qr.img : '';
  $('#qrImg').alt = qr ? `입장 QR ${qr.issueNo}` : '';
  $('#issueNo').textContent = qr ? qr.issueNo : '';
  $('#valid').innerHTML = !qr ? ''
    : staleShown ? '<span class="chip warn">어제와 같은 QR이에요. 휘닉스에서 아직 갱신되지 않았을 수 있어요. 잠시 후 다시 받아 보세요.</span>'
    : '<span class="chip">오늘 23:59까지 유효</span>';
  $('#qrFloatImg').src = qr ? qr.img : '';
  updateQrFloat();
}

// 오늘 QR이 있으면 스크롤해도 QR이 처음 보이던 자리와 크기 그대로 떠 있게 한다.
// X로 닫으면 맨 위까지 다시 올라갔다가 내려올 때 다시 띄운다. 설정의 QR 위치 고정으로 아예 끌 수 있다(기본 켜짐).
const FLOAT_KEY = 'qrFloat';
$('#floatOn').checked = localStorage.getItem(FLOAT_KEY) !== 'off';
$('#floatOn').onchange = (e) => {
  localStorage.setItem(FLOAT_KEY, e.target.checked ? 'on' : 'off');
  updateQrFloat();
};
let qrFloatClosed = false;
function updateQrFloat() {
  const scrolled = window.scrollY > 0;
  if (!scrolled) qrFloatClosed = false;
  const float = $('#qrFloat');
  float.hidden = !$('#floatOn').checked || !scrolled || qrFloatClosed || $('#qrImg').hidden;
  $('#qr').classList.toggle('floating', !float.hidden);
  if (float.hidden) return;
  // 원래 QR 박스의 문서 위치가 곧 맨 위에서 보이던 화면 위치다. 화면보다 아래에 있었으면
  // 아래 닫기 버튼(40px + 간격 8px)까지 보이도록 화면 안으로 끌어올린다.
  const box = $('#qr').getBoundingClientRect();
  const top = Math.max(0, Math.min(box.top + window.scrollY, window.innerHeight - box.height - 56));
  Object.assign(float.style, { top: `${top}px`, left: `${box.left}px`, width: `${box.width}px`, height: `${box.height}px` });
}
window.addEventListener('scroll', updateQrFloat, { passive: true });
window.addEventListener('resize', updateQrFloat);
$('#qrFloatClose').onclick = () => {
  qrFloatClosed = true;
  updateQrFloat();
};

// PWA에서 난 오류를 프록시 로그에 남긴다. 어떤 동작에서 어떤 종류의 오류였는지만 보내고, 실패해도 무시한다.
// 앱(안드로이드/iOS)은 이 서버를 쓰지 않으므로 보내지 않는다.
function reportError(action, err) {
  if (platform !== 'web') return;
  const code = err.code || (err.name === 'TypeError' ? 'network' : 'unknown');
  fetch('/px/_error', {
    method: 'POST',
    headers: { 'X-App': 'phoenix-easy-qr', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, code }),
    keepalive: true,
  }).catch(() => {});
}

async function run(button, label, task) {
  button.disabled = true;
  button.classList.add('busy');
  $('#msg').className = '';
  $('#msg').textContent = `${label} 중...`;
  try {
    await task();
    $('#msg').textContent = '';
    return true;
  } catch (err) {
    $('#msg').className = 'error';
    $('#msg').textContent = err.message;
    reportError(label, err);
    // 세션이 끊겼으면 로그인 화면으로 되돌린다.
    if (err.message === NEED_LOGIN) setLoggedIn(null);
    return false;
  } finally {
    button.disabled = false;
    button.classList.remove('busy');
  }
}

// 체크박스 상태. 자동 로그인은 저장된 아이디/비번이 있어야 하므로 저장을 함께 켠다.
const OPTS_KEY = 'loginOpts';
const opts = JSON.parse(localStorage.getItem(OPTS_KEY) || '{"save":false,"auto":false}');
const syncOpts = () => {
  $('#saveCreds').checked = opts.save;
  $('#autoLogin').checked = opts.auto;
  // QR 자동 갱신은 자동 로그인이 켜져 있을 때만 고를 수 있다. 꺼지면 설정값은 두고 동작만 멈춘다.
  $('#autoQr').checked = autoQrOn();
  $('#autoQr').disabled = !opts.auto;
  $('#autoQrHint').textContent = opts.auto ? '날이 바뀐 뒤 처음 열 때 새 QR을 받아요' : '자동 로그인을 켜야 쓸 수 있어요';
  localStorage.setItem(OPTS_KEY, JSON.stringify(opts));
};
$('#saveCreds').onchange = (e) => {
  opts.save = e.target.checked;
  if (!opts.save) {
    opts.auto = false;
    vault.clear();
  }
  syncOpts();
};
$('#autoLogin').onchange = (e) => {
  opts.auto = e.target.checked;
  if (opts.auto) opts.save = true;
  syncOpts();
};
$('#autoQr').onchange = (e) => {
  opts.autoQr = e.target.checked;
  syncOpts();
};

// 설정 창. 바깥 어두운 곳을 눌러도 닫힌다.
$('#openSettings').onclick = () => { $('#settings').hidden = false; };
$('#closeSettings').onclick = () => { $('#settings').hidden = true; };
$('#settings').onclick = (e) => { if (e.target === e.currentTarget) $('#settings').hidden = true; };

// 자동 로그인이 켜져 있으면 세션 만료나 오류가 났을 때 저장된 아이디/비번으로 다시 로그인하고 한 번 더 시도한다.
async function withRelogin(task) {
  try {
    return await task();
  } catch (err) {
    const creds = opts.auto ? await vault.load() : null;
    if (!creds) throw err;
    await login(creds.id, creds.pw);
    setLoggedIn(creds.id);
    return task();
  }
}

function doLogin() {
  return run($('#loginBtn'), '로그인', async () => {
    const id = $('#id').value.trim();
    const pw = $('#pw').value;
    await login(id, pw);
    if (opts.save) await vault.save({ id, pw });
    setLoggedIn(id);
    // 머리글 정보만 채우는 용도라 실패해도 로그인은 성공으로 둔다.
    await fetchSeasonInfo().catch(() => {});
  });
}

// 로그인 세션은 앱 메모리 기준이다. Capacitor가 앱 시작 때 세션 쿠키를 지우므로 앱을 새로 열면 로그인 전 상태가 맞다.
function setLoggedIn(id) {
  if (!id) showHolder(null);
  $('#f').hidden = !!id;
  $('#account').hidden = !id;
  $('#loginState').textContent = id ? '로그인됨' : '로그인 전';
  $('#loginState').classList.toggle('on', !!id);
  $('#who').textContent = id ? $('#who').textContent || '휘닉스 회원' : '';
  $('#whoSub').textContent = opts.auto ? '자동 로그인 켜짐' : opts.save ? '아이디/비번 저장됨' : '';
}

// 저장된 아이디/비번과 자동 로그인 설정은 그대로 둔다. 서버 세션만 끊는다.
$('#logout').onclick = async () => {
  await api('/api/member/logout').catch(() => {});
  sessionStorage.removeItem(SESSION_KEY);
  setLoggedIn(null);
  $('#msg').className = '';
  $('#msg').textContent = '로그아웃했어요';
};

$('#f').onsubmit = (e) => {
  e.preventDefault();
  doLogin();
};

// 잠금화면 QR. 안드로이드는 잠금화면 배경을, iOS는 실시간 현황(라이브 액티비티)을 쓴다.
// 켜져 있으면 오늘 QR을 받을 때마다 갱신하고, 끄거나 QR을 초기화하면 내린다(안드로이드는 홈 배경과 같게 되돌림).
const WP_KEY = 'lockWallpaper';
// 잠금화면에 올라가 있는 QR의 날짜. 다음 날 앱을 열면 이걸 보고 지난 QR을 내린다.
const LOCK_DATE_KEY = 'lockQrDate';
const plugins = window.Capacitor ? Capacitor.Plugins : {};
const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

async function applyLockScreen(qr) {
  const ticket = JSON.parse(localStorage.getItem(TICKET_KEY) || 'null');
  const title = [ticket && ticket.sesnDivNm, ticket && maskName(ticket.showKorCustNm)].filter(Boolean).join(' · ') || '휘팍 이지 QR';
  if (platform === 'android') {
    if (!qr) await plugins.LockWallpaper.clear();
    else await plugins.LockWallpaper.set({
      dataUrl: composeLockWallpaper({ qrImg: await loadImage(qr.img), issueNo: qr.issueNo, date: qr.date, ticket }),
      // 앱이 꺼져 있어도 자정에 시스템 알람으로 잠금화면 배경을 되돌린다.
      clearAt: nextMidnight(),
    });
  } else if (platform === 'ios') {
    if (!qr) await plugins.LiveActivity.end();
    else await plugins.LiveActivity.start({
      ...readQrModules(await loadImage(qr.img)),
      issueNo: qr.issueNo,
      validUntil: `${qr.date} 23:59까지 유효`,
      title,
      staleAt: Date.parse(`${qr.date}T23:59:59+09:00`),
    });
  } else {
    throw fail('web-lockscreen', '앱에서만 잠금화면에 띄울 수 있어요');
  }
  if (qr) localStorage.setItem(LOCK_DATE_KEY, qr.date);
  else localStorage.removeItem(LOCK_DATE_KEY);
  $('#wpState').textContent = qr ? `${qr.date} QR 적용됨` : '';
  $('#wpState').classList.toggle('on', !!qr);
}

if (platform === 'ios') $('#lockWpLabel').textContent = '잠금화면 실시간 현황에 오늘 QR 띄우기';
// 웹(PWA)은 잠금화면에 아무것도 띄울 수 없다.
if (platform === 'web') $('#lockSetting').hidden = true;
$('#lockWp').checked = localStorage.getItem(WP_KEY) === 'on';
$('#lockWp').onchange = (e) => {
  const on = e.target.checked;
  localStorage.setItem(WP_KEY, on ? 'on' : 'off');
  run(e.target, on ? '잠금화면 설정' : '잠금화면 복원', () => applyLockScreen(on ? todayQr() : null));
};

// 마지막으로 저장한 QR 번호 { date, issueNo }. 날이 바뀐 뒤 받은 번호가 이것과 같으면 휘닉스가 아직 QR을 갱신하지 않은 것으로 본다.
const LAST_ISSUE_KEY = 'lastIssue';
const rememberIssue = (qr) => localStorage.setItem(LAST_ISSUE_KEY, JSON.stringify({ date: qr.date, issueNo: qr.issueNo }));

// 휘닉스에서 오늘 QR을 받아 저장한다. 어제 번호와 같으면 stale로 돌려주고 저장하지 않는다.
// 그래야 다음에 받을 때 휘닉스에 다시 확인한다. 같은 번호가 게이트에서 통과될 수도 있어서 막지는 않는다.
async function fetchTodayQr() {
  const issueNo = await withRelogin(getIssueNo);
  const qr = { date: kstToday(), issueNo, img: await fetchQrImage(issueNo) };
  const last = JSON.parse(localStorage.getItem(LAST_ISSUE_KEY) || 'null');
  if (last && last.date !== qr.date && last.issueNo === issueNo) return { qr, stale: true };
  localStorage.setItem(QR_KEY, JSON.stringify(qr));
  rememberIssue(qr);
  return { qr, stale: false };
}

// 오늘 받은 QR 이미지가 저장돼 있으면 네트워크 없이 바로 보여준다.
const getQr = () => run($('#get'), 'QR 받는', async () => {
  const saved = todayQr();
  if (saved) return showQr(saved);
  const { qr, stale } = await fetchTodayQr();
  showQr(qr, stale);
  if (!stale && $('#lockWp').checked) await applyLockScreen(qr);
});
$('#get').onclick = getQr;

// 초기화하면 다음 QR 받기에서 페이지부터 다시 확인한다.
$('#clear').onclick = () => {
  if (staleShown) {
    showQr(null);
    getQr();
    return;
  }
  localStorage.removeItem(QR_KEY);
  showQr(null);
  $('#msg').className = '';
  $('#msg').textContent = 'QR을 초기화했어요';
  if ($('#lockWp').checked) run($('#clear'), '잠금화면 복원', () => applyLockScreen(null));
};

// QR은 KST 자정에 무효가 된다. 앱을 켜둔 채 자정을 넘기거나 다음 날 앱으로 돌아오면 지난 QR을 앱과 잠금화면에서 내린다.
function expireOldQr() {
  const saved = JSON.parse(localStorage.getItem(QR_KEY) || 'null');
  if (saved && saved.date !== kstToday()) {
    rememberIssue(saved);
    localStorage.removeItem(QR_KEY);
  }
  showQr(todayQr());
  const lockDate = localStorage.getItem(LOCK_DATE_KEY);
  if (lockDate && lockDate !== kstToday()) run($('#clear'), '지난 잠금화면 QR 정리', () => applyLockScreen(null));
}
// 백그라운드에서는 타이머가 멈출 수 있어 앱으로 돌아올 때(visibilitychange)도 확인한다.
function scheduleMidnight() {
  setTimeout(() => {
    expireOldQr();
    scheduleMidnight();
  }, nextMidnight() - Date.now() + 1000);
}
// 자동 로그인일 때, 앱으로 돌아왔는데 오늘 QR이 아직 없으면 세션을 미리 확인해 둔다. 끊겼으면 다시 로그인한다.
// 시즌패스 페이지 전체를 받는 요청이라 5분 간격으로만, QR을 받을 가능성이 있을 때만 한다.
const SESSION_CHECK_MS = 5 * 60 * 1000;
let lastSessionCheck = Date.now();
async function refreshSession() {
  if (!opts.auto || todayQr() || Date.now() - lastSessionCheck < SESSION_CHECK_MS) return;
  lastSessionCheck = Date.now();
  try {
    await withRelogin(fetchSeasonInfo);
  } catch {
    setLoggedIn(null);
  }
}

// 설정에서 켜면, 날이 바뀐 뒤 앱(웹)을 열 때 QR까지 받는다. 자동 로그인이 켜져 있을 때만 동작한다.
const autoQrOn = () => opts.auto && opts.autoQr;
function autoGetQr() {
  if (autoQrOn() && !todayQr()) return getQr();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  expireOldQr();
  // 앱으로 돌아올 때도 세션 확인과 같은 5분 간격으로만 시도한다.
  if (autoQrOn() && !todayQr() && Date.now() - lastSessionCheck >= SESSION_CHECK_MS) {
    lastSessionCheck = Date.now();
    autoGetQr();
    return;
  }
  refreshSession();
});
expireOldQr();
scheduleMidnight();

// PWA: 앱 화면을 캐시해서 신호가 없어도 저장된 QR을 띄운다. 앱(Capacitor)에서는 필요 없다.
if (platform === 'web' && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// PWA 홈 화면 추가 안내. 모바일 브라우저로 열었을 때만 설정 창에 보이고, 홈 화면 아이콘으로 열었으면 보이지 않는다.
// 안드로이드 크롬은 beforeinstallprompt로 진짜 설치 창을 띄운다. 아이폰은 어떤 브라우저도 설치 창을 띄울 수 없어서
// 브라우저별 메뉴 위치를 안내한다.
const ua = navigator.userAgent;
const isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
// 카카오톡, 네이버, 인스타그램 같은 앱 안 브라우저에서는 홈 화면에 추가할 수 없다.
const inAppBrowser = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//.test(ua);
const iosHow = () => {
  if (inAppBrowser) return 'Safari나 크롬에서 열어야 추가할 수 있어요';
  if (/CriOS/.test(ua)) return '주소창 오른쪽 공유 버튼 → 홈 화면에 추가';
  if (/FxiOS|EdgiOS/.test(ua)) return '메뉴의 공유 → 홈 화면에 추가';
  return '아래 공유 버튼 → 홈 화면에 추가';
};
let installPrompt = null;
// 지금 이 브라우저에서 안내할 내용. 없으면 null(안내하지 않음).
function installGuide() {
  if (platform !== 'web' || isStandalone) return null;
  if (isIos) return { how: `${iosHow()}. 추가하지 않으면 7일 뒤 저장된 로그인이 지워질 수 있어요.` };
  if (isAndroid && inAppBrowser) return { how: '크롬에서 열어야 추가할 수 있어요' };
  // 컴퓨터 크롬도 설치 창을 띄울 수 있지만, 안내는 모바일만 한다.
  if (isAndroid && installPrompt) return { how: '아이콘으로 앱처럼 열 수 있어요', button: true };
  return null;
}
function showInstall() {
  const guide = installGuide();
  $('#installSetting').hidden = !guide;
  if (!guide) return;
  $('#installHow').textContent = guide.how;
  $('#installBtn').hidden = !guide.button;
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  showInstall();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  showInstall();
});
$('#installBtn').onclick = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  showInstall();
};
showInstall();

syncOpts();
async function startup() {
  if (!opts.save) return;
  const creds = await vault.load();
  if (!creds) return;
  $('#id').value = creds.id;
  $('#pw').value = creds.pw;
  if (!opts.auto) return;
  // 로그인을 마친 뒤 QR 자동 갱신을 한다. 로그인이 실패했으면 QR 받기가 한 번 더 로그인을 시도한다.
  await doLogin();
  await autoGetQr();
}

// 안드로이드 앱 바로가기(아이콘 길게 누르기, 삼성 모드 및 루틴). 네이티브가 어떤 바로가기로 열렸는지 들고 있다가 넘겨준다.
// 로그인과 겹치지 않게 시작 처리가 끝난 뒤에 실행하고, 앱이 이미 떠 있을 때는 네이티브가 shortcut 이벤트로 알려준다.
// 바로가기로 열렸으면 일을 마친 뒤 앱을 뒤로 보내서, 루틴 실행 전에 보던 화면으로 돌아가게 한다.
// 실패하면 오류 문구를 볼 수 있게 그대로 둔다.
async function handleShortcut() {
  if (platform !== 'android') return;
  const { action } = await plugins.LockWallpaper.takeShortcut();
  const task = {
    'get-qr': getQr,
    'lock-on': () => run($('#get'), '잠금화면 QR 켜는', turnLockQrOn),
    'lock-off': () => run($('#get'), '잠금화면 QR 끄는', turnLockQrOff),
  }[action];
  if (task && (await task())) await plugins.LockWallpaper.moveToBack();
}
// 오늘 QR이 없으면 받아서 잠금화면에 올린다. 어제와 같은 QR이면 올리지 않는다.
async function turnLockQrOn() {
  $('#lockWp').checked = true;
  localStorage.setItem(WP_KEY, 'on');
  let qr = todayQr();
  if (!qr) {
    const result = await fetchTodayQr();
    showQr(result.qr, result.stale);
    if (result.stale) throw fail('stale-qr', '어제와 같은 QR이라 잠금화면에 올리지 않았어요. 잠시 후 다시 시도해 주세요.');
    qr = result.qr;
  }
  showQr(qr);
  await applyLockScreen(qr);
}
async function turnLockQrOff() {
  $('#lockWp').checked = false;
  localStorage.setItem(WP_KEY, 'off');
  await applyLockScreen(null);
}
window.addEventListener('shortcut', handleShortcut);
startup().catch(() => {}).then(handleShortcut);
