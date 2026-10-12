import OpenAI from "openai";
import { AI_EVALUATION_JSON_SCHEMA, CHALLENGE_REQUIREMENTS, INITIATIVE_FEATURES, validateAiEvaluationDraft } from "../../lib/ai-evaluation-schema";
import { AI_EVALUATION_INSTRUCTIONS } from "../../lib/ai-evaluation-prompt";
import { calculateOverallScore } from "../../lib/ai-scoring";
import { prepareBoundedEvaluationInput, validateArtifactForEvaluation } from "../../lib/ai-evaluation-input";
import { createOpenAiClient, getEvaluationModel, hasOpenAiApiKey, isAiEvaluationAvailable } from "../../lib/openai-server";
import type { AiSkillEvaluation } from "../../lib/ai-evaluation-types";

export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_REQUEST_BYTES = 25 * 1024 * 1024;

type EvaluateRequest = {
  submissionId?: unknown;
  artifactId?: unknown;
  submittedAt?: unknown;
  artifact?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!origin || !isSameOrigin(origin, request.url)) return errorResponse(403, "INVALID_ORIGIN", "This evaluation request was rejected.");

  // The hackathon demo has no AI budget. Keep the integration, but never call it.
  if (!isAiEvaluationAvailable()) return errorResponse(503, "AI_DEMO_UNAVAILABLE", "AI evaluation is unavailable for this demo. Your uploaded files and preliminary checks are still available. No AI score or credential has been created.");

  let bodyText: string;
  try {
    bodyText = await readLimitedBody(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestTooLargeError) return errorResponse(413, "REQUEST_TOO_LARGE", "This submission is too large to process.");
    return errorResponse(400, "INVALID_REQUEST", "The evaluation request could not be read.");
  }

  let body: EvaluateRequest;
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return errorResponse(400, "INVALID_REQUEST", "The evaluation request could not be read.");
    body = parsed as EvaluateRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "The evaluation request was not valid JSON.");
  }

  if (typeof body.submissionId !== "string" || body.submissionId.length < 1 || body.submissionId.length > 120 ||
      typeof body.artifactId !== "string" || typeof body.submittedAt !== "string" || Number.isNaN(Date.parse(body.submittedAt))) {
    return errorResponse(400, "INVALID_SUBMISSION", "A valid submission reference is required.");
  }
  const artifact = validateArtifactForEvaluation(body.artifact);
  if (!artifact || artifact.id !== body.artifactId || artifact.files.length === 0) {
    return errorResponse(422, "INVALID_ARTIFACT", "A valid, non-empty submission artifact is required.");
  }

  const prepared = prepareBoundedEvaluationInput({ id: body.submissionId, submittedAt: body.submittedAt, artifactId: artifact.id }, artifact);
  if (prepared.submittedFiles.length === 0) return errorResponse(422, "NO_EVALUABLE_FILES", "No supported source or configuration files were available for evaluation.");
  if (!hasOpenAiApiKey()) return errorResponse(503, "MISSING_API_KEY", "AI evaluation is not configured yet. Add OPENAI_API_KEY on the server.");

  const model = getEvaluationModel();
  try {
    const client = createOpenAiClient();
    const response = await client.responses.create({
      model,
      instructions: AI_EVALUATION_INSTRUCTIONS,
      input: JSON.stringify({
        challengeId: prepared.challengeId,
        challengeTitle: prepared.challengeTitle,
        challengeRequirements: CHALLENGE_REQUIREMENTS,
        optionalInitiativeAreas: INITIATIVE_FEATURES,
        submittedFiles: prepared.submittedFiles,
        inputSummary: prepared.inputSummary,
      }),
      text: { format: { type: "json_schema", name: "ch1ko_skill_evaluation", strict: true, schema: AI_EVALUATION_JSON_SCHEMA } },
      max_output_tokens: 7000,
      store: false,
    });

    if (response.status !== "completed" || !response.output_text.trim()) {
      return errorResponse(502, "EMPTY_AI_RESPONSE", "The AI did not return a complete evaluation. You can try again.");
    }

    let unknownDraft: unknown;
    try {
      unknownDraft = JSON.parse(response.output_text) as unknown;
    } catch {
      return errorResponse(502, "INVALID_AI_RESPONSE", "The AI response did not match the required evaluation format. You can try again.");
    }
    const draft = validateAiEvaluationDraft(unknownDraft);
    if (!draft) return errorResponse(502, "INVALID_AI_RESPONSE", "The AI response did not pass evaluation validation. You can try again.");

    const requirementsSupported = draft.requirementAnalysis.every((item) => item.status === "PASSED" && item.evidenceLevel === "VERIFIED_FROM_SOURCE");
    const evaluation: AiSkillEvaluation = {
      ...draft,
      evaluationStatus: draft.evaluationStatus === "PASSED" && requirementsSupported ? "PASSED" : "REQUIRES_REVIEW",
      overallScore: calculateOverallScore(draft.scores),
    };

    return Response.json({ evaluation, evaluatedAt: new Date().toISOString(), model: response.model || model, inputSummary: prepared.inputSummary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OpenAI.APIConnectionTimeoutError) return errorResponse(504, "AI_TIMEOUT", "AI evaluation took too long. You can try again.");
    if (error instanceof OpenAI.APIError && error.status === 429) return errorResponse(429, "AI_RATE_LIMIT", "AI evaluation is busy right now. Please wait a moment and try again.");
    if (error instanceof OpenAI.APIError && error.status === 401) return errorResponse(503, "INVALID_API_KEY", "AI evaluation is not configured correctly. Please contact the site administrator.");
    if (error instanceof OpenAI.APIError && error.status && error.status >= 500) return errorResponse(502, "AI_UNAVAILABLE", "AI evaluation is temporarily unavailable. You can try again later.");
    return errorResponse(502, "AI_EVALUATION_FAILED", "AI evaluation could not be completed. You can try again.");
  }
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

function isSameOrigin(origin: string, requestUrl: string): boolean {
  try { return new URL(origin).origin === new URL(requestUrl).origin; } catch { return false; }
}

async function readLimitedBody(request: Request, maximumBytes: number): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maximumBytes) throw new RequestTooLargeError();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new RequestTooLargeError();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

class RequestTooLargeError extends Error {}
