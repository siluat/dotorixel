#include <metal_stdlib>
using namespace metal;

struct Uniforms {
    float2 canvasSize;
    float2 viewportSize;
    float2 panOffset;
    float  effectivePixelSize;
    float  showGrid;
    float4 gridColor;
    float2 referenceScreenOrigin;
    float2 referenceScreenSize;
    float  referenceOpacity;
    uint   referenceRotation;
    float  hasReference;
    float  referencePadding;
};

struct VertexOut {
    float4 position [[position]];
    float2 uv;
};

/// Fullscreen quad from 6 vertices (two triangles), sized to the canvas display area.
/// Positions the quad in NDC using viewport size and pan offset.
vertex VertexOut vertex_main(uint vid [[vertex_id]],
                             constant Uniforms &u [[buffer(0)]]) {
    // Unit-quad corners: (0,0), (1,0), (1,1), (0,0), (1,1), (0,1)
    float2 corners[] = {
        float2(0, 0), float2(1, 0), float2(1, 1),
        float2(0, 0), float2(1, 1), float2(0, 1)
    };
    float2 corner = corners[vid];

    float2 displaySize = u.canvasSize * u.effectivePixelSize;
    float2 screen = round(u.panOffset) + corner * displaySize;
    // Convert to NDC: x ∈ [-1,1], y ∈ [-1,1] (Metal clip space, Y-up)
    float2 ndc = (screen / u.viewportSize) * 2.0 - 1.0;
    ndc.y = -ndc.y; // Flip Y: screen coords are Y-down, NDC is Y-up

    VertexOut out;
    out.position = float4(ndc, 0.0, 1.0);
    out.uv = corner;
    return out;
}

/// Inverts a clockwise Reference quarter-turn in normalized footprint space.
float2 reference_source_uv(float2 footprintUV, uint rotation) {
    switch (rotation % 4) {
        case 1: return float2(footprintUV.y, 1.0 - footprintUV.x);
        case 2: return float2(1.0 - footprintUV.x, 1.0 - footprintUV.y);
        case 3: return float2(1.0 - footprintUV.y, footprintUV.x);
        default: return footprintUV;
    }
}

/// Fragment shader: checkerboard → Reference underlay → pixel color → grid.
/// Reproduces the web Canvas2D renderer's visual output.
fragment float4 fragment_main(VertexOut in [[stage_in]],
                              constant Uniforms &u [[buffer(0)]],
                              texture2d<float> canvasTex [[texture(0)]],
                              texture2d<float> referenceTex [[texture(1)]]) {
    constexpr sampler nearestSampler(min_filter::nearest, mag_filter::nearest,
                                     address::clamp_to_edge);

    float2 uv = in.uv;
    float2 artPixel = floor(uv * u.canvasSize);

    artPixel = clamp(artPixel, float2(0), u.canvasSize - 1.0);
    float2 texCoord = (artPixel + 0.5) / u.canvasSize;
    float4 pixelColor = canvasTex.sample(nearestSampler, texCoord);

    // --- Checkerboard for transparency ---
    float4 checker;
    float4 checkerLight = float4(1.0, 1.0, 1.0, 1.0);         // #ffffff
    float4 checkerDark  = float4(0.878, 0.878, 0.878, 1.0);    // #e0e0e0

    float eps = u.effectivePixelSize;
    if (eps < 8.0) {
        // Low zoom: one checker color per art pixel
        float parity = fmod(artPixel.x + artPixel.y, 2.0);
        checker = (parity < 0.5) ? checkerLight : checkerDark;
    } else {
        // High zoom: 2×2 sub-checkerboard within each art pixel
        float2 localPos = fract(uv * u.canvasSize) * eps;
        float halfSize = ceil(eps / 2.0);
        bool inRight = localPos.x >= halfSize;
        bool inBottom = localPos.y >= halfSize;
        bool isDark = (inRight != inBottom); // XOR: top-left & bottom-right are light
        checker = isDark ? checkerDark : checkerLight;
    }

    float4 color = checker;

    // --- Original-source Reference underlay ---
    if (u.hasReference > 0.5 && all(u.referenceScreenSize > 0.0)) {
        float2 footprintUV = (in.position.xy - u.referenceScreenOrigin) / u.referenceScreenSize;
        if (all(footprintUV >= 0.0) && all(footprintUV < 1.0)) {
            float2 sourceUV = reference_source_uv(footprintUV, u.referenceRotation);
            float4 referenceColor = referenceTex.sample(nearestSampler, sourceUV);
            float referenceAlpha = referenceColor.a * u.referenceOpacity;
            color = mix(color, float4(referenceColor.rgb, 1.0), referenceAlpha);
        }
    }

    // Pixel composite stays above the Reference and remains the only texture
    // used by export and saved-work thumbnails.
    color = mix(color, float4(pixelColor.rgb, 1.0), pixelColor.a);

    // --- Grid overlay ---
    if (u.showGrid > 0.5 && eps >= 4.0) {
        float2 localPos = fract(uv * u.canvasSize) * eps;
        // Grid line at pixel boundary: first pixel row/column of each art pixel
        // Skip grid at canvas edges (artPixel == 0) to match web renderer behavior
        bool onGridX = (localPos.x < 1.0) && (artPixel.x > 0.0);
        bool onGridY = (localPos.y < 1.0) && (artPixel.y > 0.0);
        if (onGridX || onGridY) {
            color = float4(u.gridColor.rgb, u.gridColor.a);
        }
    }

    return color;
}
