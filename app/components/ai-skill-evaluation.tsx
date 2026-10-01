"use client";

import { useEffect, useState } from "react";
import { getArtifact } from "../lib/artifact-storage";
import { getAiEvaluation, saveAiEvaluation } from "../lib/ai-evaluation-storage";
import { validateAiEvaluationDraft } from "../lib/ai-evaluation-schema";
import type { AiEvaluationInputSummary, AiEvaluationRecord, AiSkillEvaluation } from "../lib/ai-evaluation-types";
import type { ChallengeSubmission } from "../lib/submission-storage";

export function AiSkillEvaluationPanel({ submission }: { submission: ChallengeSubmission }) {
  const [record, setRecord] = useState<AiEvaluationRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    setRecord(getAiEvaluation(submission.id));
    setLoaded(true);
  }, [submission.id]);

  async function runEvaluation() {
    setError("");
    setStorageWarning(false);
    if (!submission.artifactId) {
      setError("This submission has no uploaded source artifact. Upload an implementation before requesting AI evaluation.");
      return;
    }
    setRunning(true);
    try {
      const artifact = await getArtifact(submission.artifactId);
      if (!artifact || artifact.files.length === 0) {
        setError("The submitted source files are unavailable in this browser. AI evaluation cannot proceed.");
        return;
      }
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.id,
          artifactId: artifact.id,
          submittedAt: submission.submittedAt,
          artifact,
        }),
      });
      let responseBody: unknown;
      try { responseBody = await response.json() as unknown; } catch { responseBody = null; }
      if (!response.ok) {
        setError(userMessageFromError(response.status, responseBody));
        return;
      }
      const parsed = parseSuccessResponse(responseBody);
      if (!parsed) {
        setError("The evaluation service returned an incomplete result. You can try again.");
        return;
      }
      const nextRecord: AiEvaluationRecord = {
        submissionId: submission.id,
        evaluatedAt: parsed.evaluatedAt,
        model: parsed.model,
        evaluation: parsed.evaluation,
        inputSummary: parsed.inputSummary,
      };
      setRecord(nextRecord);
      setStorageWarning(!saveAiEvaluation(nextRecord));
    } catch {
      setError("Could not connect to the AI evaluation service. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }

  return <section className="evaluation-section ai-evaluation-panel" aria-labelledby="ai-evaluation-title">
    <div className="ai-evaluation-heading"><div><p className="challenge-eyebrow"><i /> AI SKILL EVALUATION</p><h2 id="ai-evaluation-title">AI Evaluation</h2><p>Evaluation uses the uploaded implementation, not the CH1KO challenge demo.</p></div>{record && <StatusBadge status={record.evaluation.evaluationStatus} />}</div>
    {!loaded ? <p className="ai-evaluation-loading" aria-busy="true">Loading saved evaluation…</p> : record ? <>
      <section className="ai-overall-score"><div><span>OVERALL SCORE</span><strong>{record.evaluation.overallScore}<small>/100</small></strong></div><p>{record.evaluation.summary}</p></section>
      <div className="ai-score-grid">{scoreCards(record.evaluation).map(([label, score]) => <ScoreCard key={label} label={label} score={score} />)}</div>
      <section className="ai-subsection reasoning-profile"><div className="ai-subsection-heading"><div><p className="evaluation-label">OBSERVABLE WORK SIGNALS</p><h3>Reasoning Profile</h3></div></div><p className="ai-subsection-intro">This profile describes observable reasoning signals in the submitted work. It is not an IQ test.</p><div className="ai-score-grid reasoning-score-grid">{reasoningCards(record.evaluation).map(([label, score, area]) => <article className="ai-score-card reasoning-score-card" key={area}><div><span>{label}</span><strong>{score}<small>/100</small></strong></div><p>{record.evaluation.reasoningEvidence.find((item) => item.area === area)?.evidence}</p></article>)}</div></section>
      <AnalysisList title="Requirement Analysis" items={record.evaluation.requirementAnalysis.map((item) => ({ name: item.requirement, status: item.status, level: item.evidenceLevel, evidence: item.evidence }))} />
      <AnalysisList title="Initiative Signals" items={record.evaluation.initiativeAnalysis.map((item) => ({ name: item.feature, status: item.status, level: item.evidenceLevel, evidence: item.evidence }))} />
      <div className="ai-feedback-grid"><FeedbackList title="Strengths" items={record.evaluation.strengths} /><FeedbackList title="Areas to Improve" items={record.evaluation.areasToImprove} /></div>
      <InputCoverage summary={record.inputSummary} />
      <footer className="ai-evaluation-meta"><span>Evaluated {new Date(record.evaluatedAt).toLocaleString()} · {record.model}</span><button type="button" className="ai-rerun-button" disabled={running} onClick={runEvaluation}>{running ? "AI is analyzing your implementation…" : "Run AI Evaluation Again"}</button></footer>
      {storageWarning && <p className="ai-storage-warning" role="status">The evaluation is visible now, but this browser could not save it locally.</p>}
    </> : <div className="ai-evaluation-empty"><p>{submission.artifactId ? "Your artifact is ready for technical evaluation. The AI request runs only when you choose to start it." : "No uploaded implementation is attached to this submission."}</p><button type="button" className="button" disabled={!submission.artifactId || running} onClick={runEvaluation}>{running ? "AI is analyzing your implementation…" : "Run AI Evaluation"}<span aria-hidden="true">-&gt;</span></button></div>}
    {running && <p className="ai-running-message" role="status" aria-live="polite">AI is analyzing your implementation…</p>}
    {error && <p className="ai-evaluation-error" role="alert">{error}</p>}
  </section>;
}

function scoreCards(evaluation: AiSkillEvaluation): Array<[string, number]> {
  return [
    ["Technical Execution", evaluation.scores.technicalExecution],
    ["Problem Solving", evaluation.scores.problemSolving],
    ["Code Quality", evaluation.scores.codeQuality],
    ["Requirements", evaluation.scores.requirements],
    ["Creativity", evaluation.scores.creativity],
    ["Initiative", evaluation.scores.initiative],
  ];
}

function reasoningCards(evaluation: AiSkillEvaluation): Array<[string, number, keyof AiSkillEvaluation["reasoningProfile"]]> {
  return [
    ["Logical Reasoning", evaluation.reasoningProfile.logicalReasoning, "logicalReasoning"],
    ["Pattern Recognition", evaluation.reasoningProfile.patternRecognition, "patternRecognition"],
    ["Problem Solving", evaluation.reasoningProfile.problemSolving, "problemSolving"],
    ["Learning / Adaptability", evaluation.reasoningProfile.learningAdaptability, "learningAdaptability"],
  ];
}

function ScoreCard({ label, score }: { label: string; score: number }) {
  return <article className="ai-score-card"><div><span>{label}</span><strong>{score}<small>/100</small></strong></div><i><span style={{ width: `${score}%` }} /></i></article>;
}

function StatusBadge({ status }: { status: AiSkillEvaluation["evaluationStatus"] }) {
  return <span className={`ai-status-badge ${status.toLowerCase().replaceAll("_", "-")}`}>{status.replaceAll("_", " ")}</span>;
}

function AnalysisList({ title, items }: { title: string; items: Array<{ name: string; status: string; level: string; evidence: string }> }) {
  return <section className="ai-subsection"><div className="ai-subsection-heading"><div><p className="evaluation-label">SOURCE GROUNDED</p><h3>{title}</h3></div></div><div className="ai-analysis-list">{items.map((item) => <article className="ai-analysis-item" key={item.name}><div className="ai-analysis-title"><h4>{item.name}</h4><span className={`ai-analysis-status ${item.status.toLowerCase().replaceAll("_", "-")}`}>{item.status.replaceAll("_", " ")}</span></div><p>{item.evidence}</p><small>{evidenceLevelLabel(item.level)}</small></article>)}</div></section>;
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  return <section className="ai-feedback-card"><h3>{title}</h3>{items.length ? <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul> : <p>No specific items recorded.</p>}</section>;
}

function InputCoverage({ summary }: { summary: AiEvaluationInputSummary }) {
  return <section className="ai-input-coverage"><div><p className="evaluation-label">AI INPUT SUMMARY</p><h3>Files analyzed</h3><p>{summary.filesIncluded.length} included · {summary.excludedFileCount} excluded · {Math.round(summary.includedSourceBytes / 1024)} KB of source content</p></div>{summary.truncated && <p className="ai-truncation-note">Some source content was truncated to fit the AI context limit.</p>}<ul>{summary.filesIncluded.slice(0, 12).map((path) => <li key={path}>{path}{summary.truncatedFiles.includes(path) ? " · excerpt" : ""}</li>)}</ul>{summary.filesIncluded.length > 12 && <small>and {summary.filesIncluded.length - 12} more included files</small>}</section>;
}

function evidenceLevelLabel(level: string): string {
  if (level === "VERIFIED_FROM_SOURCE") return "Verified from source";
  if (level === "INFERRED") return "Inferred from source";
  return "Requires review";
}

function userMessageFromError(status: number, body: unknown): string {
  const error = isRecord(body) && isRecord(body.error) ? body.error : null;
  const code = error && typeof error.code === "string" ? error.code : "";
  if (code === "MISSING_API_KEY") return "AI evaluation is not configured on the server yet. Please contact the site administrator.";
  if (code === "INVALID_API_KEY") return "AI evaluation is not configured correctly. Please contact the site administrator.";
  if (code === "AI_RATE_LIMIT") return "AI evaluation is busy right now. Please wait a moment and try again.";
  if (code === "AI_TIMEOUT") return "AI evaluation took too long. You can try again.";
  if (code === "REQUEST_TOO_LARGE") return "This submission is too large to send for AI evaluation.";
  if (code === "INVALID_ARTIFACT" || code === "NO_EVALUABLE_FILES") return "The submitted artifact is invalid or contains no evaluable text files.";
  if (status >= 500) return "AI evaluation is temporarily unavailable. You can try again later.";
  return "The evaluation request could not be validated. Review the submission and try again.";
}

function parseSuccessResponse(value: unknown): { evaluation: AiSkillEvaluation; evaluatedAt: string; model: string; inputSummary: AiEvaluationInputSummary } | null {
  if (!isRecord(value) || typeof value.evaluatedAt !== "string" || Number.isNaN(Date.parse(value.evaluatedAt)) ||
      typeof value.model !== "string" || !isRecord(value.evaluation)) return null;
  const evaluation = value.evaluation as AiSkillEvaluation;
  const { overallScore, ...draft } = evaluation;
  if (!Number.isInteger(overallScore) || overallScore < 0 || overallScore > 100 || !validateAiEvaluationDraft(draft) || !isInputSummary(value.inputSummary)) return null;
  return { evaluation, evaluatedAt: value.evaluatedAt, model: value.model, inputSummary: value.inputSummary };
}

function isInputSummary(value: unknown): value is AiEvaluationInputSummary {
  return isRecord(value) && Array.isArray(value.filesIncluded) && value.filesIncluded.every((path) => typeof path === "string") &&
    Array.isArray(value.filesExcluded) && value.filesExcluded.every((item) => isRecord(item) && typeof item.path === "string" && typeof item.reason === "string") &&
    typeof value.truncated === "boolean" && Array.isArray(value.truncatedFiles) && value.truncatedFiles.every((path) => typeof path === "string") &&
    Number.isSafeInteger(value.includedSourceBytes) && Number(value.includedSourceBytes) >= 0 &&
    Number.isSafeInteger(value.excludedFileCount) && Number(value.excludedFileCount) >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
