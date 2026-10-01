"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileNav } from "../../components/profile-nav";
import { getAchievementById, updateAchievement, type VerifiedAchievement } from "../../lib/verified-achievement";
import { verifyAchievementOnDevnet } from "../../lib/solana-proof";
import "../../solana.css";

type PageState = "loading" | "missing" | "checking" | "verified" | "unverified" | "unavailable";

export default function AchievementPage() {
  const params = useParams<{ credentialId: string }>();
  const [achievement, setAchievement] = useState<VerifiedAchievement | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const record = getAchievementById(params.credentialId);
      if (!record) { setState("missing"); return; }
      setAchievement(record);
      if (!record.transactionSignature) { setState("unverified"); return; }
      setState("checking");
      try {
        const proofExists = await verifyAchievementOnDevnet(record);
        if (!active) return;
        if (!proofExists) {
          setState("unverified");
          setMessage("The saved CH1KO record does not currently have a matching confirmed Solana Devnet proof.");
          return;
        }
        const verified = updateAchievement(record, { verificationStatus: "VERIFIED" }) ?? record;
        setAchievement(verified);
        setState("verified");
      } catch {
        if (!active) return;
        setState("unavailable");
        setMessage("Solana Devnet could not be reached to check the transaction. The on-chain status is not confirmed right now.");
      }
    }
    void load();
    return () => { active = false; };
  }, [params.credentialId]);

  const isVerified = state === "verified";
  return <div className="achievement-page"><ProfileNav />
    <main className="achievement-main">
      <header className="achievement-header"><p className="skill-profile-kicker">CH1KO · PUBLIC CREDENTIAL RECORD</p><h1>CH1KO Verified Achievement</h1><p>This record separates CH1KO evaluation data from the Solana proof that anchors its credential hash.</p></header>
      {state === "loading" || state === "checking" ? <p className="achievement-state-message" aria-busy="true">{state === "checking" ? "Checking the transaction on Solana Devnet…" : "Loading credential…"}</p> :
        !achievement ? <section className="achievement-panel"><span className="achievement-status unverified">NOT VERIFIED</span><h2>Credential record unavailable</h2><p>This browser has no CH1KO application record for this credential ID. No on-chain verification claim is made.</p><Link href="/profile">Back to Skill Profile <span aria-hidden="true">-&gt;</span></Link></section> :
        <><section className="achievement-panel"><div className="achievement-panel-heading"><div><p className="skill-profile-kicker">CREDENTIAL {achievement.credentialId}</p><h2>Verified Achievement</h2></div><span className={"achievement-status " + (isVerified ? "verified" : "unverified")}>{isVerified ? "✓ VERIFIED ON SOLANA" : state === "unavailable" ? "STATUS UNAVAILABLE" : "NOT YET VERIFIED"}</span></div>
          <p className="achievement-explanation">{isVerified ? "This credential is anchored on Solana Devnet. CH1KO generated this achievement from the evaluation and anchored its credential hash; the chain does not validate the underlying skill assessment." : message || "This CH1KO application record has no confirmed on-chain proof yet."}</p>
          <dl className="achievement-fields"><Fact label="Credential ID" value={achievement.credentialId} /><Fact label="Candidate username" value={achievement.username} /><Fact label="Skill" value={achievement.skill} /><Fact label="Challenge" value={achievement.challengeTitle} /><Fact label="Overall Score" value={String(achievement.overallScore) + " / 100"} /><Fact label="Evaluation status" value={achievement.evaluationStatus.replaceAll("_", " ")} /><Fact label="Evaluation date" value={dateLabel(achievement.evaluatedAt)} /><Fact label="Issued date" value={dateLabel(achievement.issuedAt)} /><Fact label="Wallet Address" value={achievement.walletAddress} /><Fact label="Network" value="Solana Devnet" /><Fact label="Credential Hash" value={achievement.credentialHash} /><Fact label="Transaction Signature" value={achievement.transactionSignature || "Not available"} /><Fact label="Verification Status" value={isVerified ? "VERIFIED ON SOLANA" : "NOT VERIFIED"} /></dl>
          {isVerified && achievement.transactionSignature && <a className="button" href={"https://explorer.solana.com/tx/" + encodeURIComponent(achievement.transactionSignature) + "?cluster=devnet"} target="_blank" rel="noreferrer">View on Solana Explorer <span aria-hidden="true">↗</span></a>}
          <p className="achievement-local-note">CH1KO application record: stored locally in the browser that issued this credential. Solana on-chain proof: the confirmed memo transaction above.</p>
        </section><Link className="achievement-back" href="/profile">← Back to Skill Profile</Link></>}
    </main>
  </div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value || "Not available"}</dd></div>;
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}
