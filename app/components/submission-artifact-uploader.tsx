"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { createSubmissionArtifact, formatArtifactSize, readArtifactSelection, type SubmissionArtifact, type SubmissionArtifactFile } from "../lib/submission-artifact";

const ACCEPTED_TYPES = ".zip,.ts,.tsx,.js,.jsx,.html,.css,.json";

export function SubmissionArtifactUploader({ artifact, onChange, onProcessing, locked = false }: { artifact: SubmissionArtifact | null; onChange: (artifact: SubmissionArtifact | null) => void; onProcessing?: (processing: boolean) => void; locked?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function addFiles(files: FileList | File[]) {
    if (locked || processing) return;
    setErrors([]);
    setSkipped([]);
    setProcessing(true);
    onProcessing?.(true);
    try {
      const result = await readArtifactSelection(files, artifact?.files ?? []);
      setErrors(result.errors);
      setSkipped(result.skipped);
      onChange(result.files.length ? createSubmissionArtifact(result.files) : null);
    } catch {
      setErrors(["Files could not be processed. Try selecting them again."]);
    } finally {
      setProcessing(false);
      onProcessing?.(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) void addFiles(event.target.files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
  }

  function removeFile(path: string) {
    if (!artifact || locked) return;
    const files = artifact.files.filter((file) => file.path !== path);
    onChange(files.length ? createSubmissionArtifact(files) : null);
  }

  return <section className="artifact-uploader" aria-labelledby="artifact-title">
    <div className="artifact-heading"><div><p className="challenge-eyebrow"><i /> SUBMISSION ARTIFACT</p><h3 id="artifact-title">Upload your implementation</h3></div>{artifact && <span className="artifact-ready"><i /> SUBMISSION ARTIFACT READY</span>}</div>
    <p className="artifact-description">Upload the implementation you built for this challenge. Your uploaded files will be used for technical evaluation.</p>
    <p className="artifact-description">Upload the project or source files you built for Challenge #001.</p>
    <div className={`artifact-dropzone ${dragging ? "is-dragging" : ""} ${locked ? "is-locked" : ""}`} onDragEnter={(event) => { event.preventDefault(); if (!locked) setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={handleDrop}>
      <span className="artifact-upload-icon" aria-hidden="true">↑</span>
      <strong>{processing ? "Reading your files…" : "Drop your project files here"}</strong>
      <span>ZIP, TS, TSX, JS, JSX, HTML, CSS, or JSON · Up to 2 MB per file · 20 MB total</span>
      <input ref={inputRef} className="artifact-file-input" type="file" accept={ACCEPTED_TYPES} multiple disabled={locked || processing} onChange={handleFileChange} aria-label="Choose submission files" />
      <button type="button" className="artifact-browse" disabled={locked || processing} onClick={() => inputRef.current?.click()}>Browse files</button>
    </div>
    {errors.length > 0 && <ul className="artifact-messages artifact-errors" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    {skipped.length > 0 && <div className="artifact-messages artifact-skipped" role="status"><strong>Skipped ZIP entries (not evaluated):</strong><ul>{skipped.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}
    {artifact ? <>
      <div className="artifact-summary"><div className="artifact-summary-top"><div><span className="artifact-check">✓</span><div><strong>Submission Ready</strong><p>Your implementation is ready to submit.</p></div></div><span>{artifact.totalFiles} FILE{artifact.totalFiles === 1 ? "" : "S"}</span></div><div className="artifact-summary-stats"><SummaryStat label="Files" value={String(artifact.totalFiles)} /><SummaryStat label="Total size" value={formatArtifactSize(artifact.totalBytes)} /><SummaryStat label="Source files" value={String(artifact.sourceFiles)} /><SummaryStat label="Configuration files" value={String(artifact.configurationFiles)} /></div></div>
      <div className="artifact-file-list"><div className="artifact-file-list-heading"><strong>Submission files</strong><span>{artifact.totalFiles} total</span></div><ul>{artifact.files.map((file) => <ArtifactFileRow file={file} key={file.path} locked={locked} onRemove={() => removeFile(file.path)} />)}</ul></div>
    </> : <p className="artifact-empty">Upload your implementation before submitting.</p>}
  </section>;
}

function ArtifactFileRow({ file, locked, onRemove }: { file: SubmissionArtifactFile; locked: boolean; onRemove: () => void }) {
  return <li><span className="artifact-file-check" aria-hidden="true">✓</span><span className="artifact-file-name" title={file.path}>{file.path}</span><small>{formatArtifactSize(file.size)}</small><button type="button" onClick={onRemove} disabled={locked} aria-label={`Remove ${file.path}`}>Remove</button></li>;
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
