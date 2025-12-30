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
// Chat endpoint (TEXT + FILE)
// --------------------
app.post("/chat", upload.single("file"), async (req, res) => {
  try {
    const message = req.body?.message || "";
    const file = req.file;

    let extractedText = "";

    // --------------------
    // DOCX extraction
    // --------------------
    if (
      file &&
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ path: file.path });
      extractedText = result.value.trim();
    }

    if (!message && !extractedText) {
      return res.json({ reply: "No input received" });
    }

    // --------------------
    // Build Gemini prompt
    // --------------------
    const prompt = `
You are an AI assistant that can read uploaded documents.

DOCUMENT CONTENT:
${extractedText || "(No document uploaded)"}

USER MESSAGE:
${message || "(No message provided)"}

Answer clearly and accurately using the document if relevant.
`;

    const result = await model.generateContent(prompt);

    const reply =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      result.response?.text?.() ||
      "No response from model";

    res.json({ reply });

    // --------------------
    // Cleanup temp file (Render-safe)
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
