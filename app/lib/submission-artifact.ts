export type SubmissionArtifactFile = {
  path: string;
  name: string;
  extension: string;
  size: number;
  content: string;
};

export type SubmissionArtifact = {
  id: string;
  challengeId: "001";
  submittedAt: string;
  files: SubmissionArtifactFile[];
  totalFiles: number;
  totalBytes: number;
  sourceFiles: number;
  configurationFiles: number;
};

export type SubmissionArtifactMetadata = Pick<SubmissionArtifact, "id" | "totalFiles" | "totalBytes" | "sourceFiles" | "configurationFiles">;

export const ARTIFACT_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const ARTIFACT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".html", ".css", ".json"]);
const ignoredDirectories = new Set(["node_modules", ".next", ".git", "dist", "build", "coverage", "out", ".turbo", ".vercel", "__pycache__", ".cache", ".output", "storybook-static", "target", "playwright-report", "test-results"]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".html", ".css"]);

export type ArtifactSelectionResult = {
  files: SubmissionArtifactFile[];
  errors: string[];
  skipped: string[];
};

export async function readArtifactSelection(selected: FileList | File[], current: SubmissionArtifactFile[] = []): Promise<ArtifactSelectionResult> {
  const files = [...current];
  const errors: string[] = [];
  const skipped: string[] = [];

  for (const input of Array.from(selected)) {
    const extension = getExtension(input.name);
    if (extension !== ".zip" && !allowedExtensions.has(extension)) {
      errors.push(`${input.name}: unsupported file type. Choose a ZIP, TS, TSX, JS, JSX, HTML, CSS, or JSON file.`);
      continue;
    }
    if (input.size > ARTIFACT_MAX_FILE_BYTES) {
      errors.push(`${input.name}: exceeds the 2 MB per-file limit.`);
      continue;
    }

    const alreadySelectedBytes = files.reduce((total, file) => total + file.size, 0);

    if (extension === ".zip") {
      try {
        const extracted = await extractZip(input, Math.max(0, ARTIFACT_MAX_TOTAL_BYTES - alreadySelectedBytes));
        skipped.push(...extracted.skipped.map((path) => `${input.name}: skipped ${path}`));
        files.push(...extracted.files);
      } catch (error) {
        errors.push(`${input.name}: ${error instanceof Error ? error.message : "could not read this ZIP archive."}`);
      }
      continue;
    }

    if (alreadySelectedBytes + input.size > ARTIFACT_MAX_TOTAL_BYTES) {
      errors.push(`${input.name}: adding this file would exceed the 20 MB total submission limit.`);
      continue;
    }

    try {
      const bytes = new Uint8Array(await input.arrayBuffer());
      const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      files.push({ path: input.name, name: input.name, extension, size: input.size, content });
    } catch {
      errors.push(`${input.name}: could not be read as valid UTF-8 text.`);
    }
  }

  const seen = new Set<string>();
  const unique: SubmissionArtifactFile[] = [];
  for (const file of files) {
    const normalizedPath = file.path.replaceAll("\\", "/").toLowerCase();
    if (seen.has(normalizedPath)) {
      errors.push(`${file.path}: duplicate path. Remove or rename one of the files.`);
      continue;
    }
    seen.add(normalizedPath);
    unique.push(file);
  }

  const totalBytes = unique.reduce((total, file) => total + file.size, 0);
  if (totalBytes > ARTIFACT_MAX_TOTAL_BYTES) {
    return { files: current, errors: [...errors, "The extracted submission exceeds the 20 MB total limit. Remove some files and try again."], skipped };
  }
  if (unique.some((file) => file.size > ARTIFACT_MAX_FILE_BYTES)) {
    return { files: current, errors: [...errors, "One or more extracted files exceed the 2 MB per-file limit."], skipped };
  }
  return { files: unique, errors, skipped };
}

export function createSubmissionArtifact(files: SubmissionArtifactFile[]): SubmissionArtifact {
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  return {
    id: createArtifactId(),
    challengeId: "001",
    submittedAt: new Date().toISOString(),
    files,
    totalFiles: files.length,
    totalBytes,
    sourceFiles: files.filter((file) => sourceExtensions.has(file.extension)).length,
    configurationFiles: files.filter((file) => file.extension === ".json").length,
  };
}

export function formatArtifactSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

async function extractZip(archive: File, remainingBytes: number): Promise<{ files: SubmissionArtifactFile[]; skipped: string[] }> {
  const { unzipSync } = await import("fflate");
  const archiveBytes = new Uint8Array(await archive.arrayBuffer());
  const skipped: string[] = [];
  let expectedBytes = 0;
  let selectedCount = 0;
  let skippedCount = 0;

  let contents: Record<string, Uint8Array>;
  try {
    contents = unzipSync(archiveBytes, {
      filter: (entry) => {
        const path = safeArchivePath(entry.name);
        if (!path) {
          skipped.push(entry.name || "unnamed ZIP entry");
          skippedCount += 1;
          return false;
        }
        const extension = getExtension(path);
        const keep = !isIgnoredPath(path) && allowedExtensions.has(extension) &&
          (entry.compression === 0 || entry.compression === 8) &&
          entry.originalSize <= ARTIFACT_MAX_FILE_BYTES &&
          expectedBytes + entry.originalSize <= remainingBytes && selectedCount < 500;
        if (keep) {
          expectedBytes += entry.originalSize;
          selectedCount += 1;
        } else {
          skipped.push(entry.name || "unnamed ZIP entry");
          skippedCount += 1;
        }
        return keep;
      },
    });
  } catch {
    throw new Error("ZIP could not be safely extracted. Check that the archive is valid and not encrypted.");
  }

  if (skippedCount > 0 && skipped.length === 0) skipped.push(`${skippedCount} archive entries`);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const extracted: SubmissionArtifactFile[] = [];
  for (const [rawPath, bytes] of Object.entries(contents)) {
    const path = safeArchivePath(rawPath);
    if (!path || bytes.byteLength > ARTIFACT_MAX_FILE_BYTES) {
      skipped.push(rawPath);
      continue;
    }
    try {
      extracted.push({ path, name: path.split("/").at(-1) ?? path, extension: getExtension(path), size: bytes.byteLength, content: decoder.decode(bytes) });
    } catch {
      skipped.push(`${path} (binary or invalid UTF-8)`);
    }
  }
  return { files: extracted, skipped };
}

function safeArchivePath(path: string): string | null {
  const normalized = path.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized) || normalized.includes("\0")) return null;
  const segments = normalized.split("/");
  if (segments.some((part) => part === ".." || part === ".")) return null;
  if (normalized.endsWith("/")) return null;
  return normalized;
}

function isIgnoredPath(path: string): boolean {
  return path.split("/").some((segment) => ignoredDirectories.has(segment.toLowerCase()));
}

function createArtifactId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `artifact-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
