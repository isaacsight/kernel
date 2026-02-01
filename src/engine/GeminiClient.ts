import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Agent, Message } from '../types';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export async function generateAgentResponse(
  agent: Agent,
  conversationHistory: Message[],
  topic: string,
  onChunk?: (text: string) => void
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: import.meta.env.VITE_GEMINI_MODEL_FLASH || 'gemini-2.0-flash'
  });

  // Build conversation context
  const historyText = conversationHistory
    .slice(-10) // Last 10 messages for context
    .map(m => `${m.agentName}: ${m.content}`)
    .join('\n\n');

  const prompt = `${agent.systemPrompt}

CURRENT TOPIC: "${topic}"

CONVERSATION SO FAR:
${historyText || '(This is the start of the discussion)'}

Now respond as ${agent.name}. Remember: 2-3 sentences max, build on what others said, reference them by name.`;

  try {
    if (onChunk) {
      // Streaming response
      const result = await model.generateContentStream(prompt);
      let fullText = '';

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        onChunk(fullText);
      }

      return fullText;
    } else {
      // Non-streaming
      const result = await model.generateContent(prompt);
      return result.response.text();
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}
