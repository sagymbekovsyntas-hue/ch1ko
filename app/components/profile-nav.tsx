"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearMockAuth } from "../lib/mock-auth";

export function ProfileNav({ active }: { active?: "profile" | "challenge" | "evaluation" }) {
  const router = useRouter();

  function logOut() {
    clearMockAuth();
    router.push("/login");
  }

  return <header className="profile-header"><div className="profile-nav">
    <Link className="profile-nav-brand" href="/"><span className="brand-mark">C</span>CH1KO</Link>
    <nav aria-label="Profile navigation"><Link className={active === "challenge" ? "active" : undefined} aria-current={active === "challenge" ? "page" : undefined} href="/challenge">Challenge</Link><Link className={active === "evaluation" ? "active" : undefined} aria-current={active === "evaluation" ? "page" : undefined} href="/evaluation">Evaluation</Link><Link className={active === "profile" ? "active" : undefined} aria-current={active === "profile" ? "page" : undefined} href="/profile">Profile</Link><Link href="/employers">Find Talent</Link><button type="button" onClick={logOut}>Log out</button></nav>
  </div></header>;
}
