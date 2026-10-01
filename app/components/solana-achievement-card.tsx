"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAddMemoInstruction } from "@solana-program/memo";
import { useClient } from "@solana/react";
import { useConnect, useConnectedWallet, useDisconnect, useIsWalletReady, useWallets } from "@solana/kit-plugin-wallet/react";
import { assertSolanaDevnet, type AppSolanaClient } from "../lib/solana-client";
import { verifyAchievementOnDevnet } from "../lib/solana-proof";
import { createVerifiedAchievement, credentialMemo, getAchievementBySubmission, hashCredential, updateAchievement, type VerifiedAchievement } from "../lib/verified-achievement";
import type { ChallengeSubmission } from "../lib/submission-storage";
import type { AiEvaluationRecord } from "../lib/ai-evaluation-types";
import type { MockProfile } from "../lib/mock-auth";

export function SolanaAchievementCard({ profile, submission, record, artifactReady }: {
  profile: MockProfile | null;
  submission: ChallengeSubmission | null;
  record: AiEvaluationRecord | null;
  artifactReady: boolean;
}) {
  const client = useClient<AppSolanaClient>();
  const wallets = useWallets(client);
  const connected = useConnectedWallet(client);
  const walletReady = useIsWalletReady(client);
  const connect = useConnect(client);
  const disconnect = useDisconnect(client);
  const [achievement, setAchievement] = useState<VerifiedAchievement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const evaluation = record?.evaluation;
  const eligible = Boolean(profile && submission?.artifactId && artifactReady && evaluation &&
    Number.isInteger(evaluation.overallScore) && evaluation.overallScore >= 0 && evaluation.overallScore <= 100 &&
    (evaluation.evaluationStatus === "PASSED" || evaluation.evaluationStatus === "REQUIRES_REVIEW"));

  useEffect(() => {
    let active = true;
    const stored = submission ? getAchievementBySubmission(submission.id) : null;
    if (stored?.verificationStatus !== "VERIFIED" || !stored.transactionSignature) {
      setAchievement(stored);
      return () => { active = false; };
    }
    // Do not show a local "verified" label until this browser has checked the devnet proof.
    setAchievement({ ...stored, verificationStatus: "PENDING" });
    void verifyAchievementOnDevnet(stored).then((confirmed) => {
      if (!active) return;
      if (confirmed) setAchievement(stored);
      else {
        const pending = updateAchievement(stored, { verificationStatus: "PENDING" });
        setAchievement(pending ?? { ...stored, verificationStatus: "PENDING" });
        setError("The saved credential could not be confirmed from Solana Devnet. Its status is shown as pending.");
      }
    }).catch(() => {
      if (!active) return;
      const pending = updateAchievement(stored, { verificationStatus: "PENDING" });
      setAchievement(pending ?? { ...stored, verificationStatus: "PENDING" });
      setError("Solana Devnet could not be reached to reconfirm this saved proof.");
    });
    return () => { active = false; };
  }, [submission?.id]);

  useEffect(() => {
    let active = true;
    async function prepareCredential() {
      if (!connected || !profile || !submission || !record || !evaluation || !eligible) return;
      const existing = getAchievementBySubmission(submission.id);
      if (existing) { if (active) setAchievement(existing); return; }
      try {
        const created = await createVerifiedAchievement({
          submissionId: submission.id,
          username: profile.username,
          skill: profile.skill,
          overallScore: evaluation.overallScore,
          evaluationStatus: evaluation.evaluationStatus,
          evaluatedAt: record.evaluatedAt,
          walletAddress: connected.account.address,
        });
        if (active) setAchievement(created);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not prepare the credential.");
      }
    }
    void prepareCredential();
    return () => { active = false; };
  }, [connected, eligible, evaluation, profile, record, submission]);

  async function connectWallet(wallet: (typeof wallets)[number]) {
    setError("");
    try { await connect.dispatchAsync(wallet); }
    catch { setError("Wallet connection was cancelled or could not be completed."); }
  }

  async function verify() {
    if (!eligible || !profile || !submission || !record || !evaluation) {
      setError("Complete the evaluation before creating a Verified Achievement.");
      return;
    }
    if (!connected?.signer) { setError("Connect a signing-capable wallet before verifying this achievement."); return; }
    if (!connected.supportedTransactionVersions.has(1)) {
      setError("This wallet does not support the transaction format required by the Solana Kit client.");
      return;
    }
    setBusy(true);
    setError("");
    let current: VerifiedAchievement | null = null;
    try {
      current = achievement ?? await createVerifiedAchievement({
        submissionId: submission.id,
        username: profile.username,
        skill: profile.skill,
        overallScore: evaluation.overallScore,
        evaluationStatus: evaluation.evaluationStatus,
        evaluatedAt: record.evaluatedAt,
        walletAddress: connected.account.address,
      });
      if (current.verificationStatus === "VERIFIED" && current.transactionSignature) {
        setError("This achievement is already anchored. Open its public record to view the proof.");
        return;
      }
      if (await hashCredential(current) !== current.credentialHash) throw new Error("Credential hash mismatch.");
      if (current.transactionSignature) {
        const alreadyConfirmed = await verifyAchievementOnDevnet(current);
        if (alreadyConfirmed) {
          const verified = updateAchievement(current, { verificationStatus: "VERIFIED" });
          if (verified) setAchievement(verified);
          return;
        }
        if (current.verificationStatus === "PENDING") {
          setError("This transaction has not been confirmed yet. Check again shortly; no second transaction was sent.");
          return;
        }
      }
      const pending = updateAchievement(current, { walletAddress: connected.account.address, verificationStatus: "PENDING", transactionSignature: null });
      if (!pending) throw new Error("Could not save the pending credential.");
      current = pending;
      setAchievement(current);
      await assertSolanaDevnet();
      const memoInstruction = getAddMemoInstruction({ memo: credentialMemo(current), signers: [connected.signer] });
      const result = await client.sendTransaction([memoInstruction]);
      const txSignature = String(result.context.signature);
      const submitted = updateAchievement(current, { transactionSignature: txSignature, verificationStatus: "PENDING" });
      if (!submitted) throw new Error("Could not save the submitted transaction signature.");
      current = submitted;
      setAchievement(submitted);
      if (!await verifyAchievementOnDevnet(submitted)) {
        const stillPending = updateAchievement(submitted, { verificationStatus: "PENDING" });
        if (stillPending) setAchievement(stillPending);
        setError("The transaction was sent, but confirmation is pending. Check the achievement record again shortly.");
        return;
      }
      const confirmed = updateAchievement(submitted, { verificationStatus: "VERIFIED" });
      if (!confirmed) throw new Error("The transaction was confirmed, but the browser could not save its proof record.");
      setAchievement(confirmed);
    } catch (cause) {
      if (current && current.verificationStatus !== "VERIFIED" && !(current.verificationStatus === "PENDING" && current.transactionSignature)) {
        const failed = updateAchievement(current, { verificationStatus: "FAILED" });
        if (failed) setAchievement(failed);
      }
      setError(friendlyError(cause));
    } finally { setBusy(false); }
  }

  const displayedStatus = !eligible ? "EVALUATION REQUIRED" : achievement ? statusLabel(achievement.verificationStatus) : connected ? "READY TO VERIFY" : "READY FOR VERIFICATION";
  return <section className="skill-profile-section solana-achievement" aria-labelledby="achievement-card-heading">
    <div className="skill-profile-section-heading"><div><p className="skill-profile-kicker">BLOCKCHAIN VERIFICATION · SOLANA DEVNET</p><h2 id="achievement-card-heading">Verified Achievement</h2></div><span className={"solana-status " + (achievement?.verificationStatus.toLowerCase() ?? "not-connected")}>{displayedStatus}</span></div>
    <p className="solana-description">CH1KO generates this achievement from the saved evaluation and anchors its credential hash. The chain records the anchor; it does not verify the quality of the implementation.</p>
    {!eligible ? <div className="solana-empty"><p>Complete the evaluation before creating a Verified Achievement.</p><Link href={submission ? "/evaluation" : "/challenge"}>{submission ? "View Evaluation" : "Open Challenge"} <span aria-hidden="true">-&gt;</span></Link></div> : !connected ? <div className="solana-wallet-connect">
      {achievement?.verificationStatus === "VERIFIED" && achievement.transactionSignature ? <><p>Verified credential for {achievement.skill}, anchored to Solana Devnet.</p><div className="solana-actions"><Link className="button" href={"/achievement/" + encodeURIComponent(achievement.credentialId)}>View Achievement <span aria-hidden="true">-&gt;</span></Link><a className="solana-explorer-link" href={explorerUrl(achievement.transactionSignature)} target="_blank" rel="noreferrer">View on Solana Explorer ↗</a></div></> : achievement?.verificationStatus === "PENDING" && achievement.transactionSignature ? <><p>Verification is pending. This browser has a transaction signature to check.</p><Link href={"/achievement/" + encodeURIComponent(achievement.credentialId)}>Check transaction status <span aria-hidden="true">-&gt;</span></Link></> : <><p>{walletReady && wallets.length === 0 ? "No Solana wallet detected." : "Connect a Solana wallet to verify this achievement."}</p>{walletReady && wallets.length > 0 ? <div className="solana-wallet-list">{wallets.map((wallet) => <button className="button" type="button" key={wallet.name} disabled={connect.isRunning} onClick={() => void connectWallet(wallet)}>{connect.isRunning ? "Connecting…" : wallets.length === 1 ? "Connect Wallet" : "Connect " + wallet.name}</button>)}</div> : !walletReady ? <p aria-busy="true">Looking for Wallet Standard wallets…</p> : null}</>}
      {error && <p className="solana-error" role="alert">{error}</p>}
    </div> : <div className="solana-connected">
      <div className="solana-facts"><Fact label="Wallet" value={shorten(connected.account.address)} /><Fact label="Network" value="Solana Devnet" />{achievement && <Fact label="Credential" value={achievement.credentialId} />}<Fact label="Status" value={displayedStatus} /></div>
      {achievement?.verificationStatus === "VERIFIED" && achievement.transactionSignature ? <><div className="solana-proof"><strong>✓ VERIFIED ON SOLANA</strong><p>CH1KO generated this achievement from the evaluation and anchored its credential hash on Solana Devnet.</p><Fact label="Skill" value={achievement.skill} /><Fact label="Challenge" value={achievement.challengeTitle} /><Fact label="Overall Score" value={String(achievement.overallScore) + " / 100"} /><Fact label="Wallet" value={shorten(achievement.walletAddress)} /><Fact label="Network" value="Solana Devnet" /><Fact label="Transaction" value={shorten(achievement.transactionSignature)} /><Fact label="Credential Hash" value={achievement.credentialHash} /></div><div className="solana-actions"><Link className="button" href={"/achievement/" + encodeURIComponent(achievement.credentialId)}>View Achievement <span aria-hidden="true">-&gt;</span></Link><a className="solana-explorer-link" href={explorerUrl(achievement.transactionSignature)} target="_blank" rel="noreferrer">View on Solana Explorer ↗</a></div></> : <div className="solana-actions"><button className="button" type="button" disabled={busy || !achievement} onClick={() => void verify()}>{busy ? "Waiting for Solana confirmation…" : achievement?.verificationStatus === "PENDING" && achievement.transactionSignature ? "Check Confirmation" : achievement?.verificationStatus === "FAILED" ? "Retry Verification" : "Verify on Solana"}<span aria-hidden="true">-&gt;</span></button>{achievement?.transactionSignature && <Link href={"/achievement/" + encodeURIComponent(achievement.credentialId)}>View transaction record</Link>}<a className="solana-faucet" href="https://faucet.solana.com/" target="_blank" rel="noreferrer">Need Devnet SOL? Use the official faucet ↗</a></div>}
      {error && <p className="solana-error" role="alert">{error}</p>}
      <button type="button" className="solana-disconnect" disabled={disconnect.isRunning} onClick={() => void disconnect.dispatchAsync()}>{disconnect.isRunning ? "Disconnecting…" : "Disconnect Wallet"}</button>
    </div>}
  </section>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="solana-fact"><span>{label}</span><strong>{value || "Not available"}</strong></div>; }
function shorten(value: string): string { return value.length < 14 ? value : value.slice(0, 6) + "…" + value.slice(-6); }
function statusLabel(status: VerifiedAchievement["verificationStatus"]): string {
  return ({ NOT_CONNECTED: "READY FOR VERIFICATION", READY: "READY TO VERIFY", PENDING: "VERIFICATION PENDING", VERIFIED: "VERIFIED ON SOLANA", FAILED: "VERIFICATION FAILED" } as const)[status];
}
function explorerUrl(txSignature: string): string { return "https://explorer.solana.com/tx/" + encodeURIComponent(txSignature) + "?cluster=devnet"; }
function friendlyError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message.toLowerCase() : "";
  if (message.includes("reject") || message.includes("declin") || message.includes("cancel")) return "The wallet signature was cancelled. No achievement was marked verified.";
  if (message.includes("insufficient") || message.includes("funds") || message.includes("balance")) return "This wallet needs a small amount of Devnet SOL to pay the network fee. CH1KO does not receive SOL.";
  if (message.includes("blockhash") || message.includes("expired")) return "The transaction expired before confirmation. Please try again.";
  if (message.includes("timeout") || message.includes("timed out")) return "Solana confirmation timed out. The achievement remains unverified; check again before retrying.";
  if (message.includes("hash") || message.includes("credential")) return "The saved credential could not be validated. Refresh the page and try again.";
  return "The Devnet transaction could not be completed or confirmed. The achievement remains unverified. Please try again.";
}
