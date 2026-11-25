# 휘팍 이지 QR

휘닉스파크 시즌패스 입장 QR을 버튼 한 번으로 받아서 보여주는 개인용 앱입니다. 안드로이드 앱, iOS 앱, PWA(웹앱)로 쓸 수 있고, 세 가지 모두 같은 `www/` 코드를 씁니다.

웹사이트에서 QR을 받으려면 로그인하고, 마이페이지를 거쳐 시즌패스 페이지까지 들어가야 합니다. 게이트 앞에서 매번 이 과정을 거치는 게 번거로워서 만들었습니다. 받은 QR은 잠금화면에 띄울 수도 있습니다.

## 쓰는 방법

| 방식 | 대상 | 특징 |
|---|---|---|
| 안드로이드 앱 | 안드로이드 | [Releases](https://github.com/Nakyungwon/phoenix-easy-qr/releases)에서 APK를 받아 설치합니다. 잠금화면 배경 QR을 쓸 수 있습니다. |
| iOS 앱 | 아이폰 | Xcode로 직접 설치합니다. 무료 계정이면 7일마다 다시 설치해야 합니다. 실시간 현황(라이브 액티비티) QR을 쓸 수 있습니다. |
| PWA (웹앱) | 아이폰, 안드로이드 | https://phoenix-easy-qr.gate-pass.workers.dev 를 Safari나 크롬에서 열고 **홈 화면에 추가**합니다. 설치 기한이 없습니다. 잠금화면 QR은 쓸 수 없습니다. |

> 아이폰 PWA는 꼭 **홈 화면에 추가**한 아이콘으로 여세요. Safari 탭으로 열면 7일 동안 방문하지 않았을 때 저장된 로그인 정보와 QR이 지워질 수 있습니다. 홈 화면에 추가한 웹앱은 이 규칙에서 빠집니다.

## 기획

- **QR은 하루 단위로 유효합니다.** 한국 시간(KST) 자정에 초기화되므로, 그날 처음 한 번만 신청하면 됩니다.
- **실제 서비스와 똑같은 QR을 보여줍니다.** 사이트처럼 `api.qrserver.com`에서 QR 이미지를 받습니다. 앱이 직접 그리면 데이터는 같아도 마스크 패턴이 달라져서 모양이 달라지기 때문입니다.
- **한 번 받은 QR은 네트워크 없이 뜹니다.** 스키장 게이트처럼 신호가 약한 곳을 생각해서, 받은 이미지를 기기에 저장합니다.
- **CORS가 생기지 않습니다.** 앱에서는 Capacitor가 `fetch`를 기기의 네이티브 HTTP로 보냅니다. PWA는 같은 출처의 Cloudflare Worker 프록시를 거칩니다.

## 기능

| 기능             | 설명                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 로그인           | 휘닉스 아이디·비번으로 로그인합니다. 로그인하면 계정 카드가 "로그인됨" 상태로 바뀌고 로그아웃 버튼이 생깁니다. 계정 카드와 티켓 머리글에는 아이디 대신 가운데를 가린 이름(예: 홍\*동)을 보여줍니다.                                                               |
| 아이디/비번 저장 | 로그인에 성공했을 때만 암호화해서 저장합니다. 체크를 끄면 저장된 값을 바로 지웁니다.                                                                                         |
| 자동 로그인      | 앱을 켜면 저장된 계정으로 로그인합니다. 켜면 저장도 함께 켜집니다.                                                                                                           |
| 자동 재로그인    | 자동 로그인이 켜져 있을 때 QR 받기가 실패하면(세션 만료 등), 다시 로그인한 뒤 한 번 더 시도합니다.                                                                           |
| 세션 미리 확인   | 앱으로 돌아왔을 때 아래 세 조건이 모두 맞으면 세션을 확인하고, 끊겼으면 다시 로그인합니다. 조건: 자동 로그인이 켜져 있음, 오늘 받은 QR이 없음, 마지막 확인 후 5분 이상 지남. |
| QR 받기          | QR이 없을 때 QR 자리에 버튼이 보입니다. 오늘 이미 받았으면 저장된 QR을 바로 보여줍니다.                                                                                      |
| QR 초기화        | 저장된 QR을 지웁니다. 다음 QR 받기 때 신청부터 다시 합니다.                                                                                                                  |
| 자정 초기화      | KST 자정이 지나면 앱 안의 QR과 잠금화면 QR을 내립니다.                                                                                                                       |
| 잠금화면 QR      | 안드로이드는 잠금화면 배경을 오늘 QR로 바꿉니다. iOS는 실시간 현황(라이브 액티비티)에 QR을 띄웁니다.                                                                         |
| 떠 있는 QR       | 오늘 QR이 있을 때 스크롤하면, 맨 위에서 QR이 보이던 자리와 크기 그대로 QR을 띄웁니다. 그동안 원래 QR 자리는 비웁니다. 카드 아래 **× 닫기**로 닫을 수 있고, 맨 위로 올라갔다가 내려오면 다시 뜹니다. |
| 떠 있는 QR 설정  | QR 아래 **스크롤해도 QR 띄워 두기** 체크박스로 끄고 켭니다. 기본은 켜짐이고 기기에 저장됩니다.                                                                               |
| 다크 모드        | 기기 설정을 따릅니다. 스캐너가 읽을 수 있도록 QR은 항상 흰 바탕에 그립니다.                                                                                                  |

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
  app.js                  API 호출, 상태 관리, 떠 있는 QR (CSP 때문에 인라인 스크립트 대신 파일로 둠)
  season.js               시즌패스 페이지에서 seasonInfo 파싱
  vault.js                아이디/비번 암호화 저장
  wallpaper.js            안드로이드 잠금화면 배경 이미지 생성, iOS용 QR 모듈 배열 추출
  manifest.json, sw.js    PWA 설정과 서비스 워커 (앱에서는 쓰지 않음)
  _headers                PWA 보안 헤더 (Cloudflare 전용, 앱에서는 쓰지 않음)
season.test.js            season.js 테스트 (npm test)
capacitor.config.json     앱 ID, 앱 이름, CapacitorHttp 설정
worker/                   PWA 배포용 Cloudflare Worker
  src/index.js            /px/ 프록시 (허용 경로, 출처 확인, IP별 제한, 세션 중계)
  wrangler.toml           Worker 설정 (정적 파일은 ../www, 요청 제한 한도)
assets/                   아이콘 원본 SVG/PNG

android/app/src/main/java/com/kwna/phoenixqr/
  MainActivity.java         로컬 플러그인 등록
  LockWallpaperPlugin.java  잠금화면 배경 설정·복원, 자정 알람 등록
  MidnightClearReceiver.java 자정 알람이 울리면 잠금화면 배경 복원

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
| `loginOpts`     | 저장, 자동 로그인 체크 상태                         |
| `lockWallpaper` | 잠금화면 QR 체크 상태 (`on`/`off`)                  |
| `lockQrDate`    | 잠금화면에 올라가 있는 QR의 날짜                    |
| `qrFloat`       | 떠 있는 QR 체크 상태 (`on`/`off`, 없으면 켜짐)      |

PWA는 휘닉스 세션 쿠키를 `sessionStorage`의 `pxSession`에 둡니다. 앱을 완전히 닫으면 지워지므로, 앱과 마찬가지로 새로 열면 로그인 전 상태로 시작합니다.

### 아이디/비번 암호화

- WebCrypto AES-GCM 256 키를 `extractable: false`로 만들어 IndexedDB(`phoenix-qr` DB, `keys` 저장소)에 넣습니다.
- 이 키는 JS로도 꺼낼 수 없고, 암호화와 복호화에만 쓸 수 있습니다.
- localStorage에는 암호문만 저장합니다.
- 복호화에 실패하면(예: 키 유실) 저장된 값을 지우고 다시 입력을 받습니다.

### 잠금화면 QR

**안드로이드**

- 웹 쪽 캔버스에서 QR 카드가 들어간 배경 이미지를 만듭니다. 위쪽 약 35%는 시계 자리, 아래쪽 약 15%는 바로가기 자리로 비워둡니다.
- 네이티브 플러그인이 `WallpaperManager.FLAG_LOCK`으로 잠금화면 배경만 바꿉니다. 홈 화면 배경은 그대로입니다.
- 설정과 동시에 자정 알람(`AlarmManager.setAndAllowWhileIdle`)을 등록합니다. 앱이 꺼져 있어도 알람이 울리면 잠금화면 배경을 지웁니다.
- 잠금화면 배경을 지우면 시스템이 홈 화면 배경을 잠금화면에도 씁니다.

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

### PWA 프록시 (worker/)

- 하나의 Worker가 `www/` 정적 파일을 내려주고, `/px/<경로>` 요청만 휘닉스로 중계합니다. PWA와 프록시가 같은 출처라서 CORS가 생기지 않습니다.
- 중계하는 경로는 앱이 쓰는 4개(로그인, 로그아웃, 시즌패스 페이지, QR 신청)뿐입니다. 그 밖의 경로는 403을 돌려줘서 공개 프록시로 쓰이지 않게 합니다.
- **세션:** 휘닉스가 보낸 쿠키를 `X-Session` 응답 헤더로 넘겨주고, 브라우저가 다음 요청에 같은 헤더로 돌려주면 `Cookie`로 바꿔 붙입니다. 브라우저는 이 값을 `sessionStorage`에 보관합니다. Worker는 아무것도 저장하지 않고, 요청 본문(비밀번호)도 로그로 남기지 않습니다.
- 웹에서는 잠금화면 QR 카드를 숨깁니다.
- **서비스 워커:** 화면 파일을 네트워크에서 먼저 받고, 실패하면(오프라인) 캐시를 씁니다. 그래서 배포하면 다음에 앱을 열 때 바로 새 버전이 뜹니다. `/px/` 요청은 캐시하지 않습니다.
- **남용 방지:** 앱 화면은 `X-App` 헤더를 붙여 보냅니다. 이 헤더가 없거나 다른 출처를 밝힌 요청은 403으로 막습니다. 다만 스크립트는 둘 다 꾸밀 수 있어서, 실제 방어선은 IP별 요청 제한(분당 20회, `wrangler.toml`)입니다. Cloudflare의 제한은 근사치라 짧은 시간에는 이보다 더 통과할 수 있습니다.
- **보안 헤더:** `www/_headers`로 CSP(같은 출처 스크립트만 실행), 클릭재킹 방지, `nosniff`, `no-referrer`를 겁니다. 인라인 스크립트가 막히므로 화면 로직은 `www/app.js`에 둡니다.

```bash
cd worker
npx wrangler login     # 처음 한 번
npx wrangler deploy    # https://phoenix-easy-qr.gate-pass.workers.dev
```

Cloudflare 무료 플랜(하루 10만 요청)으로 충분합니다.

## 제약과 주의

- **로그인 세션:** 앱이 시작될 때 Capacitor가 세션 쿠키를 지웁니다. 그래서 앱을 새로 열면 항상 로그인 전 상태로 시작하고, 자동 로그인이 켜져 있으면 바로 다시 로그인합니다.
- **휴대번호 인증:** 웹사이트는 QR 신청 API를 휴대번호 인증 뒤에 호출합니다. 이 앱은 그 단계 없이 바로 호출합니다.
- **안드로이드 잠금화면 배경:** 기존 잠금화면 배경은 백업할 수 없습니다. 끄면 홈 화면 배경으로 돌아갑니다. 자정 알람은 절전 상태에서 몇 분 늦게 울릴 수 있고, 재부팅하면 사라집니다. 이 경우 다음에 앱을 열 때 정리됩니다.
- **안드로이드 네트워크:** 폰이 잠겨 있으면 백그라운드 앱의 네트워크가 막힙니다. QR 받기는 앱이 화면에 떠 있을 때 하면 됩니다.
- **폴더블:** 삼성 폴드는 안쪽 화면 잠금화면 배경이 따로 있을 수 있어서, 바깥 화면에만 적용될 수 있습니다.
- **iOS 실시간 현황:** 최대 12시간까지 유지됩니다. 잠금화면 카드 크기에서 게이트 스캐너가 QR을 읽는지는 실제 현장에서 확인해야 합니다.
- **자정에 새 QR을 자동으로 받지 않습니다.** 자정에는 지난 QR을 지우기만 하고, 새 QR은 QR 받기를 눌러야 받습니다.
- **PWA:** 잠금화면 QR을 쓸 수 없습니다. 앱이 꺼져 있을 때는 자정 초기화가 동작하지 않습니다. 대신 다음에 열 때 정리됩니다. 아이디와 비번은 Worker를 거쳐 휘닉스로 전달됩니다.
- **떠 있는 QR:** 스크롤 위치에 맞춰 위치를 다시 잡습니다. 구형 아이폰에서 빠르게 튕겨 스크롤하면 잠깐 늦게 뜰 수 있습니다.
- **개인용:** 휘닉스파크의 공식 앱이 아닙니다. 스토어에 배포하려면 이름과 브랜드 사용을 다시 검토해야 합니다.
