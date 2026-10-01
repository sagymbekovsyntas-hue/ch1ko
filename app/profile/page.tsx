"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "../components/auth-gate";
import { ProfileNav } from "../components/profile-nav";
import { SkillProfile } from "../components/skill-profile";
import { readChallengeStatus, readTasks, type ChallengeStatus as Status } from "../lib/challenge-storage";
import { readMockProfile, type MockProfile } from "../lib/mock-auth";
import { ensureSubmissionForLegacy, readLatestSubmission, type ChallengeSubmission } from "../lib/submission-storage";
import { getAiEvaluation } from "../lib/ai-evaluation-storage";
import type { AiEvaluationRecord } from "../lib/ai-evaluation-types";
import "../skill-profile.css";
import "../solana.css";
import { getArtifact } from "../lib/artifact-storage";

export default function ProfilePage() {
  const [profile, setProfile] = useState<MockProfile | null>(null);
  const [challengeStatus, setChallengeStatus] = useState<Status>("Not Started");
  const [submission, setSubmission] = useState<ChallengeSubmission | null>(null);
  const [record, setRecord] = useState<AiEvaluationRecord | null>(null);
  const [artifactReady, setArtifactReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      async function loadProfile() {
        try {
          const savedProfile = readMockProfile();
          const savedStatus = readChallengeStatus();
          const savedSubmission = savedStatus === "Submitted"
            ? ensureSubmissionForLegacy(savedProfile?.username ?? "local-user", readTasks())
            : readLatestSubmission();
          const savedRecord = savedSubmission ? getAiEvaluation(savedSubmission.id) : null;
          const artifact = savedSubmission?.artifactId ? await getArtifact(savedSubmission.artifactId) : null;
          if (!active) return;
          setProfile(savedProfile);
          setSubmission(savedSubmission);
          setChallengeStatus(savedSubmission ? "Submitted" : savedStatus);
          setRecord(savedRecord);
          setArtifactReady(Boolean(artifact && artifact.files.length > 0));
        } catch {
          if (!active) return;
          setProfile(null);
          setSubmission(null);
          setRecord(null);
          setArtifactReady(false);
        } finally { if (active) setLoaded(true); }
      }
      void loadProfile();
    } catch { setLoaded(true); }
    return () => { active = false; };
  }, []);

  return <AuthGate needsProfile><div className="profile-page"><ProfileNav active="profile" />
    <main className="skill-profile-main">
      {!loaded ? <p className="skill-profile-loading" aria-busy="true">Loading your Skill Profile…</p> : <SkillProfile profile={profile} status={challengeStatus} submission={submission} record={record} artifactReady={artifactReady} />}
    </main>
  </div></AuthGate>;
}
