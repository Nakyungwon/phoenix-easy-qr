import ActivityKit

// 앱과 위젯 확장이 함께 쓰는 라이브 액티비티 데이터.
// 라이브 액티비티 데이터는 4KB 제한이라 이미지 대신 서비스 QR 이미지에서 읽은 모듈 격자를 넘긴다.
struct QrActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        // 행 우선 "0"/"1" 문자열, 길이 size * size
        var modules: String
        var size: Int
        var issueNo: String
        var validUntil: String
    }

    var title: String
}
