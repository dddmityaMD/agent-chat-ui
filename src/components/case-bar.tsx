"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { useCases } from "@/providers/Cases";
import { useStreamContext } from "@/providers/Stream";
import { toast } from "sonner";

type ResumeAttempt = {
  caseId: string;
  triedThreadId: string | null;
  startedAt: number;
  stage: "attempt" | "fallback" | "done";
};

export function CaseBar() {
  const { cases, createCase, deleteCase, refresh } = useCases();
  const stream = useStreamContext();

  const [caseId, setCaseId] = useQueryState("caseId");
  const [threadId, setThreadId] = useQueryState("threadId");

  const [resumeAttempt, setResumeAttempt] = useState<ResumeAttempt | null>(null);

  const selected = useMemo(
    () => cases.find((c) => c.case_id === caseId) ?? null,
    [cases, caseId],
  );

  useEffect(() => {
    if (!resumeAttempt) return;
    if (resumeAttempt.stage !== "attempt") return;
    if (!stream.error) return;

    const withinWindow = Date.now() - resumeAttempt.startedAt < 12_000;
    const threadMatches = (threadId ?? null) === resumeAttempt.triedThreadId;
    if (!withinWindow || !threadMatches) return;

    // Fallback: clear threadId to force new thread creation.
    setResumeAttempt({ ...resumeAttempt, stage: "fallback" });
    setThreadId(null);

    setTimeout(() => {
      stream.submit(
        { case_id: resumeAttempt.caseId, messages: [] },
        { streamMode: ["values"], streamResumable: true },
      );
      setResumeAttempt({ ...resumeAttempt, stage: "done" });
    }, 50);
  }, [resumeAttempt, setThreadId, stream, threadId]);

  const onNewCase = async () => {
    const title = window.prompt("Case title (optional):", "");
    try {
      const row = await createCase(title ?? "");
      setCaseId(row.case_id);
      setThreadId(null);
      toast.success("Case created");
    } catch (e) {
      toast.error("Failed to create case");
    }
  };

  const onDelete = async () => {
    if (!selected) {
      toast.message("Select a case first");
      return;
    }
    const ok = window.confirm(
      `Delete case? This cannot be undone.\n\n${selected.title || selected.case_id}`,
    );
    if (!ok) return;
    try {
      await deleteCase(selected.case_id);
      setCaseId(null);
      setThreadId(null);
      toast.success("Case deleted");
    } catch {
      toast.error("Failed to delete case");
    }
  };

  const onResume = async () => {
    if (!selected) {
      toast.message("Select a case first");
      return;
    }

    const preferredThreadId = selected.last_thread_id ?? null;
    setThreadId(preferredThreadId);

    setResumeAttempt({
      caseId: selected.case_id,
      triedThreadId: preferredThreadId,
      startedAt: Date.now(),
      stage: "attempt",
    });

    // Inject case_id regardless of thread reuse.
    stream.submit(
      { case_id: selected.case_id, messages: [] },
      { streamMode: ["values"], streamResumable: true },
    );
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Case</label>
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={caseId ?? ""}
          onChange={(e) => setCaseId(e.target.value || null)}
        >
          <option value="">(none)</option>
          {cases.map((c) => (
            <option key={c.case_id} value={c.case_id}>
              {c.title ? c.title : c.case_id.slice(0, 8)} [{c.status}]
            </option>
          ))}
        </select>
      </div>

      <Button variant="secondary" size="sm" onClick={() => refresh()}>
        Refresh
      </Button>
      <Button variant="secondary" size="sm" onClick={onResume}>
        Resume
      </Button>
      <Button variant="default" size="sm" onClick={onNewCase}>
        New Case
      </Button>
      <Button variant="destructive" size="sm" onClick={onDelete}>
        Delete
      </Button>
    </div>
  );
}
