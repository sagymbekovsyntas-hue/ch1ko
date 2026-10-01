export type EvaluationStatus = "PASSED" | "REQUIRES_REVIEW";
export type EvidenceLevel = "VERIFIED_FROM_SOURCE" | "INFERRED" | "REQUIRES_REVIEW";
export type ReasoningArea = "logicalReasoning" | "patternRecognition" | "problemSolving" | "learningAdaptability";

export type AiRequirementAnalysis = {
  requirement: string;
  status: "PASSED" | "PARTIAL" | "FAILED" | "REQUIRES_REVIEW";
  evidenceLevel: EvidenceLevel;
  evidence: string;
};

export type AiInitiativeAnalysis = {
  feature: string;
  status: "DETECTED" | "NOT_DETECTED" | "REQUIRES_REVIEW";
  evidenceLevel: EvidenceLevel;
  evidence: string;
};

export type AiEvaluationDraft = {
  evaluationStatus: EvaluationStatus;
  scores: {
    technicalExecution: number;
    problemSolving: number;
    codeQuality: number;
    requirements: number;
    creativity: number;
    initiative: number;
  };
  reasoningProfile: Record<ReasoningArea, number>;
  reasoningEvidence: Array<{ area: ReasoningArea; evidence: string }>;
  strengths: string[];
  areasToImprove: string[];
  requirementAnalysis: AiRequirementAnalysis[];
  initiativeAnalysis: AiInitiativeAnalysis[];
  summary: string;
};

export type AiSkillEvaluation = AiEvaluationDraft & { overallScore: number };

export type AiEvaluationInputSummary = {
  filesIncluded: string[];
  filesExcluded: Array<{ path: string; reason: string }>;
  truncated: boolean;
  truncatedFiles: string[];
  includedSourceBytes: number;
  excludedFileCount: number;
};

export type AiEvaluationRecord = {
  submissionId: string;
  evaluatedAt: string;
  model: string;
  evaluation: AiSkillEvaluation;
  inputSummary: AiEvaluationInputSummary;
};
