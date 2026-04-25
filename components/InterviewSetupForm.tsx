"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createInterview } from "@/lib/actions/general.action";

interface InterviewSetupFormProps {
  userId: string;
}

const InterviewSetupForm = ({ userId }: InterviewSetupFormProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [isResumeConfirmed, setIsResumeConfirmed] = useState(false);
  const [form, setForm] = useState({
    role: "Software Engineer",
    level: "Mid-level",
    type: "Mixed",
    techstack: "JavaScript, TypeScript, React, Node.js",
    amount: 6,
    resumeText: "",
  });
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const supportedMimeTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const isValidResumeFile = (file: File) => {
    const lowerName = file.name.toLowerCase();
    return (
      supportedMimeTypes.includes(file.type) ||
      lowerName.endsWith(".pdf") ||
      lowerName.endsWith(".docx")
    );
  };

  const parseResumeFile = async (file: File) => {
    if (!isValidResumeFile(file)) {
      setError("Unsupported file type. Please upload PDF or DOCX.");
      return;
    }

    setError("");
    setStatusMessage("Parsing resume...");
    setIsParsingResume(true);
    setParseProgress(8);
    setIsResumeConfirmed(false);
    setResumeFile(file);

    let progress = 8;
    const timer = setInterval(() => {
      progress = Math.min(progress + 12, 90);
      setParseProgress(progress);
    }, 250);

    try {
      const body = new FormData();
      body.append("resume", file);

      const parseResponse = await fetch("/api/resume/parse", {
        method: "POST",
        body,
        credentials: "same-origin",
      });
      const parseResult = await parseResponse.json();

      if (parseResponse.status === 401) {
        setError("Please sign in to upload a resume.");
        setStatusMessage("");
        return;
      }
      if (parseResponse.status === 429) {
        setError(parseResult.message || "Daily AI usage limit reached.");
        setStatusMessage("");
        return;
      }

      if (!parseResult.success) {
        setError(parseResult.message || "Unable to parse resume file.");
        setStatusMessage("");
        return;
      }

      setForm((prev) => ({ ...prev, resumeText: parseResult.text || prev.resumeText }));
      setStatusMessage("Resume parsed. Please review and confirm to use it.");
      setParseProgress(100);
    } catch {
      setError("Unable to parse resume file right now. Please try again.");
      setStatusMessage("");
    } finally {
      clearInterval(timer);
      setIsParsingResume(false);
    }
  };

  const handleFileSelected = async (file: File | null) => {
    if (!file) return;
    await parseResumeFile(file);
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStatusMessage("");

    startTransition(async () => {
      if (resumeFile && !isResumeConfirmed) {
        setError("Please confirm parsed resume before creating the interview.");
        return;
      }

      const resumeText = form.resumeText.trim();
      setStatusMessage("Creating interview...");

      const result = await createInterview({
        userId,
        role: form.role,
        level: form.level,
        type: form.type,
        techstack: form.techstack,
        amount: form.amount,
        resumeText,
      });

      if (!result.success || !result.interviewId) {
        const message =
          "message" in result && typeof result.message === "string"
            ? result.message
            : "Unable to create interview. Please try again.";
        setError(message);
        setStatusMessage("");
        return;
      }

      router.push(`/interview/${result.interviewId}`);
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-2xl w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          className="input"
          placeholder="Role (e.g. Frontend Developer)"
          value={form.role}
          onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
          required
        />
        <input
          className="input"
          placeholder="Level (e.g. Junior, Senior)"
          value={form.level}
          onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))}
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          className="input"
          placeholder="Interview type (Technical / Behavioral / Mixed)"
          value={form.type}
          onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
          required
        />
        <input
          className="input"
          type="number"
          min={3}
          max={12}
          value={form.amount}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, amount: Number(event.target.value) || 6 }))
          }
          required
        />
      </div>

      <input
        className="input"
        placeholder="Tech stack (comma separated)"
        value={form.techstack}
        onChange={(event) => setForm((prev) => ({ ...prev, techstack: event.target.value }))}
        required
      />

      <textarea
        className="input min-h-40"
        placeholder="Optional resume text: skills, projects, achievements"
        value={form.resumeText}
        onChange={(event) => setForm((prev) => ({ ...prev, resumeText: event.target.value }))}
      />
      <div className="flex flex-col gap-2">
        <label className="text-sm text-light-100">
          Upload resume (PDF or DOCX)
        </label>
        <div
          className={`rounded-2xl border border-input p-4 text-sm transition-colors ${
            isDragging ? "bg-primary-200/20 border-primary-200" : "bg-dark-200"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={async (event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files?.[0] || null;
            await handleFileSelected(file);
          }}
        >
          <p>
            Drag & drop your resume here, or{" "}
            <button
              type="button"
              className="underline text-primary-200"
              onClick={() => fileInputRef.current?.click()}
            >
              browse files
            </button>
          </p>
          {resumeFile ? (
            <p className="mt-2 text-light-100">Selected file: {resumeFile.name}</p>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={async (event) => {
            const file = event.target.files?.[0] || null;
            await handleFileSelected(file);
          }}
        />
        {isParsingResume ? (
          <div className="w-full bg-dark-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-primary-200 transition-all duration-300"
              style={{ width: `${parseProgress}%` }}
            />
          </div>
        ) : null}
        {form.resumeText ? (
          <label className="flex items-center gap-2 text-sm text-light-100">
            <input
              type="checkbox"
              checked={isResumeConfirmed}
              onChange={(event) => setIsResumeConfirmed(event.target.checked)}
              disabled={!resumeFile}
            />
            I reviewed the parsed resume and want to use it for interview customization.
          </label>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {statusMessage ? <p className="text-sm text-light-100">{statusMessage}</p> : null}

      <button
        className="btn-primary w-fit px-8"
        disabled={isPending || isParsingResume}
        type="submit"
      >
        {isPending ? "Creating..." : "Start Custom Interview"}
      </button>
    </form>
  );
};

export default InterviewSetupForm;
