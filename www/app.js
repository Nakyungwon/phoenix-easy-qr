// 앱에서는 Capacitor가 fetch를 네이티브 HTTP로 바꿔 보내므로 CORS가 없고, 쿠키(JSESSIONID)도 네이티브 쿠키 저장소가 알아서 붙인다.
const BASE = 'https://phoenixhnr.co.kr';
const platform = window.Capacitor ? Capacitor.getPlatform() : 'web';

// 앱(안드로이드/iOS)은 네이티브 HTTP로 휘닉스를 직접 부르고 쿠키도 네이티브가 관리한다.
// 웹(PWA)은 CORS 때문에 같은 출처의 프록시(/px/...)를 거치고, 휘닉스 세션 쿠키를 X-Session 헤더로 주고받는다.
const SESSION_KEY = 'pxSession';
async function api(path, init = {}) {
  if (platform !== 'web') return fetch(BASE + path, init);
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
  if (!res.ok || body.logged !== 'Y') throw new Error(body.msg ? plainText(body.msg) : `로그인 실패 (${res.status})`);
}

async function fetchSeasonInfo() {
  const res = await api('/m/page/mypage/history/snowpark');
  if (res.status === 401) throw new Error(NEED_LOGIN);
  if (!res.ok) throw new Error(`시즌패스 페이지 실패 (${res.status})`);
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
  if (res.status === 401) throw new Error(NEED_LOGIN);
  const result = await res.json().catch(() => ({}));
  if (!res.ok || result.responseMessage) throw new Error(`QR 신청 실패 (${res.status}): ${plainText(result.responseMessage || '')}`);
}

// 페이지의 fngprtRegYn/QR 번호가 자정에 초기화되는지 알 수 없어서, 그날 첫 QR 받기는 항상 신청부터 한다.
async function getIssueNo() {
  await apply(await fetchSeasonInfo());
  const info = await fetchSeasonInfo();
  if (!info.mpSstkIssueNo) throw new Error(`QR 번호가 없어요 (${info.mpSstkIssueResult || '사유 없음'})`);
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
    img.onerror = () => reject(new Error('QR 이미지를 불러오지 못했어요'));
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?qzone=1&data=' + encodeURIComponent(issueNo);
  });
}

// QR이 없으면 QR 자리에 받기 버튼을, 있으면 QR과 초기화 버튼을 보여준다.
function showQr(qr) {
  $('#qrImg').hidden = !qr;
  $('#qrEmpty').hidden = !!qr;
  $('#clear').hidden = !qr;
  $('#floatOpt').hidden = !qr;
  $('#qrImg').src = qr ? qr.img : '';
  $('#qrImg').alt = qr ? `입장 QR ${qr.issueNo}` : '';
  $('#issueNo').textContent = qr ? qr.issueNo : '';
  $('#valid').innerHTML = qr ? '<span class="chip">오늘 23:59까지 유효</span>' : '';
  $('#qrFloatImg').src = qr ? qr.img : '';
  updateQrFloat();
}

// 오늘 QR이 있으면 스크롤해도 QR이 처음 보이던 자리와 크기 그대로 떠 있게 한다.
// X로 닫으면 맨 위까지 다시 올라갔다가 내려올 때 다시 띄운다. QR 아래 체크박스로 아예 끌 수 있다(기본 켜짐).
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

async function run(button, label, task) {
  button.disabled = true;
  button.classList.add('busy');
  $('#msg').className = '';
  $('#msg').textContent = `${label} 중...`;
  try {
    await task();
    $('#msg').textContent = '';
  } catch (err) {
    $('#msg').className = 'error';
    $('#msg').textContent = err.message;
    // 세션이 끊겼으면 로그인 화면으로 되돌린다.
    if (err.message === NEED_LOGIN) setLoggedIn(null);
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
    throw new Error('앱에서만 잠금화면에 띄울 수 있어요');
  }
  if (qr) localStorage.setItem(LOCK_DATE_KEY, qr.date);
  else localStorage.removeItem(LOCK_DATE_KEY);
  $('#wpState').textContent = qr ? `${qr.date} QR 적용됨` : '';
  $('#wpState').classList.toggle('on', !!qr);
}

if (platform === 'ios') $('#lockWpLabel').textContent = '잠금화면 실시간 현황에 오늘 QR 띄우기';
// 웹(PWA)은 잠금화면에 아무것도 띄울 수 없다.
if (platform === 'web') $('#lockWp').closest('.card').hidden = true;
$('#lockWp').checked = localStorage.getItem(WP_KEY) === 'on';
$('#lockWp').onchange = (e) => {
  const on = e.target.checked;
  localStorage.setItem(WP_KEY, on ? 'on' : 'off');
  run(e.target, on ? '잠금화면 설정' : '잠금화면 복원', () => applyLockScreen(on ? todayQr() : null));
};

$('#get').onclick = () => run($('#get'), 'QR 받는', async () => {
  // 오늘 받은 QR 이미지가 저장돼 있으면 네트워크 없이 바로 보여준다.
  let qr = todayQr();
  if (!qr) {
    const issueNo = await withRelogin(getIssueNo);
    qr = { date: kstToday(), issueNo, img: await fetchQrImage(issueNo) };
    localStorage.setItem(QR_KEY, JSON.stringify(qr));
    if ($('#lockWp').checked) await applyLockScreen(qr);
  }
  showQr(qr);
});

// 초기화하면 다음 QR 받기에서 페이지부터 다시 확인한다.
$('#clear').onclick = () => {
  localStorage.removeItem(QR_KEY);
  showQr(null);
  $('#msg').className = '';
  $('#msg').textContent = 'QR을 초기화했어요';
  if ($('#lockWp').checked) run($('#clear'), '잠금화면 복원', () => applyLockScreen(null));
};

// QR은 KST 자정에 무효가 된다. 앱을 켜둔 채 자정을 넘기거나 다음 날 앱으로 돌아오면 지난 QR을 앱과 잠금화면에서 내린다.
function expireOldQr() {
  const saved = JSON.parse(localStorage.getItem(QR_KEY) || 'null');
  if (saved && saved.date !== kstToday()) localStorage.removeItem(QR_KEY);
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

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  expireOldQr();
  refreshSession();
});
expireOldQr();
scheduleMidnight();

// PWA: 앱 화면을 캐시해서 신호가 없어도 저장된 QR을 띄운다. 앱(Capacitor)에서는 필요 없다.
if (platform === 'web' && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

syncOpts();
if (opts.save) {
  vault.load().then((creds) => {
    if (!creds) return;
    $('#id').value = creds.id;
    $('#pw').value = creds.pw;
    if (opts.auto) doLogin();
  });
}
