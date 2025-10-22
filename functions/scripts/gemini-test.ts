import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY env var");
  process.exit(1);
}

const modelName = process.argv[2] ?? "gemini-2.5-flash";

async function run() {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  try {
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: "Say hello from Gemini" }]
      }],
    });

    console.log("Model:", modelName);
    console.log("Response:", result.response.text());
  } catch (error) {
    console.error("Gemini request failed:", error);
  }
}

run();
