import ActivityKit
import Capacitor

// 잠금화면 실시간 현황에 오늘 QR을 띄우고 내린다. 한 번에 하나만 유지한다.
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("iOS 16.2 이상에서만 쓸 수 있어요")
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("설정 > 휘팍 이지 QR > 실시간 현황을 켜주세요")
            return
        }
        guard let modules = call.getString("modules"), let size = call.getInt("size"),
              let issueNo = call.getString("issueNo"), let validUntil = call.getString("validUntil") else {
            call.reject("QR 정보가 부족해요")
            return
        }
        let attributes = QrActivityAttributes(title: call.getString("title") ?? "휘팍 이지 QR")
        let state = QrActivityAttributes.ContentState(modules: modules, size: size, issueNo: issueNo, validUntil: validUntil)
        // 자정이 지나면 시스템이 오래된 정보로 표시한다.
        let staleDate = call.getDouble("staleAt").map { Date(timeIntervalSince1970: $0 / 1000) }

        Task {
            await Self.endAll()
            do {
                _ = try Activity.request(attributes: attributes, content: .init(state: state, staleDate: staleDate))
                call.resolve()
            } catch {
                call.reject("실시간 현황 시작 실패: \(error.localizedDescription)")
            }
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        Task {
            await Self.endAll()
            call.resolve()
        }
    }

    @available(iOS 16.2, *)
    private static func endAll() async {
        for activity in Activity<QrActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}
