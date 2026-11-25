import ActivityKit
import SwiftUI
import WidgetKit

@main
struct QrWidgetBundle: WidgetBundle {
    var body: some Widget {
        QrLiveActivity()
    }
}

struct QrLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: QrActivityAttributes.self) { context in
            HStack(spacing: 16) {
                QrModulesView(modules: context.state.modules, size: context.state.size)
                    .frame(width: 140, height: 140)
                VStack(alignment: .leading, spacing: 6) {
                    Text(context.attributes.title)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.8))
                    Text(context.state.issueNo)
                        .font(.system(.callout, design: .monospaced).weight(.bold))
                        .foregroundStyle(.white)
                        .minimumScaleFactor(0.7)
                    Text(context.state.validUntil)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color(red: 0.53, green: 0.94, blue: 0.67))
                }
                Spacer(minLength: 0)
            }
            .padding(10)
            .activityBackgroundTint(Color(red: 0.06, green: 0.16, blue: 0.37))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.center) {
                    QrModulesView(modules: context.state.modules, size: context.state.size)
                        .frame(width: 130, height: 130)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.validUntil).font(.caption)
                }
            } compactLeading: {
                Image(systemName: "qrcode")
            } compactTrailing: {
                Text("입장QR").font(.caption2)
            } minimal: {
                Image(systemName: "qrcode")
            }
        }
    }
}

// 서비스 QR과 똑같은 모양이 되도록 넘겨받은 모듈 격자를 그대로 그린다. 바깥 여백 1칸은 서비스와 같다.
struct QrModulesView: View {
    let modules: String
    let size: Int

    var body: some View {
        GeometryReader { geo in
            let cell = min(geo.size.width, geo.size.height) / CGFloat(size + 2)
            ZStack(alignment: .topLeading) {
                Rectangle().fill(.white)
                Path { path in
                    for (i, ch) in modules.enumerated() where ch == "1" {
                        path.addRect(CGRect(x: CGFloat(i % size + 1) * cell, y: CGFloat(i / size + 1) * cell, width: cell, height: cell))
                    }
                }
                .fill(.black)
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
