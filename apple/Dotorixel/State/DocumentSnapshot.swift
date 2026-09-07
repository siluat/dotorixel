import Foundation

/// A Document's preservation state, independent of tab identity and presentation.
/// Capture and reconstruction share this module so consumers never assemble the
/// frame grid or restore the Marquee separately. This is not a History entry.
struct DocumentSnapshot {
    let width: UInt32
    let height: UInt32
    /// Pixel Layers in stack order, with every Cel and the active-frame pixels.
    let layers: [AppleLayerSnapshot]
    /// Both absent for legacy or adapter-recovered single-frame records; the
    /// existing binding then builds the sole Cel from each Layer's `pixels`.
    let frames: [AppleFrameMetadata]?
    let activeFrameId: String?
    let reference: AppleReferenceLayerSnapshot?
    let activeLayerId: String
    let nextLayerNumber: UInt32
    let marquee: AppleMarqueeRegion?

    /// Captures a value without resolving a Floating Selection or mutating the
    /// live Document. The lifecycle owns the baseline; this module applies its
    /// preservation projection to both the active-frame pixels and its Cel.
    static func capture(
        _ document: AppleDocument,
        floatingSelection: FloatingSelectionLifecycle? = nil
    ) -> DocumentSnapshot {
        DocumentSnapshot(
            width: document.width(),
            height: document.height(),
            layers: preservationLayers(document, floatingSelection: floatingSelection),
            frames: document.frames(),
            activeFrameId: document.activeFrameId(),
            reference: document.referenceLayerSnapshot(),
            activeLayerId: floatingSelection?.snapshotActiveLayerId(
                currentActiveLayerId: document.activeLayerId()
            ) ?? document.activeLayerId(),
            nextLayerNumber: document.nextLayerNumber(),
            marquee: document.marquee()
        )
    }

    /// Whether all preserved Cel bytes are zero, including hidden Layers and
    /// inactive Frames. Reads only the Pixel Layers, avoiding Reference source
    /// copies and Document reconstruction for the tab-close guard.
    static func isDocumentBlank(
        _ document: AppleDocument,
        floatingSelection: FloatingSelectionLifecycle? = nil
    ) -> Bool {
        preservationLayers(document, floatingSelection: floatingSelection).allSatisfy { layer in
            layer.cels.allSatisfy { cel in
                cel.pixels.allSatisfy { $0 == 0 }
            }
        }
    }

    private static func preservationLayers(
        _ document: AppleDocument,
        floatingSelection: FloatingSelectionLifecycle?
    ) -> [AppleLayerSnapshot] {
        let layers = document.pixelLayerSnapshots()
        guard let floatingSelection else { return layers }
        let activeFrameId = document.activeFrameId()
        return layers.map { layer in
            var preserved = layer
            let pixels = floatingSelection.snapshotPixels(
                for: layer.id, currentPixels: layer.pixels
            )
            preserved.pixels = pixels
            preserved.cels = layer.cels.map { cel in
                var preservedCel = cel
                if cel.frameId == activeFrameId {
                    preservedCel.pixels = pixels
                }
                return preservedCel
            }
            return preserved
        }
    }

    /// Reconstructs an independent Document through the core's validation.
    /// The existing binding carries Timeline presentation alongside content;
    /// callers restoring a tab supply its flag without storing it here.
    /// Throws on invalid content; storage-specific recovery belongs to the adapter.
    func makeDocument(timelinePanelCollapsed: Bool = false) throws -> AppleDocument {
        let document = try AppleDocument.fromLayers(
            width: width,
            height: height,
            layers: layers,
            activeLayerId: activeLayerId,
            nextLayerNumber: nextLayerNumber,
            timelinePanelCollapsed: timelinePanelCollapsed,
            reference: reference,
            frames: frames,
            activeFrameId: activeFrameId
        )
        try document.setMarquee(region: marquee)
        return document
    }
}
