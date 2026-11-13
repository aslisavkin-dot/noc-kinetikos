import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const apiKey =
  process.env.GEMINI_API_KEY ||
  "AQ.Ab8RN6JP4G6UQrNZo21xEc858eh2jps6NE5z_e7POTSXy_MGWg";

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const NOC_SYSTEM_INSTRUCTION =
  "Sen NOC KinetikOS mobil işletim sisteminin yerel yapay zekasısın. Adın kesinlikle NOC AI. Asla Gemini, Google veya başka bir model adından bahsetme veya yazma. Kendini daima NOC AI olarak tanıt. Türkçe, samimi, kibar, zeki ve son derece faydalı yanıtlar ver.";

interface ChatMessageInput {
  sender?: string;
  text?: string;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.post("/api/noc-ai", async (req, res) => {
    try {
      const body = req.body as { messages?: ChatMessageInput[] } | undefined;
      const messages = Array.isArray(body?.messages) ? body.messages : [];

      if (messages.length === 0) {
        res.status(400).json({ error: "Mesaj içeriği boş olamaz." });
        return;
      }

      const contents = messages
        .slice(-12)
        .filter((m) => typeof m?.text === "string" && m.text.trim().length > 0)
        .map((m) => ({
          role: m.sender === "user" ? "user" : "model",
          parts: [{ text: String(m.text).slice(0, 2000) }],
        }));

      if (contents.length === 0) {
        res.status(400).json({ error: "Geçerli bir mesaj bulunamadı." });
        return;
      }

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents,
        config: {
          systemInstruction: NOC_SYSTEM_INSTRUCTION,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      let reply = (response.text || "").trim();
      if (!reply) {
        res.status(502).json({ error: "NOC AI yanıt üretemedi." });
        return;
      }

      reply = reply
        .replace(/gemini/gi, "NOC AI")
        .replace(/google/gi, "NOC KinetikOS");

      res.json({ text: reply });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "NOC AI servisine ulaşılamadı.";
      const status =
        typeof (err as { status?: unknown })?.status === "number"
          ? ((err as { status: number }).status)
          : 500;
      console.error("NOC AI server error:", err);
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: message,
      });
    }
  });

  const distDir = path.resolve(__dirname, "dist");
  const isDev =
    process.env.NODE_ENV === "development" || !fs.existsSync(path.join(distDir, "index.html"));

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NOC KinetikOS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
