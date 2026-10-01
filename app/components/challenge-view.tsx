"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { ProfileNav } from "./profile-nav";
import { ChallengeStatus } from "./challenge-status";
import {
  beginChallenge,
  markChallengeSubmitted,
  readTasks,
  writeTasks,
  type ChallengeStatus as Status,
  type TaskItem,
} from "../lib/challenge-storage";
import { createTaskRecord, deleteTaskById, getTaskListState, searchTasks, setTaskCompletion } from "../lib/task-logic";
import { isMockAuthenticated, readMockProfile } from "../lib/mock-auth";
import { ensureSubmissionForLegacy, readLatestSubmission, submitChallengeOnce, type ChallengeSubmission } from "../lib/submission-storage";
import { saveArtifact, getArtifact } from "../lib/artifact-storage";
import { SubmissionArtifactUploader } from "./submission-artifact-uploader";
import type { SubmissionArtifact } from "../lib/submission-artifact";

const requirements = [
  ["01", "Create tasks", "Users can create new tasks."],
  ["02", "Delete tasks", "Users can remove tasks."],
  ["03", "Complete tasks", "Users can mark tasks as completed and undo completion."],
  ["04", "Search", "Users can search and filter tasks."],
  ["05", "Responsive UI", "The application must work properly on desktop and mobile."],
  ["06", "Clean UX", "The interface should be clear, usable and visually polished."],
] as const;

const extras = ["Dark Mode", "Keyboard Shortcuts", "Task Priorities", "Due Dates", "Drag & Drop", "Empty State UX", "Animations / Micro-interactions", "Mobile-first improvements"];

export function ChallengeView() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("Not Started");
  const [submission, setSubmission] = useState<ChallengeSubmission | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksHydrated, setTasksHydrated] = useState(false);
  const [userId, setUserId] = useState("local-user");
  const [artifact, setArtifact] = useState<SubmissionArtifact | null>(null);
  const [artifactProcessing, setArtifactProcessing] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const initialStatus = beginChallenge();
    const initialTasks = readTasks();
    const username = readMockProfile()?.username ?? "local-user";
    const storedSubmission = initialStatus === "Submitted"
      ? ensureSubmissionForLegacy(username, initialTasks)
      : readLatestSubmission();
    if (storedSubmission) markChallengeSubmitted();
    setStatus(storedSubmission ? "Submitted" : initialStatus);
    setSubmission(storedSubmission);
    setUserId(username);
    setTasks(initialTasks);
    setTasksHydrated(true);
  }, []);

  useEffect(() => {
    if (tasksHydrated) writeTasks(tasks);
  }, [tasks, tasksHydrated]);

  async function handleSubmit(currentTasks: TaskItem[]) {
    if (!isMockAuthenticated()) {
      router.replace("/login");
      return;
    }
    const profile = readMockProfile();
    if (!profile) {
      router.replace("/onboarding");
      return;
    }
    const existingSubmission = readLatestSubmission();
    if (existingSubmission) {
      setSubmission(existingSubmission);
      setStatus("Submitted");
      router.push("/evaluation");
      return;
    }
    if (!artifact || artifact.totalFiles === 0) {
      setSubmitError("Upload your implementation before submitting.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    const stored = await saveArtifact(artifact);
    const verifiedArtifact = stored ? await getArtifact(artifact.id) : null;
    if (!verifiedArtifact) {
      setSubmitError("Your artifact could not be saved in this browser. Check IndexedDB availability and try again.");
      setSubmitting(false);
      return;
    }
    const savedSubmission = submitChallengeOnce(profile.username || userId, currentTasks, {
      id: verifiedArtifact.id,
      totalFiles: verifiedArtifact.totalFiles,
      totalBytes: verifiedArtifact.totalBytes,
      sourceFiles: verifiedArtifact.sourceFiles,
      configurationFiles: verifiedArtifact.configurationFiles,
    });
    setSubmission(savedSubmission);
    setStatus("Submitted");
    router.push("/evaluation");
  }

  return <div className="challenge-page"><ProfileNav active="challenge" />
    <main className="challenge-main">
      <ChallengeHeader status={status} />
      <div className="challenge-meta"><Meta label="Category" value="Software Development" /><Meta label="Difficulty" value="Intermediate" /><Meta label="Estimated time" value="60–90 minutes" /></div>
      <section className="challenge-section requirements-section"><SectionIntro eyebrow="THE BRIEF" title="What you’ll build" /><p className="challenge-description">Build a simple, responsive task management application that demonstrates your practical frontend development skills.</p><RequirementList /></section>
      <GoBeyond />
      <TaskManager tasks={tasks} setTasks={setTasks} tasksHydrated={tasksHydrated} />
      <SubmissionPanel status={status} submission={submission} tasks={tasks} tasksHydrated={tasksHydrated} artifact={artifact} onArtifactChange={setArtifact} onArtifactProcessing={setArtifactProcessing} artifactProcessing={artifactProcessing} submitError={submitError} submitting={submitting} onSubmit={handleSubmit} />
    </main>
  </div>;
}

export function ChallengeHeader({ status }: { status: Status }) {
  return <section className="challenge-hero"><div className="challenge-title-block"><p className="challenge-eyebrow"><i /> CHALLENGE #001 <span>·</span> PROOF OF SKILL</p><h1>Frontend Task Manager</h1><p className="challenge-deck">A practical frontend challenge to show how you plan, build, and refine a useful interface.</p></div><ChallengeStatus status={status} /></section>;
}

export function RequirementList() {
  return <ol className="requirement-grid">{requirements.map(([number, title, description]) => <li className="requirement-card" key={number}><span className="requirement-number">{number}</span><div><h3>{title}</h3><p>{description}</p></div><span className="requirement-check" aria-hidden="true">✓</span></li>)}</ol>;
}

export function GoBeyond() {
  return <section className="challenge-section go-beyond"><SectionIntro eyebrow="OPTIONAL IDEAS" title="Go Beyond" /><p className="challenge-description">Extra improvements can demonstrate initiative and creativity.</p><ul className="extra-list">{extras.map((extra) => <li key={extra}><span aria-hidden="true">+</span>{extra}</li>)}</ul><p className="optional-note">These are optional ideas. They don’t award points or affect a score.</p></section>;
}

export function TaskManager({ tasks, setTasks, tasksHydrated }: { tasks: TaskItem[]; setTasks: Dispatch<SetStateAction<TaskItem[]>>; tasksHydrated: boolean }) {
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const completedCount = tasks.filter((task) => task.completed).length;
  const visibleTasks = searchTasks(tasks, search);
  const listState = getTaskListState(tasks, search);

  function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Add a task name before creating it.");
      return;
    }
    const task = createTaskRecord(createTaskId(), cleanTitle, new Date().toISOString());
    setTasks((current) => [task, ...current]);
    setTitle("");
    setError("");
  }

  function toggleTask(id: string) {
    const target = tasks.find((task) => task.id === id);
    if (target) setTasks((current) => setTaskCompletion(current, id, !target.completed));
  }

  function deleteTask(id: string) {
    setTasks((current) => deleteTaskById(current, id));
  }

  return <section className="challenge-section task-workspace"><div className="workspace-heading"><SectionIntro eyebrow="BUILD IN THE BROWSER" title="Your Task Manager" /><span className="local-demo-label"><i /> LOCAL PREVIEW</span></div>
    <div className="task-app">
      <div className="task-app-top"><div><span className="task-app-mark">✓</span><div><h3>Today’s tasks</h3><p>A small workspace for your next steps.</p></div></div><span className="task-totals">{tasks.length} TASK{tasks.length === 1 ? "" : "S"} <i /> {completedCount} DONE</span></div>
      <form className="task-create" onSubmit={createTask}><label className="visually-hidden" htmlFor="new-task">New task</label><input id="new-task" value={title} onChange={(event) => { setTitle(event.target.value); setError(""); }} placeholder="What needs to get done?" aria-invalid={Boolean(error)} aria-describedby={error ? "new-task-error" : undefined} /><button className="button" type="submit">Add task <span aria-hidden="true">+</span></button></form>
      {error && <p className="field-error task-error" id="new-task-error" role="alert">{error}</p>}
      <div className="task-controls"><label htmlFor="task-search">Search tasks</label><input id="task-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a task..." /></div>
      {!tasksHydrated ? <p className="task-empty">Loading saved tasks…</p> : listState === "empty" ? <EmptyState title="A clear space to start." text="Add your first task above and start shaping your workspace." /> : listState === "no-results" ? <EmptyState title="No matching tasks." text="Try another search term to find a task." /> : <ul className="task-list">{visibleTasks.map((task) => <li className={`task-row ${task.completed ? "is-complete" : ""}`} key={task.id}><label className="task-check"><input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} /><span aria-hidden="true">✓</span><span className="visually-hidden">{task.completed ? "Mark incomplete" : "Mark complete"}: {task.title}</span></label><span className="task-title">{task.title}</span><time dateTime={task.createdAt}>{formatTaskDate(task.createdAt)}</time><button className="delete-task" type="button" onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`}>Delete</button></li>)}</ul>}
      <div className="task-app-footer"><span>{completedCount} of {tasks.length} completed</span><span>Saved in this browser</span></div>
    </div>
  </section>;
}

export function SubmissionPanel({ status, submission, tasks, tasksHydrated, artifact, onArtifactChange, onArtifactProcessing, artifactProcessing, submitError, submitting, onSubmit }: { status: Status; submission: ChallengeSubmission | null; tasks: TaskItem[]; tasksHydrated: boolean; artifact: SubmissionArtifact | null; onArtifactChange: (artifact: SubmissionArtifact | null) => void; onArtifactProcessing: (processing: boolean) => void; artifactProcessing: boolean; submitError: string; submitting: boolean; onSubmit: (tasks: TaskItem[]) => void }) {
  return <section className={`challenge-section submission-panel ${status === "Submitted" ? "is-submitted" : ""}`}><div className="submission-copy"><SectionIntro eyebrow="WHEN YOU’RE READY" title="Submit Your Challenge" /><p className="challenge-description">When you’re satisfied with your implementation, upload and submit it for evaluation. The Task Manager above is a local demo environment, not your submission.</p></div>{status === "Submitted" ? <div className="submission-success" role="status"><span className="success-mark">✓</span><div><h3>Challenge submitted.</h3><p>Preliminary automated checks complete.</p>{submission?.artifactSummary && <small>{submission.artifactSummary.totalFiles} artifact files received</small>}<Link className="submission-view-link" href="/evaluation">View Evaluation <span aria-hidden="true">-&gt;</span></Link></div></div> : <><SubmissionArtifactUploader artifact={artifact} onChange={onArtifactChange} onProcessing={onArtifactProcessing} locked={submitting} /><p className="artifact-submit-hint">{!artifact ? "Upload your implementation before submitting." : "✓ Submission artifact ready"}</p>{submitError && <p className="artifact-submit-error" role="alert">{submitError}</p>}<button className="button" type="button" disabled={!tasksHydrated || !artifact || submitting || artifactProcessing} onClick={() => onSubmit(tasks)}>{submitting ? "Saving artifact…" : "Submit Challenge"} <span aria-hidden="true">-&gt;</span></button></>}</section>;
}

function SectionIntro({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="section-intro"><p className="challenge-eyebrow"><i /> {eyebrow}</p><h2>{title}</h2></div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="challenge-meta-item"><span>{label}</span><b>{value}</b></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="task-empty-state"><span className="empty-icon" aria-hidden="true">＋</span><h4>{title}</h4><p>{text}</p></div>;
}

function createTaskId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatTaskDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Just added" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}
