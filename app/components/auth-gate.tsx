"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { isMockAuthenticated, readMockProfile } from "../lib/mock-auth";

export function AuthGate({ children, needsProfile = false }: { children: ReactNode; needsProfile?: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
  }, [needsProfile, router]);

  if (!ready) return <main className="auth-page" aria-busy="true"><p className="auth-loading">Loading your profile…</p></main>;
  return children;
}
