import { searchTasks, createTaskRecord, deleteTaskById, setTaskCompletion } from "./task-logic";
import type { TaskItem } from "./challenge-storage";

export type RequirementStatus = "PASSED" | "FAILED" | "REQUIRES_REVIEW";
export type InitiativeStatus = "DETECTED" | "NOT_DETECTED" | "REQUIRES_REVIEW";

export type RequirementResult = {
  id: string;
  name: string;
  description: string;
  status: RequirementStatus;
  details: string;
};

export type InitiativeSignal = {
  id: string;
  name: string;
  status: InitiativeStatus;
  details: string;
};

export type TechnicalResult = {
  label: "Automated Requirements Score";
  score: number;
  passed: number;
  automaticallyVerifiable: number;
  note: "Preliminary automated result — not the final CH1KO score.";
};

export type EvaluationResult = {
  evaluator: "ch1ko-local-rules-v1";
  status: RequirementStatus;
  requirements: RequirementResult[];
  initiative: InitiativeSignal[];
  technicalResult: TechnicalResult;
};

const reviewRequirements = [
  { id: "responsive-ui", name: "Responsive UI", description: "Requires application/source review." },
  { id: "clean-ux", name: "Clean UX", description: "Requires application/source review." },
] as const;

function validTasks(tasks: TaskItem[]): TaskItem[] {
  return tasks.filter((task) => task.id.trim().length > 0 && task.title.trim().length > 0 && typeof task.completed === "boolean" && !Number.isNaN(new Date(task.createdAt).getTime()));
}

function verifyTaskOperations(tasks: TaskItem[]) {
  const probe = createTaskRecord("evaluation-probe", "Evaluation probe", "2026-01-01T00:00:00.000Z");
  const createAvailable = probe.title === "Evaluation probe" && probe.completed === false;
  const deleteAvailable = deleteTaskById([probe], probe.id).length === 0;
  const completed = setTaskCompletion([probe], probe.id, true);
  const completionAvailable = completed[0]?.completed === true && setTaskCompletion(completed, probe.id, false)[0]?.completed === false;
  const searchAvailable = searchTasks([probe], "probe").length === 1 && searchTasks([probe], "missing").length === 0;
  const valid = validTasks(tasks);
  return { createAvailable, deleteAvailable, completionAvailable, searchAvailable, valid };
}

export function evaluateChallenge(tasks: TaskItem[]): EvaluationResult {
  const checks = verifyTaskOperations(tasks);
  const automaticallyVerifiable: RequirementResult[] = [
    { id: "create-tasks", name: "Create tasks", description: "Users can create new tasks.", status: checks.createAvailable && checks.valid.length > 0 ? "PASSED" : "FAILED", details: checks.valid.length > 0 ? `Found ${checks.valid.length} valid task${checks.valid.length === 1 ? "" : "s"} in the submitted workspace.` : "Add at least one valid task before submitting." },
    { id: "delete-tasks", name: "Delete tasks", description: "Users can remove tasks.", status: checks.deleteAvailable ? "PASSED" : "FAILED", details: checks.deleteAvailable ? "Task deletion behavior passed a local operation check." : "Task deletion behavior did not pass the local operation check." },
    { id: "complete-tasks", name: "Complete tasks", description: "Users can mark tasks as completed and undo completion.", status: checks.completionAvailable ? "PASSED" : "FAILED", details: checks.completionAvailable ? "Completion and undo behavior passed a local operation check." : "Task completion behavior did not pass the local operation check." },
    { id: "search", name: "Search", description: "Users can search and filter tasks.", status: checks.searchAvailable ? "PASSED" : "FAILED", details: checks.searchAvailable ? "Task search matched and excluded items in a local operation check." : "Task search behavior did not pass the local operation check." },
  ];
  const requirements: RequirementResult[] = [
    ...automaticallyVerifiable,
    ...reviewRequirements.map((requirement) => ({ ...requirement, status: "REQUIRES_REVIEW" as const, details: "Requires application/source review; this is not inferred from local task state." })),
  ];
  const passed = automaticallyVerifiable.filter((result) => result.status === "PASSED").length;
  const denominator = automaticallyVerifiable.length;
  const initiative = detectInitiativeSignals(checks.valid);
  const hasFailedRequirement = requirements.some((result) => result.status === "FAILED");
  const hasReviewRequirement = requirements.some((result) => result.status === "REQUIRES_REVIEW");
  const status: RequirementStatus = hasFailedRequirement
    ? "FAILED"
    : hasReviewRequirement
      ? "REQUIRES_REVIEW"
      : "PASSED";

  return {
    evaluator: "ch1ko-local-rules-v1",
    status,
    requirements,
    initiative,
    technicalResult: {
      label: "Automated Requirements Score",
      score: Math.round((passed / denominator) * 100),
      passed,
      automaticallyVerifiable: denominator,
      note: "Preliminary automated result — not the final CH1KO score.",
    },
  };
}

function detectInitiativeSignals(tasks: TaskItem[]): InitiativeSignal[] {
  void tasks;
  return [
    ...["dark-mode", "keyboard-shortcuts", "task-priorities", "due-dates", "drag-drop", "empty-state-ux", "micro-interactions"].map((id, index) => ({
      id,
      name: ["Dark Mode", "Keyboard Shortcuts", "Task Priorities", "Due Dates", "Drag & Drop", "Empty State UX", "Animations / Micro-interactions"][index],
      status: "REQUIRES_REVIEW" as const,
      details: "Local initiative signal only. This feature cannot be reliably verified from the candidate implementation in this MVP.",
    })),
    { id: "mobile-first", name: "Mobile-first improvements", status: "REQUIRES_REVIEW", details: "Local initiative signal only. Responsive behavior cannot be reliably verified from the candidate implementation in this MVP." },
  ];
}
