# CH1KO Hackathon Demo (2–3 minutes)

### 1. Problem

“Traditional resumes show what candidates claim they can do. CH1KO evaluates demonstrated work.”

### 2. CH1KO solution and candidate flow

“A candidate registers, adds a skill profile, and opens Challenge #001: a Frontend Task Manager. The task manager shown inside CH1KO is a demo environment. For evaluation, the candidate uploads the source files they actually built.”

Show the challenge brief and artifact uploader. Point out that submission requires an artifact.

“CH1KO first runs deterministic automated checks, then the candidate can explicitly request AI evaluation of the uploaded source artifact. The AI returns structured scores and concise evidence; uncertain areas are marked for review.”

Open `/evaluation` and show the automated checks, AI evaluation, scores, and evidence. If AI is not configured or no saved evaluation exists, show that state honestly rather than presenting sample results as real.

### 3. Skill Profile

“The saved evaluation becomes a Skill Profile with a weighted overall score, six skill dimensions, reasoning signals, strengths, improvement areas, and requirement evidence.”

Open `/profile`. Clarify that the Reasoning Profile describes signals visible in the work and is not an IQ test.

### 4. Solana verification

“If the candidate chooses, CH1KO hashes the credential record and anchors a memo on Solana Devnet. The wallet signs the transaction. The public achievement page checks the confirmed transaction and memo.”

Show a real achievement and Devnet Explorer transaction only if one exists. The chain anchors the credential record; it does not prove that an AI assessment is objectively correct. If no wallet or verified credential is available, show the ready/not-yet-verified state.

### 5. Employer Search and close

“An employer can search the locally available profiles by skill, username, or challenge, then inspect the score, evidence, and any public achievement proof.”

Open `/employers`. If this browser has no candidate data, show the honest empty state. Close with: “Instead of trusting a resume alone, CH1KO evaluates demonstrated work and makes the evidence easier to inspect.”
