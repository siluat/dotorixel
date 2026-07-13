import SwiftUI

@main
struct DotorixelApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
            #if os(macOS)
                // Floor the window so the docked chrome (44pt toolbar + 200pt panel)
                // can't be squeezed past the canvas on a narrowly-resized Mac window.
                // iPad's compact context is ≥320pt natively and needs no floor.
                .frame(minWidth: 480, minHeight: 400)
            #endif
        }
        .commands {
            CommandGroup(replacing: .undoRedo) { }
        }
        #if os(macOS)
        .defaultSize(width: 960, height: 640)
        .windowResizability(.contentMinSize)
        #endif
    }
}
