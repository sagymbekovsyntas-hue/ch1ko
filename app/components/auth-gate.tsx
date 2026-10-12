"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { isMockAuthenticated, readMockProfile } from "../lib/mock-auth";

export function AuthGate({ children, needsProfile = false }: { children: ReactNode; needsProfile?: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
    if (!active) return;
    if (!isMockAuthenticated()) {
      router.replace("/login");
      return;
    }

    const hasProfile = Boolean(readMockProfile());
    if (needsProfile && !hasProfile) {
      router.replace("/onboarding");
      return;
    }
    if (!needsProfile && hasProfile) {
      router.replace("/profile");
      return;
    }
    setReady(true);
    });
    return () => { active = false; };
  }, [needsProfile, router]);

  if (!ready) return <main className="auth-page" aria-busy="true"><p className="auth-loading">Loading your profile…</p></main>;
  return children;
}
