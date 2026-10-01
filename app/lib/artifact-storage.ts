import { ARTIFACT_MAX_FILE_BYTES, ARTIFACT_MAX_TOTAL_BYTES, type SubmissionArtifact } from "./submission-artifact";

const DATABASE_NAME = "ch1ko-submission-artifacts";
const STORE_NAME = "artifacts";
const DATABASE_VERSION = 1;

export async function saveArtifact(artifact: SubmissionArtifact): Promise<boolean> {
  const database = await openArtifactDatabase();
  if (!database) return false;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(artifact);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return true;
  } catch {
    return false;
  } finally {
    database.close();
  }
}

export async function getArtifact(id: string): Promise<SubmissionArtifact | null> {
  const database = await openArtifactDatabase();
  if (!database) return null;
  try {
    return await new Promise<SubmissionArtifact | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(isSubmissionArtifact(request.result) ? request.result : null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  } finally {
    database.close();
  }
}

export async function deleteArtifact(id: string): Promise<boolean> {
  const database = await openArtifactDatabase();
  if (!database) return false;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return true;
  } catch {
    return false;
  } finally {
    database.close();
  }
}

function openArtifactDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function isSubmissionArtifact(value: unknown): value is SubmissionArtifact {
  if (typeof value !== "object" || value === null) return false;
  const artifact = value as Partial<SubmissionArtifact>;
  if (!(typeof artifact.id === "string" && artifact.challengeId === "001" &&
    typeof artifact.submittedAt === "string" && Array.isArray(artifact.files) &&
    artifact.files.every((file) => typeof file?.path === "string" && typeof file.name === "string" &&
      typeof file.extension === "string" && Number.isSafeInteger(file.size) && file.size >= 0 &&
      file.size <= ARTIFACT_MAX_FILE_BYTES && typeof file.content === "string" && !file.path.startsWith("/") &&
      !file.path.split(/[\\/]/).some((segment) => segment === ".." || segment === ".")) &&
    artifact.totalFiles === artifact.files.length && typeof artifact.totalBytes === "number" && Number.isSafeInteger(artifact.totalBytes) &&
    artifact.totalBytes >= 0 && artifact.totalBytes <= ARTIFACT_MAX_TOTAL_BYTES &&
    Number.isSafeInteger(artifact.sourceFiles) && Number.isSafeInteger(artifact.configurationFiles))) return false;
  return artifact.files.reduce((total, file) => total + file.size, 0) === artifact.totalBytes &&
    artifact.files.length <= 500;
}
