const HSTS = "max-age=31536000; includeSubDomains";

const PUBLIC_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self'",
].join("; ");

const INTERNAL_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self' https://fonts.gstatic.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
].join("; ");

function isInternalRoute(pathname: string) {
  return pathname === "/internal" || pathname.startsWith("/internal/");
}

function isPublicRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname === "/support" ||
    pathname === "/legal/privacy" ||
    pathname === "/legal/terms"
  );
}

export function applySecurityHeaders(
  request: Request,
  headers: Headers,
): Headers {
  const url = new URL(request.url);

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  if (url.protocol === "https:") {
    headers.set("Strict-Transport-Security", HSTS);
  }

  if (isInternalRoute(url.pathname)) {
    headers.set("X-Frame-Options", "DENY");
    headers.set("Content-Security-Policy", INTERNAL_CSP);
    return headers;
  }

  if (isPublicRoute(url.pathname)) {
    headers.set("X-Frame-Options", "DENY");
    headers.set("Content-Security-Policy", PUBLIC_CSP);
  }

  return headers;
}
