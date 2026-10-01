"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGate } from "../components/auth-gate";
import { ChallengeStatus } from "../components/challenge-status";
import { ProfileNav } from "../components/profile-nav";
import { readChallengeStatus, markChallengeSubmitted, readTasks } from "../lib/challenge-storage";
import { readMockProfile } from "../lib/mock-auth";
import { ensureSubmissionForLegacy, readLatestSubmission, type ChallengeSubmission } from "../lib/submission-storage";
import { getArtifact } from "../lib/artifact-storage";
import { formatArtifactSize, type SubmissionArtifact } from "../lib/submission-artifact";
import { AiSkillEvaluationPanel } from "../components/ai-skill-evaluation";

export default function EvaluationPage() {
  const [submission, setSubmission] = useState<ChallengeSubmission | null>(null);
  const [artifact, setArtifact] = useState<SubmissionArtifact | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadEvaluation() {
      const current = readLatestSubmission();
      const saved = current ?? (readChallengeStatus() === "Submitted"
        ? ensureSubmissionForLegacy(readMockProfile()?.username ?? "local-user", readTasks())
        : null);
      if (saved) markChallengeSubmitted();
      const savedArtifact = saved?.artifactId ? await getArtifact(saved.artifactId) : null;
      if (!active) return;
      setSubmission(saved);
      setArtifact(savedArtifact);
      setLoaded(true);
    }
    void loadEvaluation();
    return () => { active = false; };
  }, []);

  return <AuthGate needsProfile><div className="evaluation-page"><ProfileNav active="evaluation" />
    <main className="evaluation-main">
      <header className="evaluation-hero"><p className="challenge-eyebrow"><i /> PROOF OF SKILL <span>·</span> CHALLENGE #001</p><div className="evaluation-heading"><div><h1>Challenge Evaluation</h1><p>Frontend Task Manager</p></div>{submission && <ChallengeStatus status="Submitted" />}</div></header>
      {!loaded ? <p className="evaluation-loading" aria-busy="true">Loading evaluation…</p> : submission ? <>
        <section className="preliminary-card"><div><p className="evaluation-label">AUTOMATED CHALLENGE CHECKS</p><h2>Preliminary Requirements Score</h2><p>{submission.technicalResult.note} These local checks evaluated the CH1KO challenge environment; they did not analyze your uploaded source code.</p></div><div className="score-display"><strong>{submission.technicalResult.score}<small>/100</small></strong><span>{submission.technicalResult.passed} of {submission.technicalResult.automaticallyVerifiable} checks passed</span></div></section>
        <section className="evaluation-section evaluation-artifact"><div className="evaluation-section-heading"><p className="challenge-eyebrow"><i /> SUBMISSION ARTIFACT</p><h2>Ready for evaluation</h2></div>{artifact ? <span className="evaluation-artifact-status"><i /> READY FOR EVALUATION</span> : submission.artifactSummary ? <span className="evaluation-artifact-unavailable">ARTIFACT CONTENTS UNAVAILABLE</span> : null}{(artifact || submission.artifactSummary) ? <><div className="evaluation-artifact-stats"><ArtifactStat label="Files submitted" value={String(artifact?.totalFiles ?? submission.artifactSummary?.totalFiles ?? 0)} /><ArtifactStat label="Source files" value={String(artifact?.sourceFiles ?? submission.artifactSummary?.sourceFiles ?? 0)} /><ArtifactStat label="Submission size" value={formatArtifactSize(artifact?.totalBytes ?? submission.artifactSummary?.totalBytes ?? 0)} /></div><p>{artifact ? "Your implementation has been received and is ready for deeper technical evaluation." : "Saved artifact counts are shown, but the source contents could not be loaded from this browser."}</p></> : <p>This submission predates artifact collection and has no uploaded implementation attached.</p>}</section>
        <section className={`overall-evaluation-status ${submission.evaluationStatus.toLowerCase().replaceAll("_", "-")}`} aria-label="Overall evaluation status"><span>OVERALL EVALUATION STATUS</span><strong>{submission.evaluationStatus.replaceAll("_", " ")}</strong></section>
        <section className="evaluation-section"><SectionHeading eyebrow="AUTOMATED CHALLENGE CHECKS" title="Challenge Environment Requirements" /><div className="evaluation-requirements">{submission.requirements.map((requirement) => <article className={`evaluation-requirement ${requirement.status.toLowerCase().replaceAll("_", "-")}`} key={requirement.id}><StatusIcon status={requirement.status} /><div className="evaluation-requirement-copy"><div><h3>{requirement.name}</h3><span className="result-status">{requirement.status.replaceAll("_", " ")}</span></div><p>{requirement.details}</p></div></article>)}</div></section>
        <section className="evaluation-section initiative-section"><SectionHeading eyebrow="LOCAL INITIATIVE SIGNALS" title="Initiative Signals" /><p className="evaluation-section-intro">These optional features cannot be reliably verified from the candidate implementation in this MVP. Each signal is marked for review.</p><div className="initiative-results">{submission.initiative.map((item) => <article className={`initiative-result ${item.status.toLowerCase().replaceAll("_", "-")}`} key={item.id}><StatusIcon status={item.status} /><div><div><h3>{item.name}</h3><span className="result-status">{item.status.replaceAll("_", " ")}</span></div><p>{item.details}</p></div></article>)}</div></section>
        <AiSkillEvaluationPanel submission={submission} />
        <footer className="evaluation-footer"><span>Submission {submission.id.slice(0, 14)} · {new Date(submission.submittedAt).toLocaleString()}</span><Link href="/profile">Back to Profile <span aria-hidden="true">-&gt;</span></Link></footer>
      </> : <section className="evaluation-empty"><span className="empty-icon" aria-hidden="true">○</span><h2>No submission to evaluate yet.</h2><p>Submit Challenge #001 to see a preliminary automated result here.</p><Link className="button" href="/challenge">Open Challenge <span aria-hidden="true">-&gt;</span></Link></section>}
    </main>
  </div></AuthGate>;
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="evaluation-section-heading"><p className="challenge-eyebrow"><i /> {eyebrow}</p><h2>{title}</h2></div>;
}

function ArtifactStat({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function StatusIcon({ status }: { status: "PASSED" | "FAILED" | "REQUIRES_REVIEW" | "DETECTED" | "NOT_DETECTED" }) {
  const icon = status === "PASSED" || status === "DETECTED" ? "✓" : status === "FAILED" ? "×" : status === "NOT_DETECTED" ? "—" : "◌";
  return <span className={`result-icon ${status.toLowerCase().replaceAll("_", "-")}`} aria-hidden="true">{icon}</span>;
}
