import SwiftUI

@main
struct DotorixelApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .commands {
            CommandGroup(replacing: .undoRedo) { }
        }
        #if os(macOS)
        .defaultSize(width: 960, height: 640)
        #endif
    }
}
