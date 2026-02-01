import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Agent, Message, MediaAttachment } from '../types';

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

  // Build conversation context with media descriptions
  const historyText = conversationHistory
    .slice(-10)
    .map(m => {
      let text = `${m.agentName}: ${m.content}`;
      if (m.media && m.media.length > 0) {
        text += ` [Shared ${m.media.length} media file(s)]`;
      }
      return text;
    })
    .join('\n\n');

  // Check if the last message has media that needs analysis
  const lastMessage = conversationHistory[conversationHistory.length - 1];
  const hasMediaToAnalyze = lastMessage?.media && lastMessage.media.length > 0;

  const prompt = `${agent.systemPrompt}

CURRENT TOPIC: "${topic}"

CONVERSATION SO FAR:
${historyText || '(This is the start of the discussion)'}

${hasMediaToAnalyze ? 'NOTE: The last message includes media. Analyze and respond to it thoughtfully.' : ''}

Now respond as ${agent.name}. Remember: 2-3 sentences max, build on what others said, reference them by name.`;

  try {
    if (hasMediaToAnalyze && lastMessage.media) {
      // Multimodal request with images
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: prompt }
      ];

      // Add media as inline data
      for (const media of lastMessage.media) {
        if (media.base64 && media.type === 'image') {
          parts.push({
            inlineData: {
              mimeType: media.mimeType,
              data: media.base64
            }
          });
        }
      }

      if (onChunk) {
        const result = await model.generateContentStream(parts);
        let fullText = '';
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          fullText += chunkText;
          onChunk(fullText);
        }
        return fullText;
      } else {
        const result = await model.generateContent(parts);
        return result.response.text();
      }
    } else {
      // Text-only request
      if (onChunk) {
        const result = await model.generateContentStream(prompt);
        let fullText = '';
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          fullText += chunkText;
          onChunk(fullText);
        }
        return fullText;
      } else {
        const result = await model.generateContent(prompt);
        return result.response.text();
      }
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

// Analyze an image directly
export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  prompt: string = "Describe this image in detail. What do you see?"
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: import.meta.env.VITE_GEMINI_MODEL_FLASH || 'gemini-2.0-flash'
  });

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: imageBase64
      }
    }
  ]);

  return result.response.text();
}

// Convert file to base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
}
