import type { Agent, Message } from '../types';
import { generateAgentResponse as geminiGenerate } from './GeminiClient';
import { generateAgentResponse as nvidiaGenerate, isNvidiaAvailable } from './NvidiaClient';

export type Provider = 'gemini' | 'nvidia';

let currentProvider: Provider = 'gemini';

export function setProvider(provider: Provider) {
  currentProvider = provider;
}

export function getProvider(): Provider {
  return currentProvider;
}

export async function generateResponse(
  agent: Agent,
  conversationHistory: Message[],
  topic: string,
  onChunk?: (text: string) => void
): Promise<string> {
  if (currentProvider === 'nvidia' && isNvidiaAvailable()) {
    return nvidiaGenerate(agent, conversationHistory, topic, onChunk);
  }
  return geminiGenerate(agent, conversationHistory, topic, onChunk);
}
