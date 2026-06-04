import dotenv from "dotenv";
import { createWeeklyRunInNotion } from "../_lib/notion.js";

type ApiRequest = {
  method?: string;
  body?: {
    sessionName?: unknown;
    userName?: unknown;
    musicSource?: unknown;
    lastfmUsername?: unknown;
    mainGenreKey?: unknown;
    secondaryGenreKey?: unknown;
    analysisType?: unknown;
    listenCount?: unknown;
    day1ClothesKey?: unknown;
    day1ShoesKey?: unknown;
    day2HeadwearKey?: unknown;
    day2HandheldKey?: unknown;
    day3AccessoryKey?: unknown;
    baseKey?: unknown;
    finalPrompt?: unknown;
    petImageUrl?: unknown;
    status?: unknown;
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

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    return jsonResponse(res, 405, { error: "Only POST is allowed" });
  }

  const payload = {
    sessionName: readString(req.body?.sessionName),
    userName: readString(req.body?.userName),
    musicSource: readString(req.body?.musicSource),
    lastfmUsername: readString(req.body?.lastfmUsername),
    mainGenreKey: readString(req.body?.mainGenreKey),
    secondaryGenreKey: readString(req.body?.secondaryGenreKey),
    analysisType: readString(req.body?.analysisType),
    listenCount: Number(req.body?.listenCount) || 0,
    day1ClothesKey: readString(req.body?.day1ClothesKey),
    day1ShoesKey: readString(req.body?.day1ShoesKey),
    day2HeadwearKey: readString(req.body?.day2HeadwearKey),
    day2HandheldKey: readString(req.body?.day2HandheldKey),
    day3AccessoryKey: readString(req.body?.day3AccessoryKey),
    baseKey: readString(req.body?.baseKey),
    finalPrompt: readString(req.body?.finalPrompt),
    petImageUrl: readString(req.body?.petImageUrl),
    status: readString(req.body?.status) || "generated",
  };

  if (
    !payload.sessionName ||
    !payload.userName ||
    !payload.musicSource ||
    !payload.mainGenreKey ||
    !payload.secondaryGenreKey ||
    !payload.baseKey
  ) {
    return jsonResponse(res, 400, { error: "Missing required weekly run fields" });
  }

  try {
    const result = await createWeeklyRunInNotion(payload);
    return jsonResponse(res, 200, {
      ok: true,
      pageId: result.pageId,
      database: result.database,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create Notion weekly run";
    return jsonResponse(res, 502, { error: message });
  }
}
