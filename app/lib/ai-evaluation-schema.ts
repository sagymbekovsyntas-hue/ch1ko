import type { AiEvaluationDraft, AiInitiativeAnalysis, AiRequirementAnalysis, EvidenceLevel, ReasoningArea } from "./ai-evaluation-types";

export const CHALLENGE_REQUIREMENTS = [
  "Create tasks", "Delete tasks", "Complete/uncomplete tasks", "Search tasks", "Responsive UI", "Clean UX",
] as const;

export const INITIATIVE_FEATURES = [
  "Dark Mode", "Keyboard Shortcuts", "Task Priorities", "Due Dates", "Drag & Drop", "Empty State UX", "Animations / Micro-interactions", "Mobile-first improvements",
] as const;

const scoreSchema = { type: "integer", minimum: 0, maximum: 100 };
const evidenceLevelSchema = { type: "string", enum: ["VERIFIED_FROM_SOURCE", "INFERRED", "REQUIRES_REVIEW"] };
const requirementSchema = {
  type: "object",
  properties: {
    requirement: { type: "string" },
    status: { type: "string", enum: ["PASSED", "PARTIAL", "FAILED", "REQUIRES_REVIEW"] },
    evidenceLevel: evidenceLevelSchema,
    evidence: { type: "string" },
  },
  required: ["requirement", "status", "evidenceLevel", "evidence"],
  additionalProperties: false,
};
const initiativeSchema = {
  type: "object",
  properties: {
    feature: { type: "string" },
    status: { type: "string", enum: ["DETECTED", "NOT_DETECTED", "REQUIRES_REVIEW"] },
    evidenceLevel: evidenceLevelSchema,
    evidence: { type: "string" },
  },
  required: ["feature", "status", "evidenceLevel", "evidence"],
  additionalProperties: false,
};
const reasoningAreaSchema = { type: "string", enum: ["logicalReasoning", "patternRecognition", "problemSolving", "learningAdaptability"] };

// overallScore is intentionally absent: it is calculated by the server from the six returned category scores.
export const AI_EVALUATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    evaluationStatus: { type: "string", enum: ["PASSED", "REQUIRES_REVIEW"] },
    scores: {
      type: "object",
      properties: {
        technicalExecution: scoreSchema,
        problemSolving: scoreSchema,
        codeQuality: scoreSchema,
        requirements: scoreSchema,
        creativity: scoreSchema,
        initiative: scoreSchema,
      },
      required: ["technicalExecution", "problemSolving", "codeQuality", "requirements", "creativity", "initiative"],
      additionalProperties: false,
    },
    reasoningProfile: {
      type: "object",
      properties: {
        logicalReasoning: scoreSchema,
        patternRecognition: scoreSchema,
        problemSolving: scoreSchema,
        learningAdaptability: scoreSchema,
      },
      required: ["logicalReasoning", "patternRecognition", "problemSolving", "learningAdaptability"],
      additionalProperties: false,
    },
    reasoningEvidence: {
      type: "array",
      items: {
        type: "object",
        properties: { area: reasoningAreaSchema, evidence: { type: "string" } },
        required: ["area", "evidence"],
        additionalProperties: false,
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    areasToImprove: { type: "array", items: { type: "string" } },
    requirementAnalysis: { type: "array", items: requirementSchema },
    initiativeAnalysis: { type: "array", items: initiativeSchema },
    summary: { type: "string" },
  },
  required: ["evaluationStatus", "scores", "reasoningProfile", "reasoningEvidence", "strengths", "areasToImprove", "requirementAnalysis", "initiativeAnalysis", "summary"],
  additionalProperties: false,
} as const;

const reasoningAreas: ReasoningArea[] = ["logicalReasoning", "patternRecognition", "problemSolving", "learningAdaptability"];
const evidenceLevels: EvidenceLevel[] = ["VERIFIED_FROM_SOURCE", "INFERRED", "REQUIRES_REVIEW"];

export function validateAiEvaluationDraft(value: unknown): AiEvaluationDraft | null {
  if (!isRecord(value) || (value.evaluationStatus !== "PASSED" && value.evaluationStatus !== "REQUIRES_REVIEW")) return null;
  if (!isScoreRecord(value.scores, ["technicalExecution", "problemSolving", "codeQuality", "requirements", "creativity", "initiative"])) return null;
  if (!isScoreRecord(value.reasoningProfile, reasoningAreas)) return null;
  if (!Array.isArray(value.reasoningEvidence) || value.reasoningEvidence.length !== reasoningAreas.length) return null;
  const reasoningEvidence = value.reasoningEvidence;
  if (!reasoningEvidence.every((item) => isRecord(item) && reasoningAreas.includes(item.area as ReasoningArea) && isEvidence(item.evidence))) return null;
  if (new Set(reasoningEvidence.map((item) => (item as { area: string }).area)).size !== reasoningAreas.length) return null;
  if (!isStringList(value.strengths, 8) || !isStringList(value.areasToImprove, 8) || !isEvidence(value.summary, 700)) return null;
  if (!Array.isArray(value.requirementAnalysis) || value.requirementAnalysis.length !== CHALLENGE_REQUIREMENTS.length) return null;
  if (!Array.isArray(value.initiativeAnalysis) || value.initiativeAnalysis.length !== INITIATIVE_FEATURES.length) return null;

  const requirements = value.requirementAnalysis as unknown[];
  const initiatives = value.initiativeAnalysis as unknown[];
  if (!requirements.every(isRequirementAnalysis) || !initiatives.every(isInitiativeAnalysis)) return null;
  if (!hasExactNames(requirements, CHALLENGE_REQUIREMENTS, "requirement") || !hasExactNames(initiatives, INITIATIVE_FEATURES, "feature")) return null;
  return value as AiEvaluationDraft;
}

function isRequirementAnalysis(value: unknown): value is AiRequirementAnalysis {
  if (!isRecord(value)) return false;
  return typeof value.requirement === "string" && ["PASSED", "PARTIAL", "FAILED", "REQUIRES_REVIEW"].includes(String(value.status)) &&
    evidenceLevels.includes(value.evidenceLevel as EvidenceLevel) && isEvidence(value.evidence) &&
    (value.status === "REQUIRES_REVIEW" ? value.evidenceLevel === "REQUIRES_REVIEW" : value.evidenceLevel !== "REQUIRES_REVIEW");
}

function isInitiativeAnalysis(value: unknown): value is AiInitiativeAnalysis {
  if (!isRecord(value)) return false;
  return typeof value.feature === "string" && ["DETECTED", "NOT_DETECTED", "REQUIRES_REVIEW"].includes(String(value.status)) &&
    evidenceLevels.includes(value.evidenceLevel as EvidenceLevel) && isEvidence(value.evidence) &&
    (value.status === "REQUIRES_REVIEW" ? value.evidenceLevel === "REQUIRES_REVIEW" : value.evidenceLevel !== "REQUIRES_REVIEW");
}

function hasExactNames(values: unknown[], expected: readonly string[], key: "requirement" | "feature"): boolean {
  const names = values.map((item) => isRecord(item) && typeof item[key] === "string" ? item[key] : "");
  return new Set(names).size === expected.length && expected.every((name) => names.includes(name));
}

function isScoreRecord(value: unknown, keys: readonly string[]): boolean {
  return isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Number.isInteger(value[key]) && (value[key] as number) >= 0 && (value[key] as number) <= 100);
}

function isStringList(value: unknown, max: number): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every((item) => isEvidence(item, 320));
}

function isEvidence(value: unknown, max = 320): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
