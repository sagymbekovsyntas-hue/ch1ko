import { markChallengeSubmitted, type TaskItem } from "./challenge-storage";
import { evaluateChallenge, type EvaluationResult } from "./evaluation";
import type { SubmissionArtifactMetadata } from "./submission-artifact";

const SUBMISSION_KEY = "ch1ko.challenge001.submission";

export type ChallengeSubmission = {
  id: string;
  userId: string;
  challengeId: "001";
  submittedAt: string;
  status: "Submitted";
  evaluationStatus: EvaluationResult["status"];
  requirements: EvaluationResult["requirements"];
  initiative: EvaluationResult["initiative"];
  technicalResult: EvaluationResult["technicalResult"];
  evaluator: EvaluationResult["evaluator"];
  taskSnapshot: { taskCount: number; completedTaskCount: number };
  artifactId?: string;
  artifactSummary?: SubmissionArtifactMetadata;
};

type LegacySubmission = { challengeId?: unknown; submittedAt?: unknown };

export function readLatestSubmission(): ChallengeSubmission | null {
  const value = readStoredValue();
  return isChallengeSubmission(value) ? value : null;
}

export function ensureSubmissionForLegacy(userId: string, tasks: TaskItem[]): ChallengeSubmission | null {
  const value = readStoredValue();
  if (isChallengeSubmission(value)) return value;
  if (isLegacySubmission(value)) return persistSubmission(userId, tasks, new Date(value.submittedAt as string).toISOString());
  return persistSubmission(userId, tasks, new Date().toISOString());
}

export function submitChallengeOnce(userId: string, tasks: TaskItem[], artifact?: SubmissionArtifactMetadata): ChallengeSubmission {
  const existing = readLatestSubmission();
  if (existing) return existing;
  const legacy = readStoredValue();
  const submittedAt = isLegacySubmission(legacy) ? new Date(legacy.submittedAt as string).toISOString() : new Date().toISOString();
  return persistSubmission(userId, tasks, submittedAt, artifact);
}

function persistSubmission(userId: string, tasks: TaskItem[], submittedAt: string, artifact?: SubmissionArtifactMetadata): ChallengeSubmission {
  const evaluation = evaluateChallenge(tasks);
  const submission: ChallengeSubmission = {
    id: createSubmissionId(),
    userId: userId || "local-user",
    challengeId: "001",
    submittedAt,
    status: "Submitted",
    evaluationStatus: evaluation.status,
    requirements: evaluation.requirements,
    initiative: evaluation.initiative,
    technicalResult: evaluation.technicalResult,
    evaluator: evaluation.evaluator,
    taskSnapshot: {
      taskCount: tasks.length,
      completedTaskCount: tasks.filter((task) => task.completed).length,
    },
    ...(artifact ? { artifactId: artifact.id, artifactSummary: artifact } : {}),
  };
  try { window.localStorage.setItem(SUBMISSION_KEY, JSON.stringify(submission)); } catch { /* Evaluation remains available in the current view. */ }
  markChallengeSubmitted();
  return submission;
}

function readStoredValue(): unknown {
  try {
    const value = window.localStorage.getItem(SUBMISSION_KEY);
    return value ? JSON.parse(value) as unknown : null;
  } catch {
    return null;
  }
}

function isLegacySubmission(value: unknown): value is LegacySubmission & { challengeId: "001"; submittedAt: string } {
  return typeof value === "object" && value !== null &&
    (value as LegacySubmission).challengeId === "001" &&
    typeof (value as LegacySubmission).submittedAt === "string" &&
    !Number.isNaN(new Date((value as LegacySubmission).submittedAt as string).getTime()) &&
    !isChallengeSubmission(value);
}

function isChallengeSubmission(value: unknown): value is ChallengeSubmission {
  if (typeof value !== "object" || value === null) return false;
  const submission = value as Partial<ChallengeSubmission>;
  return typeof submission.id === "string" && typeof submission.userId === "string" &&
    submission.challengeId === "001" && typeof submission.submittedAt === "string" &&
    submission.status === "Submitted" && Array.isArray(submission.requirements) &&
    Array.isArray(submission.initiative) && typeof submission.technicalResult?.score === "number" &&
    typeof submission.evaluator === "string" &&
    (submission.artifactId === undefined || typeof submission.artifactId === "string") &&
    (submission.evaluationStatus === "PASSED" || submission.evaluationStatus === "FAILED" || submission.evaluationStatus === "REQUIRES_REVIEW");
}

function createSubmissionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `submission-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
