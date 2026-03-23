/**
 * Deep link URL generation and metadata for source systems.
 *
 * This is the single source of truth for deep-link type metadata:
 * detection, icon, label, and URL generation. Frontend components
 * should import from here rather than maintaining their own mappings.
 */

import {
  BarChart2,
  Layers,
  GitBranchIcon,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";

/**
 * Types of deep links supported by the system
 */
export type DeepLinkType =
  | "metabase_card"
  | "metabase_dashboard"
  | "dbt_model"
  | "dbt_source"
  | "dbt_test"
  | "dbt_docs"
  | "git_commit"
  | "git_file";

/**
 * Configuration for deep link generation
 */
export interface DeepLinkConfig {
  metabaseBaseUrl?: string;
  dbtDocsBaseUrl?: string;
  gitRepoUrl?: string;
  gitBranch?: string;
}

/**
 * Default configuration values from environment or fallbacks
 */
function getDefaultConfig(): DeepLinkConfig {
  return {
    metabaseBaseUrl:
      typeof window !== "undefined"
        ? (process.env.NEXT_PUBLIC_METABASE_URL ?? "http://localhost:3001")
        : "http://localhost:3001",
    dbtDocsBaseUrl:
      typeof window !== "undefined"
        ? (process.env.NEXT_PUBLIC_DBT_DOCS_URL ?? "")
        : "",
    gitRepoUrl:
      typeof window !== "undefined"
        ? (process.env.NEXT_PUBLIC_GIT_REPO_URL ?? "")
        : "",
    gitBranch: "main",
  };
}

/**
 * Generate a Metabase URL for cards or dashboards.
 *
 * @param type - 'card' or 'dashboard'
 * @param id - The numeric ID of the card or dashboard
 * @param baseUrl - Optional override for Metabase base URL
 * @returns Full URL to the Metabase resource
 *
 * @example
 * generateMetabaseUrl('card', 123)
 * // => "http://localhost:3001/card/123"
 *
 * generateMetabaseUrl('dashboard', 5, 'https://bi.example.com')
 * // => "https://bi.example.com/dashboard/5"
 */
export function generateMetabaseUrl(
  type: "card" | "dashboard",
  id: number | string,
  baseUrl?: string,
): string {
  const config = getDefaultConfig();
  const base = baseUrl || config.metabaseBaseUrl || "";

  // Remove trailing slash from base URL
  const normalizedBase = base.replace(/\/+$/, "");

  return `${normalizedBase}/${type}/${id}`;
}

/**
 * Generate a dbt documentation URL for models, sources, or tests.
 *
 * @param type - 'model', 'source', or 'test'
 * @param name - The name of the dbt resource (e.g., 'stg_customers')
 * @param project - Optional dbt project name for multi-project setups
 * @returns Full URL to the dbt documentation
 *
 * @example
 * generateDbtUrl('model', 'stg_customers')
 * // => "http://localhost:8080/#!/model/stg_customers"
 *
 * generateDbtUrl('source', 'raw.customers', 'analytics')
 * // => "http://localhost:8080/#!/source/raw.customers"
 */
export function generateDbtUrl(
  type: "model" | "source" | "test",
  name: string,
  project?: string,
): string {
  const config = getDefaultConfig();
  const base = config.dbtDocsBaseUrl || "";

  if (!base) {
    return "";
  }

  const normalizedBase = base.replace(/\/+$/, "");

  // dbt docs uses hash-based routing
  const path = project ? `#!/${type}/${project}.${name}` : `#!/${type}/${name}`;

  return `${normalizedBase}/${path}`;
}

/**
 * Generate a Git URL for commits or files.
 *
 * @param type - 'commit' or 'file'
 * @param ref - The git reference (commit SHA for commits, commit SHA or branch for files)
 * @param repoUrl - Optional override for Git repository URL
 * @param filePath - Required for 'file' type, the path to the file
 * @returns Full URL to the Git resource
 *
 * @example
 * generateGitUrl('commit', 'abc123def')
 * // => "https://github.com/org/repo/commit/abc123def"
 *
 * generateGitUrl('file', 'main', undefined, 'src/models/users.sql')
 * // => "https://github.com/org/repo/blob/main/src/models/users.sql"
 */
export function generateGitUrl(
  type: "commit" | "file",
  ref: string,
  repoUrl?: string,
  filePath?: string,
): string {
  const config = getDefaultConfig();
  const base = repoUrl || config.gitRepoUrl || "";

  if (!base) {
    return "";
  }

  const normalizedBase = base.replace(/\/+$/, "");

  if (type === "commit") {
    return `${normalizedBase}/commit/${ref}`;
  }

  // For files, use blob path
  const branch = ref || config.gitBranch || "main";
  return `${normalizedBase}/blob/${branch}/${filePath || ""}`;
}

// ---------------------------------------------------------------------------
// Deep-link registry — single source of truth for type metadata
// ---------------------------------------------------------------------------

interface DeepLinkEntry {
  /** Lucide icon component for this deep-link type. */
  icon: LucideIcon;
  /** Human-readable label (e.g. "Metabase Card", "dbt Model"). */
  label: string;
}

const DEEP_LINK_REGISTRY: Record<DeepLinkType, DeepLinkEntry> = {
  metabase_card: { icon: BarChart2, label: "Metabase Card" },
  metabase_dashboard: { icon: BarChart2, label: "Metabase Dashboard" },
  dbt_model: { icon: Layers, label: "dbt Model" },
  dbt_source: { icon: Layers, label: "dbt Source" },
  dbt_test: { icon: Layers, label: "dbt Test" },
  dbt_docs: { icon: Layers, label: "dbt Docs" },
  git_commit: { icon: GitBranchIcon, label: "Git Commit" },
  git_file: { icon: GitBranchIcon, label: "Git File" },
};

/**
 * Get the Lucide icon component for a deep link type.
 */
export function getDeepLinkIcon(type: DeepLinkType): LucideIcon {
  return DEEP_LINK_REGISTRY[type]?.icon ?? ExternalLink;
}

/**
 * Get human-readable label for a deep link type.
 */
export function getDeepLinkLabel(type: DeepLinkType): string {
  return DEEP_LINK_REGISTRY[type]?.label ?? type;
}

/**
 * Detect deep-link from an evidence item.
 * Consolidates detection logic so evidence-viewer doesn't need inline switches.
 *
 * @returns Deep-link info or null if no link applicable.
 */
export function detectDeepLink(
  evidence: { type: string; payload?: Record<string, any> },
): { type: DeepLinkType; id: string | number; url: string } | null {
  const payload = evidence.payload;

  // API_RESPONSE with card_id -> Metabase card
  if (evidence.type === "API_RESPONSE" && payload?.card_id) {
    const url = generateDeepLinkUrl("metabase_card", String(payload.card_id));
    return url ? { type: "metabase_card", id: payload.card_id, url } : null;
  }

  // GIT_DIFF -> Git commit (parse SHA from oneline log)
  if (evidence.type === "GIT_DIFF") {
    const commit =
      payload?.commit ||
      (typeof payload?.log === "string"
        ? payload.log.match(/^([a-f0-9]{7,40})\s/m)?.[1]
        : null);
    if (commit) {
      const url = generateDeepLinkUrl("git_commit", commit);
      return url ? { type: "git_commit", id: commit, url } : null;
    }
  }

  // DBT_ARTIFACT -> dbt model docs
  if (evidence.type === "DBT_ARTIFACT") {
    const modelName =
      payload?.model_name ||
      payload?.manifest_summary?.models?.[0]?.name ||
      payload?.run_summary?.results?.[0]?.unique_id?.replace(
        /^model\..*?\./,
        "",
      );
    if (modelName) {
      const url = generateDeepLinkUrl("dbt_model", modelName);
      return url ? { type: "dbt_model", id: modelName, url } : null;
    }
  }

  return null;
}

/**
 * Parse a deep link type and target into a full URL.
 * Convenience function for use in cell renderers.
 *
 * @param type - The deep link type
 * @param targetId - The ID or reference for the target
 * @param config - Optional configuration overrides
 * @returns Generated URL or empty string if type unknown
 */
export function generateDeepLinkUrl(
  type: DeepLinkType,
  targetId: string,
  config?: Partial<DeepLinkConfig>,
): string {
  const fullConfig = { ...getDefaultConfig(), ...config };

  switch (type) {
    case "metabase_card":
      return generateMetabaseUrl("card", targetId, fullConfig.metabaseBaseUrl);
    case "metabase_dashboard":
      return generateMetabaseUrl(
        "dashboard",
        targetId,
        fullConfig.metabaseBaseUrl,
      );
    case "dbt_model":
      return generateDbtUrl("model", targetId);
    case "dbt_source":
      return generateDbtUrl("source", targetId);
    case "dbt_test":
      return generateDbtUrl("test", targetId);
    case "dbt_docs":
      return generateDbtUrl("model", targetId);
    case "git_commit":
      return generateGitUrl("commit", targetId, fullConfig.gitRepoUrl);
    case "git_file": {
      // For git_file, targetId format is "ref:filepath"
      const [ref, ...pathParts] = targetId.split(":");
      const filePath = pathParts.join(":");
      return generateGitUrl("file", ref, fullConfig.gitRepoUrl, filePath);
    }
    default:
      return "";
  }
}
