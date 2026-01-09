import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import fs from "fs";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";

// --------------------
// Path + ENV
// --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

// --------------------
// Ensure uploads dir exists (Render-safe)
// --------------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// --------------------
// App
// --------------------
const app = express();
const port = process.env.PORT || 3000;

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// --------------------
// Multer (temp uploads)
// --------------------
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// --------------------
// Gemini
// --------------------
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.MODEL || "gemini-1.5-flash",
});

// --------------------
// In-memory session store
// --------------------
const sessions = new Map();
/*
sessions structure:
{
  messages: [{ role: "user" | "assistant", content: string }],
  document: string
}
*/

// --------------------
// Session helper
// --------------------
function getSessionId(req) {
  return req.headers["x-session-id"] || "default";
}

// --------------------
// Chat endpoint (TEXT + FILE + MEMORY)
// --------------------
app.post("/chat", upload.single("file"), async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const message = req.body?.message || "";
    const file = req.file;

    // --------------------
    // Init session if needed
    // --------------------
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        messages: [],
        document: ""
      });
    }

    const session = sessions.get(sessionId);

    // --------------------
    // DOCX extraction (document memory)
    // --------------------
    if (
      file &&
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ path: file.path });
      session.document = result.value.trim();
    }

    if (!message && !session.document) {
      return res.json({ reply: "No input received" });
    }

    // --------------------
    // Save user message
    // --------------------
    if (message) {
      session.messages.push({ role: "user", content: message });
    }

    // Limit memory (last 10 turns)
    session.messages = session.messages.slice(-10);

    // --------------------
    // Build conversation history
    // --------------------
    const conversation = session.messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    // --------------------
    // Build Gemini prompt
    // --------------------
    const prompt = `
You're a friendly chatbot with memory. You like maths and physics and programming, euler is your favourite. You also like chess. You help with anything asked of you.
DOCUMENT CONTENT:
${session.document || "(No document uploaded)"}

CONVERSATION HISTORY:
${conversation}

ASSISTANT:
`;

    const result = await model.generateContent(prompt);

    const reply =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      result.response?.text?.() ||
      "No response from model";

    // --------------------
    // Save assistant reply
    // --------------------
    session.messages.push({ role: "assistant", content: reply });

    res.json({ reply });

    // --------------------
    // Cleanup temp file
    // --------------------
    if (file) {
      fs.unlink(file.path, () => {});
    }

  } catch (err) {
    console.error("AI ERROR:", err);
    res.json({ reply: "AI error occurred: " + err.message });
  }
});

// --------------------
// Start
// --------------------
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


