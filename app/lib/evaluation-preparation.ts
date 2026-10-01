import type { SubmissionArtifact } from "./submission-artifact";

export type EvaluationSubmissionMetadata = { id: string; submittedAt: string; artifactId: string };

export type EvaluationPreparation = {
  challengeId: string;
  challengeTitle: string;
  challengeRequirements: string[];
  submissionMetadata: EvaluationSubmissionMetadata;
  submittedFiles: SubmissionArtifact["files"];
};

export function prepareEvaluationInput(submission: EvaluationSubmissionMetadata, artifact: SubmissionArtifact): EvaluationPreparation {
  return {
    challengeId: "001",
    challengeTitle: "Frontend Task Manager",
    challengeRequirements: [
      "Create tasks.",
      "Delete tasks.",
      "Complete tasks and undo completion.",
      "Search and filter tasks.",
      "Build a responsive interface.",
      "Provide a clear, usable experience.",
    ],
    submissionMetadata: {
      id: submission.id,
      submittedAt: submission.submittedAt,
      artifactId: artifact.id,
    },
    submittedFiles: artifact.files,
  };
}
