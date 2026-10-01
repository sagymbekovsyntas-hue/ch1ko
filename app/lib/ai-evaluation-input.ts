import { ARTIFACT_MAX_FILE_BYTES, ARTIFACT_MAX_TOTAL_BYTES, type SubmissionArtifact } from "./submission-artifact";
import { prepareEvaluationInput, type EvaluationPreparation, type EvaluationSubmissionMetadata } from "./evaluation-preparation";
import type { AiEvaluationInputSummary } from "./ai-evaluation-types";

export const MAX_AI_SOURCE_BYTES = 128 * 1024;

const SOURCE_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js", ".html", ".css"]);
const CONFIG_EXTENSIONS = new Set([".json"]);
const IGNORED_SEGMENTS = new Set(["node_modules", ".next", ".git", "dist", "build", "coverage", "out", ".turbo", ".vercel", "__pycache__", ".cache", ".output", "storybook-static", "target", "playwright-report", "test-results"]);

export type AiIncludedFile = { path: string; extension: string; content: string };
export type PreparedAiRequest = Omit<EvaluationPreparation, "submittedFiles"> & { submittedFiles: AiIncludedFile[]; inputSummary: AiEvaluationInputSummary };

export function prepareBoundedEvaluationInput(submission: EvaluationSubmissionMetadata, artifact: SubmissionArtifact): PreparedAiRequest {
  const base = prepareEvaluationInput(submission, artifact);
  const filesExcluded: AiEvaluationInputSummary["filesExcluded"] = [];
  const truncatedFiles: string[] = [];
  const candidates: Array<{ file: SubmissionArtifact["files"][number]; priority: number; originalIndex: number }> = [];
  const seen = new Set<string>();

  for (let index = 0; index < artifact.files.length; index += 1) {
    const file = artifact.files[index];
    const path = normalizePath(file.path);
    const extension = path ? getExtension(path) : "";
    const key = path?.toLowerCase() ?? "";
    let reason = "";
    if (!path) reason = "Unsafe file path";
    else if (hasIgnoredSegment(path)) reason = "Generated or dependency directory";
    else if (!SOURCE_EXTENSIONS.has(extension) && !CONFIG_EXTENSIONS.has(extension)) reason = "Unsupported evaluation file type";
    else if (seen.has(key)) reason = "Duplicate path";
    else if (file.size > ARTIFACT_MAX_FILE_BYTES || new TextEncoder().encode(file.content).byteLength > ARTIFACT_MAX_FILE_BYTES) reason = "File exceeds the 2 MB limit";
    else if (!validTextFile(file.content)) reason = "Invalid text content";
    else {
      seen.add(key);
      candidates.push({ file, priority: SOURCE_EXTENSIONS.has(extension) ? 0 : 1, originalIndex: index });
    }
    if (reason) filesExcluded.push({ path: file.path.slice(0, 240), reason });
  }

  const artifactBytes = candidates.reduce((total, candidate) => total + new TextEncoder().encode(candidate.file.content).byteLength, 0);
  if (artifactBytes > ARTIFACT_MAX_TOTAL_BYTES) {
    return { ...base, submittedFiles: [], inputSummary: { filesIncluded: [], filesExcluded: artifact.files.map((file) => ({ path: file.path.slice(0, 240), reason: "Artifact exceeds the 20 MB evaluation limit" })), truncated: false, truncatedFiles: [], includedSourceBytes: 0, excludedFileCount: artifact.files.length } };
  }

  candidates.sort((a, b) => a.priority - b.priority || a.originalIndex - b.originalIndex);
  let remaining = MAX_AI_SOURCE_BYTES;
  let includedSourceBytes = 0;
  const submittedFiles: AiIncludedFile[] = [];
  for (const candidate of candidates) {
    const path = normalizePath(candidate.file.path) as string;
    const extension = getExtension(path);
    const contentBytes = new TextEncoder().encode(candidate.file.content);
    if (contentBytes.byteLength <= remaining) {
      submittedFiles.push({ path, extension, content: candidate.file.content });
      remaining -= contentBytes.byteLength;
      includedSourceBytes += contentBytes.byteLength;
      continue;
    }
    if (remaining >= 1024) {
      const truncatedContent = decodeUtf8Prefix(contentBytes, remaining);
      const usedBytes = new TextEncoder().encode(truncatedContent).byteLength;
      if (truncatedContent.trim()) {
        submittedFiles.push({ path, extension, content: truncatedContent });
        includedSourceBytes += usedBytes;
        remaining -= usedBytes;
        truncatedFiles.push(path);
        continue;
      }
    }
    filesExcluded.push({ path, reason: "Excluded when the AI source-content budget was reached" });
  }

  const inputSummary: AiEvaluationInputSummary = {
    filesIncluded: submittedFiles.map((file) => file.path),
    filesExcluded,
    truncated: truncatedFiles.length > 0,
    truncatedFiles,
    includedSourceBytes,
    excludedFileCount: filesExcluded.length,
  };
  return { ...base, submittedFiles, inputSummary };
}

export function validateArtifactForEvaluation(value: unknown): SubmissionArtifact | null {
  if (typeof value !== "object" || value === null) return null;
  const artifact = value as Partial<SubmissionArtifact>;
  if (artifact.challengeId !== "001" || typeof artifact.id !== "string" || artifact.id.length > 120 ||
      typeof artifact.submittedAt !== "string" || !Array.isArray(artifact.files) || artifact.files.length === 0 || artifact.files.length > 500) return null;
  let totalBytes = 0;
  for (const file of artifact.files) {
    if (typeof file?.path !== "string" || typeof file.name !== "string" || typeof file.extension !== "string" ||
        typeof file.content !== "string" || !Number.isSafeInteger(file.size) || file.size < 0 ||
        file.size > ARTIFACT_MAX_FILE_BYTES || new TextEncoder().encode(file.content).byteLength !== file.size ||
        !normalizePath(file.path) || file.extension !== getExtension(file.path)) return null;
    totalBytes += file.size;
    if (totalBytes > ARTIFACT_MAX_TOTAL_BYTES) return null;
  }
  if (artifact.totalFiles !== artifact.files.length || artifact.totalBytes !== totalBytes ||
      artifact.sourceFiles !== artifact.files.filter((file) => SOURCE_EXTENSIONS.has(file.extension)).length ||
      artifact.configurationFiles !== artifact.files.filter((file) => CONFIG_EXTENSIONS.has(file.extension)).length) return null;
  return artifact as SubmissionArtifact;
}

function normalizePath(path: string): string | null {
  const value = path.replaceAll("\\", "/");
  if (!value || value.startsWith("/") || /^[a-zA-Z]:/.test(value) || value.includes("\0")) return null;
  const segments = value.split("/");
  if (segments.some((segment) => segment === ".." || segment === ".")) return null;
  return value;
}

function hasIgnoredSegment(path: string): boolean {
  return path.split("/").some((segment) => IGNORED_SEGMENTS.has(segment.toLowerCase()));
}

function getExtension(path: string): string {
  const name = path.split("/").at(-1) ?? path;
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

function validTextFile(content: string): boolean {
  return !content.includes("\0");
}

function decodeUtf8Prefix(bytes: Uint8Array, limit: number): string {
  let text = new TextDecoder().decode(bytes.slice(0, limit));
  while (text.endsWith("\uFFFD")) text = text.slice(0, -1);
  return text;
}
