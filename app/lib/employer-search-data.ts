import { getAchievementById, type VerifiedAchievement } from "./verified-achievement";
import { getAiEvaluation } from "./ai-evaluation-storage";
import { readLatestSubmission } from "./submission-storage";
import { readMockProfile } from "./mock-auth";

export type EmployerCandidate = {
  credentialId: string;
  username: string;
  fullName: string;
  skill: string;
  experience: string;
  overallScore: number;
  challengeTitle: string;
  evaluationStatus: string;
  verificationStatus: VerifiedAchievement["verificationStatus"];
};

const ACHIEVEMENT_PREFIX = "ch1ko.achievement.";
const INDEX_MARKER = "submission.";

/** Reads only real, locally saved profiles joined to their current evaluation and public credential record. */
export function loadEmployerCandidates(): EmployerCandidate[] {
  if (typeof window === "undefined") return [];
  try {
    const profile = readMockProfile();
    const submission = readLatestSubmission();
    if (!profile || !submission || !submission.artifactId) return [];
    const evaluation = getAiEvaluation(submission.id);
    if (!evaluation) return [];

    const keys = Object.keys(window.localStorage);
    const results: EmployerCandidate[] = [];
    for (const key of keys) {
      if (!key.startsWith(ACHIEVEMENT_PREFIX)) continue;
      const credentialId = key.slice(ACHIEVEMENT_PREFIX.length);
      if (!credentialId || credentialId.startsWith(INDEX_MARKER)) continue;
      const achievement = getAchievementById(credentialId);
      if (!achievement || achievement.submissionId !== submission.id || achievement.username !== profile.username) continue;
      if (achievement.overallScore !== evaluation.evaluation.overallScore || achievement.skill !== profile.skill) continue;

      results.push({
        credentialId: achievement.credentialId,
        username: profile.username,
        fullName: profile.fullName,
        skill: profile.skill,
        experience: profile.experience,
        overallScore: evaluation.evaluation.overallScore,
        challengeTitle: achievement.challengeTitle,
        evaluationStatus: "AI Evaluated",
        verificationStatus: achievement.verificationStatus,
      });
    }
    return results;
  } catch {
    return [];
  }
}
