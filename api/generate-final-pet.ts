import dotenv from "dotenv";
import { ApiRequest, ApiResponse, getRequestUrl, jsonResponse } from "./_lib/http.js";
import type { GenerateFinalPetResponse } from "../src/types";

dotenv.config({ path: ".env.local" });
dotenv.config();

type ItemImageUrls = {
  clothes?: string;
  shoes?: string;
  headwear?: string;
  handheld?: string;
  accessory?: string;
};

type GenerateFinalPetRequestBody = {
  baseImageUrl?: unknown;
  itemImageUrls?: ItemImageUrls | null;
  mainGenre?: unknown;
  subGenre?: unknown;
};

type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const PUBLIC_ASSET_ORIGIN =
  process.env.PUBLIC_ASSET_ORIGIN ||
  process.env.VITE_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://playlist-pet-clean.vercel.app";
const CORE_PROMPT = `Create one finished polished pixel-art music pet character.

Use the BASE IMAGE as the fixed character prototype.
The base image defines the character identity and must be preserved:
- same body shape
- same front-facing standing pose
- same silhouette
- same facial feeling
- same cute proportions
- same mascot-like personality
- same overall character identity

Use the ITEM IMAGES as selected wearable and prop references.
The item images may include clothes, shoes, headwear, handheld objects, and accessories.

Redraw the character as one cohesive final completed design.
The final image must look like a newly illustrated finished character, not a collage.

Important rules:
- Do NOT simply paste the item images on top of the base.
- Do NOT generate a completely different animal or character.
- Do NOT change the base pet into a new species.
- Do NOT remove or ignore selected items.
- Do NOT leave items floating separately.
- Do NOT create UI cards, labels, mockups, borders, or interface elements.
- Do NOT generate a sprite sheet.
- Do NOT generate multiple characters.
- Do NOT add extra unrelated props.
- Do NOT write any text in the image.

Integrate all selected items naturally:
- clothes should be worn on the body
- shoes should appear clearly on the feet
- headwear should be placed on the head
- handheld item should be held by the character or naturally attached to one side
- accessory should be worn or attached in a logical visible position

Visual style:
- polished cute pixel-art game character
- front-facing full-body composition
- clean readable silhouette
- soft pastel color palette
- clear dark outline
- detailed pixel shading
- cohesive game mascot design
- simple clean background
- centered character
- consistent style across the whole image

The result should feel like a refined final character artwork for a collectible music pet game.

If mainGenre and subGenre are provided, they can influence the mood and small decorative details, but they must not override the base character identity or remove any selected item.

Output only one final image.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveImageUrl(req: ApiRequest, value: string): string {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return "";
  if (/^data:image\//i.test(normalizedValue)) return normalizedValue;
  if (/^https?:\/\//i.test(normalizedValue)) return normalizedValue;

  const cleanOrigin = PUBLIC_ASSET_ORIGIN.replace(/\/$/, "");
  if (cleanOrigin) {
    return normalizedValue.startsWith("/") ? `${cleanOrigin}${normalizedValue}` : `${cleanOrigin}/${normalizedValue}`;
  }

  return new URL(normalizedValue, getRequestUrl(req)).toString();
}

function guessMimeType(url: string, fallback = "image/png") {
  const cleanUrl = url.split("?")[0] || "";
  const extension = cleanUrl.split(".").pop()?.toLowerCase() || "";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "png") return "image/png";
  return fallback;
}

function parseDataUrl(value: string, label: string) {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error(`Invalid ${label} data URL`);
  }

  const mimeType = match[1] || "image/png";
  const base64Data = match[2] || "";
  const filename = `${label}.${mimeType.includes("jpeg") ? "jpg" : mimeType.includes("webp") ? "webp" : "png"}`;

  return {
    blob: new Blob([Buffer.from(base64Data, "base64")], { type: mimeType }),
    filename,
  };
}

async function fetchImageAsBlob(req: ApiRequest, imageUrl: string, fieldName: string) {
  const resolvedUrl = resolveImageUrl(req, imageUrl);
  if (/^data:image\//i.test(resolvedUrl)) {
    return parseDataUrl(resolvedUrl, fieldName);
  }

  const response = await fetch(resolvedUrl);
  if (!response.ok) {
    throw new Error(`Failed to load ${fieldName} image: ${resolvedUrl}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || guessMimeType(resolvedUrl);
  const filename = `${fieldName}.${contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png"}`;

  return {
    blob: new Blob([arrayBuffer], { type: contentType }),
    filename,
  };
}

function buildPrompt(input: {
  mainGenre: string;
  subGenre?: string;
}) {
  const genreNote = input.subGenre
    ? `\n\nGenre note: mainGenre = ${input.mainGenre}; subGenre = ${input.subGenre}. Use this only to influence mood and small decorative details.`
    : `\n\nGenre note: mainGenre = ${input.mainGenre}. Use this only to influence mood and small decorative details.`;

  return `${CORE_PROMPT}${genreNote}`;
}

function extractOpenAIError(body: OpenAIImageResponse | null, fallback: string) {
  const message = body?.error?.message;
  return typeof message === "string" && message.trim() ? message.trim() : fallback;
}

async function callOpenAIImageEdit(options: {
  apiKey: string;
  model: string;
  images: Array<{ blob: Blob; filename: string }>;
  prompt: string;
}) {
  const formData = new FormData();
  formData.append("model", options.model);
  formData.append("prompt", options.prompt);
  formData.append("n", "1");
  formData.append("size", "1024x1024");
  formData.append("quality", "medium");
  formData.append("background", "opaque");
  formData.append("output_format", "png");

  options.images.forEach((image) => {
    formData.append("image[]", image.blob, image.filename);
  });

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: formData,
  });

  const rawText = await response.text().catch(() => "");
  let parsedBody: OpenAIImageResponse | null = null;

  try {
    parsedBody = rawText.trim() ? (JSON.parse(rawText) as OpenAIImageResponse) : null;
  } catch {
    parsedBody = null;
  }

  if (!response.ok) {
    const errorText = extractOpenAIError(parsedBody, rawText.trim() || "OpenAI image generation failed.");
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const firstImage = Array.isArray(parsedBody?.data) ? parsedBody?.data?.[0] : null;
  if (!firstImage) {
    throw new Error("OpenAI did not return an image.");
  }

  if (typeof firstImage.b64_json === "string" && firstImage.b64_json) {
    return `data:image/png;base64,${firstImage.b64_json}`;
  }

  if (typeof firstImage.url === "string" && firstImage.url) {
    return firstImage.url;
  }

  throw new Error("OpenAI did not return a usable image.");
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    return jsonResponse(res, 405, { ok: false, error: "Only POST is allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    return jsonResponse(res, 500, { ok: false, error: "Missing OPENAI_API_KEY" });
  }

  let step = "start";

  try {
    step = "read-request-body";
    const body = (isRecord(req.body) ? req.body : {}) as GenerateFinalPetRequestBody;
    const baseImageUrl = normalizeOptionalString(body.baseImageUrl);
    const itemImageUrls = (isRecord(body.itemImageUrls) ? body.itemImageUrls : {}) as ItemImageUrls;
    const mainGenre = normalizeOptionalString(body.mainGenre);
    const subGenre = normalizeOptionalString(body.subGenre);

    if (!baseImageUrl) {
      return jsonResponse(res, 400, { ok: false, error: "Missing baseImageUrl" });
    }

    if (!mainGenre) {
      return jsonResponse(res, 400, { ok: false, error: "Missing mainGenre" });
    }

    const orderedItemEntries = [
      ["clothes", normalizeOptionalString(itemImageUrls.clothes)],
      ["shoes", normalizeOptionalString(itemImageUrls.shoes)],
      ["headwear", normalizeOptionalString(itemImageUrls.headwear)],
      ["handheld", normalizeOptionalString(itemImageUrls.handheld)],
      ["accessory", normalizeOptionalString(itemImageUrls.accessory)],
    ] as const;

    const prompt = buildPrompt({
      mainGenre,
      subGenre: subGenre || undefined,
    });

    step = "parse-base-image";
    const baseImage = await fetchImageAsBlob(req, baseImageUrl, "base");
    step = "parse-item-images";
    const itemImages = await Promise.all(
      orderedItemEntries
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => fetchImageAsBlob(req, value, key))
    );

    const images = [
      baseImage,
      ...itemImages,
    ];

    step = "call-openai";
    const imageUrl = await callOpenAIImageEdit({
      apiKey,
      model: DEFAULT_OPENAI_IMAGE_MODEL,
      images,
      prompt,
    });
    step = "parse-openai-response";

    const successBody: GenerateFinalPetResponse = {
      ok: true,
      imageUrl,
      provider: "openai",
    };

    return jsonResponse(res, 200, successBody);
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "OpenAI image generation failed.";
    const errorBody: GenerateFinalPetResponse & { debug: { step: string } } = {
      ok: false,
      error: message,
      debug: {
        step,
      },
    };

    return jsonResponse(res, 500, errorBody);
  }
}
