export type ChallengeStatus = "Not Started" | "In Progress" | "Submitted";

export type TaskItem = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
};

const TASKS_KEY = "ch1ko.challenge001.tasks";
const STATUS_KEY = "ch1ko.challenge001.status";

export function readTasks(): TaskItem[] {
  try {
    const value = window.localStorage.getItem(TASKS_KEY);
    const tasks: unknown = value ? JSON.parse(value) : [];
    if (!Array.isArray(tasks)) return [];
    return tasks.filter((task): task is TaskItem =>
      typeof task === "object" && task !== null &&
      typeof task.id === "string" && typeof task.title === "string" &&
      typeof task.completed === "boolean" && typeof task.createdAt === "string",
    );
  } catch {
    return [];
  }
}

export function writeTasks(tasks: TaskItem[]): void {
  try { window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch { /* Keep the challenge usable without persistence. */ }
}

export function readChallengeStatus(): ChallengeStatus {
  try {
    const value = window.localStorage.getItem(STATUS_KEY);
    return value === "In Progress" || value === "Submitted" ? value : "Not Started";
  } catch {
    return "Not Started";
  }
}

export function beginChallenge(): ChallengeStatus {
  const current = readChallengeStatus();
  if (current === "Not Started") {
    try { window.localStorage.setItem(STATUS_KEY, "In Progress"); } catch { /* Continue with an in-memory challenge state. */ }
  }
  return current === "Not Started" ? "In Progress" : current;
}

export function markChallengeSubmitted(): void {
  try { window.localStorage.setItem(STATUS_KEY, "Submitted"); } catch { /* Submission state remains in the current view. */ }
}
