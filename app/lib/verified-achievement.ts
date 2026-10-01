export type AchievementVerificationStatus = "NOT_CONNECTED" | "READY" | "PENDING" | "VERIFIED" | "FAILED";

export type VerifiedAchievement = {
  id: string;
  credentialId: string;
  submissionId: string;
  username: string;
  skill: string;
  challengeId: "001";
  challengeTitle: string;
  overallScore: number;
  evaluationStatus: "PASSED" | "REQUIRES_REVIEW";
  evaluatedAt: string;
  issuedAt: string;
  walletAddress: string;
  network: "devnet";
  credentialHash: string;
  transactionSignature: string | null;
  verificationStatus: AchievementVerificationStatus;
};

const KEY_PREFIX = "ch1ko.achievement.";
const SUBMISSION_PREFIX = `${KEY_PREFIX}submission.`;

export async function createVerifiedAchievement(input: {
  submissionId: string;
  username: string;
  skill: string;
  overallScore: number;
  evaluationStatus: "PASSED" | "REQUIRES_REVIEW";
  evaluatedAt: string;
  walletAddress: string;
}): Promise<VerifiedAchievement> {
  if (!input.submissionId || !input.username || !input.skill || !Number.isInteger(input.overallScore) || input.overallScore < 0 || input.overallScore > 100 ||
      Number.isNaN(Date.parse(input.evaluatedAt)) || !isAddress(input.walletAddress)) throw new Error("Invalid credential data.");

  const existing = getAchievementBySubmission(input.submissionId);
  if (existing) return existing;

  const stableIdentity = canonicalJson({ challengeId: "001", evaluatedAt: input.evaluatedAt, overallScore: input.overallScore, skill: input.skill, submissionId: input.submissionId });
  const identityHash = await sha256(stableIdentity);
  const credentialId = `CH1KO-001-${identityHash.slice(0, 12).toUpperCase()}`;
  const credentialPayload = canonicalJson({
    credentialId,
    submissionId: input.submissionId,
    challengeId: "001",
    overallScore: input.overallScore,
    skill: input.skill,
    evaluatedAt: input.evaluatedAt,
  });
  const achievement: VerifiedAchievement = {
    id: credentialId,
    credentialId,
    submissionId: input.submissionId,
    username: input.username,
    skill: input.skill,
    challengeId: "001",
    challengeTitle: "Frontend Task Manager",
    overallScore: input.overallScore,
    evaluationStatus: input.evaluationStatus,
    evaluatedAt: input.evaluatedAt,
    issuedAt: new Date().toISOString(),
    walletAddress: input.walletAddress,
    network: "devnet",
    credentialHash: await sha256(credentialPayload),
    transactionSignature: null,
    verificationStatus: "READY",
  };
  if (!saveAchievement(achievement)) throw new Error("Could not save the credential in this browser.");
  return achievement;
}

export function getAchievementById(credentialId: string): VerifiedAchievement | null {
  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}${safeKey(credentialId)}`);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return isAchievement(value) && value.credentialId === credentialId ? value : null;
  } catch { return null; }
}

export function getAchievementBySubmission(submissionId: string): VerifiedAchievement | null {
  try {
    const credentialId = window.localStorage.getItem(`${SUBMISSION_PREFIX}${safeKey(submissionId)}`);
    return credentialId ? getAchievementById(credentialId) : null;
  } catch { return null; }
}

export function saveAchievement(achievement: VerifiedAchievement): boolean {
  try {
    if (!isAchievement(achievement)) return false;
    window.localStorage.setItem(`${KEY_PREFIX}${safeKey(achievement.credentialId)}`, JSON.stringify(achievement));
    window.localStorage.setItem(`${SUBMISSION_PREFIX}${safeKey(achievement.submissionId)}`, achievement.credentialId);
    return true;
  } catch { return false; }
}

export function updateAchievement(achievement: VerifiedAchievement, update: Partial<Pick<VerifiedAchievement, "walletAddress" | "transactionSignature" | "verificationStatus">>): VerifiedAchievement | null {
  const next = { ...achievement, ...update };
  return saveAchievement(next) ? next : null;
}

export function credentialMemo(achievement: VerifiedAchievement): string {
  return `CH1KO|credential:${achievement.credentialId}|hash:${achievement.credentialHash}`;
}

export async function hashCredential(achievement: VerifiedAchievement): Promise<string> {
  return sha256(canonicalJson({
    credentialId: achievement.credentialId,
    submissionId: achievement.submissionId,
    challengeId: achievement.challengeId,
    overallScore: achievement.overallScore,
    skill: achievement.skill,
    evaluatedAt: achievement.evaluatedAt,
  }));
}

function canonicalJson(value: { [key: string]: string | number }): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
}

async function sha256(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Secure hashing is unavailable in this browser.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeKey(value: string): string { return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120); }
function isAddress(value: string): boolean { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value); }

function isAchievement(value: unknown): value is VerifiedAchievement {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<VerifiedAchievement>;
  return typeof item.id === "string" && typeof item.credentialId === "string" && item.id === item.credentialId &&
    typeof item.submissionId === "string" && typeof item.username === "string" && typeof item.skill === "string" &&
    item.challengeId === "001" && typeof item.challengeTitle === "string" && Number.isInteger(item.overallScore) && Number(item.overallScore) >= 0 && Number(item.overallScore) <= 100 &&
    (item.evaluationStatus === "PASSED" || item.evaluationStatus === "REQUIRES_REVIEW") &&
    typeof item.evaluatedAt === "string" && typeof item.issuedAt === "string" && typeof item.walletAddress === "string" && isAddress(item.walletAddress) &&
    item.network === "devnet" && typeof item.credentialHash === "string" && /^[a-f0-9]{64}$/.test(item.credentialHash) &&
    (item.transactionSignature === null || typeof item.transactionSignature === "string") &&
    (item.verificationStatus !== "VERIFIED" || typeof item.transactionSignature === "string") &&
    ["NOT_CONNECTED", "READY", "PENDING", "VERIFIED", "FAILED"].includes(item.verificationStatus ?? "");
}
