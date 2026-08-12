import CoreGraphics
import Foundation
import SwiftUI

private let selectionActionBarGap = DesignTokens.space3
private let selectionActionBarEdgeMargin = DesignTokens.space3
private let selectionActionTargetSize = DesignTokens.btnSize
private let selectionActionSpacing = DesignTokens.space1
private let selectionActionBarPadding = DesignTokens.space2
private let selectionActionBarCornerRadius: CGFloat = 4
private let selectionActionBarBorderWidth: CGFloat = 1
private let selectionActionBarShadowOpacity = 0.12
private let selectionActionBarShadowRadius: CGFloat = 8
private let selectionActionBarShadowYOffset: CGFloat = 2
private let selectionActionIconSize: CGFloat = 16

func selectionActionBarSize(actionCount: Int, viewportWidth: CGFloat) -> CGSize {
    let actionWidth = CGFloat(actionCount) * selectionActionTargetSize
    let spacingWidth = CGFloat(max(0, actionCount - 1)) * selectionActionSpacing
    let contentWidth = actionWidth + spacingWidth + selectionActionBarPadding * 2
    let availableWidth = max(0, viewportWidth - selectionActionBarEdgeMargin * 2)
    return CGSize(
        width: min(contentWidth, availableWidth),
        height: selectionActionTargetSize
    )
}

func selectionActionBarPosition(
    marqueeRect: CGRect,
    viewportSize: CGSize,
    barSize: CGSize
) -> CGPoint {
    let maxX = max(
        selectionActionBarEdgeMargin,
        viewportSize.width - barSize.width - selectionActionBarEdgeMargin
    )
    let x = min(
        max(marqueeRect.midX - barSize.width / 2, selectionActionBarEdgeMargin),
        maxX
    )
    let maxY = max(0, viewportSize.height - barSize.height)
    let aboveY = marqueeRect.minY - selectionActionBarGap - barSize.height
    if aboveY >= 0, aboveY <= maxY {
        return CGPoint(x: x, y: aboveY)
    }

    let belowY = marqueeRect.maxY + selectionActionBarGap
    if belowY >= 0, belowY <= maxY {
        return CGPoint(x: x, y: belowY)
    }

    let spaceAbove = max(0, marqueeRect.minY)
    let spaceBelow = max(0, viewportSize.height - marqueeRect.maxY)
    let stickyY = spaceAbove <= spaceBelow
        ? 0
        : maxY
    return CGPoint(x: x, y: stickyY)
}

func selectionActionBarAnchorRect(
    marquee: AppleMarqueeRegion,
    hasFloatingSelection: Bool,
    canvasWidth: UInt32,
    canvasHeight: UInt32,
    viewport: AppleViewport,
    displayScale: CGFloat
) -> CGRect? {
    if hasFloatingSelection {
        return unclippedMarqueeDisplayRect(
            region: marquee,
            viewport: viewport,
            displayScale: displayScale
        )
    }
    return marqueeDisplayRect(
        region: marquee,
        canvasWidth: canvasWidth,
        canvasHeight: canvasHeight,
        viewport: viewport,
        displayScale: displayScale
    )
}

protocol SelectionActionBarHost: AnyObject {
    func copySelection()
    func cutSelection()
    func pasteSelectionClipboard()
    func flipMarqueeHorizontal()
    func flipMarqueeVertical()
    func rotateMarqueeCw()
    func rotateMarqueeCcw()
    func clearMarqueePixels()
    func clearMarqueeOrFloating()
    func commitFloatingSelection()
}

enum SelectionActionBarAction: CaseIterable, Hashable {
    case copy
    case cut
    case paste
    case flipHorizontal
    case flipVertical
    case rotateCw
    case rotateCcw
    case delete
    case deselect
    case commit
    case cancel

    var label: LocalizedStringResource {
        switch self {
        case .copy: return "Copy"
        case .cut: return "Cut"
        case .paste: return "Paste"
        case .flipHorizontal: return "Flip Horizontal"
        case .flipVertical: return "Flip Vertical"
        case .rotateCw: return "Rotate Right"
        case .rotateCcw: return "Rotate Left"
        case .delete: return "Delete"
        case .deselect: return "Deselect"
        case .commit: return "Done"
        case .cancel: return "Cancel"
        }
    }

    var symbolName: String {
        switch self {
        case .copy: return "doc.on.doc"
        case .cut: return "scissors"
        case .paste: return "doc.on.clipboard"
        case .flipHorizontal:
            return "arrow.left.and.right.righttriangle.left.righttriangle.right"
        case .flipVertical:
            return "arrow.up.and.down.righttriangle.up.righttriangle.down"
        case .rotateCw: return "rotate.right"
        case .rotateCcw: return "rotate.left"
        case .delete: return "trash"
        case .deselect: return "rectangle.dashed"
        case .commit: return "checkmark"
        case .cancel: return "xmark"
        }
    }

    func perform(on host: any SelectionActionBarHost) {
        switch self {
        case .copy: host.copySelection()
        case .cut: host.cutSelection()
        case .paste: host.pasteSelectionClipboard()
        case .flipHorizontal: host.flipMarqueeHorizontal()
        case .flipVertical: host.flipMarqueeVertical()
        case .rotateCw: host.rotateMarqueeCw()
        case .rotateCcw: host.rotateMarqueeCcw()
        case .delete: host.clearMarqueePixels()
        case .deselect, .cancel: host.clearMarqueeOrFloating()
        case .commit: host.commitFloatingSelection()
        }
    }
}

struct SelectionActionBarItem: Equatable {
    let action: SelectionActionBarAction
    let isEnabled: Bool
}

struct SelectionActionBarPresentation: Equatable {
    let items: [SelectionActionBarItem]

    static func resolve(
        hasMarquee: Bool,
        hasFloatingSelection: Bool,
        canPaste: Bool,
        isActiveLayerEditable: Bool,
        isEditingAvailable: Bool
    ) -> SelectionActionBarPresentation? {
        guard hasMarquee, isActiveLayerEditable, isEditingAvailable else {
            return nil
        }
        if hasFloatingSelection {
            return SelectionActionBarPresentation(items: [
                SelectionActionBarItem(action: .commit, isEnabled: true),
                SelectionActionBarItem(action: .cancel, isEnabled: true),
            ])
        }
        return SelectionActionBarPresentation(items: [
            SelectionActionBarItem(action: .copy, isEnabled: true),
            SelectionActionBarItem(action: .cut, isEnabled: true),
            SelectionActionBarItem(action: .paste, isEnabled: canPaste),
            SelectionActionBarItem(action: .flipHorizontal, isEnabled: true),
            SelectionActionBarItem(action: .flipVertical, isEnabled: true),
            SelectionActionBarItem(action: .rotateCw, isEnabled: true),
            SelectionActionBarItem(action: .rotateCcw, isEnabled: true),
            SelectionActionBarItem(action: .delete, isEnabled: true),
            SelectionActionBarItem(action: .deselect, isEnabled: true),
        ])
    }
}

/// Touch-first actions anchored to the active Marquee. Presentation state,
/// command dispatch, and geometry stay behind explicit seams so this leaf
/// view only composes them into accessible SwiftUI controls.
struct SelectionActionBar: View {
    let workspace: Workspace
    let tab: TabState
    let displayScale: CGFloat

    var body: some View {
        GeometryReader { geometry in
            let hasFloatingSelection = tab.floatingSelectionOffset != nil
            let presentation = SelectionActionBarPresentation.resolve(
                hasMarquee: tab.marquee != nil,
                hasFloatingSelection: hasFloatingSelection,
                canPaste: workspace.selectionClipboard != nil,
                isActiveLayerEditable: tab.isActiveLayerEditable,
                isEditingAvailable: !tab.isDrawing
            )

            if let presentation,
               let marquee = tab.marquee,
               let marqueeRect = selectionActionBarAnchorRect(
                   marquee: marquee,
                   hasFloatingSelection: hasFloatingSelection,
                   canvasWidth: tab.document.width(),
                   canvasHeight: tab.document.height(),
                   viewport: tab.viewport,
                   displayScale: displayScale
               ) {
                let barSize = selectionActionBarSize(
                    actionCount: presentation.items.count,
                    viewportWidth: geometry.size.width
                )
                let position = selectionActionBarPosition(
                    marqueeRect: marqueeRect,
                    viewportSize: geometry.size,
                    barSize: barSize
                )

                ScrollView(.horizontal) {
                    HStack(spacing: selectionActionSpacing) {
                        ForEach(presentation.items, id: \.action) { item in
                            actionButton(item)
                        }
                    }
                    .padding(.horizontal, selectionActionBarPadding)
                }
                .scrollIndicators(.hidden)
                .frame(width: barSize.width, height: barSize.height, alignment: .leading)
                .background(DesignTokens.bgElevated)
                .clipShape(RoundedRectangle(cornerRadius: selectionActionBarCornerRadius))
                .overlay {
                    RoundedRectangle(cornerRadius: selectionActionBarCornerRadius)
                        .stroke(
                            DesignTokens.border,
                            lineWidth: selectionActionBarBorderWidth
                        )
                }
                .shadow(
                    color: .black.opacity(selectionActionBarShadowOpacity),
                    radius: selectionActionBarShadowRadius,
                    x: 0,
                    y: selectionActionBarShadowYOffset
                )
                .offset(x: position.x, y: position.y)
                .accessibilityElement(children: .contain)
                .accessibilityLabel(Text("Selection actions"))
            }
        }
    }

    private func actionButton(_ item: SelectionActionBarItem) -> some View {
        Button {
            item.action.perform(on: workspace)
        } label: {
            Image(systemName: item.action.symbolName)
                .font(.system(size: selectionActionIconSize, weight: .medium))
                .frame(width: selectionActionTargetSize, height: selectionActionTargetSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(
            item.action == .delete ? SwiftUI.Color.red : DesignTokens.textPrimary
        )
        .disabled(!item.isEnabled)
        .accessibilityLabel(Text(item.action.label))
    }
}

extension Workspace: SelectionActionBarHost {
    func flipMarqueeHorizontal() {
        activeTab.flipMarqueeHorizontal()
    }

    func flipMarqueeVertical() {
        activeTab.flipMarqueeVertical()
    }

    func rotateMarqueeCw() {
        activeTab.rotateMarqueeCw()
    }

    func rotateMarqueeCcw() {
        activeTab.rotateMarqueeCcw()
    }

    func commitFloatingSelection() {
        _ = activeTab.commitFloatingSelection()
    }
}
