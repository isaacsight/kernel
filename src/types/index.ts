export interface Agent {
  id: string;
  name: string;
  persona: string;
  systemPrompt: string;
  avatar: string;
  color: string;
}

export interface MediaAttachment {
  type: 'image' | 'video';
  url: string;
  mimeType: string;
  base64?: string;
}

export interface Message {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  media?: MediaAttachment[];
}

export interface SwarmState {
  isActive: boolean;
  currentSpeaker: string | null;
  topic: string;
  turnCount: number;
}
