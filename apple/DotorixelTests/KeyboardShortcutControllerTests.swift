import Testing
@testable import Dotorixel

/// Records the commands the controller dispatches and plays back the state
/// reads it performs — the keyboard analog of `StrokeEngineTests`' fake host.
private final class FakeShortcutHost: KeyboardShortcutHost {
    var isDrawing = false
    var isTextInputFocused = false
    var activeTool: EditorTool = .pencil

    private(set) var undoCount = 0
    private(set) var redoCount = 0
    private(set) var gridToggleCount = 0
    private(set) var swapColorsCount = 0

    func setActiveTool(_ tool: EditorTool) { activeTool = tool }
    func handleUndo() { undoCount += 1 }
    func handleRedo() { redoCount += 1 }
    func toggleGrid() { gridToggleCount += 1 }
    func swapColors() { swapColorsCount += 1 }
}

private func makeController(host: FakeShortcutHost) -> KeyboardShortcutController {
    let controller = KeyboardShortcutController()
    controller.host = host
    return controller
}

@Suite("KeyboardShortcutController — tool keys")
struct KeyboardShortcutControllerToolKeyTests {

    @Test("a tool's shortcut letter activates it", arguments: EditorTool.allCases)
    func toolKeyActivatesTool(tool: EditorTool) {
        let host = FakeShortcutHost()
        let controller = makeController(host: host)

        let handled = controller.handleKeyDown(tool.shortcutKey)

        #expect(handled)
        #expect(host.activeTool == tool)
    }

    @Test("tool keys pass through while a text field is focused")
    func toolKeyIgnoredWhileTyping() {
        let host = FakeShortcutHost()
        host.isTextInputFocused = true
        let controller = makeController(host: host)

        let handled = controller.handleKeyDown(EditorTool.eraser.shortcutKey)

        #expect(!handled)
        #expect(host.activeTool == .pencil)
    }

    @Test("tool keys are inert while a stroke is in progress")
    func toolKeyInertMidStroke() {
        let host = FakeShortcutHost()
        host.isDrawing = true
        let controller = makeController(host: host)

        controller.handleKeyDown(EditorTool.eraser.shortcutKey)

        #expect(host.activeTool == .pencil)
    }

    @Test("tool keys require no modifiers", arguments: [
        ShortcutModifiers.command, .shift, .option, .control,
    ])
    func toolKeyIgnoredWithModifier(modifier: ShortcutModifiers) {
        let host = FakeShortcutHost()
        let controller = makeController(host: host)

        controller.handleKeyDown(EditorTool.eraser.shortcutKey, modifiers: modifier)

        #expect(host.activeTool == .pencil)
    }
}

@Suite("KeyboardShortcutController — X swap / G grid")
struct KeyboardShortcutControllerSwapGridTests {

    @Test("bare X swaps foreground/background colors")
    func xSwapsColors() {
        let host = FakeShortcutHost()
        let controller = makeController(host: host)

        let handled = controller.handleKeyDown("x")

        #expect(handled)
        #expect(host.swapColorsCount == 1)
    }

    @Test("bare G toggles the grid")
    func gTogglesGrid() {
        let host = FakeShortcutHost()
        let controller = makeController(host: host)

        let handled = controller.handleKeyDown("g")

        #expect(handled)
        #expect(host.gridToggleCount == 1)
    }

    @Test("X and G still fire mid-stroke (web parity)")
    func swapAndGridFireMidStroke() {
        let host = FakeShortcutHost()
        host.isDrawing = true
        let controller = makeController(host: host)

        controller.handleKeyDown("x")
        controller.handleKeyDown("g")

        #expect(host.swapColorsCount == 1)
        #expect(host.gridToggleCount == 1)
    }

    @Test("X and G require no modifiers", arguments: [
        ShortcutModifiers.command, .shift, .option, .control,
    ])
    func swapAndGridIgnoredWithModifier(modifier: ShortcutModifiers) {
        let host = FakeShortcutHost()
        let controller = makeController(host: host)

        controller.handleKeyDown("x", modifiers: modifier)
        controller.handleKeyDown("g", modifiers: modifier)

        #expect(host.swapColorsCount == 0)
        #expect(host.gridToggleCount == 0)
    }
}

@Suite("KeyboardShortcutController — undo/redo keys")
struct KeyboardShortcutControllerUndoRedoTests {

    @Test("⌘Z dispatches undo")
    func commandZUndoes() {
        let host = FakeShortcutHost()
        let controller = makeController(host: host)

        let handled = controller.handleKeyDown("z", modifiers: .command)

        #expect(handled)
        #expect(host.undoCount == 1)
        #expect(host.redoCount == 0)
    }

    @Test("⇧⌘Z dispatches redo")
    func shiftCommandZRedoes() {
        let host = FakeShortcutHost()
        let controller = makeController(host: host)

        let handled = controller.handleKeyDown("z", modifiers: [.command, .shift])

        #expect(handled)
        #expect(host.undoCount == 0)
        #expect(host.redoCount == 1)
    }

    @Test("⌘Y dispatches redo (web parity)")
    func commandYRedoes() {
        let host = FakeShortcutHost()
        let controller = makeController(host: host)

        let handled = controller.handleKeyDown("y", modifiers: .command)

        #expect(handled)
        #expect(host.redoCount == 1)
    }

    @Test("bare Z and Y are not shortcuts")
    func bareZAndYPassThrough() {
        let host = FakeShortcutHost()
        let controller = makeController(host: host)

        #expect(!controller.handleKeyDown("z"))
        #expect(!controller.handleKeyDown("y"))
        #expect(host.undoCount == 0)
        #expect(host.redoCount == 0)
    }
}

@Suite("KeyboardShortcutController — Alt-hold eyedropper")
struct KeyboardShortcutControllerAltHoldTests {

    @Test("holding Alt switches to the eyedropper; releasing restores the prior tool")
    func altHoldSwitchesAndRestores() {
        let host = FakeShortcutHost()
        host.activeTool = .rectangle
        let controller = makeController(host: host)

        controller.setAltHeld(true)
        #expect(host.activeTool == .eyedropper)

        controller.setAltHeld(false)
        #expect(host.activeTool == .rectangle)
    }

    @Test("Alt while the eyedropper is already active is a no-op")
    func altOnEyedropperDoesNothing() {
        let host = FakeShortcutHost()
        host.activeTool = .eyedropper
        let controller = makeController(host: host)

        controller.setAltHeld(true)
        controller.setAltHeld(false)

        // No temporary switch was recorded, so release restores nothing.
        #expect(host.activeTool == .eyedropper)
        #expect(controller.consumePendingToolRestore() == nil)
    }

    @Test("Alt pressed mid-stroke does not switch tools")
    func altPressIgnoredMidStroke() {
        let host = FakeShortcutHost()
        host.activeTool = .pencil
        host.isDrawing = true
        let controller = makeController(host: host)

        controller.setAltHeld(true)

        #expect(host.activeTool == .pencil)

        // Release after the stroke: nothing was saved, nothing restores.
        host.isDrawing = false
        controller.setAltHeld(false)
        #expect(host.activeTool == .pencil)
        #expect(controller.consumePendingToolRestore() == nil)
    }

    @Test("Alt released mid-stroke defers the restore to stroke end")
    func altReleaseMidStrokeDefersRestore() {
        let host = FakeShortcutHost()
        host.activeTool = .pencil
        let controller = makeController(host: host)

        // Alt-switch to the eyedropper, then start drawing with it.
        controller.setAltHeld(true)
        #expect(host.activeTool == .eyedropper)
        host.isDrawing = true

        // Releasing Alt mid-stroke must not yank the tool out from under
        // the active stroke.
        controller.setAltHeld(false)
        #expect(host.activeTool == .eyedropper)

        // Stroke end: the input pipeline consumes the pending restore once.
        host.isDrawing = false
        #expect(controller.consumePendingToolRestore() == .pencil)
        #expect(controller.consumePendingToolRestore() == nil)
    }

    @Test("stroke ending while Alt is still held keeps the eyedropper")
    func strokeEndWhileAltHeldDoesNotRestore() {
        let host = FakeShortcutHost()
        host.activeTool = .pencil
        let controller = makeController(host: host)

        controller.setAltHeld(true)
        host.isDrawing = true
        host.isDrawing = false

        // Alt is still down — the temporary eyedropper must survive the
        // stroke; the restore waits for the release.
        #expect(controller.consumePendingToolRestore() == nil)

        controller.setAltHeld(false)
        #expect(host.activeTool == .pencil)
    }

    @Test("reset clears the held state and force-restores the prior tool")
    func resetRestoresPriorTool() {
        let host = FakeShortcutHost()
        host.activeTool = .line
        let controller = makeController(host: host)

        controller.setAltHeld(true)
        // Focus loss (web blur parity): the Alt release will never arrive,
        // so the temporary switch must end now.
        controller.reset()

        #expect(host.activeTool == .line)
        #expect(controller.consumePendingToolRestore() == nil)

        // The stale held flag must not swallow the next real Alt press.
        controller.setAltHeld(true)
        #expect(host.activeTool == .eyedropper)
    }

    @Test("reset mid-stroke keeps the restore deferred to stroke end")
    func resetMidStrokeDefersRestore() {
        let host = FakeShortcutHost()
        host.activeTool = .pencil
        let controller = makeController(host: host)

        controller.setAltHeld(true)
        host.isDrawing = true
        controller.reset()

        // The active stroke keeps its tool; the restore stays pending.
        #expect(host.activeTool == .eyedropper)

        host.isDrawing = false
        #expect(controller.consumePendingToolRestore() == .pencil)
    }
}

@Suite("KeyboardShortcutController — key repeat")
struct KeyboardShortcutControllerRepeatTests {

    @Test("repeats of G and X are swallowed without re-firing (web parity)")
    func repeatSuppressesToggles() {
        let host = FakeShortcutHost()
        let controller = makeController(host: host)

        controller.handleKeyDown("g")
        let handled = controller.handleKeyDown("g", isRepeat: true)

        // Still consumed — a held G must not leak into default handling —
        // but the grid doesn't flicker.
        #expect(handled)
        #expect(host.gridToggleCount == 1)

        controller.handleKeyDown("x", isRepeat: true)
        #expect(host.swapColorsCount == 0)
    }

    @Test("holding ⌘Y keeps redoing (web has no repeat guard on undo/redo)")
    func repeatKeepsFiringUndoRedo() {
        let host = FakeShortcutHost()
        let controller = makeController(host: host)

        controller.handleKeyDown("y", modifiers: .command)
        controller.handleKeyDown("y", modifiers: .command, isRepeat: true)

        #expect(host.redoCount == 2)
    }

    @Test("a repeated tool key still activates (idempotent, web parity)")
    func repeatActivatesTool() {
        let host = FakeShortcutHost()
        let controller = makeController(host: host)

        let handled = controller.handleKeyDown(EditorTool.line.shortcutKey, isRepeat: true)

        #expect(handled)
        #expect(host.activeTool == .line)
    }

    @Test("repeats in a text field pass through untouched")
    func repeatInTextFieldPassesThrough() {
        let host = FakeShortcutHost()
        host.isTextInputFocused = true
        let controller = makeController(host: host)

        #expect(!controller.handleKeyDown("g", isRepeat: true))
    }
}

@Suite("KeyboardShortcutController — menu-owned combos")
struct KeyboardShortcutControllerMenuOwnedTests {

    @Test("⌘Z and ⇧⌘Z belong to the Edit-menu commands; everything else doesn't")
    func menuOwnedCombos() {
        #expect(KeyboardShortcutController.isMenuOwnedShortcut("z", modifiers: .command))
        #expect(KeyboardShortcutController.isMenuOwnedShortcut("z", modifiers: [.command, .shift]))
        #expect(!KeyboardShortcutController.isMenuOwnedShortcut("y", modifiers: .command))
        #expect(!KeyboardShortcutController.isMenuOwnedShortcut("z", modifiers: []))
    }
}

@Suite("EditorState — keyboard shortcut integration")
struct EditorStateKeyboardShortcutTests {

    @Test("setActiveTool never toggles the Constrain latch, unlike a toolbar re-tap")
    func setActiveToolBypassesLatch() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .line

        state.setActiveTool(.line)

        #expect(state.activeTool == .line)
        #expect(!state.isConstrainLatchOn)
    }

    @Test("Alt released mid-stroke restores the prior tool when the stroke ends")
    func deferredRestoreAppliesAtStrokeEnd() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .pencil

        state.keyboardShortcuts.setAltHeld(true)
        #expect(state.activeTool == .eyedropper)

        state.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.keyboardShortcuts.setAltHeld(false)
        #expect(state.activeTool == .eyedropper)

        state.endStroke()
        #expect(state.activeTool == .pencil)
    }

    @Test("Alt released mid-stroke restores the prior tool on cancel too")
    func deferredRestoreAppliesAtStrokeCancel() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .rectangle

        state.keyboardShortcuts.setAltHeld(true)
        state.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.keyboardShortcuts.setAltHeld(false)

        state.cancelStroke()
        #expect(state.activeTool == .rectangle)
    }

    @Test("shortcut key presses route through EditorState as the live host")
    func editorStateActsAsHost() {
        let state = EditorState(width: 16, height: 16)
        let gridBefore = state.showGrid
        let foregroundBefore = state.foregroundColor
        let backgroundBefore = state.backgroundColor

        state.keyboardShortcuts.handleKeyDown(EditorTool.floodFill.shortcutKey)
        #expect(state.activeTool == .floodFill)

        state.keyboardShortcuts.handleKeyDown("g")
        #expect(state.showGrid == !gridBefore)

        state.keyboardShortcuts.handleKeyDown("x")
        #expect(state.foregroundColor == backgroundBefore)
        #expect(state.backgroundColor == foregroundBefore)
    }

    @Test("shortcuts are ignored while a canvas-size field is focused")
    func textFieldFocusSuppressesShortcuts() {
        let state = EditorState(width: 16, height: 16)
        state.isTextInputFocused = true

        state.keyboardShortcuts.handleKeyDown(EditorTool.eraser.shortcutKey)

        #expect(state.activeTool == .pencil)
    }

    @Test("focusing a text field ends a temporary Alt switch")
    func textFieldFocusEndsTemporarySwitch() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .pencil

        state.keyboardShortcuts.setAltHeld(true)
        #expect(state.activeTool == .eyedropper)

        // Moving focus into a size field means the Alt release may never
        // reach the canvas (iPad loses first responder) — the temporary
        // switch must end now instead of sticking.
        state.isTextInputFocused = true

        #expect(state.activeTool == .pencil)

        // The cleared held flag must not swallow the next real Alt press.
        state.isTextInputFocused = false
        state.keyboardShortcuts.setAltHeld(true)
        #expect(state.activeTool == .eyedropper)
    }
}
