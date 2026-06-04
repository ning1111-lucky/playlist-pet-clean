import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, type Plugin } from "vite";
import analyzeAssetsHandler from "./api/analyze-assets";
import generatePetHandler from "./api/generate-pet";
import generateWeeklyPetHandler from "./api/generate-weekly-pet";
import musicTodayHandler from "./api/music/today";
import notionReferenceHandler from "./api/notion/reference";
import notionSyncUserHandler from "./api/notion/sync-user";
import notionWeeklyRunHandler from "./api/notion/weekly-run";
import spotifyAuthHandler from "./api/spotify/auth";
import spotifyCallbackHandler from "./api/spotify/callback";
import spotifyLogoutHandler from "./api/spotify/logout";
import spotifySessionHandler from "./api/spotify/session";

function createJsonResponder(res: {
  statusCode: number;
  setHeader: (name: string, value: string | string[]) => void;
  end: (chunk?: string) => void;
}) {
  return {
    setHeader(name: string, value: string | string[]) {
      res.setHeader(name, value);
    },
    status(code: number) {
      res.statusCode = code;
      return {
        json(body: unknown) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(body));
        },
      };
    },
  };
}

async function readRequestPayload(req: {
  headers?: Record<string, string | string[] | undefined>;
  on: (event: string, handler: (chunk?: Buffer) => void) => void;
}): Promise<{ body: Record<string, unknown> | null; rawBody: Buffer | null; invalidJson: boolean }> {
  const chunks: Buffer[] = [];
  const contentType = Array.isArray(req.headers?.["content-type"])
    ? req.headers?.["content-type"]?.[0] || ""
    : typeof req.headers?.["content-type"] === "string"
      ? req.headers["content-type"]
      : "";

  return new Promise((resolve) => {
    req.on("data", (chunk) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    });

    req.on("end", () => {
      const rawBody = Buffer.concat(chunks);

      if (contentType.toLowerCase().includes("application/json")) {
        const text = rawBody.toString("utf8").trim();
        if (!text) {
          resolve({ body: null, rawBody: null, invalidJson: false });
          return;
        }

        try {
          const parsed = JSON.parse(text);
          resolve({
            body: parsed && typeof parsed === "object" ? parsed : null,
            rawBody: null,
            invalidJson: false,
          });
        } catch {
          resolve({ body: null, rawBody: null, invalidJson: true });
        }
        return;
      }

      resolve({ body: null, rawBody, invalidJson: false });
    });
  });
}

const routeHandlers: Record<string, (req: { method?: string; url?: string; headers?: Record<string, string | string[] | undefined>; body?: Record<string, unknown> | null; rawBody?: Buffer | null }, res: ReturnType<typeof createJsonResponder> & { end?: (chunk?: string) => void; statusCode?: number }) => Promise<unknown>> = {
  "/api/analyze-assets": analyzeAssetsHandler,
  "/api/generate-pet": generatePetHandler,
  "/api/generate-weekly-pet": generateWeeklyPetHandler,
  "/api/music/today": musicTodayHandler,
  "/api/notion/reference": notionReferenceHandler,
  "/api/notion/sync-user": notionSyncUserHandler,
  "/api/notion/weekly-run": notionWeeklyRunHandler,
  "/api/spotify/auth": spotifyAuthHandler,
  "/api/spotify/callback": spotifyCallbackHandler,
  "/api/spotify/session": spotifySessionHandler,
  "/api/spotify/logout": spotifyLogoutHandler,
};

function localApiPlugin(): Plugin {
  return {
    name: "local-app-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split("?")[0];
        const handler = pathname ? routeHandlers[pathname] : undefined;

        if (!handler) {
          next();
          return;
        }

        const responder = createJsonResponder(res);

        try {
          const payload = await readRequestPayload(req);
          if (payload.invalidJson) {
            responder.status(400).json({ ok: false, error: "請求格式錯誤，JSON 內容無法解析。" });
            return;
          }

          await handler(
            {
              method: req.method,
              url: req.url,
              headers: req.headers as Record<string, string | string[] | undefined>,
              body: payload.body,
              rawBody: payload.rawBody,
            },
            {
              ...responder,
              end: res.end.bind(res),
              statusCode: res.statusCode,
            }
          );
        } catch (error) {
          console.error(`Local ${pathname} middleware failed:`, error);
          responder.status(500).json({ ok: false, error: "請求處理失敗，請重試" });
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), localApiPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
