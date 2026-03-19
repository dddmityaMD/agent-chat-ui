"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { useQueryState } from "nuqs";
import { useStreamContext } from "@/providers/Stream";
import { usePermissionState } from "@/providers/Thread";
import { cn } from "@/lib/utils";
import { useCaseEvidenceState } from "@/hooks/useCaseEvidenceState";
import { getApiBaseUrl } from "@/lib/api-url";
import { useSaisUi } from "@/hooks/useSaisUi";
import { useAuth } from "@/providers/Auth";
import { TAB_CONFIG, TabTrigger } from "@/components/case-panel/tabs";
import type { TabValue } from "@/components/case-panel/tabs";
import { SummaryTab } from "@/components/case-panel/summary-tab";
import { CostTab } from "@/components/case-panel/cost-tab";
import { FlowTab } from "@/components/case-panel/flow-tab";
import { WorkspaceTab } from "@/components/case-panel/workspace-tab";
import { LINEAGE_NAVIGATE_EVENT } from "@/components/lineage-link";
import type { LineageNavigateDetail } from "@/components/lineage-link";

// ---------------------------------------------------------------------------
// Thread Summary types (local to this component, matches backend ThreadSummaryOut)
// ---------------------------------------------------------------------------

interface ThreadMeta {
  thread_id: string;
  workspace_id: string | null;
  title: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  last_activity_at: string;
  last_message_preview: string | null;
}

export interface ThreadSummary {
  thread: ThreadMeta;
  evidence: Array<Record<string, unknown>>;
  hypotheses: Array<Record<string, unknown>>;
  findings: Record<string, unknown> | null;
}

// Types for findings
interface RootCause {
  statement: string;
  confidence: number;
  evidence_ids: string[];
}

interface Observation {
  statement: string;
  evidence_ids: string[];
  confidence: number;
}

interface RecommendedFix {
  steps: string[];
  risks: string[];
  validation_steps: string[];
}

interface NextTest {
  test: string;
  why: string;
  tool_candidates: string[];
}

interface OpenQuestion {
  question: string;
  why_missing: string;
  tool_candidates: string[];
}

export interface Findings {
  root_cause: RootCause | null;
  key_observations: Observation[];
  rejected_hypotheses: any[];
  recommended_fix: RecommendedFix | null;
  recommended_next_tests: NextTest[];
  open_questions: OpenQuestion[];
}

// ---------------------------------------------------------------------------
// API helpers -- direct fetch from /api/threads
// ---------------------------------------------------------------------------

async function fetchThreadSummary(
  threadId: string,
  setSessionExpired: (expired: boolean) => void,
): Promise<ThreadSummary | null> {
  const res = await fetch(`${getApiBaseUrl()}/api/threads/${threadId}/summary`, { credentials: "include" });
  if (res.status === 401) { setSessionExpired(true); return null; }
  // Gracefully handle 404/500 for newly-created threads where registration
  // may not have completed yet (UX-06). Return null instead of throwing --
  // the summary will be fetched again when the stream completes.
  if (!res.ok) {
    console.warn(`[case-panel] Thread summary fetch returned ${res.status} for ${threadId}, returning empty`);
    return null;
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// CasePanel (thread-scoped)
// ---------------------------------------------------------------------------

interface CasePanelProps {
  className?: string;
  threadId?: string | null;
  onStartThread?: (projectId: string) => Promise<void>;
  currentThread?: import("@/lib/types").ThreadWithMeta | null;
}

export function CasePanel({ className, threadId: propThreadId, onStartThread, currentThread }: CasePanelProps) {
  const stream = useStreamContext();
  const { permissionState, revokePermissionGrant } = usePermissionState();
  const { setSessionExpired } = useAuth();
  const [threadId] = useQueryState("threadId");
  const saisUiData = useSaisUi();
  const [casePanelSection, setCasePanelSection] = useQueryState("casePanelSection");
  const [summary, setSummary] = useState<ThreadSummary | null>(null);
  const [findings, setFindings] = useState<Findings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0);
  const VALID_TABS: readonly TabValue[] = ["workspace", "summary", "flow", "cost"] as const;
  const [activeTab, setActiveTabState] = useState<TabValue>("workspace");
  // Read the deep-link tab from URL once (client-only, captured at module eval time)
  const deepLinkTabRef = useRef<TabValue | null>(null);
  const deepLinkConsumed = useRef(false);

  const setActiveTab = useCallback((tab: string | null) => {
    const value = tab ?? "workspace";
    const valid = VALID_TABS.includes(value as TabValue) ? (value as TabValue) : "workspace";
    setActiveTabState(valid);
    // Sync to URL
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (valid === "summary") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", valid);
      }
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // On mount, capture URL tab and apply it after hydration effects settle
  useEffect(() => {
    if (deepLinkConsumed.current) return;
    deepLinkConsumed.current = true;
    const raw = new URLSearchParams(window.location.search).get("tab");
    if (raw && VALID_TABS.includes(raw as TabValue)) {
      deepLinkTabRef.current = raw as TabValue;
      // Apply after all synchronous effects + nuqs hydration have settled
      requestAnimationFrame(() => {
        setActiveTabState(raw as TabValue);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [lineageFilter, setLineageFilter] = useState<{
    canonicalKeys: string[];
    displayNames: string[];
  } | null>(null);

  // Listen for lineage navigation events from AI messages (cross-component communication)
  useEffect(() => {
    function handleLineageNavigate(e: Event) {
      const detail = (e as CustomEvent<LineageNavigateDetail>).detail;
      if (detail?.canonicalKeys?.length > 0) {
        setLineageFilter({
          canonicalKeys: detail.canonicalKeys,
          displayNames: detail.displayNames,
        });
        setActiveTab("summary");
      }
    }
    window.addEventListener(LINEAGE_NAVIGATE_EVENT, handleLineageNavigate);
    return () => window.removeEventListener(LINEAGE_NAVIGATE_EVENT, handleLineageNavigate);
  }, []);

  // Clean slate experience: Track which evidence types user has requested
  const {
    requestedTypes,
    shouldShowMissingWarning,
    getMissingMessage,
    resetRequestedTypes,
    inferTypesFromIntent,
  } = useCaseEvidenceState();

  // Track loading->idle transitions to refetch only when stream completes
  const wasStreamingRef = useRef(false);
  const prevThreadIdRef = useRef(threadId);

  // Ref for saisUiData.raw to avoid doFetch identity churn on every stream update
  const saisUiRawRef = useRef(saisUiData.raw);
  saisUiRawRef.current = saisUiData.raw;

  const doFetch = useCallback(async (tid: string) => {
    setLoading(true);
    try {
      const s = await fetchThreadSummary(tid, setSessionExpired);
      if (!s) return; // 401 handled -- modal already showing
      setSummary(s);
      setFindings(s.findings as Findings | null);
      setError(null);

      const currentIntent = saisUiRawRef.current?.intent;
      if (typeof currentIntent === "string") {
        inferTypesFromIntent(currentIntent);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
      setSummary(null);
      setFindings(null);
    } finally {
      setLoading(false);
    }
  }, [inferTypesFromIntent, setSessionExpired]);

  useEffect(() => {
    if (!threadId) {
      setSummary(null);
      setFindings(null);
      setError(null);
      resetRequestedTypes();
      // Only reset tab when clearing a real thread, not on SSR→hydration
      if (prevThreadIdRef.current !== null) {
        setActiveTab(null);
      }
      setLineageFilter(null);
      prevThreadIdRef.current = threadId;
      return;
    }

    const threadChanged = threadId !== prevThreadIdRef.current;
    const streamJustFinished = wasStreamingRef.current && !stream.isLoading;

    if (stream.isLoading) {
      wasStreamingRef.current = true;
    }

    if (!threadChanged && !streamJustFinished) {
      if (summary !== null) return;
    }

    // Reset to summary tab and clear lineage filter when switching threads
    // Skip reset on SSR→hydration (null→real threadId) to preserve deep-linked tab
    if (threadChanged) {
      if (prevThreadIdRef.current !== null) {
        setActiveTab(null);
      }
      setLineageFilter(null);
    }

    if (streamJustFinished) {
      wasStreamingRef.current = false;
      setWorkspaceRefreshKey((k) => k + 1);
    }
    prevThreadIdRef.current = threadId;

    doFetch(threadId);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, stream.isLoading, resetRequestedTypes, doFetch]);

  useEffect(() => {
    if (casePanelSection !== "permissions") return;
    // Navigate to summary tab where permissions live, then scroll
    setActiveTab(null);
    // Permissions is inside a <details> — open it before scrolling
    const section = document.getElementById("permissions-section") as HTMLDetailsElement | null;
    if (section) {
      section.open = true;
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setCasePanelSection(null);
  }, [casePanelSection, setCasePanelSection]);

  // Auto-switch to Flow tab when any flow starts
  const prevFlowTypeRef = useRef<string | null>(null);
  useEffect(() => {
    const methodologyType = saisUiData.methodologyType;
    if (methodologyType && !prevFlowTypeRef.current) {
      // Defer to next frame so the Flow tab trigger is in the DOM
      // before Radix Tabs processes the value change.
      requestAnimationFrame(() => {
        setActiveTab("flow");
      });
    }
    prevFlowTypeRef.current = methodologyType;
  }, [saisUiData.methodologyType, setActiveTab]);

  const getBadgeCount = (_tabValue: string): number | undefined => {
    return undefined;
  };

  return (
    <div className={cn("h-full overflow-y-auto", className)}>
      <Tabs.Root
        value={activeTab}
        onValueChange={(v: string) => setActiveTab(v)}
        className="flex h-full flex-col"
      >
        {/* Tab bar — Workspace always visible, others only when thread active */}
        <Tabs.List
          className="flex shrink-0 gap-0 overflow-x-auto border-b px-2"
          aria-label="Thread details"
        >
          {TAB_CONFIG.filter((tab) =>
            tab.value === "workspace" || !!threadId
          ).map((tab) => (
            <TabTrigger
              key={tab.value}
              config={tab}
              badgeCount={getBadgeCount(tab.value)}
            />
          ))}
        </Tabs.List>

        {/* Tab content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Summary Tab */}
          <Tabs.Content value="summary" className="p-4">
            <SummaryTab
              threadId={threadId}
              summary={summary}
              loading={loading}
              error={error}
              permissionState={permissionState}
              revokePermissionGrant={revokePermissionGrant}
              stream={stream}
              lineageFilter={lineageFilter}
              setLineageFilter={setLineageFilter}
            />
          </Tabs.Content>

          {/* Flow Tab (universal flow tracker) */}
          <Tabs.Content value="flow" className="p-0">
            <FlowTab threadId={threadId} />
          </Tabs.Content>

          {/* Workspace Tab (agent workspace files / project selector) */}
          <Tabs.Content value="workspace" className="p-0 h-[calc(100vh-8rem)]">
            <WorkspaceTab
              threadId={threadId}
              refreshKey={workspaceRefreshKey}
              onStartThread={onStartThread ?? (async () => {})}
              currentThread={currentThread ?? null}
            />
          </Tabs.Content>

          {/* Cost Tab */}
          <Tabs.Content value="cost" className="p-4">
            <CostTab threadId={threadId ?? undefined} />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}

