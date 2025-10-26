#!/usr/bin/env node
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("Set GEMINI_API_KEY (or GOOGLE_API_KEY) before running this script.");
  process.exit(1);
}

const modelName = process.argv[2] ?? "gemini-2.5-flash";
const prompt = process.argv[3] ?? "Say hello from Gemini";

async function run() {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  try {
    const response = await model.generateContent(prompt);
    console.log(`Model: ${modelName}`);
    console.log("Prompt:", prompt);
    console.log("Response:", response.response.text());
  } catch (error) {
    console.error("Gemini request failed:");
    if (error instanceof Error) {
      console.error(error.message);
    }
    if (error?.response) {
      console.error("Status:", error.response.status);
      console.error("Body:", error.response.data);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  }
}

run();
