export type ApiRequest = {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown> | null;
};

export type ApiResponse = {
  setHeader?: (name: string, value: string | string[]) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
  };
  statusCode?: number;
  end?: (chunk?: string) => void;
};

export function jsonResponse(res: ApiResponse, statusCode: number, body: Record<string, unknown>) {
  return res.status(statusCode).json(body);
}

export function getHeader(req: ApiRequest, name: string): string {
  const headers = req.headers || {};
  const raw = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  if (Array.isArray(raw)) {
    return raw[0] || "";
  }
  return typeof raw === "string" ? raw : "";
}

export function getRequestUrl(req: ApiRequest): URL {
  const rawUrl = req.url || "/";
  const protocol = getHeader(req, "x-forwarded-proto") || "http";
  const host = getHeader(req, "x-forwarded-host") || getHeader(req, "host") || "localhost:3000";
  return new URL(rawUrl, `${protocol}://${host}`);
}

export function redirectResponse(res: ApiResponse, location: string, statusCode = 302) {
  if (typeof res.setHeader === "function") {
    res.setHeader("Location", location);
  }
  if (typeof res.end === "function") {
    res.statusCode = statusCode;
    res.end();
    return;
  }
  return res.status(statusCode).json({ ok: true, redirectTo: location });
}

export function parseCookies(req: ApiRequest): Record<string, string> {
  const cookieHeader = getHeader(req, "cookie");
  if (!cookieHeader) return {};

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex === -1) return acc;
      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (!name) return acc;
      acc[name] = decodeURIComponent(value);
      return acc;
    }, {});
}

type CookieOptions = {
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  maxAge?: number;
};

export function serializeCookie(name: string, value: string, options: CookieOptions = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  segments.push(`Path=${options.path || "/"}`);

  if (typeof options.maxAge === "number") {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.httpOnly) {
    segments.push("HttpOnly");
  }

  if (options.secure) {
    segments.push("Secure");
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  return segments.join("; ");
}
