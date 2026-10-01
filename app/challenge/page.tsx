import { AuthGate } from "../components/auth-gate";
import { ChallengeView } from "../components/challenge-view";

export default function ChallengePage() {
  return <AuthGate needsProfile><ChallengeView /></AuthGate>;
}
