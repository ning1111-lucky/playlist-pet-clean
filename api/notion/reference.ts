import dotenv from "dotenv";
import { buildGenreReferenceContext, getGenreRules } from "../_lib/notion.js";

type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
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

function firstQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : typeof value === "string" ? value : "";
}

function readQueryValue(req: ApiRequest, key: string): string {
  const direct = firstQueryValue(req.query?.[key]);
  if (direct) return direct;

  if (typeof req.url === "string" && req.url.includes("?")) {
    const searchParams = new URL(req.url, "http://localhost").searchParams;
    return searchParams.get(key)?.trim() || "";
  }

  return "";
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    res.setHeader?.("Allow", "GET");
    return jsonResponse(res, 405, { error: "Only GET is allowed" });
  }

  try {
    const genre = readQueryValue(req, "genre");
    const subGenre = readQueryValue(req, "subGenre");

    if (genre) {
      const reference = await buildGenreReferenceContext(genre, subGenre || genre);
      return jsonResponse(res, 200, {
        ok: true,
        source: reference.source,
        mainRule: reference.mainRule,
        subRule: reference.subRule,
        promptContext: reference.promptContext,
      });
    }

    const { rules, source } = await getGenreRules();
    return jsonResponse(res, 200, {
      ok: true,
      source,
      rules,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch Notion reference";
    return jsonResponse(res, 502, { error: message });
  }
}
