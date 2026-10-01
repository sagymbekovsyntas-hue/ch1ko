"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthGate } from "./auth-gate";
import { saveMockProfile, type MockProfile } from "../lib/mock-auth";

const steps = ["Basic", "Skill", "Experience", "Background"] as const;
const skills = ["Software Development", "UI/UX", "Data", "Cybersecurity", "Business"] as const;
const experienceLevels = ["Beginner", "Intermediate", "Advanced"] as const;
const educationOptions = ["Student", "College graduate", "University graduate", "Self-taught", "Other"] as const;

type FieldErrors = { username?: string; fullName?: string };

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<MockProfile>({
    username: "",
    fullName: "",
    skill: "Software Development",
    experience: "Beginner",
    education: "Student",
    institution: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  function updateProfile<K extends keyof MockProfile>(key: K, value: MockProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    if (key === "username" || key === "fullName") {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  function continueFromBasic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = profile.username.trim();
    const fullName = profile.fullName.trim();
    const nextErrors: FieldErrors = {};
    if (!username) nextErrors.username = "Choose a username to continue.";
    else if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) nextErrors.username = "Use 3–20 letters, numbers, or underscores.";
    if (!fullName) nextErrors.fullName = "Enter your full name to continue.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) setStep(1);
  }

  function finishOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMockProfile({ ...profile, username: profile.username.trim(), fullName: profile.fullName.trim(), institution: profile.institution.trim() });
    router.push("/profile");
  }

  return <AuthGate><main className="onboarding-page">
    <header className="onboarding-header"><div className="onboarding-brand"><span className="brand-mark">C</span><span>CH1KO</span></div><span className="onboarding-tag">PROOF OF SKILL</span></header>
    <section className="onboarding-content" aria-labelledby="onboarding-title">
      <div className="onboarding-intro"><p className="onboarding-kicker"><i /> YOUR CH1KO PROFILE</p><h1 id="onboarding-title">Build your skill profile.</h1><p>Tell us a little about yourself so we can understand what you want to prove.</p></div>
      <ol className="progress-steps" aria-label="Onboarding progress">{steps.map((label, index) => <li key={label} className={index === step ? "current" : index < step ? "complete" : ""} aria-current={index === step ? "step" : undefined}><span>{String(index + 1).padStart(2, "0")}</span><b>{label}</b></li>)}</ol>
      <section className="step-panel" aria-live="polite">
        {step === 0 && <form onSubmit={continueFromBasic} noValidate>
          <div className="step-heading"><span>STEP 01 / 04</span><h2>Let’s start with the basics.</h2></div>
          <div className="onboarding-fields">
            <div className="auth-field"><label htmlFor="username">Username</label><input id="username" value={profile.username} onChange={(event) => updateProfile("username", event.target.value)} placeholder="e.g. alex_builds" autoComplete="username" aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? "username-error" : "username-help"} />{errors.username ? <p className="field-error" id="username-error" role="alert">{errors.username}</p> : <p className="field-hint" id="username-help">3–20 characters · letters, numbers, and underscores</p>}</div>
            <div className="auth-field"><label htmlFor="fullName">Full Name</label><input id="fullName" value={profile.fullName} onChange={(event) => updateProfile("fullName", event.target.value)} placeholder="Your name" autoComplete="name" aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? "full-name-error" : undefined} />{errors.fullName && <p className="field-error" id="full-name-error" role="alert">{errors.fullName}</p>}</div>
          </div>
          <div className="step-actions"><span>About 2 minutes to complete</span><button className="button" type="submit">Continue <span aria-hidden="true">-&gt;</span></button></div>
        </form>}
        {step === 1 && <div><div className="step-heading"><span>STEP 02 / 04</span><h2>What do you want to prove?</h2><p>Choose the skill you want your profile to lead with.</p></div><div className="skill-options">{skills.map((skill) => <button className={`choice-card skill-choice ${profile.skill === skill ? "selected" : ""}`} type="button" key={skill} onClick={() => updateProfile("skill", skill)} aria-pressed={profile.skill === skill}><span>{skill}</span><i aria-hidden="true">{profile.skill === skill ? "✓" : ""}</i>{skill === "Software Development" && <small>RECOMMENDED FOR MVP</small>}</button>)}</div><p className="mvp-callout"><i />Software Development is the current MVP challenge category.</p><StepActions onBack={() => setStep(0)} onContinue={() => setStep(2)} /></div>}
        {step === 2 && <div><div className="step-heading"><span>STEP 03 / 04</span><h2>What&apos;s your experience level?</h2><p>There’s no wrong answer. This helps us understand where you’re starting from.</p></div><div className="experience-options">{experienceLevels.map((level, index) => <button className={`choice-card experience-choice ${profile.experience === level ? "selected" : ""}`} type="button" key={level} onClick={() => updateProfile("experience", level)} aria-pressed={profile.experience === level}><span className="experience-number">0{index + 1}</span><span className="experience-copy"><b>{level}</b><small>{["I’m just getting started.", "I’ve built some experience.", "I’m confident in my skills."][index]}</small></span><i aria-hidden="true">{profile.experience === level ? "✓" : ""}</i></button>)}</div><StepActions onBack={() => setStep(1)} onContinue={() => setStep(3)} /></div>}
        {step === 3 && <form onSubmit={finishOnboarding}>
          <div className="step-heading"><span>STEP 04 / 04</span><h2>Tell us about your background.</h2><p>Education is one part of your story. Formal education is not required to use CH1KO.</p></div>
          <div className="onboarding-fields"><div className="auth-field"><label htmlFor="education">Education status</label><select id="education" value={profile.education} onChange={(event) => updateProfile("education", event.target.value as MockProfile["education"])}>{educationOptions.map((education) => <option key={education}>{education}</option>)}</select></div><div className="auth-field"><label htmlFor="institution">Institution <span className="optional-label">OPTIONAL</span></label><input id="institution" value={profile.institution} onChange={(event) => updateProfile("institution", event.target.value)} placeholder="School, college, or university" /></div></div>
          <p className="education-note">Your practical skills matter here. A degree is never a requirement.</p>
          <div className="step-actions"><button type="button" className="text-button" onClick={() => setStep(2)}>← Back</button><button className="button" type="submit">Create My Profile <span aria-hidden="true">-&gt;</span></button></div>
        </form>}
      </section>
      <Link className="onboarding-back-home" href="/">← Back to CH1KO</Link>
    </section>
  </main></AuthGate>;
}

function StepActions({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return <div className="step-actions"><button type="button" className="text-button" onClick={onBack}>← Back</button><button type="button" className="button" onClick={onContinue}>Continue <span aria-hidden="true">-&gt;</span></button></div>;
}
