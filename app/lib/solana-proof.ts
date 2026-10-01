import { signature, type Signature } from "@solana/kit";
import { assertSolanaDevnet, solanaClient } from "./solana-client";
import { credentialMemo, hashCredential, type VerifiedAchievement } from "./verified-achievement";

export async function verifyAchievementOnDevnet(achievement: VerifiedAchievement): Promise<boolean> {
  if (!achievement.transactionSignature || achievement.network !== "devnet") return false;
  if (await hashCredential(achievement) !== achievement.credentialHash) return false;
  await withTimeout(assertSolanaDevnet());
  let txSignature: Signature;
  try { txSignature = signature(achievement.transactionSignature); }
  catch { return false; }
  const statuses = await withTimeout(solanaClient.rpc.getSignatureStatuses([txSignature], { searchTransactionHistory: true }).send());
  const status = statuses.value[0];
  if (!status || status.err || (status.confirmationStatus !== "confirmed" && status.confirmationStatus !== "finalized")) return false;
  const transaction = await withTimeout(solanaClient.rpc.getTransaction(txSignature, {
    encoding: "json",
    maxSupportedTransactionVersion: 1,
  }).send());
  if (!transaction || transaction.meta?.err) return false;
  const memo = credentialMemo(achievement);
  const logs = transaction.meta?.logMessages ?? [];
  return logs.some((line) => line.includes(memo));
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Solana RPC confirmation check timed out.")), 12_000);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error: unknown) => { clearTimeout(timer); reject(error); });
  });
}
