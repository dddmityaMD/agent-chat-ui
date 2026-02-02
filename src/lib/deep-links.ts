/**
 * Deep link URL generation utilities for source systems.
 *
 * Generates URLs for Metabase, dbt docs, and Git repositories.
 */

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
    // Return a relative path if no base URL configured
    return `#!/${type}/${name}`;
  }

  const normalizedBase = base.replace(/\/+$/, "");

  // dbt docs uses hash-based routing
  const path = project
    ? `#!/${type}/${project}.${name}`
    : `#!/${type}/${name}`;

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
    // Return a placeholder if no base URL configured
    return type === "commit" ? `commit/${ref}` : `file/${ref}/${filePath || ""}`;
  }

  const normalizedBase = base.replace(/\/+$/, "");

  if (type === "commit") {
    return `${normalizedBase}/commit/${ref}`;
  }

  // For files, use blob path
  const branch = ref || config.gitBranch || "main";
  return `${normalizedBase}/blob/${branch}/${filePath || ""}`;
}

/**
 * Get the icon name for a deep link type.
 * Used by UI components to render appropriate icons.
 *
 * @param type - The deep link type
 * @returns Icon identifier string
 */
export function getDeepLinkIcon(type: DeepLinkType): string {
  switch (type) {
    case "metabase_card":
      return "BarChart3";
    case "metabase_dashboard":
      return "LayoutDashboard";
    case "dbt_model":
    case "dbt_source":
    case "dbt_test":
    case "dbt_docs":
      return "FileCode";
    case "git_commit":
    case "git_file":
      return "GitBranch";
    default:
      return "ExternalLink";
  }
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
      return generateMetabaseUrl("dashboard", targetId, fullConfig.metabaseBaseUrl);
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
    case "git_file":
      // For git_file, targetId format is "ref:filepath"
      const [ref, ...pathParts] = targetId.split(":");
      const filePath = pathParts.join(":");
      return generateGitUrl("file", ref, fullConfig.gitRepoUrl, filePath);
    default:
      return "";
  }
}
