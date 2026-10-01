const USER_KEY = "ch1ko.mockUser";
const AUTH_KEY = "ch1ko.isAuthenticated";

type MockUser = { email: string; password: string };

export type MockProfile = {
  username: string;
  fullName: string;
  skill: string;
  experience: "Beginner" | "Intermediate" | "Advanced";
  education: "Student" | "College graduate" | "University graduate" | "Self-taught" | "Other";
  institution: string;
};

const PROFILE_KEY = "ch1ko.profile";

function readUser(): MockUser | null {
  try {
    const value = safeGet(USER_KEY);
    if (!value) return null;
    const user: unknown = JSON.parse(value);
    return typeof user === "object" && user !== null &&
      typeof (user as MockUser).email === "string" && typeof (user as MockUser).password === "string"
      ? user as MockUser
      : null;
  } catch {
    return null;
  }
}

export function registerMockUser(email: string, password: string): void {
  safeSet(USER_KEY, JSON.stringify({ email, password }));
  safeSet(AUTH_KEY, "true");
  safeRemove(PROFILE_KEY);
}

export function loginMockUser(email: string, password: string): "success" | "missing" | "invalid" {
  const user = readUser();
  if (!user) return "missing";
  if (user.email !== email || user.password !== password) return "invalid";
  safeSet(AUTH_KEY, "true");
  return "success";
}

export function isMockAuthenticated(): boolean {
  return safeGet(AUTH_KEY) === "true";
}

export function saveMockProfile(profile: MockProfile): void {
  safeSet(PROFILE_KEY, JSON.stringify(profile));
}

export function readMockProfile(): MockProfile | null {
  try {
    const value = safeGet(PROFILE_KEY);
    if (!value) return null;
    const profile: unknown = JSON.parse(value);
    if (typeof profile !== "object" || profile === null) return null;
    const candidate = profile as Partial<MockProfile>;
    return typeof candidate.username === "string" && typeof candidate.fullName === "string" &&
      typeof candidate.skill === "string" && typeof candidate.experience === "string" &&
      typeof candidate.education === "string" && typeof candidate.institution === "string"
      ? profile as MockProfile
      : null;
  } catch {
    return null;
  }
}

export function clearMockAuth(): void {
  safeRemove(AUTH_KEY);
}

function safeGet(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function safeSet(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); } catch { /* Keep the local MVP usable when storage is unavailable. */ }
}

function safeRemove(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}
