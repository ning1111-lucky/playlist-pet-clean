import { getValidSpotifyAccessToken, spotifyApiFetch } from "../_lib/spotify.js";
import { ApiRequest, ApiResponse, jsonResponse } from "../_lib/http.js";

type SpotifyProfile = {
  display_name?: string;
  id?: string;
  email?: string;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    return jsonResponse(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    const accessToken = await getValidSpotifyAccessToken(req, res);
    if (!accessToken) {
      return jsonResponse(res, 200, { ok: true, connected: false });
    }

    const profile = await spotifyApiFetch<SpotifyProfile>(accessToken, "/me");
    return jsonResponse(res, 200, {
      ok: true,
      connected: true,
      displayName: profile.display_name || profile.id || "Spotify User",
      email: profile.email || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Spotify 連線檢查失敗。";
    return jsonResponse(res, 500, { ok: false, connected: false, error: message });
  }
}
