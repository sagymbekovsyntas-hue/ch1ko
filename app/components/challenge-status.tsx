import type { ChallengeStatus as Status } from "../lib/challenge-storage";

export function ChallengeStatus({ status }: { status: Status }) {
  const statusClass = status.toLowerCase().replaceAll(" ", "-");
  return <span className={`challenge-status ${statusClass}`}><i />{status}</span>;
}
