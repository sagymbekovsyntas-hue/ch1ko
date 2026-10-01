"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { loginMockUser, registerMockUser } from "../lib/mock-auth";

type AuthFormProps = { mode: "login" | "register" };
type Errors = { email?: string; password?: string; confirmPassword?: string; form?: string };

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const registering = mode === "register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Errors = {};
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) nextErrors.email = "Enter your email address.";
    else if (registering && !validEmail(cleanEmail)) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";
    else if (registering && password.length < 8) nextErrors.password = "Use at least 8 characters.";
    if (registering && password !== confirmPassword) nextErrors.confirmPassword = "Your passwords do not match.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (registering) {
      registerMockUser(cleanEmail, password);
    } else {
      const result = loginMockUser(cleanEmail, password);
      if (result === "missing") {
        setErrors({ form: "No mock account exists yet. Create an account to continue." });
        return;
      }
      if (result === "invalid") {
        setErrors({ form: "That email and password do not match our mock account." });
        return;
      }
    }

    router.push("/onboarding");
  }

  function clearError(field: keyof Errors) {
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <div className="auth-field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => { setEmail(event.target.value); clearError("email"); }} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />
        {errors.email && <p className="field-error" id="email-error" role="alert">{errors.email}</p>}
      </div>
      <div className="auth-field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} placeholder="Enter your password" value={password} onChange={(event) => { setPassword(event.target.value); clearError("password"); }} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : undefined} />
        {errors.password && <p className="field-error" id="password-error" role="alert">{errors.password}</p>}
      </div>
      {registering && <div className="auth-field">
        <label htmlFor="confirmPassword">Confirm Password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Enter your password again" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); clearError("confirmPassword"); }} aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined} />
        {errors.confirmPassword && <p className="field-error" id="confirm-password-error" role="alert">{errors.confirmPassword}</p>}
      </div>}
      {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
      <button className="button auth-submit" type="submit">{registering ? "Create Account" : "Log In"}<span aria-hidden="true">-&gt;</span></button>
      <p className="auth-switch">{registering ? "Already have an account?" : "Don’t have an account?"} <Link href={registering ? "/login" : "/register"}>{registering ? "Log in" : "Create one"}</Link></p>
    </form>
  );
}

export function AuthPage({ mode }: AuthFormProps) {
  return <main className="auth-page"><section className="auth-card" aria-labelledby="auth-title">
    <Link className="auth-brand" href="/"><span className="brand-mark">C</span><span>CH1KO</span></Link>
    <p className="auth-eyebrow"><i /> PROOF OF SKILL</p>
    <h1 id="auth-title">{mode === "register" ? "Create your account." : "Welcome back."}</h1>
    <AuthForm mode={mode} />
    <Link className="back-link" href="/">← Back to CH1KO</Link>
    <p className="mock-note">MVP preview · Mock authentication stored in this browser</p>
  </section></main>;
}
