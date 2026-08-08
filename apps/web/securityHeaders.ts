export const crossOriginIsolationHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws://127.0.0.1:5173 https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
    "worker-src 'self' blob:",
  ].join("; "),
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
} as const;

/** The isolated OAuth helper is the only route allowed to retain a cross-origin popup opener. */
export const googleOAuthBridgeHeaders = {
  ...crossOriginIsolationHeaders,
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
} as const;
