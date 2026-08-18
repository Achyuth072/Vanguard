// lib/ai.ts
import { type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
  getAllConfiguredModels,
  getGeminiModel,
  getGroqModel,
  getOpenRouterModel,
} from "@/lib/ai/router";

const local = createOpenAI({
  baseURL: process.env.LOCAL_AI_BASE_URL || "http://localhost:11434/v1",
  apiKey: "not-needed",
});

export function getModel(): LanguageModel {
  const provider = (process.env.AI_PROVIDER || "").toLowerCase();

  if (provider === "local" || provider === "ollama") {
    return local(process.env.LOCAL_MODEL || "llama3");
  }
  if (provider === "groq") {
    return getGroqModel();
  }
  if (provider === "google" || provider === "gemini") {
    return getGeminiModel();
  }
  if (provider === "openrouter") {
    return getOpenRouterModel();
  }

  const configured = getAllConfiguredModels();
  if (configured.length > 0 && configured[0]?.model) {
    return configured[0].model;
  }

  return getGeminiModel();
}
