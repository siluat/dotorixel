import CoreGraphics
import Testing
@testable import Dotorixel

/// The frame ruler's Reorder Interaction state machine (issue 286,
/// `CONTEXT.md` § Reorder Interaction): a press tracked from touch-down and
/// resolved, at the release, into the one thing a ruler header can mean —
/// reorder, select, or nothing.
///
/// The header carries two roles, and SwiftUI hands the view no per-gesture
/// state to separate them, so the view has to track that itself. Pulling the
/// tracking out here is what lets the cancellation and multi-touch edges be
/// pinned at all: a rendered gesture cannot be driven from a test.
@Suite("FrameReorderInteraction — resolving a ruler header's press")
struct FrameReorderInteractionTests {

    /// The ruler's column extent and tap threshold (`DesignTokens.btnSize`,
    /// `frameDragThreshold`), spelled out so a token change cannot silently
    /// rewrite what these cases mean.
    private let columnWidth: CGFloat = 44
    private let tapThreshold: CGFloat = 4

    private let axis = ["first", "second", "third"]

    private func makeInteraction() -> FrameReorderInteraction {
        FrameReorderInteraction(itemExtent: columnWidth, tapThreshold: tapThreshold)
    }

    @Test("a press that stays in tap range selects; one that travels reorders")
    func pressBelowThresholdSelectsAndAboveItReorders() {
        var interaction = makeInteraction()

        // Under the threshold no drag opens, and the release falls to the
        // header's other role.
        interaction.track(itemId: "first", axisIndex: 0, travel: 2, axisCount: axis.count)
        #expect(interaction.drag == nil)
        #expect(interaction.release(itemId: "first", travel: 2) == .select)

        // Past it the drag opens and the release commits where it landed.
        interaction.track(itemId: "first", axisIndex: 0, travel: columnWidth, axisCount: axis.count)
        #expect(interaction.drag?.itemId == "first")
        #expect(interaction.release(itemId: "first", travel: columnWidth) == .reorder(toIndex: 1))

        // The release leaves nothing behind for the next press.
        #expect(interaction.drag == nil)
    }

    @Test("a sole-frame axis opens no drag, and a travelled press there selects nothing")
    func soleFrameAxisNeverOpensADrag() {
        var interaction = makeInteraction()

        interaction.track(itemId: "only", axisIndex: 0, travel: columnWidth, axisCount: 1)
        #expect(interaction.drag == nil)

        // Nowhere to reorder to, so the travel resolves to nothing at all —
        // reading it as a tap would make a dragged header select instead.
        #expect(interaction.release(itemId: "only", travel: columnWidth) == .ignore)

        // A real tap on that header still selects.
        interaction.track(itemId: "only", axisIndex: 0, travel: 0, axisCount: 1)
        #expect(interaction.release(itemId: "only", travel: 0) == .select)
    }

    @Test("a second pointer neither steals a live drag nor selects on its own release")
    func secondPointerIsInert() {
        var interaction = makeInteraction()
        interaction.track(itemId: "first", axisIndex: 0, travel: columnWidth, axisCount: axis.count)

        // Another finger presses a different header mid-drag: the live drag is
        // untouched, whether that press taps or travels.
        interaction.track(itemId: "third", axisIndex: 2, travel: 2, axisCount: axis.count)
        interaction.track(itemId: "third", axisIndex: 2, travel: columnWidth, axisCount: axis.count)
        #expect(interaction.drag?.itemId == "first")

        // And its release commits nothing and selects nothing.
        #expect(interaction.release(itemId: "third", travel: columnWidth) == .ignore)
        #expect(interaction.drag?.itemId == "first")

        // The initiating pointer still resolves normally afterwards.
        #expect(interaction.release(itemId: "first", travel: columnWidth) == .reorder(toIndex: 1))
    }

    @Test("an axis change cancels the drag, and the press it belonged to resolves to nothing")
    func axisChangeCancelsTheDragAndItsReleaseResolvesToNothing() {
        var interaction = makeInteraction()
        interaction.track(itemId: "first", axisIndex: 0, travel: columnWidth, axisCount: axis.count)

        // A second finger adds a frame, or ⌘Z restores another axis: the
        // captured geometry is stale, so the preview goes.
        interaction.axisChanged(to: ["first", "new", "second", "third"])
        #expect(interaction.drag == nil)

        // The finger is still down. Returning it near the origin makes the
        // release indistinguishable from a tap by travel alone — but this
        // press was a drag, and a cancelled reorder must not fall through to
        // moving the drawing target.
        #expect(interaction.release(itemId: "first", travel: 1) == .ignore)
    }

    @Test("a cancelled press cannot reopen a drag: its travel no longer measures from the axis it sees")
    func aCancelledPressCannotReopenADrag() {
        var interaction = makeInteraction()
        interaction.track(itemId: "first", axisIndex: 0, travel: columnWidth * 3, axisCount: axis.count)
        interaction.axisChanged(to: ["first", "new", "second", "third"])

        // The finger keeps moving. Reopening here would pair a baseIndex read
        // from the axis as it now stands with a translation still measured
        // from the original touch-down — a target the finger was never over.
        interaction.track(itemId: "first", axisIndex: 0, travel: columnWidth * 3, axisCount: 4)
        #expect(interaction.drag == nil)
        #expect(interaction.release(itemId: "first", travel: columnWidth * 3) == .ignore)

        // The next press starts clean.
        interaction.track(itemId: "first", axisIndex: 0, travel: columnWidth, axisCount: 4)
        #expect(interaction.drag?.itemId == "first")
    }

    @Test("another header's release does not consume the cancellation held for a different press")
    func cancellationIsConsumedOnlyByTheGestureItBelongsTo() {
        var interaction = makeInteraction()
        interaction.track(itemId: "first", axisIndex: 0, travel: columnWidth, axisCount: axis.count)

        // Two fingers are down when the axis changes; the second one is on
        // another header and never opened a drag of its own.
        interaction.track(itemId: "third", axisIndex: 2, travel: 1, axisCount: axis.count)
        interaction.axisChanged(to: ["first", "new", "second", "third"])

        // That second finger lifts first. Its release is an ordinary tap and
        // must resolve as one — while leaving the cancellation intact.
        #expect(interaction.release(itemId: "third", travel: 1) == .select)

        // The cancelled press lifts last, back within tap range. A shared flag
        // would already have been spent by the release above, letting this one
        // through as a tap.
        #expect(interaction.release(itemId: "first", travel: 1) == .ignore)
    }

    @Test("a cancellation is not held for a header that left the axis — no release is coming for it")
    func cancellationIsNotHeldForAHeaderThatLeftTheAxis() {
        var interaction = makeInteraction()
        interaction.track(itemId: "first", axisIndex: 0, travel: columnWidth, axisCount: axis.count)

        // What cancelled the drag was the removal of its own frame — deleted
        // by a second finger, or undone away. Its header is gone, and the
        // gesture on it is torn down without ever releasing, so a latch kept
        // here would outlive everything that could clear it.
        interaction.axisChanged(to: ["second", "third"])
        #expect(interaction.cancelledItemId == nil)

        // Undo brings that frame back: it drags like any other, rather than
        // spending its first press on a latch nothing consumed.
        interaction.track(itemId: "first", axisIndex: 0, travel: columnWidth, axisCount: axis.count)
        #expect(interaction.drag?.itemId == "first")
    }

    @Test("a held cancellation is released once its header leaves the axis")
    func heldCancellationIsReleasedWhenItsHeaderLeavesTheAxis() {
        var interaction = makeInteraction()
        interaction.track(itemId: "first", axisIndex: 0, travel: columnWidth, axisCount: axis.count)

        // The first change cancels the drag while the header is still there,
        // so the latch is taken…
        interaction.axisChanged(to: ["first", "new", "second", "third"])
        #expect(interaction.cancelledItemId == "first")

        // …and the second removes that header, with the finger still down. No
        // release will arrive to spend the latch, so it goes with the header.
        interaction.axisChanged(to: ["new", "second", "third"])
        #expect(interaction.cancelledItemId == nil)
    }

    @Test("tearing the ruler down drops both the drag and any cancellation waiting on a release")
    func teardownDropsEverything() {
        var interaction = makeInteraction()

        // Collapsing the panel mid-drag takes the ruler with it, and the
        // gestures on it are torn down without releasing.
        interaction.track(itemId: "first", axisIndex: 0, travel: columnWidth, axisCount: axis.count)
        interaction.reset()
        #expect(interaction.drag == nil)

        // The same for a cancellation still waiting to be spent — no preview
        // offset, scroll lock, or latch survives into the next expand.
        interaction.track(itemId: "first", axisIndex: 0, travel: columnWidth, axisCount: axis.count)
        interaction.axisChanged(to: ["first", "new", "second", "third"])
        interaction.reset()
        #expect(interaction.cancelledItemId == nil)
        #expect(interaction.release(itemId: "first", travel: 1) == .select)
    }
}
