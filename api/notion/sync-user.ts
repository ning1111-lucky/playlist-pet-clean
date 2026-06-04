import dotenv from "dotenv";
import { syncUserProfileToNotion } from "../_lib/notion.js";

type ApiRequest = {
  method?: string;
  body?: {
    name?: unknown;
    email?: unknown;
    country?: unknown;
    city?: unknown;
    style?: unknown;
    musicProvider?: unknown;
    lastfmUsername?: unknown;
  } | null;
};

type ApiResponse = {
  setHeader?: (name: string, value: string | string[]) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

dotenv.config({ path: ".env.local" });
dotenv.config();

function jsonResponse(res: ApiResponse, statusCode: number, body: Record<string, unknown>) {
  return res.status(statusCode).json(body);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    return jsonResponse(res, 405, { error: "Only POST is allowed" });
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const country = typeof req.body?.country === "string" ? req.body.country.trim() : "";
  const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
  const style = typeof req.body?.style === "string" ? req.body.style.trim() : "";
  const musicProvider = typeof req.body?.musicProvider === "string" ? req.body.musicProvider.trim() : "";
  const lastfmUsername = typeof req.body?.lastfmUsername === "string" ? req.body.lastfmUsername.trim() : "";

  if (!name || !email || !country || !city || !musicProvider) {
    return jsonResponse(res, 400, { error: "Missing required user fields" });
  }

  try {
    const result = await syncUserProfileToNotion({
      name,
      email,
      country,
      city,
      styleNote: style,
      musicSource: musicProvider,
      lastfmUsername,
      spotifyConnected: musicProvider === "spotify",
    });

    return jsonResponse(res, 200, {
      ok: true,
      pageId: result.pageId,
      database: result.database,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync Notion user";
    return jsonResponse(res, 502, { error: message });
  }
}
