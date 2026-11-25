import Capacitor

// 앱 안에 둔 로컬 플러그인은 여기서 직접 등록해야 JS에서 보인다.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveActivityPlugin())
    }
}
