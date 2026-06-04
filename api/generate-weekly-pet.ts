import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";

type ApiRequest = {
  method?: string;
  body?: {
    prompt?: unknown;
    baseImagePath?: unknown;
    itemImagePaths?: unknown;
  } | null;
};

type ApiResponse = {
  setHeader?: (name: string, value: string | string[]) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

type JsonObject = Record<string, unknown>;

type LeonardoInitUploadResponse = {
  uploadInitImage?: {
    id?: unknown;
    fields?: unknown;
    url?: unknown;
  };
};

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

const LEONARDO_API_BASE = "https://cloud.leonardo.ai/api/rest/v1";
const LEONARDO_LIGHTNING_XL_MODEL_ID = "b24e16ff-06e3-43eb-8d33-4416c2d75876";
const SDXL_STYLE_REFERENCE_PREPROCESSOR_ID = 67;
const SDXL_CHARACTER_REFERENCE_PREPROCESSOR_ID = 133;
const MAX_PROMPT_LENGTH = 1450;
const PUBLIC_DIR = path.join(process.cwd(), "public");
const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 24;

dotenv.config({ path: ".env.local" });
dotenv.config();

function jsonResponse(res: ApiResponse, statusCode: number, body: JsonObject) {
  return res.status(statusCode).json(body);
}

function getLeonardoApiKey() {
  return process.env.LEONARDO_API_KEY || "";
}

function sanitizePublicAssetPath(assetPath: string): string | null {
  if (!assetPath.startsWith("/")) {
    return null;
  }

  const decodedPath = decodeURIComponent(assetPath);
  const resolvedPath = path.resolve(PUBLIC_DIR, `.${decodedPath}`);
  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    return null;
  }

  return resolvedPath;
}

function getFileExtension(filePath: string): "png" | "jpg" | "jpeg" | "webp" {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg") return "jpg";
  if (extension === ".jpeg") return "jpeg";
  if (extension === ".webp") return "webp";
  return "png";
}

function getMimeType(extension: string): string {
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  return "image/png";
}

async function readPublicAsset(assetPath: string): Promise<{
  buffer: Buffer;
  extension: "png" | "jpg" | "jpeg" | "webp";
  filename: string;
  mimeType: string;
}> {
  const resolvedPath = sanitizePublicAssetPath(assetPath);
  if (!resolvedPath) {
    throw new Error(`無效的素材路徑：${assetPath}`);
  }

  const buffer = await readFile(resolvedPath);
  const extension = getFileExtension(resolvedPath);
  return {
    buffer,
    extension,
    filename: path.basename(resolvedPath),
    mimeType: getMimeType(extension),
  };
}

function buildLeonardoPrompt(prompt: string): string {
  return prompt
    .replace(/\s+/g, " ")
    .slice(0, MAX_PROMPT_LENGTH)
    .trim();
}

function extractErrorMessage(error: unknown, fallback = "Leonardo 圖片生成暫時失敗，請稍後再試。") {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  return fallback;
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return {
      error: text.trim(),
    };
  }
}

function extractApiError(body: Record<string, unknown> | null, fallback: string): string {
  if (!body) {
    return fallback;
  }

  const directError = body.error;
  if (typeof directError === "string" && directError.trim()) {
    return directError.trim();
  }

  const message = body.message;
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  const errors = body.errors;
  if (Array.isArray(errors)) {
    const firstMessage = errors.find((item) => item && typeof item === "object" && "message" in item);
    if (firstMessage && typeof (firstMessage as { message?: unknown }).message === "string") {
      return ((firstMessage as { message: string }).message || fallback).trim();
    }
  }

  return fallback;
}

function createLeonardoHeaders(apiKey: string) {
  return {
    accept: "application/json",
    authorization: `Bearer ${apiKey}`,
  };
}

async function uploadInitImage(apiKey: string, assetPath: string): Promise<string> {
  const asset = await readPublicAsset(assetPath);

  const initResponse = await fetch(`${LEONARDO_API_BASE}/init-image`, {
    method: "POST",
    headers: {
      ...createLeonardoHeaders(apiKey),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      extension: asset.extension,
    }),
  });

  const initBody = (await readJsonResponse(initResponse)) as LeonardoInitUploadResponse | null;
  if (!initResponse.ok) {
    throw new Error(extractApiError(initBody, "Leonardo 初始化圖片上傳失敗。"));
  }

  const uploadData = initBody?.uploadInitImage;
  const imageId = typeof uploadData?.id === "string" ? uploadData.id : "";
  const uploadUrl = typeof uploadData?.url === "string" ? uploadData.url : "";
  const rawFields = uploadData?.fields;
  const fields =
    typeof rawFields === "string"
      ? (JSON.parse(rawFields) as Record<string, string>)
      : rawFields && typeof rawFields === "object"
        ? (rawFields as Record<string, string>)
        : null;

  if (!imageId || !uploadUrl || !fields) {
    throw new Error("Leonardo 沒有回傳完整的圖片上傳資訊。");
  }

  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  formData.append("file", new Blob([asset.buffer], { type: asset.mimeType }), asset.filename);

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!uploadResponse.ok) {
    const uploadErrorText = await uploadResponse.text().catch(() => "");
    throw new Error(uploadErrorText.trim() || "Leonardo 圖片檔案上傳失敗。");
  }

  return imageId;
}

async function createGeneration(options: {
  apiKey: string;
  prompt: string;
  baseImageId: string;
  itemImageIds: string[];
}): Promise<string> {
  const response = await fetch(`${LEONARDO_API_BASE}/generations`, {
    method: "POST",
    headers: {
      ...createLeonardoHeaders(options.apiKey),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt: options.prompt,
      negative_prompt: "text, watermark, logo, signature, collage, pasted items, photorealistic render, 3d render, portrait crop, bust crop, close-up only",
      modelId: LEONARDO_LIGHTNING_XL_MODEL_ID,
      presetStyle: "ILLUSTRATION",
      alchemy: true,
      width: 1024,
      height: 1024,
      num_images: 1,
      guidance_scale: 8,
      num_inference_steps: 30,
      init_image_id: options.baseImageId,
      init_strength: 0.34,
      imagePrompts: options.itemImageIds,
      imagePromptWeight: 0.72,
      controlnets: [
        {
          initImageId: options.baseImageId,
          initImageType: "UPLOADED",
          preprocessorId: SDXL_CHARACTER_REFERENCE_PREPROCESSOR_ID,
          strengthType: "High",
        },
        ...options.itemImageIds.map((imageId) => ({
          initImageId: imageId,
          initImageType: "UPLOADED",
          preprocessorId: SDXL_STYLE_REFERENCE_PREPROCESSOR_ID,
          strengthType: "High",
        })),
      ],
    }),
  });

  const responseBody = (await readJsonResponse(response)) as LeonardoGenerationCreateResponse | null;
  if (!response.ok) {
    throw new Error(extractApiError(responseBody, "Leonardo 建立圖片生成任務失敗。"));
  }

  const generationId = responseBody?.sdGenerationJob?.generationId;
  if (typeof generationId !== "string" || !generationId) {
    throw new Error("Leonardo 沒有回傳 generationId。");
  }

  return generationId;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function pollGenerationResult(apiKey: string, generationId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${LEONARDO_API_BASE}/generations/${generationId}`, {
      headers: createLeonardoHeaders(apiKey),
    });

    const responseBody = (await readJsonResponse(response)) as LeonardoGenerationStatusResponse | null;
    if (!response.ok) {
      throw new Error(extractApiError(responseBody, "Leonardo 查詢生成結果失敗。"));
    }

    const generation = responseBody?.generations_by_pk;
    const status = typeof generation?.status === "string" ? generation.status : "";
    const images = Array.isArray(generation?.generated_images) ? generation.generated_images : [];
    const firstImageUrl = images.find((image) => typeof image?.url === "string" && image.url)?.url;

    if (status === "COMPLETE" && typeof firstImageUrl === "string" && firstImageUrl) {
      return firstImageUrl;
    }

    if (status === "FAILED") {
      throw new Error("Leonardo 圖片生成失敗，請稍後再試。");
    }

    await wait(POLL_INTERVAL_MS);
  }

  throw new Error("Leonardo 生成時間過久，請稍後再試。");
}

async function generateWeeklyPetImage(options: {
  apiKey: string;
  prompt: string;
  baseImagePath: string;
  itemImagePaths: string[];
}): Promise<string> {
  const baseImageId = await uploadInitImage(options.apiKey, options.baseImagePath);
  const itemImageIds = await Promise.all(options.itemImagePaths.map((imagePath) => uploadInitImage(options.apiKey, imagePath)));
  const generationId = await createGeneration({
    apiKey: options.apiKey,
    prompt: options.prompt,
    baseImageId,
    itemImageIds,
  });

  return pollGenerationResult(options.apiKey, generationId);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    return jsonResponse(res, 405, { ok: false, error: "只支援 POST 請求。" });
  }

  const prompt = req.body?.prompt;
  const baseImagePath = req.body?.baseImagePath;
  const itemImagePaths = req.body?.itemImagePaths;

  if (typeof prompt !== "string" || !prompt.trim()) {
    return jsonResponse(res, 400, { ok: false, error: "缺少 prompt，請重新生成 Day 7 提示詞後再試。" });
  }

  if (typeof baseImagePath !== "string" || !baseImagePath.trim()) {
    return jsonResponse(res, 400, { ok: false, error: "缺少 base 角色圖片，請重新整理後再試。" });
  }

  if (!Array.isArray(itemImagePaths) || itemImagePaths.length === 0) {
    return jsonResponse(res, 400, { ok: false, error: "缺少本週素材圖片，請確認 Day 1 到 Day 6 都已生成。" });
  }

  const safeItemImagePaths = itemImagePaths.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (safeItemImagePaths.length === 0) {
    return jsonResponse(res, 400, { ok: false, error: "缺少有效的素材圖片路徑，請重新生成本週物品後再試。" });
  }

  const apiKey = getLeonardoApiKey();
  if (!apiKey) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Leonardo API key 尚未設定，請先在 .env.local 或部署環境中加入 LEONARDO_API_KEY。",
    });
  }

  try {
    const imageUrl = await generateWeeklyPetImage({
      apiKey,
      prompt: buildLeonardoPrompt(prompt),
      baseImagePath,
      itemImagePaths: safeItemImagePaths,
    });

    return jsonResponse(res, 200, {
      ok: true,
      imageUrl,
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    console.error("Leonardo weekly pet generation failed:", message);
    return jsonResponse(res, 502, {
      ok: false,
      error: message,
    });
  }
}
