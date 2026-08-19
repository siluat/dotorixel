import SwiftUI

/// The transport strip's derived read model over the 288 playback controller's
/// state (web parity: `TransportBar.svelte` derivations): the enable rule and
/// the position readout, the decisions that need the frame axis. State the
/// chrome mirrors directly — the Play⇄Pause form, the Loop flag — is read
/// straight off `TabState` at the view's call sites. The strip itself stays a
/// thin view — no timing logic.
struct TransportStripPresentation {
    /// Whether the transport controls are interactive. A single-frame document
    /// has nothing to animate, so both controls are inert (the strip's
    /// "needs 2+ frames" convention; playback can never be running here —
    /// the controller stops on the structural change that drops the count).
    let isEnabled: Bool
    /// The 1-based ordinal the position readout shows: the Playhead's while
    /// playing, else the Active Frame's. A playhead id missing from the axis
    /// (a stale read mid-teardown) falls back to the Active Frame.
    let positionOrdinal: Int
    /// The readout's denominator — the axis length.
    let frameCount: Int

    static func resolve(
        frameIds: [String],
        activeFrameId: String,
        playheadFrameId: String?,
        isPlaying: Bool
    ) -> TransportStripPresentation {
        let playheadOrdinal = playheadFrameId.flatMap { ordinal(of: $0, in: frameIds) }
        return TransportStripPresentation(
            isEnabled: frameIds.count > 1,
            // The Active Frame always references a frame present on the axis
            // (the domain invariant) — its lookup is trusted, not re-guarded.
            positionOrdinal: (isPlaying ? playheadOrdinal : nil)
                ?? ordinal(of: activeFrameId, in: frameIds)!,
            frameCount: frameIds.count
        )
    }

    private static func ordinal(of frameId: String, in frameIds: [String]) -> Int? {
        frameIds.firstIndex(of: frameId).map { $0 + 1 }
    }
}

/// The playback transport in the Timeline panel's band above the frame ruler
/// (issues 289, 291; web parity: `TransportBar.svelte`): Play/Pause, Loop, the
/// Onion Skin toggle, and the position readout, driving the 288 playback
/// controller and the 290 onion skin state through `TabState`.
///
/// Play/Pause is an action button whose accessible name flips Play⇄Pause — not
/// a toggle, so no on/off value (a changing name plus a toggle value would be
/// conflicting patterns); the morphing name conveys state. Loop and Onion
/// Skin, with stable names, are the real toggles and announce On/Off (the
/// TopBar convention).
struct TransportStrip: View {
    let tab: TabState

    /// Each control's visible chrome, centered in its 44pt touch box — the
    /// compact-glyph-in-full-touch-target pattern `PanelIconButton` set, drawn
    /// larger here because the play button carries a fill, not a bare glyph.
    private let controlChromeSize: CGFloat = 32

    /// Control glyph extent — the web transport icons (`size={16}`).
    private let controlIconSize: CGFloat = 16

    /// The toggles' on-state outline — web `--ds-border-width` inset shadow.
    private let toggleOnBorderWidth: CGFloat = 1

    private var presentation: TransportStripPresentation {
        TransportStripPresentation.resolve(
            frameIds: tab.frameColumns.map(\.id),
            activeFrameId: tab.activeFrameId,
            playheadFrameId: tab.playheadFrameId,
            isPlaying: tab.isPlaying
        )
    }

    var body: some View {
        let presentation = self.presentation
        HStack(spacing: DesignTokens.space3) {
            playPauseButton(presentation)
            loopToggle(presentation)
            onionSkinToggle(presentation)
            Spacer(minLength: 0)
            positionReadout(presentation)
        }
        .padding(.horizontal, DesignTokens.space4)
        .frame(maxWidth: .infinity)
        .frame(height: DesignTokens.btnSize)
        .background(DesignTokens.bgElevated)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Playback")
    }

    private func playPauseButton(_ presentation: TransportStripPresentation) -> some View {
        Button {
            tab.togglePlayback()
        } label: {
            Image(systemName: tab.isPlaying ? "pause.fill" : "play.fill")
                .font(.system(size: controlIconSize))
                .foregroundStyle(presentation.isEnabled ? .white : DesignTokens.textTertiary)
                .frame(width: controlChromeSize, height: controlChromeSize)
                // Disabled drops the accent fill to the muted treatment the
                // web's `:disabled` rule applies over both variants.
                .background(presentation.isEnabled ? DesignTokens.accent : DesignTokens.bgHover)
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))
                .frame(width: DesignTokens.btnSize, height: DesignTokens.btnSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!presentation.isEnabled)
        .accessibilityLabel(tab.isPlaying ? "Pause" : "Play")
    }

    private func loopToggle(_ presentation: TransportStripPresentation) -> some View {
        toggleButton(
            systemName: "repeat",
            isOn: tab.isPlaybackLooping,
            isEnabled: presentation.isEnabled
        ) {
            tab.togglePlaybackLoop()
        }
        .accessibilityLabel("Loop")
        .accessibilityValue(tab.isPlaybackLooping ? "On" : "Off")
    }

    /// The Onion Skin toggle, third in the strip's leading cluster (218
    /// design): ghosts of adjacent frames on the canvas. A single frame has no
    /// neighbors to ghost, so it shares the strip's disabled convention. The
    /// two-layer glyph stands in for the web's lucide Ghost — SF Symbols
    /// carries no ghost.
    private func onionSkinToggle(_ presentation: TransportStripPresentation) -> some View {
        toggleButton(
            systemName: "square.2.layers.3d",
            isOn: tab.isOnionSkinEnabled,
            isEnabled: presentation.isEnabled
        ) {
            tab.toggleOnionSkin()
        }
        .accessibilityLabel("Onion skin")
        .accessibilityValue(tab.isOnionSkinEnabled ? "On" : "Off")
    }

    /// One transport toggle's chrome — Loop set the pattern and the Onion
    /// Skin toggle mirrors it (web parity: `.transport-btn--loop` /
    /// `--loop-on` / `--onion-skin(-on)` / `:disabled`).
    private func toggleButton(
        systemName: String,
        isOn: Bool,
        isEnabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        // The on-state renders only while actionable (web parity: `:disabled`
        // overrides the on-variant) — the flag itself survives disabling.
        let showsOn = isOn && isEnabled
        return Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: controlIconSize))
                .foregroundStyle(toggleTint(showsOn: showsOn, isEnabled: isEnabled))
                .frame(width: controlChromeSize, height: controlChromeSize)
                // Disabled drops to the same muted fill as the play button —
                // the web's `:disabled` treatment covers every variant.
                .background(toggleFill(showsOn: showsOn, isEnabled: isEnabled))
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))
                // Two-channel on-state (color-blind safe, web parity): the
                // accent-subtle fill plus an accent outline.
                .overlay {
                    RoundedRectangle(cornerRadius: DesignTokens.radiusSm)
                        .strokeBorder(
                            showsOn ? DesignTokens.accent : .clear,
                            lineWidth: toggleOnBorderWidth
                        )
                }
                .frame(width: DesignTokens.btnSize, height: DesignTokens.btnSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }

    /// A toggle glyph's tint across its three states.
    private func toggleTint(showsOn: Bool, isEnabled: Bool) -> SwiftUI.Color {
        if showsOn { return DesignTokens.accentText }
        return isEnabled ? DesignTokens.textSecondary : DesignTokens.textTertiary
    }

    /// A toggle chrome's fill across the same three states.
    private func toggleFill(showsOn: Bool, isEnabled: Bool) -> SwiftUI.Color {
        if showsOn { return DesignTokens.accentSubtle }
        return isEnabled ? .clear : DesignTokens.bgHover
    }

    /// Right-aligned "n / N" readout — the Playhead's ordinal while playing,
    /// else the Active Frame's. Digits and a slash, so no catalog entry; the
    /// monospaced digits keep the width stable as the Playhead advances.
    private func positionReadout(_ presentation: TransportStripPresentation) -> some View {
        Text(verbatim: "\(presentation.positionOrdinal) / \(presentation.frameCount)")
            .font(.system(size: DesignTokens.fontSize))
            .monospacedDigit()
            .foregroundStyle(DesignTokens.textTertiary)
    }
}
