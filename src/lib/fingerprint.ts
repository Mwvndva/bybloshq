/**
 * Generates a stable, unique 64-character hash of the user's device
 * Combining Canvas fingerprinting, CPU cores, WebGL renderer, and AudioContext metrics.
 */
export async function getDeviceFingerprint(): Promise<string> {
    const components: string[] = [];

    // 1. Hardware Metrics
    components.push(navigator.hardwareConcurrency?.toString() || 'unknown');
    components.push((navigator as any).deviceMemory?.toString() || 'unknown');

    // 2. Canvas Fingerprint
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("ByblosArmoredSystem", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("ByblosArmoredSystem", 4, 17);
        components.push(canvas.toDataURL());
    }

    // 3. WebGL Fingerprint
    const glCanvas = document.createElement('canvas');
    const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl') as WebGLRenderingContext;
    if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
            components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
        }
    }

    // 4. AudioContext Fingerprint
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const compressor = audioCtx.createDynamicsCompressor();
        oscillator.type = 'triangle';
        oscillator.connect(compressor);
        compressor.connect(audioCtx.destination);
        components.push(compressor.attack.value.toString());
        components.push(compressor.threshold.value.toString());
    } catch (e) {
        components.push('no-audio');
    }

    // 5. Screen & Timezone
    components.push(`${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`);
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Combine and Hash
    const combinedString = components.join('|');
    const msgUint8 = new TextEncoder().encode(combinedString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Return first 64 chars (SHA-256 is 64 hex chars)
    return hashHex;
}
