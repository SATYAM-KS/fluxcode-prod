/**
 * Client-side device fingerprinting utility.
 * Combines browser signals into a stable SHA-256 hash.
 * This runs only in the browser (use dynamically or inside useEffect).
 */

async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("FluxCode🔥", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("FluxCode🔥", 4, 17);
    return canvas.toDataURL();
  } catch {
    return "canvas-error";
  }
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return "no-webgl";
    const renderer = gl.getParameter(gl.RENDERER) as string;
    const vendor = gl.getParameter(gl.VENDOR) as string;
    return `${vendor}::${renderer}`;
  } catch {
    return "webgl-error";
  }
}

export async function getDeviceFingerprint(): Promise<string> {
  const signals = [
    navigator.userAgent,
    navigator.language,
    navigator.languages?.join(",") ?? "",
    String(screen.colorDepth),
    `${screen.width}x${screen.height}`,
    `${window.devicePixelRatio}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(navigator.hardwareConcurrency ?? ""),
    String((navigator as any).deviceMemory ?? ""),
    String(navigator.maxTouchPoints ?? ""),
    new Date().getTimezoneOffset().toString(),
    getCanvasFingerprint(),
    getWebGLFingerprint(),
    // Platform info
    (navigator as any).platform ?? "",
    navigator.vendor ?? "",
  ].join("|");

  return sha256(signals);
}
