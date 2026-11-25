# 휘팍 이지 QR

휘닉스파크 시즌패스 입장 QR을 버튼 한 번으로 받아서 보여주는 개인용 앱입니다. 안드로이드와 iOS를 지원합니다.

웹사이트에서 QR을 받으려면 로그인하고, 마이페이지를 거쳐 시즌패스 페이지까지 들어가야 합니다. 게이트 앞에서 매번 이 과정을 거치는 게 번거로워서 만들었습니다. 받은 QR은 잠금화면에 띄울 수도 있습니다.

## 기획

- **QR은 하루 단위로 유효합니다.** 한국 시간(KST) 자정에 초기화되므로, 그날 처음 한 번만 신청하면 됩니다.
- **실제 서비스와 똑같은 QR을 보여줍니다.** 사이트처럼 `api.qrserver.com`에서 QR 이미지를 받습니다. 앱이 직접 그리면 데이터는 같아도 마스크 패턴이 달라져서 모양이 달라지기 때문입니다.
- **한 번 받은 QR은 네트워크 없이 뜹니다.** 스키장 게이트처럼 신호가 약한 곳을 생각해서, 받은 이미지를 기기에 저장합니다.
- **CORS가 생기지 않습니다.** Capacitor가 `fetch`를 기기의 네이티브 HTTP로 보내기 때문에 별도 프록시 서버가 필요 없습니다.

## 기능

| 기능             | 설명                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 로그인           | 휘닉스 아이디·비번으로 로그인합니다. 로그인하면 계정 카드가 "로그인됨" 상태로 바뀌고 로그아웃 버튼이 생깁니다.                                                               |
| 아이디/비번 저장 | 로그인에 성공했을 때만 암호화해서 저장합니다. 체크를 끄면 저장된 값을 바로 지웁니다.                                                                                         |
| 자동 로그인      | 앱을 켜면 저장된 계정으로 로그인합니다. 켜면 저장도 함께 켜집니다.                                                                                                           |
| 자동 재로그인    | 자동 로그인이 켜져 있을 때 QR 받기가 실패하면(세션 만료 등), 다시 로그인한 뒤 한 번 더 시도합니다.                                                                           |
| 세션 미리 확인   | 앱으로 돌아왔을 때 아래 세 조건이 모두 맞으면 세션을 확인하고, 끊겼으면 다시 로그인합니다. 조건: 자동 로그인이 켜져 있음, 오늘 받은 QR이 없음, 마지막 확인 후 5분 이상 지남. |
| QR 받기          | QR이 없을 때 QR 자리에 버튼이 보입니다. 오늘 이미 받았으면 저장된 QR을 바로 보여줍니다.                                                                                      |
| QR 초기화        | 저장된 QR을 지웁니다. 다음 QR 받기 때 신청부터 다시 합니다.                                                                                                                  |
| 자정 초기화      | KST 자정이 지나면 앱 안의 QR과 잠금화면 QR을 내립니다.                                                                                                                       |
| 잠금화면 QR      | 안드로이드는 잠금화면 배경을 오늘 QR로 바꿉니다. iOS는 실시간 현황(라이브 액티비티)에 QR을 띄웁니다.                                                                         |
| 티켓 설정 보기   | 마지막으로 신청 API에 보낸 값을 JSON으로 보여줍니다. 읽기 전용입니다.                                                                                                        |
| 다크 모드        | 기기 설정을 따릅니다. 스캐너가 읽을 수 있도록 QR은 항상 흰 바탕에 그립니다.                                                                                                  |

## QR 받기 흐름

그날 처음 QR을 받을 때 호출하는 순서입니다.

1. **로그인** `POST https://phoenixhnr.co.kr/api/member/login`
   - form-data로 `mbNo`(아이디)와 `mbPw`(비번)를 보냅니다.
   - 응답에 `logged: 'Y'`가 있으면 성공입니다. 세션 쿠키 `JSESSIONID`는 네이티브 쿠키 저장소가 관리합니다.
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
  index.html              화면, API 호출, 상태 관리
  season.js               시즌패스 페이지에서 seasonInfo 파싱
  vault.js                아이디/비번 암호화 저장
  wallpaper.js            안드로이드 잠금화면 배경 이미지 생성, iOS용 QR 모듈 배열 추출
season.test.js            season.js 테스트 (npm test)
capacitor.config.json     앱 ID, 앱 이름, CapacitorHttp 설정
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

### iOS

1. 아이폰을 맥에 연결하고 "이 컴퓨터를 신뢰"를 누릅니다.
2. 아래 명령으로 빌드합니다.
   ```bash
   cd ios/App
   xcodebuild -project App.xcodeproj -scheme App -destination 'platform=iOS,id=<기기 UDID>' \
     -allowProvisioningUpdates -allowProvisioningDeviceRegistration build
   xcrun devicectl device install app --device <기기 UDID> <빌드된 App.app 경로>
   ```
3. 처음 설치했다면 아이폰 **설정 → 일반 → VPN 및 기기 관리**에서 개발자 앱을 신뢰합니다.
4. **설정 → 휘팍 이지 QR → 실시간 현황**이 켜져 있는지 확인합니다.

- 서명 팀은 프로젝트의 `DEVELOPMENT_TEAM`에 들어 있습니다(무료 Personal Team). 기기 UDID는 `xcrun xctrace list devices`로 확인합니다.
- 무료 계정으로 설치하면 7일마다 다시 설치해야 합니다.

### 아이콘

```bash
npx @capacitor/assets generate --android --ios --iconBackgroundColor '#1E3A8A'
```

> 생성기는 `android/.../mipmap-anydpi-v26/ic_launcher*.xml`에 16.7% inset을 다시 넣습니다. 아이콘 원본이 이미 안전 영역 안에 그려져 있어서 이 inset이 있으면 아이콘이 작아집니다. 생성기를 실행한 뒤에는 이 파일들에서 `inset`을 지워야 합니다.

## 제약과 주의

- **로그인 세션:** 앱이 시작될 때 Capacitor가 세션 쿠키를 지웁니다. 그래서 앱을 새로 열면 항상 로그인 전 상태로 시작하고, 자동 로그인이 켜져 있으면 바로 다시 로그인합니다.
- **휴대번호 인증:** 웹사이트는 QR 신청 API를 휴대번호 인증 뒤에 호출합니다. 이 앱은 그 단계 없이 바로 호출합니다.
- **안드로이드 잠금화면 배경:** 기존 잠금화면 배경은 백업할 수 없습니다. 끄면 홈 화면 배경으로 돌아갑니다. 자정 알람은 절전 상태에서 몇 분 늦게 울릴 수 있고, 재부팅하면 사라집니다. 이 경우 다음에 앱을 열 때 정리됩니다.
- **안드로이드 네트워크:** 폰이 잠겨 있으면 백그라운드 앱의 네트워크가 막힙니다. QR 받기는 앱이 화면에 떠 있을 때 하면 됩니다.
- **폴더블:** 삼성 폴드는 안쪽 화면 잠금화면 배경이 따로 있을 수 있어서, 바깥 화면에만 적용될 수 있습니다.
- **iOS 실시간 현황:** 최대 12시간까지 유지됩니다. 잠금화면 카드 크기에서 게이트 스캐너가 QR을 읽는지는 실제 현장에서 확인해야 합니다.
- **개인용:** 휘닉스파크의 공식 앱이 아닙니다. 스토어에 배포하려면 이름과 브랜드 사용을 다시 검토해야 합니다.
