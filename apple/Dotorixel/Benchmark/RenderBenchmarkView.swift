#if DEBUG
import MetalKit
import SwiftUI

// MARK: - Data types

struct BenchmarkResult: Identifiable {
    let id = UUID()
    let canvasSize: UInt32
    let zoom: Double
    let effectivePixelSize: Int
    let cpuMedianMs: Double
    let cpuP95Ms: Double
    let gpuMedianMs: Double
    let gpuP95Ms: Double
    let theoreticalFps: Int
}

// MARK: - Benchmark controller

@Observable
final class BenchmarkController {
    var mtkView: MTKView?
    var renderer: PixelGridRenderer?
    var results: [BenchmarkResult] = []
    var isRunning = false
    var progress = ""

    private static let canvasSizes: [UInt32] = [8, 16, 32, 64, 128]
    private static let zoomLevels: [Double] = [1, 8, 16]
    private static let targetDisplaySize: UInt32 = 512
    private static let warmupFrames = 10
    private static let measureFrames = 100

    func runBenchmark() {
        guard let mtkView, let renderer, !isRunning else { return }
        isRunning = true
        results = []

        DispatchQueue.global(qos: .userInitiated).async { [self] in
            var allResults: [BenchmarkResult] = []

            for size in Self.canvasSizes {
                for zoom in Self.zoomLevels {
                    let pixelSize = Self.targetDisplaySize / size
                    let eps = Int(round(Double(pixelSize) * zoom))

                    DispatchQueue.main.sync {
                        self.progress = "\(size)\u{00d7}\(size) @ \(Int(zoom))\u{00d7} (effective pixel: \(eps)px)..."
                    }

                    // Create test canvas filled with semi-transparent color
                    let testColor = Color(r: 128, g: 64, b: 192, a: 180)
                    guard let canvas = try? ApplePixelCanvas.withColor(
                        width: size, height: size, color: testColor
                    ) else { continue }

                    let pixels = Data(canvas.pixels())
                    let gridColor = SIMD4<Float>(0.878, 0.863, 0.843, 1.0)

                    // Configure renderer on main thread (Metal requires it)
                    DispatchQueue.main.sync {
                        renderer.updateCanvasTexture(pixels: pixels, width: size, height: size)
                        renderer.updateUniforms(
                            canvasWidth: size,
                            canvasHeight: size,
                            viewportWidth: Float(mtkView.drawableSize.width),
                            viewportHeight: Float(mtkView.drawableSize.height),
                            panX: 0,
                            panY: 0,
                            effectivePixelSize: Float(eps),
                            showGrid: true,
                            gridColor: gridColor
                        )
                    }

                    // Warmup — must run on main thread for drawable access
                    DispatchQueue.main.sync {
                        for _ in 0..<Self.warmupFrames {
                            _ = renderer.benchmarkDraw(in: mtkView)
                        }
                    }

                    // Measure
                    var cpuTimes: [Double] = []
                    var gpuTimes: [Double] = []

                    DispatchQueue.main.sync {
                        for _ in 0..<Self.measureFrames {
                            if let timing = renderer.benchmarkDraw(in: mtkView) {
                                cpuTimes.append(timing.cpuMs)
                                gpuTimes.append(timing.gpuMs)
                            }
                        }
                    }

                    guard !cpuTimes.isEmpty else { continue }

                    let cpuMed = Self.median(cpuTimes)
                    let gpuMed = Self.median(gpuTimes)

                    allResults.append(BenchmarkResult(
                        canvasSize: size,
                        zoom: zoom,
                        effectivePixelSize: eps,
                        cpuMedianMs: cpuMed,
                        cpuP95Ms: Self.percentile95(cpuTimes),
                        gpuMedianMs: gpuMed,
                        gpuP95Ms: Self.percentile95(gpuTimes),
                        theoreticalFps: cpuMed > 0 ? Int(1000.0 / cpuMed) : 0
                    ))
                }
            }

            DispatchQueue.main.async {
                self.results = allResults
                self.progress = "Done!"
                self.isRunning = false
            }
        }
    }

    func resultsAsMarkdown() -> String {
        var md = "| Canvas | Zoom | Effective px | CPU Median (ms) | CPU P95 (ms) | GPU Median (ms) | GPU P95 (ms) | Max FPS |\n"
        md += "|--------|------|-------------|-----------------|--------------|-----------------|--------------|----------|\n"
        for r in results {
            md += "| \(r.canvasSize)\u{00d7}\(r.canvasSize) | \(Int(r.zoom))\u{00d7} | \(r.effectivePixelSize)"
            md += " | \(String(format: "%.3f", r.cpuMedianMs)) | \(String(format: "%.3f", r.cpuP95Ms))"
            md += " | \(String(format: "%.3f", r.gpuMedianMs)) | \(String(format: "%.3f", r.gpuP95Ms))"
            md += " | \(r.theoreticalFps) |\n"
        }
        return md
    }

    private static func median(_ arr: [Double]) -> Double {
        let sorted = arr.sorted()
        let mid = sorted.count / 2
        return sorted.count % 2 == 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    }

    private static func percentile95(_ arr: [Double]) -> Double {
        let sorted = arr.sorted()
        let index = Int(ceil(Double(sorted.count) * 0.95)) - 1
        return sorted[max(0, index)]
    }
}

// MARK: - MTKView wrapper for benchmark

private struct BenchmarkMTKViewWrapper {
    let controller: BenchmarkController
}

#if os(macOS)
extension BenchmarkMTKViewWrapper: NSViewRepresentable {
    func makeNSView(context: Context) -> MTKView {
        createMTKView()
    }

    func updateNSView(_ nsView: MTKView, context: Context) {}
}
#else
extension BenchmarkMTKViewWrapper: UIViewRepresentable {
    func makeUIView(context: Context) -> MTKView {
        createMTKView()
    }

    func updateUIView(_ uiView: MTKView, context: Context) {}
}
#endif

extension BenchmarkMTKViewWrapper {
    private func createMTKView() -> MTKView {
        let view = MTKView()
        view.device = MTLCreateSystemDefaultDevice()
        view.colorPixelFormat = .bgra8Unorm

        if let renderer = PixelGridRenderer(mtkView: view) {
            controller.renderer = renderer
            view.delegate = renderer
        }
        controller.mtkView = view
        return view
    }
}

// MARK: - Benchmark view

struct RenderBenchmarkView: View {
    @State private var controller = BenchmarkController()

    var body: some View {
        VStack(spacing: 16) {
            Text("Metal Rendering Benchmark")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Measures PixelGridRenderer draw time across canvas sizes and zoom levels. Viewport: 512\u{00d7}512, grid: on, all pixels: semi-transparent.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            // Render target — needs to be in view hierarchy for valid drawables
            BenchmarkMTKViewWrapper(controller: controller)
                .frame(width: 256, height: 256)
                .border(SwiftUI.Color.gray.opacity(0.3))

            HStack(spacing: 12) {
                Button(controller.isRunning ? "Running..." : "Run Benchmark") {
                    controller.runBenchmark()
                }
                .disabled(controller.isRunning)

                if !controller.results.isEmpty {
                    #if os(macOS)
                    Button("Copy as Markdown") {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(controller.resultsAsMarkdown(), forType: .string)
                    }
                    #else
                    Button("Copy as Markdown") {
                        UIPasteboard.general.string = controller.resultsAsMarkdown()
                    }
                    #endif
                }
            }

            if !controller.progress.isEmpty {
                Text(controller.progress)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if !controller.results.isEmpty {
                ScrollView {
                    resultTable
                }
            }
        }
        .padding()
    }

    @ViewBuilder
    private var resultTable: some View {
        Grid(alignment: .trailing, horizontalSpacing: 12, verticalSpacing: 6) {
            GridRow {
                Text("Canvas").fontWeight(.semibold)
                Text("Zoom").fontWeight(.semibold)
                Text("Eff. px").fontWeight(.semibold)
                Text("CPU Med").fontWeight(.semibold)
                Text("CPU P95").fontWeight(.semibold)
                Text("GPU Med").fontWeight(.semibold)
                Text("GPU P95").fontWeight(.semibold)
                Text("Max FPS").fontWeight(.semibold)
            }
            .font(.caption)

            Divider()

            ForEach(controller.results) { r in
                GridRow {
                    Text("\(r.canvasSize)\u{00d7}\(r.canvasSize)")
                    Text("\(Int(r.zoom))\u{00d7}")
                    Text("\(r.effectivePixelSize)")
                    Text(String(format: "%.3f", r.cpuMedianMs))
                    Text(String(format: "%.3f", r.cpuP95Ms))
                    Text(String(format: "%.3f", r.gpuMedianMs))
                    Text(String(format: "%.3f", r.gpuP95Ms))
                    Text("\(r.theoreticalFps)")
                }
                .font(.caption.monospaced())
            }
        }
        .padding(.horizontal)
    }
}
#endif
