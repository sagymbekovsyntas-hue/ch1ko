import type { TaskItem } from "./challenge-storage";

export type TaskListState = "tasks" | "empty" | "no-results";

export function createTaskRecord(id: string, title: string, createdAt: string): TaskItem {
  return { id, title: title.trim(), completed: false, createdAt };
}

export function deleteTaskById(tasks: TaskItem[], id: string): TaskItem[] {
  return tasks.filter((task) => task.id !== id);
}

export function setTaskCompletion(tasks: TaskItem[], id: string, completed: boolean): TaskItem[] {
  return tasks.map((task) => task.id === id ? { ...task, completed } : task);
}

export function searchTasks(tasks: TaskItem[], query: string): TaskItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  return normalizedQuery ? tasks.filter((task) => task.title.toLowerCase().includes(normalizedQuery)) : tasks;
}

export function getTaskListState(tasks: TaskItem[], query: string): TaskListState {
  if (tasks.length === 0) return "empty";
  return searchTasks(tasks, query).length > 0 ? "tasks" : "no-results";
}
