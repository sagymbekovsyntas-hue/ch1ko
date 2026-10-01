import { calculateOverallScore } from "./ai-scoring";
import { validateAiEvaluationDraft } from "./ai-evaluation-schema";
import type { AiEvaluationRecord, AiEvaluationInputSummary, AiSkillEvaluation } from "./ai-evaluation-types";

const STORAGE_PREFIX = "ch1ko.aiEvaluation.";

export function getAiEvaluation(submissionId: string): AiEvaluationRecord | null {
  try {
    const value = window.localStorage.getItem(storageKey(submissionId));
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    return isEvaluationRecord(parsed, submissionId) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveAiEvaluation(record: AiEvaluationRecord): boolean {
  try {
    if (!isEvaluationRecord(record, record.submissionId)) return false;
    window.localStorage.setItem(storageKey(record.submissionId), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function deleteAiEvaluation(submissionId: string): boolean {
  try {
    window.localStorage.removeItem(storageKey(submissionId));
    return true;
  } catch {
    return false;
  }
}

function storageKey(submissionId: string): string {
  return `${STORAGE_PREFIX}${submissionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120)}`;
}

function isEvaluationRecord(value: unknown, expectedSubmissionId: string): value is AiEvaluationRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<AiEvaluationRecord>;
  if (record.submissionId !== expectedSubmissionId || typeof record.evaluatedAt !== "string" || typeof record.model !== "string" ||
      typeof record.evaluation !== "object" || record.evaluation === null || typeof record.inputSummary !== "object" || record.inputSummary === null) return false;
  const evaluation = record.evaluation as AiSkillEvaluation;
  const { overallScore, ...draft } = evaluation;
  if (!Number.isInteger(overallScore) || overallScore !== calculateOverallScore(evaluation.scores) || !validateAiEvaluationDraft(draft)) return false;
  const summary = record.inputSummary as AiEvaluationInputSummary;
  return Array.isArray(summary.filesIncluded) && summary.filesIncluded.every((path) => typeof path === "string") &&
    Array.isArray(summary.filesExcluded) && summary.filesExcluded.every((item) => typeof item?.path === "string" && typeof item.reason === "string") &&
    typeof summary.truncated === "boolean" && Array.isArray(summary.truncatedFiles) && summary.truncatedFiles.every((path) => typeof path === "string") &&
    Number.isSafeInteger(summary.includedSourceBytes) && summary.includedSourceBytes >= 0 &&
    Number.isSafeInteger(summary.excludedFileCount) && summary.excludedFileCount >= 0;
}
