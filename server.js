import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

console.log("KEY LOADED:", process.env.API_KEY);

import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

app.post("/chat", async (req, res) => {
  try {
    const message = req.body?.message;

    if (!message) {
      return res.json({ reply: "No input received" });
    }

    const genAI = new GoogleGenerativeAI(process.env.API_KEY);
    const model = genAI.getGenerativeModel({
      model: process.env.MODEL || "gemini-1.5-flash",
    });

    const result = await model.generateContent(message);

    const response = result.response;
    const reply =
      response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      response?.text?.() ||
      "No response from model";

    res.json({ reply });
  }
   catch (err) {
  console.error("AI ERROR FULL:", err);
  res.json({ reply: "AI error occurred: " + err.message });
  }

});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
