// ─── Computer Engine Types ───────────────────────────────────
//
// Sandboxed compute environments for agents — code execution,
// file system management, browser access, terminal commands.

/** A sandboxed compute environment */
export interface Sandbox {
  id: string
  agentId: string
  userId: string
  status: 'creating' | 'ready' | 'busy' | 'destroyed' | 'error'
  filesystem: SandboxFile[]
  processes: SandboxProcess[]
  createdAt: number
  expiresAt: number
  /** Max idle time before auto-destroy (ms) */
  idleTimeout: number
  lastActivityAt: number
}

export interface SandboxFile {
  path: string
  content: string
  language: string
  size: number
  lastModified: number
}

export interface SandboxProcess {
  id: string
  command: string
  status: 'running' | 'completed' | 'failed'
  pid?: number
  startedAt: number
  completedAt?: number
}

/** Actions that can be performed in a sandbox */
export type SandboxAction =
  | 'execute_code'
  | 'read_file'
  | 'write_file'
  | 'browse_url'
  | 'run_terminal'
  | 'install_package'
  | 'list_files'

/** Result from sandbox action execution */
export interface SandboxResult {
  stdout: string
  stderr: string
  exitCode: number
  files?: SandboxFile[]
  screenshot?: string
  duration_ms: number
}

/** Code execution request */
export interface ExecuteCodeRequest {
  sandboxId: string
  code: string
  language: 'javascript' | 'typescript' | 'python' | 'bash' | 'html'
  /** Entry file path (for multi-file projects) */
  entryFile?: string
}

/** Browse URL request */
export interface BrowseUrlRequest {
  sandboxId: string
  url: string
  /** Wait for specific selector before capturing */
  waitForSelector?: string
  /** Take screenshot */
  screenshot?: boolean
}

/** Callbacks for streaming sandbox output */
export interface ComputerEngineCallbacks {
  onOutput: (sandboxId: string, output: string) => void
  onFileChange: (sandboxId: string, file: SandboxFile) => void
  onScreenshot: (sandboxId: string, base64: string) => void
  onError: (sandboxId: string, error: string) => void
  onStatusChange: (sandboxId: string, status: Sandbox['status']) => void
}

/** Tier limits for Computer Engine */
export interface ComputerEngineLimits {
  maxConcurrentSandboxes: number
  maxExecutionTimeMs: number
  maxFileSize: number
  allowedLanguages: string[]
}

export const TIER_LIMITS: Record<'free' | 'pro' | 'max', ComputerEngineLimits> = {
  free: {
    maxConcurrentSandboxes: 0,
    maxExecutionTimeMs: 0,
    maxFileSize: 0,
    allowedLanguages: [],
  },
  pro: {
    maxConcurrentSandboxes: 3,
    maxExecutionTimeMs: 30000,
    maxFileSize: 1024 * 1024, // 1MB
    allowedLanguages: ['javascript', 'typescript', 'python', 'bash', 'html'],
  },
  max: {
    maxConcurrentSandboxes: 10,
    maxExecutionTimeMs: 120000,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedLanguages: ['javascript', 'typescript', 'python', 'bash', 'html'],
  },
}
