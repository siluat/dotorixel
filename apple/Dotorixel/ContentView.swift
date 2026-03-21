import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack {
            Text("DOTORIXEL")
                .font(.title)
            Text("Core v\(coreVersion())")
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
