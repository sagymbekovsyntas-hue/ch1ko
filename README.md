# CH1KO

CH1KO helps candidates demonstrate practical skills through a hands-on challenge, evidence-based evaluation, and a shareable Skill Profile.

**Problem:** Traditional resumes show what candidates claim they can do. CH1KO evaluates demonstrated work.

## Product flow

1. Register and sign in.
2. Complete onboarding with a username, skill, and experience level.
3. Open Challenge #001, the Frontend Task Manager challenge.
4. Build a solution using the challenge brief.
5. Upload the source files or a ZIP of the implementation. The Task Manager inside CH1KO is a demo environment; it is not the candidate's uploaded solution.
6. Review the deterministic automated challenge checks.
7. Explicitly request an AI evaluation of the submitted source artifact.
8. Review the resulting Skill Profile and evidence.
9. Connect a Wallet Standard compatible wallet and optionally anchor the credential on Solana Devnet.
10. Search locally available candidate records from Find Talent and inspect public achievement pages.

## Technology

- Next.js App Router 16, React 19, and TypeScript
- CSS and Tailwind CSS 4 tooling
- Browser localStorage for MVP profile, challenge, submission metadata, and evaluation records
- IndexedDB for uploaded source artifacts
- `fflate` for safely reading ZIP archives in the browser; uploaded code is treated as text and never executed
- Official OpenAI JavaScript SDK and Responses API, called by a server-side Next.js route
- Solana Kit, Solana React, Wallet Standard discovery, and the Solana Memo Program on Devnet

Local browser storage is an MVP data store, not a shared database. Candidate and employer-search records are available only in the browser where they were created.

## Running locally

Requirements: Node.js and npm.

```bash
npm install
copy .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`. The app builds without an OpenAI key or an installed Solana wallet. Add `OPENAI_API_KEY` to the server's private `.env.local` only when testing AI evaluation. Never prefix it with `NEXT_PUBLIC_`. `OPENAI_EVALUATION_MODEL` is optional; the default is configured in `app/lib/openai-server.ts`.

Solana is restricted to Devnet. `NEXT_PUBLIC_SOLANA_NETWORK` defaults to `devnet`; `NEXT_PUBLIC_SOLANA_RPC_URL` defaults to the official Devnet RPC. A connected wallet signs and pays the Devnet transaction fee. No mainnet funds are used.

## AI evaluation

The candidate explicitly starts evaluation from the evaluation screen. The server-side `/api/evaluate` route sends the uploaded artifact as text to the OpenAI Responses API using Structured Outputs. Candidate files are never executed. The evaluator uses evidence from the submitted artifact and can mark uncertain requirements as requiring review. This is an AI-assisted assessment, not objective truth; reviewers should consider the evidence and limits of static source analysis.

The six category scores are weighted into an overall score by the server:

| Dimension | Weight |
| --- | ---: |
| Technical Execution | 30% |
| Problem Solving | 20% |
| Code Quality | 15% |
| Requirements | 20% |
| Creativity | 10% |
| Initiative | 5% |

The Reasoning Profile presents observable signals in the submitted work. It is not an IQ test and does not make psychological claims.

## Solana credential

After an AI evaluation exists, the candidate can connect a Wallet Standard wallet and create a credential on Solana Devnet. CH1KO creates a stable credential ID and SHA-256 hash from selected evaluation data, then submits a compact memo transaction. The app waits for confirmation and the public achievement page checks the transaction and memo through Devnet before displaying verified status.

The blockchain anchors the credential record. It does **not** prove that the AI's subjective evaluation is objectively correct, or independently validate the candidate's skill. The transaction link opens Solana Explorer on Devnet.

## Employer search

`/employers` searches candidate records available in the current browser by skill, username, or challenge, with a minimum-score filter. Employers can inspect the saved skill score and evaluation status, open the achievement record, and check its Solana proof. Empty or unavailable local data produces an empty state; the app does not seed fake candidates or transactions.

## Routes

- `/` — product overview
- `/register`, `/login`, `/onboarding` — local MVP account and profile flow
- `/challenge` — Challenge #001 and source artifact submission
- `/evaluation` — automated checks and optional AI evaluation
- `/profile` — Skill Profile and achievement controls
- `/employers` — local candidate search
- `/achievement/[credentialId]` — public credential record and Devnet proof check

## MVP data and security notes

- Account and profile handling are local demo flows, not production authentication.
- Profile, evaluation metadata, challenge status, and credential records use browser localStorage; source contents use IndexedDB.
- AI evaluation requires a server-side `OPENAI_API_KEY`. The API key is not sent to client components or stored with evaluation data.
- No fake evaluation results, wallet addresses, transaction signatures, or verified achievements are created by the app.
- Uploaded source code is untrusted text. It is not run, imported, installed, or passed to shell commands.
- Wallet private keys and seed phrases remain with the wallet and are never requested or stored by CH1KO.
- Solana integration supports Devnet only. No AI or blockchain service is called just by opening a page.
