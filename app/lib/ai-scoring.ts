import type { AiSkillEvaluation } from "./ai-evaluation-types";

export function calculateOverallScore(scores: AiSkillEvaluation["scores"]): number {
  return Math.round(
    scores.technicalExecution * 0.30 +
    scores.problemSolving * 0.20 +
    scores.codeQuality * 0.15 +
    scores.requirements * 0.20 +
    scores.creativity * 0.10 +
    scores.initiative * 0.05,
  );
}
