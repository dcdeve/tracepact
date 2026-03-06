export interface ProcessSandboxConfig {
  /** Working directory for the sandbox (defaults to a temporary directory) */
  workdir?: string;

  /** Timeout for each tool execution in ms (default: 30000) */
  timeout?: number;

  /** Allowlists for tool execution */
  allow?: {
    /** Filesystem paths the agent can read/write (glob patterns) */
    fs?: string[];
    /** Bash commands the agent can run (exact strings or RegExp) */
    bash?: (string | RegExp)[];
  };

  /** Environment variables to pass to subprocess (defaults to minimal safe env) */
  env?: Record<string, string>;
}
