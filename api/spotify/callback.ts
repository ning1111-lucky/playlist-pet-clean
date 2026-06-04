import { exchangeSpotifyCode, getSpotifyAppRedirect, validateSpotifyState } from "../_lib/spotify.js";
import { ApiRequest, ApiResponse, getRequestUrl, jsonResponse, redirectResponse } from "../_lib/http.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    return jsonResponse(res, 405, { ok: false, error: "Method not allowed." });
  }

  const url = getRequestUrl(req);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error") || "";

  if (error) {
    return redirectResponse(res, `${getSpotifyAppRedirect(req)}?spotify_error=${encodeURIComponent(error)}`);
  }

  if (!code || !validateSpotifyState(req, state)) {
    return redirectResponse(res, `${getSpotifyAppRedirect(req)}?spotify_error=invalid_state`);
  }

  try {
    await exchangeSpotifyCode(req, res, code);
    return redirectResponse(res, `${getSpotifyAppRedirect(req)}?spotify=connected`);
  } catch (tokenError) {
    const message = tokenError instanceof Error ? tokenError.message : "spotify_exchange_failed";
    return redirectResponse(res, `${getSpotifyAppRedirect(req)}?spotify_error=${encodeURIComponent(message)}`);
  }
}
