import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

async function listModels() {
  try {
    const key = process.env.API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.models) {
      console.log("No models found or error:", data);
      return;
    }

    console.log("Available models:");
    data.models.forEach((m) => {
      console.log("-", m.name);
    });
  } catch (err) {
    console.error("Listing error:", err);
  }
}

listModels();
