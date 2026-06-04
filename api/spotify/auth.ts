import { createSpotifyAuthorizeUrl, setSpotifyStateCookie } from "../_lib/spotify.js";
import { ApiRequest, ApiResponse, jsonResponse, redirectResponse } from "../_lib/http.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    return jsonResponse(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    const { url, state } = createSpotifyAuthorizeUrl(req);
    setSpotifyStateCookie(req, res, state);
    return redirectResponse(res, url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Spotify 授權初始化失敗。";
    return jsonResponse(res, 500, { ok: false, error: message });
  }
}
