/**
 * Tests for useSaisUi hook and pure accessor functions.
 *
 * Phase 19 - TEST-04: Frontend component test coverage.
 *
 * Strategy: Test the pure accessor functions directly (no React context needed),
 * and test the hook via renderHook with a mock StreamContext provider.
 */

// Mock Stream provider to avoid transitive @langchain/langgraph-sdk import
// (ReadableStream not available in jsdom)
jest.mock("@/providers/Stream", () => ({
  useStreamContext: jest.fn(() => ({
    values: { messages: [], sais_ui: undefined },
  })),
}));

import {
  extractFlowType,
  extractBlockers,
  extractEvidence,
  extractConfidence,
  extractBuildPlan,
  extractBuildPlanStatus,
  extractBuildVerification,
  extractHandoffProposal,
  extractRemediationProposals,
  extractMultiIntent,
  extractMetadataResults,
  extractDisambiguation,
  extractResolutionSteps,
} from "../useSaisUi";

// ---------------------------------------------------------------------------
// Pure accessor function tests (no React context required)
// ---------------------------------------------------------------------------

describe("useSaisUi accessors", () => {
  describe("extractFlowType", () => {
    it("returns null for null input", () => {
      expect(extractFlowType(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(extractFlowType(undefined)).toBeNull();
    });

    it("returns null for non-object input", () => {
      expect(extractFlowType("string")).toBeNull();
    });

    it("returns null when active_flow is missing", () => {
      expect(extractFlowType({})).toBeNull();
    });

    it("returns null for empty string active_flow", () => {
      expect(extractFlowType({ active_flow: "" })).toBeNull();
    });

    it("returns flow type string", () => {
      expect(extractFlowType({ active_flow: "investigation" })).toBe("investigation");
    });

    it("returns catalog flow type", () => {
      expect(extractFlowType({ active_flow: "catalog" })).toBe("catalog");
    });

    it("returns build flow type", () => {
      expect(extractFlowType({ active_flow: "build" })).toBe("build");
    });
  });

  describe("extractBlockers", () => {
    it("returns empty array for null input", () => {
      expect(extractBlockers(null)).toEqual([]);
    });

    it("returns empty array for undefined input", () => {
      expect(extractBlockers(undefined)).toEqual([]);
    });

    it("returns empty array when blockers is not an array", () => {
      expect(extractBlockers({ blockers: "not-an-array" })).toEqual([]);
    });

    it("returns empty array when blockers array is empty", () => {
      expect(extractBlockers({ blockers: [] })).toEqual([]);
    });

    it("returns empty array when blockers have invalid shape", () => {
      expect(extractBlockers({ blockers: [{ type: "MISSING_ENTITY" }] })).toEqual([]);
    });

    it("returns valid blockers array", () => {
      const blockers = [
        {
          type: "MISSING_ENTITY",
          severity: "WARNING",
          message: "Entity not found",
          hint: "Check spelling",
        },
      ];
      expect(extractBlockers({ blockers })).toEqual(blockers);
    });

    it("returns multiple blockers", () => {
      const blockers = [
        { type: "MISSING_ENTITY", severity: "WARNING", message: "A", hint: "B" },
        { type: "LLM_ERROR", severity: "ERROR", message: "C", hint: "D" },
      ];
      expect(extractBlockers({ blockers })).toEqual(blockers);
    });
  });

  describe("extractEvidence", () => {
    it("returns empty array for null input", () => {
      expect(extractEvidence(null)).toEqual([]);
    });

    it("returns empty array when evidence is not an array", () => {
      expect(extractEvidence({ evidence: "not-array" })).toEqual([]);
    });

    it("returns evidence array", () => {
      const evidence = [{ type: "SQL_METADATA", data: {} }];
      expect(extractEvidence({ evidence })).toEqual(evidence);
    });
  });

  describe("extractConfidence", () => {
    it("returns null for null input", () => {
      expect(extractConfidence(null)).toBeNull();
    });

    it("returns null when confidence is not an object", () => {
      expect(extractConfidence({ confidence: "high" })).toBeNull();
    });

    it("returns confidence object", () => {
      const confidence = { level: "high", reason: "Multiple sources agree" };
      expect(extractConfidence({ confidence })).toEqual(confidence);
    });
  });

  describe("extractBuildPlan", () => {
    it("returns null for null input", () => {
      expect(extractBuildPlan(null)).toBeNull();
    });

    it("returns null when build_plan is missing", () => {
      expect(extractBuildPlan({})).toBeNull();
    });

    it("returns build plan object", () => {
      const plan = { plan_id: "p1", title: "Create model", steps: [] };
      expect(extractBuildPlan({ build_plan: plan })).toEqual(plan);
    });
  });

  describe("extractBuildPlanStatus", () => {
    it("returns null for null input", () => {
      expect(extractBuildPlanStatus(null)).toBeNull();
    });

    it("returns status string", () => {
      expect(extractBuildPlanStatus({ build_plan_status: "proposed" })).toBe("proposed");
    });

    it("returns null for non-string status", () => {
      expect(extractBuildPlanStatus({ build_plan_status: 123 })).toBeNull();
    });
  });

  describe("extractBuildVerification", () => {
    it("returns null for null input", () => {
      expect(extractBuildVerification(null)).toBeNull();
    });

    it("returns verification result", () => {
      const result = { status: "VERIFIED_FIXED", comparison_summary: "OK" };
      expect(extractBuildVerification({ build_verification_result: result })).toEqual(result);
    });
  });

  describe("extractHandoffProposal", () => {
    it("returns null for null input", () => {
      expect(extractHandoffProposal(null)).toBeNull();
    });

    it("returns null when handoff is not an object", () => {
      expect(extractHandoffProposal({ handoff: "string" })).toBeNull();
    });

    it("returns handoff object", () => {
      const handoff = { target_flow: "investigation", reason: "Need deeper analysis" };
      expect(extractHandoffProposal({ handoff })).toEqual(handoff);
    });
  });

  describe("extractRemediationProposals", () => {
    it("returns empty array for null input", () => {
      expect(extractRemediationProposals(null)).toEqual([]);
    });

    it("returns proposals array", () => {
      const proposals = [{ fix_id: "f1", title: "Add index" }];
      expect(extractRemediationProposals({ remediation_proposals: proposals })).toEqual(proposals);
    });
  });

  describe("extractMultiIntent", () => {
    it("returns null for null input", () => {
      expect(extractMultiIntent(null)).toBeNull();
    });

    it("returns multi intent object", () => {
      const mi = { intents: [], results: [], was_parallel: false };
      expect(extractMultiIntent({ multi_intent: mi })).toEqual(mi);
    });
  });

  describe("extractMetadataResults", () => {
    it("returns empty array for null input", () => {
      expect(extractMetadataResults(null)).toEqual([]);
    });

    it("returns metadata results array", () => {
      const results = [{ entity_type: "table", name: "users" }];
      expect(extractMetadataResults({ metadata_results: results })).toEqual(results);
    });
  });

  describe("extractDisambiguation", () => {
    it("returns null for null input", () => {
      expect(extractDisambiguation(null)).toBeNull();
    });

    it("returns disambiguation object", () => {
      const d = { mention: "users", candidates: [] };
      expect(extractDisambiguation({ disambiguation: d })).toEqual(d);
    });
  });

  describe("extractResolutionSteps", () => {
    it("returns null for null input", () => {
      expect(extractResolutionSteps(null)).toBeNull();
    });

    it("returns resolution steps object", () => {
      const steps = { type: "resolution_steps", steps: [] };
      expect(extractResolutionSteps({ resolution_steps: steps })).toEqual(steps);
    });
  });
});
