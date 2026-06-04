import dotenv from "dotenv";
import { getRequestContentType, getRequestRawBody, parseMultipartFormData, resolveMultipartImageField, type ApiLikeRequest } from "./_lib/multipart.js";
import { buildGenreReferenceContext } from "./_lib/notion.js";

type ApiResponse = {
  setHeader?: (name: string, value: string | string[]) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

type GeminiAnalysis = {
  base_description: string;
  clothes_description: string;
  shoes_description: string;
  headwear_description: string;
  handheld_description: string;
  accessory_description: string;
  style_summary: string;
  final_prompt_en: string;
  negative_prompt_en: string;
};

export const config = {
  api: {
    bodyParser: false,
  },
};

dotenv.config({ path: ".env.local" });
dotenv.config();

const GEMINI_PROMPT = `You are analyzing image assets for a music pet generator.

Image A is the base character.
Image B is the clothes item.
Image C is the shoes item.
Image D is the headwear item.
Image E is the handheld item.
Image F is the accessory item.

Analyze each image carefully and return JSON only.

Requirements:

* Describe the base character's body shape, silhouette, facial features, color palette, and visual identity.
* Describe each selected item:

  * what it is
  * color
  * material or texture
  * shape
  * music/fashion style
  * where it should be worn or placed on the character
* Do not confuse item categories.
* Do not treat the outfit as an empty shell.
* Do not leave selected items floating separately in the final generated image.
* The final prompt must be written in English and must be directly usable by Leonardo AI.

The final prompt must instruct Leonardo to:

* preserve the base character identity
* keep the base character body fully present and fully rendered
* apply the clothes as the main torso outfit
* place shoes clearly on both feet
* place headwear on top of the head
* place handheld item in one hand or naturally beside the character
* place accessory in the correct worn position
* generate one cohesive full-body cute pixel-art music pet
* keep all items integrated into the character
* do not ignore any selected item
* do not leave items floating separately
* do not generate UI cards, item previews, text labels, borders, or interface elements
* output only the final character artwork

Return JSON only in this exact structure:

{
"base_description": "",
"clothes_description": "",
"shoes_description": "",
"headwear_description": "",
"handheld_description": "",
"accessory_description": "",
"style_summary": "",
"final_prompt_en": "",
"negative_prompt_en": ""
}`;

function buildGeminiPrompt(referenceContext: string): string {
  if (!referenceContext.trim()) {
    return GEMINI_PROMPT;
  }

  return `${GEMINI_PROMPT}

Additional Notion genre references:
${referenceContext.trim()}

Use these Notion references only as style guidance. The uploaded images still have the highest priority.`;
}

function jsonResponse(res: ApiResponse, statusCode: number, body: Record<string, unknown>) {
  return res.status(statusCode).json(body);
}

function stripJsonCodeFence(rawText: string): string {
  return rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function validateAnalysisShape(value: unknown): GeminiAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const keys = [
    "base_description",
    "clothes_description",
    "shoes_description",
    "headwear_description",
    "handheld_description",
    "accessory_description",
    "style_summary",
    "final_prompt_en",
    "negative_prompt_en",
  ] as const;
  const normalized: Record<string, string> = {};

  for (const key of keys) {
    normalized[key] = typeof record[key] === "string" ? record[key].trim() : "";
  }

  if (!normalized.final_prompt_en) return null;
  return normalized as GeminiAnalysis;
}

function parseGeminiJson(rawText: string): GeminiAnalysis | { error: string; raw: string } {
  const candidates = [rawText, stripJsonCodeFence(rawText)];
  for (const candidate of candidates) {
    if (!candidate.trim()) continue;
    try {
      const parsed = JSON.parse(candidate);
      const valid = validateAnalysisShape(parsed);
      if (valid) return valid;
    } catch {
      // continue
    }
  }

  return {
    error: "Failed to parse Gemini JSON",
    raw: rawText,
  };
}

function extractGeminiText(responseBody: unknown): string {
  if (!responseBody || typeof responseBody !== "object") return "";
  const body = responseBody as Record<string, unknown>;
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  const firstCandidate = candidates[0];
  if (!firstCandidate || typeof firstCandidate !== "object") return "";
  const content = (firstCandidate as Record<string, unknown>).content;
  if (!content || typeof content !== "object") return "";
  const parts = Array.isArray((content as Record<string, unknown>).parts)
    ? ((content as Record<string, unknown>).parts as Array<Record<string, unknown>>)
    : [];

  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

function toInlineData(image: { buffer: Buffer; mimeType: string }) {
  return {
    inlineData: {
      mimeType: image.mimeType || "image/png",
      data: image.buffer.toString("base64"),
    },
  };
}

async function callGemini(
  model: string,
  apiKey: string,
  images: Array<{ buffer: Buffer; mimeType: string }>,
  promptText: string
) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }, ...images.map((image) => toInlineData(image))],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  const responseText = await response.text().catch(() => "");
  let parsedBody: unknown = null;
  try {
    parsedBody = responseText ? JSON.parse(responseText) : null;
  } catch {
    parsedBody = null;
  }

  if (!response.ok) {
    const message =
      parsedBody && typeof parsedBody === "object" && typeof (parsedBody as { error?: { message?: unknown } }).error?.message === "string"
        ? (parsedBody as { error: { message: string } }).error.message
        : responseText || "Gemini analysis failed";
    throw new Error(message);
  }

  return extractGeminiText(parsedBody);
}

export default async function handler(req: ApiLikeRequest & { method?: string }, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    return jsonResponse(res, 405, { error: "Only POST is allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    return jsonResponse(res, 500, { error: "Missing GEMINI_API_KEY" });
  }

  const contentType = getRequestContentType(req);
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return jsonResponse(res, 400, { error: "Expected multipart/form-data" });
  }

  try {
    const rawBody = await getRequestRawBody(req);
    const fields = parseMultipartFormData(rawBody, contentType);

    const images = await Promise.all([
      resolveMultipartImageField(fields, "base"),
      resolveMultipartImageField(fields, "clothes"),
      resolveMultipartImageField(fields, "shoes"),
      resolveMultipartImageField(fields, "headwear"),
      resolveMultipartImageField(fields, "handheld"),
      resolveMultipartImageField(fields, "accessory"),
    ]);

    const mainGenre = typeof fields.mainGenre === "string" ? fields.mainGenre.trim() : "";
    const subGenre = typeof fields.subGenre === "string" ? fields.subGenre.trim() : "";
    let notionReferenceContext = "";
    let notionSource: Record<string, unknown> | null = null;

    if (mainGenre) {
      try {
        const reference = await buildGenreReferenceContext(mainGenre, subGenre || mainGenre);
        notionReferenceContext = reference.promptContext;
        notionSource = reference.source ? { ...reference.source } : null;
      } catch {
        notionReferenceContext = "";
        notionSource = null;
      }
    }

    const rawText = await callGemini(
      process.env.GEMINI_MODEL || "gemini-2.5-flash",
      apiKey,
      images,
      buildGeminiPrompt(notionReferenceContext)
    );
    const parsed = parseGeminiJson(rawText);

    if ("error" in parsed) {
      return jsonResponse(res, 502, parsed);
    }

    return jsonResponse(res, 200, {
      analysis: parsed,
      notion: {
        source: notionSource,
        promptContext: notionReferenceContext,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini analysis failed";
    return jsonResponse(res, 502, { error: message });
  }
}
