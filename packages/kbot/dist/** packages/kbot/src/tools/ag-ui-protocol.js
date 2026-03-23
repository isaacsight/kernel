 **
    `` `typescript
/**
 * AG-UI Protocol Implementation
 * 
 * The AG-UI Protocol (from CopilotKit) defines a standardized interface
 * for AI agents to communicate with frontend/generative UI layers.
 * 
 * This tool enables kbot to:
 * - Serialize agent actions into AG-UI compatible command objects
 * - Parse incoming AG-UI events from frontend layers
 * - Render agent reasoning and actions in UI components
 */

/**
 * Represents an action that an agent can execute
 */
export interface AGUIAction {
  /** Unique identifier for the action */
  id: string;
  
  /** Action type from AG-UI protocol spec */
  type: AGUIActionType;
  
  /** Parameters specific to the action type */
  parameters: Record<string, unknown>;
  
  /** Optional reasoning/explanation for the action */
  reasoning?: string;
  
  /** Metadata for UI rendering */
  metadata?: {
    priority?: number;
    requiresConfirmation?: boolean;
    estimatedDuration?: number;
  };
}

/**
 * Action types defined by AG-UI Protocol
 */
export enum AGUIActionType {
  /** Agent is thinking/processing */
  THOUGHT = 'thought',
  
  /** Agent is searching for information */
  SEARCH = 'search',
  
  /** Agent is executing code */
  EXECUTE = 'execute',
  
  /** Agent is browsing a website */
  BROWSE = 'browse',
  
  /** Agent is reading a file */
  READ = 'read',
  
  /** Agent is writing a file */
  WRITE = 'write',
  
  /** Agent is running a command in terminal */
  TERMINAL = 'terminal',
  
  /** Agent is calling an API */
  API_CALL = 'api_call',
  
  /** Agent is asking the user for clarification */
  QUERY = 'query',
}

/**
 * Represents an event from the frontend layer back to the agent
 */
export interface AGUIEvent {
  /** Event type */
  type: AGUIEventType;
  
  /** Payload containing event data */
  payload: Record<string, unknown>;
  
  /** Optional metadata */
  metadata?: {
    sessionId?: string;
    timestamp?: number;
  };
}

/**
 * Event types for frontend-to-agent communication
 */
export enum AGUIEventType {
  /** User provided input */
  USER_INPUT = 'user_input',
  
  /** User acknowledged/rejected an action */
  ACTION_RESPONSE = 'action_response',
  
  /** Frontend requested agent to explain reasoning */
  EXPLAIN = 'explain',
  
  /** Frontend requested to resume execution */
  RESUME = 'resume',
  
  /** Frontend requested to pause execution */
  PAUSE = 'pause',
}

/**
 * Main AG-UI Protocol handler class
 */
export class AGUIProtocolHandler {
  private sessionId: string;
  private pendingActions: Map<string, AGUIAction>;
  private actionHistory: AGUIAction[];

  constructor(sessionId: string = `;
agui - $;
{
    Date.now();
}
-$;
{
    Math.random().toString(36).slice(4);
}
`) {
    this.sessionId = sessionId;
    this.pendingActions = new Map();
    this.actionHistory = [];
  }

  /**
   * Serialize an action to AG-UI protocol format
   */
  serializeAction(action: AGUIAction): AGUIAction {
    const serialized: AGUIAction = {
      id: action.id,
      type: action.type,
      parameters: action.parameters,
      reasoning: action.reasoning,
      metadata: action.metadata || {},
    };

    // Add protocol-specific metadata
    serialized.metadata = {
      ...serialized.metadata,
      protocolVersion: '1.0',
      source: 'kbot',
    };

    return serialized;
  }

  /**
   * Parse an AG-UI protocol message from frontend
   */
  parseEvent(data: AGUIEvent): AGUIEvent {
    const parsed: AGUIEvent = {
      type: data.type,
      payload: data.payload,
      metadata: data.metadata || {
        sessionId: this.sessionId,
        timestamp: Date.now(),
      },
    };

    return parsed;
  }

  /**
   * Register a new action with the protocol
   */
  registerAction(action: AGUIAction): AGUIAction {
    const serialized = this.serializeAction(action);
    
    this.pendingActions.set(serialized.id, serialized);
    this.actionHistory.push(serialized);

    return serialized;
  }

  /**
   * Get pending actions awaiting confirmation
   */
  getPendingActions(): AGUIAction[] {
    return Array.from(this.pendingActions.values())
      .filter(a => a.metadata?.requiresConfirmation === true);
  }

  /**
   * Record user confirmation for an action
   */
  confirmAction(actionId: string): void {
    const action = this.pendingActions.get(actionId);
    
    if (action) {
      action.metadata = {
        ...action.metadata,
        confirmed: true,
        confirmedAt: Date.now(),
      };
      this.pendingActions.delete(actionId);
      this.actionHistory.push(action);
    }
  }

  /**
   * Record user rejection of an action
   */
  rejectAction(actionId: string, reason: string): void {
    const action = this.pendingActions.get(actionId);
    
    if (action) {
      action.metadata = {
        ...action.metadata,
        rejected: true,
        rejectionReason: reason,
      };
      this.pendingActions.delete(actionId);
    }
  }

  /**
   * Get action execution history
   */
  getHistory(): AGUIAction[] {
    return [...this.actionHistory];
  }

  /**
   * Generate a summary of session for user display
   */
  generateSummary(): string {
    const summaryLines: string[] = [];
    summaryLines.push(`;
Session: $;
{
    this.sessionId;
}
`);
    summaryLines.push(`;
Total;
Actions: $;
{
    this.actionHistory.length;
}
`);
    summaryLines.push(`;
Pending: $;
{
    this.pendingActions.size;
}
`);
    summaryLines.push(`;
Completed: $;
{
    this.actionHistory.length - this.pendingActions.size;
}
`);

    // Add recent actions summary
    const recent = this.actionHistory.slice(-5);
    if (recent.length > 0) {
      summaryLines.push(`;
Recent: $;
{
    recent.map(a => a.type).join(', ');
}
`);
    }

    return summaryLines.join('\n');
  }

  /**
   * Clean up old sessions (for memory management)
   */
  cleanupOldSessions(inactiveThresholdMs: number = 3600000): void {
    // Implementation would track session activity and clean up
    // For now, this is a placeholder for future multi-session support
  }
}

/**
 * Utility functions for AG-UI Protocol integration
 */
export namespace AGUIProtocol {
  /**
   * Create a new protocol handler instance
   */
  export function createHandler(options?: { sessionId?: string }): AGUIProtocolHandler {
    return new AGUIProtocolHandler(options?.sessionId);
  }

  /**
   * Action type lookup helper
   */
  export const actionTypes: AGUIActionType[] = [
    AGUIActionType.THOUGHT,
    AGUIActionType.SEARCH,
    AGUIActionType.EXECUTE,
    AGUIActionType.BROWSE,
    AGUIActionType.READ,
    AGUIActionType.WRITE,
    AGUIActionType.TERMINAL,
    AGUIActionType.API_CALL,
    AGUIActionType.QUERY,
  ];

  /**
   * Validate action type
   */
  export function isValidActionType(type: string): type is AGUIActionType {
    return actionTypes.includes(type as AGUIActionType);
  }
}

/**
 * Type guards for type safety
 */
export function isAGUIAction(obj: unknown): obj is AGUIAction {
  if (typeof obj !== 'object' || obj === null) return false;
  const a = obj as Record<string, unknown>;
  return (
    typeof a.id === 'string' &&
    typeof a.type === 'string' &&
    typeof a.parameters === 'object' &&
    a.parameters !== null &&
    typeof a.parameters === 'object' &&
    AGUIProtocol.isValidActionType(a.type)
  );
}

export function isAGUIEvent(obj: unknown): obj is AGUIEvent {
  if (typeof obj !== 'object' || obj === null) return false;
  const e = obj as Record<string, unknown>;
  return (
    typeof e.type === 'string' &&
    typeof e.payload === 'object' &&
    e.payload !== null &&
    typeof e.payload === 'object'
  );
}
` ``;
export {};
//# sourceMappingURL=ag-ui-protocol.js.map