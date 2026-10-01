"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProfileNav } from "../components/profile-nav";
import { loadEmployerCandidates, type EmployerCandidate } from "../lib/employer-search-data";
import "./employers.css";

export default function EmployersPage() {
  const [candidates, setCandidates] = useState<EmployerCandidate[]>([]);
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("Any skill");
  const [minimumScore, setMinimumScore] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setCandidates(loadEmployerCandidates());
    });
    return () => { active = false; };
  }, []);

  const skills = useMemo(() => Array.from(new Set(candidates.map((candidate) => candidate.skill).filter(Boolean))).sort(), [candidates]);
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return candidates.filter((candidate) => {
      const matchesQuery = !needle || [candidate.username, candidate.fullName, candidate.skill, candidate.challengeTitle].some((value) => value.toLocaleLowerCase().includes(needle));
      return matchesQuery && (skill === "Any skill" || candidate.skill === skill) && candidate.overallScore >= minimumScore;
    });
  }, [candidates, minimumScore, query, skill]);

  return <div className="employers-page"><ProfileNav />
    <main className="employers-main">
      <header className="employers-heading"><p className="skill-profile-kicker">CH1KO · TALENT SEARCH</p><h1>Find Verified Talent</h1><p>Discover candidates through demonstrated skills and verified achievements.</p></header>
      <section className="employers-search" aria-label="Search candidates">
        <label className="employers-query"><span>Search candidates</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by skill, username, or challenge..." /></label>
        <label><span>Skill</span><select value={skill} onChange={(event) => setSkill(event.target.value)}><option>Any skill</option>{skills.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Minimum Score</span><select value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))}><option value={0}>Any</option><option value={60}>60+</option><option value={70}>70+</option><option value={80}>80+</option><option value={90}>90+</option></select></label>
      </section>
      <div className="employers-results-heading"><h2>Candidates</h2><span>{results.length} {results.length === 1 ? "profile" : "profiles"}</span></div>
      {results.length ? <section className="employer-candidate-grid" aria-label="Candidate results">{results.map((candidate) => <CandidateCard key={candidate.credentialId} candidate={candidate} />)}</section> : <section className="employers-empty"><span aria-hidden="true">⌕</span><h2>No candidates found</h2><p>Try another skill, username, or score.</p></section>}
      <p className="employers-data-note">Search uses candidate records saved in this browser. Public achievement pages check Solana Devnet proof independently.</p>
    </main>
  </div>;
}

function CandidateCard({ candidate }: { candidate: EmployerCandidate }) {
  const verified = candidate.verificationStatus === "VERIFIED";
  const verificationLabel = verified ? "Verified on Solana" : candidate.verificationStatus.replaceAll("_", " ");
  return <article className="employer-candidate-card">
    <div className="employer-card-top"><div><p className="skill-profile-kicker">CANDIDATE</p><h3>{candidate.username}</h3></div><span className={"employer-verification-badge" + (verified ? " verified" : "")}>{verificationLabel}</span></div>
    <p className="employer-skill">{candidate.skill}</p>
    <p className="employer-experience">{candidate.experience}</p>
    <div className="employer-score"><span>Overall Skill Score</span><strong>{candidate.overallScore}<small> / 100</small></strong></div>
    <dl className="employer-facts"><div><dt>Challenge</dt><dd>{candidate.challengeTitle}</dd></div><div><dt>Evaluation</dt><dd>{candidate.evaluationStatus}</dd></div><div><dt>Achievement</dt><dd>{verificationLabel}</dd></div></dl>
    <Link className="button employer-view-profile" href={"/achievement/" + encodeURIComponent(candidate.credentialId)}>View Profile <span aria-hidden="true">-&gt;</span></Link>
  </article>;
}
