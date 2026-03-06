export interface ContainerConfig {
  /** Docker image (e.g., "node:20-slim", "python:3.12-slim") */
  image: string;

  /** Host path → container path mounts */
  mount?: Record<string, string>;

  /** Network access: "deny" (default) or "allow" */
  network?: 'deny' | 'allow';

  /** Resource limits */
  limits?: {
    cpu?: string; // e.g., "0.5" (half a core)
    memory?: string; // e.g., "512m"
    timeout?: number; // ms, default: 30000
  };

  /** Allowlists for tool execution */
  allow?: {
    /** Filesystem paths the agent can read/write (glob patterns) */
    fs?: string[];
    /** Bash commands the agent can run (exact strings or RegExp) */
    bash?: (string | RegExp)[];
  };
}

export interface ContainerToolResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}
