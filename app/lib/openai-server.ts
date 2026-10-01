import "server-only";
import OpenAI from "openai";

export const DEFAULT_EVALUATION_MODEL = "gpt-5.4-mini";
export const OPENAI_TIMEOUT_MS = 60_000;

export function hasOpenAiApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getEvaluationModel(): string {
  return process.env.OPENAI_EVALUATION_MODEL?.trim() || DEFAULT_EVALUATION_MODEL;
}

export function createOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenAI is not configured");
  return new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS, maxRetries: 0 });
}
