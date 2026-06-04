import { clearSpotifyCookies, getSpotifyLogoutRedirect } from "../_lib/spotify.js";
import { ApiRequest, ApiResponse, jsonResponse, redirectResponse } from "../_lib/http.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse(res, 405, { ok: false, error: "Method not allowed." });
  }

  clearSpotifyCookies(req, res);
  return redirectResponse(res, getSpotifyLogoutRedirect(req));
}
