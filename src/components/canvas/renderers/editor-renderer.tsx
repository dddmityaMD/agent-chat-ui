"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { MarkdownText } from "@/components/thread/markdown-text";
import type { EditorContentData } from "@/stores/canvas-store";
import { getApiBaseUrl } from "@/lib/api-url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditorRendererProps {
  data: unknown;
}

function isEditorData(v: unknown): v is EditorContentData {
  return (
    v != null &&
    typeof v === "object" &&
    "content" in v &&
    typeof (v as EditorContentData).content === "string" &&
    "filePath" in v &&
    typeof (v as EditorContentData).filePath === "string" &&
    "projectId" in v &&
    typeof (v as EditorContentData).projectId === "string"
  );
}

/** Infer language from file extension for CodeMirror */
function inferLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "md":
    case "markdown":
      return "markdown";
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "json":
      return "javascript";
    case "sql":
      return "sql";
    default:
      return "markdown";
  }
}

// ---------------------------------------------------------------------------
// Lazy CodeMirror component (avoid SSR issues)
// ---------------------------------------------------------------------------

function LazyCodeMirror({
  value,
  language,
  onChange,
}: {
  value: string;
  language: string;
  onChange: (val: string) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [CM, setCM] = useState<{ Component: any; extensions: any[] } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [cm, langMd, langJs, langSql] = await Promise.all([
        import("@uiw/react-codemirror"),
        import("@codemirror/lang-markdown"),
        import("@codemirror/lang-javascript"),
        import("@codemirror/lang-sql"),
      ]);

      if (!mounted) return;

      const ext =
        language === "sql"
          ? [langSql.sql()]
          : language === "javascript"
            ? [langJs.javascript({ jsx: true, typescript: true })]
            : [langMd.markdown()];

      setCM({ Component: cm.default, extensions: ext });
    }

    load();
    return () => { mounted = false; };
  }, [language]);

  if (!CM) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-zinc-400">
        Loading editor...
      </div>
    );
  }

  const { Component, extensions } = CM;

  return (
    <Component
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="dark"
      basicSetup
      className="h-full text-sm"
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditorRenderer({ data }: EditorRendererProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const originalContentRef = useRef("");

  if (!isEditorData(data)) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        No file data to display
      </div>
    );
  }

  const { content, filePath, projectId, language: langHint } = data;
  const language = langHint ?? inferLanguage(filePath);
  const filename = filePath.split("/").pop() ?? filePath;
  const isMarkdown = language === "markdown";

  // Initialize original content ref
  if (originalContentRef.current === "" && content) {
    originalContentRef.current = content;
  }

  const isDirty = editing && editContent !== originalContentRef.current;

  const startEditing = useCallback(() => {
    setEditContent(content);
    originalContentRef.current = content;
    setEditing(true);
    setSaveError(null);
  }, [content]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setEditContent("");
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/workspace/projects/${projectId}/files/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content: editContent }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(body.detail ?? `Save failed (${res.status})`);
      }

      // Mark clean — update the original ref
      originalContentRef.current = editContent;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [editContent, filePath, projectId, saving]);

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    if (!editing) return;

    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, handleSave]);

  return (
    <div className="flex h-full flex-col" data-testid="editor-renderer">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-200">
            {filename}
          </span>
          {isDirty && (
            <span className="text-amber-500" title="Unsaved changes">*</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {saveError && (
            <span className="text-xs text-red-500">{saveError}</span>
          )}

          {!editing ? (
            <button
              type="button"
              onClick={startEditing}
              className="flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="flex items-center gap-1.5 rounded border border-blue-400 bg-blue-500 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {editing ? (
          <LazyCodeMirror
            value={editContent}
            language={language}
            onChange={setEditContent}
          />
        ) : isMarkdown ? (
          <div className="prose prose-sm dark:prose-invert max-w-none p-6">
            <MarkdownText>{content}</MarkdownText>
          </div>
        ) : (
          <pre className="p-4 text-sm text-zinc-700 dark:text-zinc-300">
            <code>{content}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
