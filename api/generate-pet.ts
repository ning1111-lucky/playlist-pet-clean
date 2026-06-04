import dotenv from "dotenv";

type ApiRequest = {
  method?: string;
  body?: {
    analysis?: {
      final_prompt_en?: unknown;
      negative_prompt_en?: unknown;
    } | null;
  } | null;
};

type ApiResponse = {
  setHeader?: (name: string, value: string | string[]) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

type JsonObject = Record<string, unknown>;

type LeonardoGenerationCreateResponse = {
  sdGenerationJob?: {
    generationId?: unknown;
  };
};

type LeonardoGeneratedImage = {
  url?: unknown;
};

type LeonardoGenerationStatusResponse = {
  generations_by_pk?: {
    status?: unknown;
    generated_images?: LeonardoGeneratedImage[] | null;
  };
};

const DEFAULT_LEONARDO_MODEL_ID = "b24e16ff-06e3-43eb-8d33-4416c2d75876";
const DEFAULT_LEONARDO_API_BASE = "https://cloud.leonardo.ai/api/rest/v1";
const DEFAULT_NEGATIVE_PROMPT = "floating items, separate item preview, UI layout, interface card, text label, border frame, split screen, collage, empty costume shell, hollow body, missing clothes, missing shoes, missing accessory, missing headwear, missing handheld item, distorted body, extra limbs, cropped feet, cropped head, realistic photo, 3d render, blurry, low quality, messy background";
const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 3000;
const MAX_LEONARDO_PROMPT_LENGTH = 1450;

dotenv.config({ path: ".env.local" });
dotenv.config();

function jsonResponse(res: ApiResponse, statusCode: number, body: JsonObject) {
  return res.status(statusCode).json(body);
}

function createLeonardoHeaders(apiKey: string) {
  return {
    accept: "application/json",
    authorization: `Bearer ${apiKey}`,
  };
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return null;

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return { error: text.trim() };
  }
}

function extractApiError(body: Record<string, unknown> | null, fallback: string): string {
  if (!body) return fallback;
  if (typeof body.error === "string" && body.error.trim()) return body.error.trim();
  if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
  return fallback;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function trimToLength(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;

  const trimmed = value.slice(0, maxLength - 1).trimEnd();
  return `${trimmed}\u2026`;
}

function wrapLeonardoPrompt(finalPrompt: string): string {
  const wrappedPrompt = compactWhitespace([
    "Create one final full-body cute pixel-art music pet character.",
    "Use the provided analyzed asset descriptions as strict design requirements.",
    finalPrompt.trim(),
    "Generate only one complete character.",
    "Do not generate a UI screen, cards, previews, labels, or floating items.",
    "All selected items must be naturally integrated into the character design.",
    "Keep the base character identity, body shape, silhouette, proportions, and front-facing pose.",
    "Keep the character fully rendered with no hollow gaps.",
    "The shoes must be visible on both feet.",
    "The face, lower body, and feet must remain readable.",
    "Use clean soft pixel art, warm creamy colors, clear outlines, and a polished game-character asset style.",
    "Center the character on a simple clean background.",
  ].join(" "));

  return trimToLength(wrappedPrompt, MAX_LEONARDO_PROMPT_LENGTH);
}

async function createGeneration(options: { apiKey: string; prompt: string; negativePrompt: string }): Promise<string> {
  const apiBase = process.env.LEONARDO_API_BASE_URL || DEFAULT_LEONARDO_API_BASE;
  const modelId = process.env.LEONARDO_MODEL_ID || DEFAULT_LEONARDO_MODEL_ID;

  const response = await fetch(`${apiBase}/generations`, {
    method: "POST",
    headers: {
      ...createLeonardoHeaders(options.apiKey),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      modelId,
      presetStyle: "ILLUSTRATION",
      alchemy: true,
      width: 1024,
      height: 1024,
      num_images: 1,
      guidance_scale: 8,
      num_inference_steps: 30,
    }),
  });

  const responseBody = (await readJsonResponse(response)) as LeonardoGenerationCreateResponse | null;
  if (!response.ok) {
    throw new Error(extractApiError(responseBody, "Leonardo generation request failed."));
  }

  const generationId = responseBody?.sdGenerationJob?.generationId;
  if (typeof generationId !== "string" || !generationId) {
    throw new Error("Leonardo did not return a generationId.");
  }

  return generationId;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollGenerationResult(apiKey: string, generationId: string): Promise<string> {
  const apiBase = process.env.LEONARDO_API_BASE_URL || DEFAULT_LEONARDO_API_BASE;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${apiBase}/generations/${generationId}`, {
      headers: createLeonardoHeaders(apiKey),
    });

    const responseBody = (await readJsonResponse(response)) as LeonardoGenerationStatusResponse | null;
    if (!response.ok) {
      throw new Error(extractApiError(responseBody, "Leonardo polling failed."));
    }

    const generation = responseBody?.generations_by_pk;
    const status = typeof generation?.status === "string" ? generation.status : "";
    const images = Array.isArray(generation?.generated_images) ? generation.generated_images : [];
    const firstImageUrl = images.find((image) => typeof image?.url === "string" && image.url)?.url;

    if (status === "COMPLETE" && typeof firstImageUrl === "string" && firstImageUrl) {
      return firstImageUrl;
    }

    if (status === "FAILED") {
      throw new Error("Leonardo generation failed.");
    }

    await wait(POLL_INTERVAL_MS);
  }

  throw new Error(`Leonardo generation timed out:::${generationId}`);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    return jsonResponse(res, 405, { error: "Only POST is allowed" });
  }

  const apiKey = process.env.LEONARDO_API_KEY || "";
  if (!apiKey) {
    return jsonResponse(res, 500, { error: "Missing LEONARDO_API_KEY" });
  }

  const analysis = req.body?.analysis;
  const finalPromptEn = typeof analysis?.final_prompt_en === "string" ? analysis.final_prompt_en.trim() : "";
  const negativePromptEn = typeof analysis?.negative_prompt_en === "string" ? analysis.negative_prompt_en.trim() : "";

  if (!finalPromptEn) {
    return jsonResponse(res, 400, { error: "Missing analysis.final_prompt_en" });
  }

  const prompt = wrapLeonardoPrompt(finalPromptEn);
  const negativePrompt = negativePromptEn || DEFAULT_NEGATIVE_PROMPT;

  try {
    const generationId = await createGeneration({
      apiKey,
      prompt,
      negativePrompt,
    });
    const imageUrl = await pollGenerationResult(apiKey, generationId);

    return jsonResponse(res, 200, {
      imageUrl,
      generationId,
      prompt,
      negativePrompt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leonardo generation failed";
    if (message.startsWith("Leonardo generation timed out:::")) {
      const generationId = message.split(":::")[1] || "";
      return jsonResponse(res, 504, {
        error: "Leonardo generation timed out",
        generationId,
      });
    }

    return jsonResponse(res, 502, { error: message });
  }
}
