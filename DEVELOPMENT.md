# 휘팍 이지 QR 개발 문서

쓰는 방법과 기능은 [README.md](README.md)에 있습니다. 이 문서는 구조, API 흐름, 빌드와 배포를 다룹니다.

안드로이드 앱, iOS 앱, PWA 모두 같은 `www/` 코드를 씁니다. 앱은 Capacitor로 감싸고, PWA는 Cloudflare Worker가 정적 파일과 프록시를 함께 내려줍니다.

## 설계 원칙

- **QR은 하루 단위로 유효합니다.** 한국 시간(KST) 자정에 초기화되므로, 그날 처음 한 번만 신청하면 됩니다.
- **실제 서비스와 똑같은 QR을 보여줍니다.** 사이트처럼 `api.qrserver.com`에서 QR 이미지를 받습니다. 앱이 직접 그리면 데이터는 같아도 마스크 패턴이 달라져서 모양이 달라지기 때문입니다.
- **한 번 받은 QR은 네트워크 없이 뜹니다.** 스키장 게이트처럼 신호가 약한 곳을 생각해서, 받은 이미지를 기기에 저장합니다.
- **CORS가 생기지 않습니다.** 앱에서는 Capacitor가 `fetch`를 기기의 네이티브 HTTP로 보냅니다. PWA는 같은 출처의 Cloudflare Worker 프록시를 거칩니다.

## QR 받기 흐름

그날 처음 QR을 받을 때 호출하는 순서입니다.

1. **로그인** `POST https://phoenixhnr.co.kr/api/member/login`
   - form-data로 `mbNo`(아이디)와 `mbPw`(비번)를 보냅니다.
   - 응답에 `logged: 'Y'`가 있으면 성공입니다. 세션 쿠키 `JSESSIONID`는 앱에서는 네이티브 쿠키 저장소가, PWA에서는 `X-Session` 헤더가 관리합니다([PWA 프록시](#pwa-프록시-worker) 참고).
   - PWA는 같은 경로를 `/px/` 아래로 부릅니다. 예: `POST /px/api/member/login`. 아래 2~4단계도 같습니다.
2. **시즌패스 페이지 조회** `GET https://phoenixhnr.co.kr/m/page/mypage/history/snowpark`
   - HTML 안에 들어 있는 Vue 데이터 `seasonInfo` 객체를 파싱합니다.
   - 로그인이 안 되어 있으면 401이 옵니다.
3. **QR 신청** `POST https://phoenixhnr.co.kr/api/reservation/pyeongchang/snowpark/season/updateFngprtRegDttm`
   - 2단계에서 얻은 `seasonInfo`를 JSON으로 보내되, 아래처럼 바꿔서 보냅니다.
     - `mpSstkIssueNo`, `mpSstkIssueResult`, `ordrBarCd`, `qrViewYn` → `""`
     - `fngprtRegYn` → `"N"`
     - `custNo` → 문자열로 변환
   - 응답에 `responseMessage`가 있으면 실패입니다.
4. **시즌패스 페이지 재조회**: 2단계와 같은 요청입니다. 새로 발급된 `mpSstkIssueNo`(QR 번호)를 읽습니다.
5. **QR 이미지** `GET https://api.qrserver.com/v1/create-qr-code/?qzone=1&data=<QR 번호>`
   - 받은 이미지를 캔버스로 data URL로 바꿉니다. 이 서비스는 CORS를 허용합니다.
   - 날짜, QR 번호, 이미지를 함께 저장합니다.

그날 자정 전까지는 QR 받기를 다시 눌러도 저장된 QR을 보여주고, 네트워크 요청은 보내지 않습니다.

## 구조

```
www/                      화면과 로직 (양 플랫폼 공용, 빌드 도구 없음)
  index.html              화면 마크업과 스타일
  app.js                  API 호출, 상태 관리, 설정, 떠 있는 QR, 바로가기 처리, 오류 보고
                          (CSP 때문에 인라인 스크립트 대신 파일로 둠)
  season.js               시즌패스 페이지에서 seasonInfo 파싱
  vault.js                아이디/비번 암호화 저장
  wallpaper.js            안드로이드 잠금화면 배경 이미지 생성, iOS용 QR 모듈 배열 추출
  manifest.json, sw.js    PWA 설정과 서비스 워커 (앱에서는 쓰지 않음)
  _headers                PWA 보안 헤더 (Cloudflare 전용, 앱에서는 쓰지 않음)
season.test.js            season.js 테스트 (npm test)
capacitor.config.json     앱 ID, 앱 이름, CapacitorHttp 설정
worker/                   PWA 배포용 Cloudflare Worker
  src/index.js            /px/ 프록시 (허용 경로, 출처 확인, IP별 제한, 세션 중계, 요청 기록, 화면 오류 보고)
  wrangler.toml           Worker 설정 (정적 파일은 ../www, 요청 제한 한도, 로그)
assets/                   아이콘 원본 SVG/PNG

android/app/src/main/java/com/kwna/phoenixqr/
  MainActivity.java         로컬 플러그인 등록, 어떤 바로가기로 열렸는지 전달
  LockWallpaperPlugin.java  잠금화면 배경 설정·복원, 자정 알람 등록, 바로가기 동작 전달, 앱 뒤로 보내기
  MidnightClearReceiver.java 자정 알람이 울리면 잠금화면 배경 복원
android/app/src/main/res/
  xml/shortcuts.xml         앱 바로가기 목록 (잠금화면 QR 켜기/끄기, 오늘 QR 받기)
  drawable/ic_shortcut_*.xml 바로가기 아이콘

ios/App/App/
  MainViewController.swift  로컬 플러그인 등록
  LiveActivityPlugin.swift  라이브 액티비티 시작·종료
  QrActivityAttributes.swift 앱과 위젯이 함께 쓰는 데이터 모델
ios/App/QrWidget/
  QrLiveActivity.swift      잠금화면·다이나믹 아일랜드 UI
```

### 저장 데이터 (localStorage)

| 키              | 내용                                                |
| --------------- | --------------------------------------------------- |
| `qr`            | 오늘 QR `{ date, issueNo, img }` (`img`는 data URL) |
| `lastTicket`    | 마지막으로 신청 API에 보낸 값                       |
| `creds`         | 암호화된 아이디/비번 `{ iv, data }`                 |
| `loginOpts`     | 저장, 자동 로그인, QR 자동 갱신(`autoQr`) 체크 상태 |
| `lastIssue`     | 마지막으로 저장한 QR `{ date, issueNo }` (어제와 같은 QR 확인용) |
| `lockWallpaper` | 잠금화면 QR 체크 상태 (`on`/`off`)                  |
| `lockQrDate`    | 잠금화면에 올라가 있는 QR의 날짜                    |
| `qrFloat`       | QR 위치 고정 설정 (`on`/`off`, 없으면 켜짐)         |

PWA는 휘닉스 세션 쿠키를 `sessionStorage`의 `pxSession`에 둡니다. 앱을 완전히 닫으면 지워지므로, 앱과 마찬가지로 새로 열면 로그인 전 상태로 시작합니다.

### 아이디/비번 암호화

- WebCrypto AES-GCM 256 키를 `extractable: false`로 만들어 IndexedDB(`phoenix-qr` DB, `keys` 저장소)에 넣습니다.
- 이 키는 JS로도 꺼낼 수 없고, 암호화와 복호화에만 쓸 수 있습니다.
- localStorage에는 암호문만 저장합니다.
- 복호화에 실패하면(예: 키 유실) 저장된 값을 지우고 다시 입력을 받습니다.

## 잠금화면 QR과 앱 바로가기

**안드로이드**

- 웹 쪽 캔버스에서 QR 카드가 들어간 배경 이미지를 만듭니다. 위쪽 약 35%는 시계 자리, 아래쪽 약 15%는 바로가기 자리로 비워둡니다.
- 네이티브 플러그인이 `WallpaperManager.FLAG_LOCK`으로 잠금화면 배경만 바꿉니다. 홈 화면 배경은 그대로입니다.
- 설정과 동시에 자정 알람(`AlarmManager.setAndAllowWhileIdle`)을 등록합니다. 앱이 꺼져 있어도 알람이 울리면 잠금화면 배경을 지웁니다.
- 잠금화면 배경을 지우면 시스템이 홈 화면 배경을 잠금화면에도 씁니다.

**앱 바로가기 구현 (안드로이드)**

- `res/xml/shortcuts.xml`의 각 항목은 `com.kwna.phoenixqr.shortcut.<동작>` intent로 `MainActivity`를 엽니다.
- `MainActivity`가 동작 이름(`lock-on`, `lock-off`, `get-qr`)을 기억하고, `app.js`의 `handleShortcut`이 시작 처리(자동 로그인, QR 자동 갱신)를 마친 뒤 `LockWallpaper.takeShortcut()`으로 받아 실행합니다. 앱이 이미 떠 있으면 `shortcut` 이벤트로 바로 처리합니다.
- 성공하면 `LockWallpaper.moveToBack()`으로 앱을 뒤로 보냅니다(`moveTaskToBack`, 종료 아님).
- 화면 회전으로 다시 만들어지거나 최근 앱 목록에서 다시 열 때는 같은 바로가기를 또 실행하지 않습니다.

**iOS**

- 라이브 액티비티 데이터는 4KB 제한이 있어서 이미지를 넘길 수 없습니다.
- 대신 서비스 QR 이미지에서 21×21 모듈 배열을 읽어(`readQrModules`) 넘기고, 위젯이 그 배열을 그대로 그립니다. 그래서 서비스 QR과 모양이 같습니다.
- `staleDate`를 자정으로 지정해서, 자정이 지나면 시스템이 '지난 정보'로 표시합니다.
- 다음에 앱을 열면 앱이 지난 카드를 내립니다.

## 빌드와 설치

### 버전

릴리스할 때 두 곳의 버전을 같이 올립니다.

- 안드로이드: `android/app/build.gradle`의 `versionCode`(정수, 매번 1씩)와 `versionName`
- iOS: `ios/App/App.xcodeproj/project.pbxproj`의 `MARKETING_VERSION`

### 공통

```bash
npm install
npm test               # seasonInfo 파서 테스트
npx cap sync           # www/ 변경 사항을 android/, ios/에 반영
```

### 안드로이드

```bash
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

폰에서 USB 디버깅을 켜야 합니다.

### 안드로이드 릴리스 APK

배포용 APK는 저장소 밖에 둔 릴리스 키로 서명합니다.

- 기본 위치: `~/.phoenix-easy-qr/keystore.properties`. 다른 위치에 두려면 `PHOENIX_KEYSTORE_PROPS` 환경변수로 경로를 지정합니다.
- 키 파일이 없으면 릴리스 APK는 서명되지 않습니다.

```bash
npx cap sync android
cd android && ./gradlew assembleRelease     # app/build/outputs/apk/release/app-release.apk
```

> 릴리스 키를 잃어버리면 같은 앱으로 업데이트할 수 없습니다. 기존 앱을 지우고 새로 설치해야 하고, 그러면 저장된 로그인과 QR도 함께 지워집니다. 키 파일(`release.jks`)과 `keystore.properties`는 꼭 따로 백업해 두세요.

설치 파일은 [Releases](https://github.com/Nakyungwon/phoenix-easy-qr/releases)에서 받을 수 있습니다.

### iOS

1. 아이폰을 맥에 연결하고 "이 컴퓨터를 신뢰"를 누릅니다.
2. 아래 명령으로 빌드하고 설치합니다.
   ```bash
   npx cap sync ios
   cd ios/App
   xcodebuild -project App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS' \
     -derivedDataPath build/dd -allowProvisioningUpdates -allowProvisioningDeviceRegistration build
   xcrun devicectl list devices      # 기기 식별자 확인
   xcrun devicectl device install app --device <기기 식별자> build/dd/Build/Products/Debug-iphoneos/App.app
   ```
3. 처음 설치했다면 아이폰 **설정 → 일반 → VPN 및 기기 관리**에서 개발자 앱을 신뢰합니다.
4. **설정 → 휘팍 이지 QR → 실시간 현황**이 켜져 있는지 확인합니다.

- 서명 팀은 프로젝트의 `DEVELOPMENT_TEAM`에 들어 있습니다(무료 Personal Team).
- 무료 계정으로 설치하면 7일마다 다시 설치해야 합니다.

### 아이콘

```bash
npx @capacitor/assets generate --android --ios --iconBackgroundColor '#1E3A8A'
```

> 생성기는 `android/.../mipmap-anydpi-v26/ic_launcher*.xml`에 16.7% inset을 다시 넣습니다. 아이콘 원본이 이미 안전 영역 안에 그려져 있어서 이 inset이 있으면 아이콘이 작아집니다. 생성기를 실행한 뒤에는 이 파일들에서 `inset`을 지워야 합니다.

## PWA 프록시 (worker/)

- 하나의 Worker가 `www/` 정적 파일을 내려주고, `/px/<경로>` 요청만 휘닉스로 중계합니다. PWA와 프록시가 같은 출처라서 CORS가 생기지 않습니다.
- 중계하는 경로는 앱이 쓰는 4개(로그인, 로그아웃, 시즌패스 페이지, QR 신청)뿐입니다. 그 밖의 경로는 403을 돌려줘서 공개 프록시로 쓰이지 않게 합니다.
- **세션:** 휘닉스가 보낸 쿠키를 `X-Session` 응답 헤더로 넘겨주고, 브라우저가 다음 요청에 같은 헤더로 돌려주면 `Cookie`로 바꿔 붙입니다. 브라우저는 이 값을 `sessionStorage`에 보관합니다. Worker는 세션이나 계정 정보를 저장하지 않습니다.
- 웹에서는 설정 창의 잠금화면 QR 항목을 숨깁니다.
- **요청 기록:** 프록시 요청마다 시간, 경로, 결과 코드, 이유(`reason`), 접속 국가, 걸린 시간 한 줄을 Workers Logs에 남깁니다(무료 플랜 3일 보관). 헤더(세션 쿠키)와 본문(비밀번호)은 남기지 않습니다.
  - `reason`: 프록시가 막은 이유(`bad-origin`, `rate-limit`, `path-not-allowed`)나 휘닉스 연결 예외(`upstream-error: ...`)입니다.
  - **화면 오류 보고:** PWA 화면에서 오류가 나면 `POST /px/_error`로 동작과 오류 종류만 보내고, `client-error 로그인: login-failed-401`처럼 남습니다. 휘닉스가 보낸 원문은 보내지 않습니다. 오류 종류는 `app.js`에서 `fail(code, message)`로 붙입니다. 앱(안드로이드/iOS)은 보내지 않습니다.
  - **보는 곳:** Cloudflare 대시보드 → Workers & Pages → phoenix-easy-qr → **Logs**. 실시간으로는 `npx wrangler tail`로 봅니다. 화면 파일 요청은 Worker를 거치지 않아서 기록되지 않습니다.
- **서비스 워커:** 화면 파일을 네트워크에서 먼저 받고, 실패하면(오프라인) 캐시를 씁니다. 그래서 배포하면 다음에 앱을 열 때 바로 새 버전이 뜹니다. `/px/` 요청은 캐시하지 않습니다.
- **남용 방지:** 앱 화면은 `X-App` 헤더를 붙여 보냅니다. 이 헤더가 없거나 다른 출처를 밝힌 요청은 403으로 막습니다. 다만 스크립트는 둘 다 꾸밀 수 있어서, 실제 방어선은 IP별 요청 제한(분당 20회, `wrangler.toml`)입니다. Cloudflare의 제한은 근사치라 짧은 시간에는 이보다 더 통과할 수 있습니다.
- **보안 헤더:** `www/_headers`로 CSP(같은 출처 스크립트만 실행), 클릭재킹 방지, `nosniff`, `no-referrer`를 겁니다. 인라인 스크립트가 막히므로 화면 로직은 `www/app.js`에 둡니다.

```bash
cd worker
npx wrangler login     # 처음 한 번
npx wrangler deploy    # https://phoenix-easy-qr.gate-pass.workers.dev
```

Cloudflare 무료 플랜(하루 10만 요청)으로 충분합니다.

## 개발 쪽 제약

- **로그인 세션:** 앱이 시작될 때 Capacitor가 세션 쿠키를 지웁니다. PWA는 세션을 `sessionStorage`에 둬서 앱을 닫으면 지워집니다. 휘닉스 서버의 세션 만료 시간은 확인하지 않았습니다.
- **휴대번호 인증:** 웹사이트는 QR 신청 API를 휴대번호 인증 뒤에 호출합니다. 이 앱은 그 단계 없이 바로 호출합니다.
- **백그라운드 QR 받기:** 받는 로직과 저장된 아이디/비번(WebCrypto 키)이 웹 화면 안에 있어서, 앱이 꺼진 상태에서 받으려면 네이티브로 로직과 자격 증명 저장을 따로 만들어야 합니다.
- **휘닉스 응답 형식:** 시즌패스 페이지 HTML의 `seasonInfo` 리터럴을 정규식으로 읽습니다. 페이지 구조가 바뀌면 `season.js`와 `season.test.js`를 고쳐야 합니다.
- **스토어 배포:** 휘닉스파크의 공식 앱이 아닙니다. 스토어에 배포하려면 이름과 브랜드 사용을 다시 검토해야 합니다.
