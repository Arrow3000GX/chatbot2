import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import fs from "fs";
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

app.use(express.static(path.join(__dirname, "public")));

// --------------------
// Multer (temp uploads)
// --------------------
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// --------------------
// Gemini
// --------------------
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.MODEL || "gemini-1.5-flash",
});

// --------------------
// Chat endpoint
// --------------------
app.post("/chat", upload.single("file"), async (req, res) => {
  try {
    const message = req.body?.message || "";
    const file = req.file;

    if (!message && !file) {
      return res.json({ reply: "No input received" });
    }

    let prompt = message || "User uploaded a file.";

    if (file) {
      prompt += `\n\nUploaded file name: ${file.originalname}`;
      prompt += `\nFile type: ${file.mimetype}`;
    }

    const result = await model.generateContent(prompt);

    const reply =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      result.response?.text?.() ||
      "No response from model";

    res.json({ reply });

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
