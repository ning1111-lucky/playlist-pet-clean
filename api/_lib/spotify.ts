import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import { ApiRequest, ApiResponse, getHeader, getRequestUrl, parseCookies, serializeCookie } from "./http.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SPOTIFY_AUTH_BASE = "https://accounts.spotify.com";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const ACCESS_COOKIE = "spotify_access_token";
const REFRESH_COOKIE = "spotify_refresh_token";
const EXPIRES_COOKIE = "spotify_token_expires_at";
const STATE_COOKIE = "spotify_oauth_state";

const SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
];

function getClientId() {
  return process.env.SPOTIFY_CLIENT_ID || "";
}

function getClientSecret() {
  return process.env.SPOTIFY_CLIENT_SECRET || "";
}

export function getSpotifyRedirectUri(req: ApiRequest) {
  return process.env.SPOTIFY_REDIRECT_URI || new URL("/api/spotify/callback", getRequestUrl(req)).toString();
}

function getTokenEndpoint() {
  return `${SPOTIFY_AUTH_BASE}/api/token`;
}

function createBasicAuthHeader() {
  return `Basic ${Buffer.from(`${getClientId()}:${getClientSecret()}`).toString("base64")}`;
}

export function assertSpotifyEnv() {
  if (!getClientId() || !getClientSecret()) {
    throw new Error("Spotify 尚未設定完成，請先加入 SPOTIFY_CLIENT_ID 與 SPOTIFY_CLIENT_SECRET。");
  }
}

export function createSpotifyAuthorizeUrl(req: ApiRequest) {
  assertSpotifyEnv();
  const state = randomBytes(16).toString("hex");
  const url = new URL(`${SPOTIFY_AUTH_BASE}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", getClientId());
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("redirect_uri", getSpotifyRedirectUri(req));
  url.searchParams.set("state", state);

  return { url: url.toString(), state };
}

export function setSpotifyStateCookie(req: ApiRequest, res: ApiResponse, state: string) {
  const secure = getRequestUrl(req).protocol === "https:";
  res.setHeader?.(
    "Set-Cookie",
    serializeCookie(STATE_COOKIE, state, {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
      maxAge: 60 * 10,
    })
  );
}

function setAuthCookies(req: ApiRequest, res: ApiResponse, payload: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) {
  const secure = getRequestUrl(req).protocol === "https:";
  const expiresAt = Date.now() + payload.expiresIn * 1000;
  const cookies = [
    serializeCookie(ACCESS_COOKIE, payload.accessToken, {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
      maxAge: payload.expiresIn,
    }),
    serializeCookie(REFRESH_COOKIE, payload.refreshToken, {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 30,
    }),
    serializeCookie(EXPIRES_COOKIE, String(expiresAt), {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 30,
    }),
    serializeCookie(STATE_COOKIE, "", {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
      maxAge: 0,
    }),
  ];
  res.setHeader?.("Set-Cookie", cookies);
}

export function clearSpotifyCookies(req: ApiRequest, res: ApiResponse) {
  const secure = getRequestUrl(req).protocol === "https:";
  res.setHeader?.("Set-Cookie", [
    serializeCookie(ACCESS_COOKIE, "", { path: "/", httpOnly: true, secure, sameSite: "Lax", maxAge: 0 }),
    serializeCookie(REFRESH_COOKIE, "", { path: "/", httpOnly: true, secure, sameSite: "Lax", maxAge: 0 }),
    serializeCookie(EXPIRES_COOKIE, "", { path: "/", httpOnly: true, secure, sameSite: "Lax", maxAge: 0 }),
    serializeCookie(STATE_COOKIE, "", { path: "/", httpOnly: true, secure, sameSite: "Lax", maxAge: 0 }),
  ]);
}

type SpotifyTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function readSpotifyTokenResponse(response: Response): Promise<SpotifyTokenResponse> {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as SpotifyTokenResponse;
  } catch {
    return { error_description: text.trim() };
  }
}

export async function exchangeSpotifyCode(req: ApiRequest, res: ApiResponse, code: string) {
  const response = await fetch(getTokenEndpoint(), {
    method: "POST",
    headers: {
      Authorization: createBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getSpotifyRedirectUri(req),
    }),
  });

  const body = await readSpotifyTokenResponse(response);
  if (!response.ok || !body.access_token || !body.refresh_token || !body.expires_in) {
    throw new Error(body.error_description || "Spotify 授權交換失敗。");
  }

  setAuthCookies(req, res, {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in,
  });
}

async function refreshSpotifyToken(req: ApiRequest, res: ApiResponse, refreshToken: string) {
  const response = await fetch(getTokenEndpoint(), {
    method: "POST",
    headers: {
      Authorization: createBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const body = await readSpotifyTokenResponse(response);
  if (!response.ok || !body.access_token || !body.expires_in) {
    throw new Error(body.error_description || "Spotify token 更新失敗。");
  }

  setAuthCookies(req, res, {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || refreshToken,
    expiresIn: body.expires_in,
  });

  return body.access_token;
}

export async function getValidSpotifyAccessToken(req: ApiRequest, res: ApiResponse) {
  assertSpotifyEnv();
  const cookies = parseCookies(req);
  const accessToken = cookies[ACCESS_COOKIE];
  const refreshToken = cookies[REFRESH_COOKIE];
  const expiresAt = Number(cookies[EXPIRES_COOKIE] || 0);

  if (accessToken && expiresAt > Date.now() + 10_000) {
    return accessToken;
  }

  if (!refreshToken) {
    return null;
  }

  return refreshSpotifyToken(req, res, refreshToken);
}

export function validateSpotifyState(req: ApiRequest, state: string) {
  const cookies = parseCookies(req);
  return Boolean(state && cookies[STATE_COOKIE] && cookies[STATE_COOKIE] === state);
}

export async function spotifyApiFetch<T>(accessToken: string, pathname: string, params?: Record<string, string>) {
  const url = new URL(`${SPOTIFY_API_BASE}${pathname}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const text = await response.text().catch(() => "");
  const body = text.trim() ? (JSON.parse(text) as T & { error?: { message?: string } }) : ({} as T & { error?: { message?: string } });

  if (!response.ok) {
    const message = body?.error?.message || "Spotify API 請求失敗。";
    throw new Error(message);
  }

  return body as T;
}

export function getSpotifyLogoutRedirect(req: ApiRequest) {
  return new URL("/", getRequestUrl(req)).toString();
}

export function getSpotifyAppRedirect(req: ApiRequest) {
  return new URL("/", getRequestUrl(req)).toString();
}

export function getRequestOrigin(req: ApiRequest) {
  return getRequestUrl(req).origin;
}
