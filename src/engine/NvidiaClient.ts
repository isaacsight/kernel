import type { Agent, Message } from '../types';

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

export const NVIDIA_MODELS = [
  // ── NVIDIA Nemotron ──────────────────────────────────────────────
  { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', name: 'Nemotron Ultra 253B', category: 'NVIDIA' },
  { id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', name: 'Nemotron Super 49B v1.5', category: 'NVIDIA' },
  { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', name: 'Nemotron Super 49B v1', category: 'NVIDIA' },
  { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron 4 340B', category: 'NVIDIA' },
  { id: 'nvidia/nemotron-3-nano-30b-a3b', name: 'Nemotron 3 Nano 30B', category: 'NVIDIA' },
  { id: 'nvidia/nvidia-nemotron-nano-9b-v2', name: 'Nemotron Nano 9B v2', category: 'NVIDIA' },
  { id: 'nvidia/llama-3.1-nemotron-nano-8b-v1', name: 'Nemotron Nano 8B', category: 'NVIDIA' },
  { id: 'nvidia/llama-3.1-nemotron-nano-4b-v1_1', name: 'Nemotron Nano 4B', category: 'NVIDIA' },
  { id: 'nvidia/nemotron-mini-4b-instruct', name: 'Nemotron Mini 4B', category: 'NVIDIA' },
  { id: 'nvidia/nemotron-4-mini-hindi-4b-instruct', name: 'Nemotron Mini Hindi 4B', category: 'NVIDIA' },
  { id: 'nvidia/llama3-chatqa-1.5-8b', name: 'ChatQA 1.5 8B', category: 'NVIDIA' },

  // ── Meta Llama ───────────────────────────────────────────────────
  { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', category: 'Meta' },
  { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', category: 'Meta' },
  { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', category: 'Meta' },
  { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', category: 'Meta' },
  { id: 'meta/llama-3.2-3b-instruct', name: 'Llama 3.2 3B', category: 'Meta' },
  { id: 'meta/llama-3.2-1b-instruct', name: 'Llama 3.2 1B', category: 'Meta' },
  { id: 'meta/llama3-70b', name: 'Llama 3 70B', category: 'Meta' },
  { id: 'meta/llama3-8b', name: 'Llama 3 8B', category: 'Meta' },
  { id: 'meta/llama2-70b', name: 'Llama 2 70B', category: 'Meta' },
  { id: 'meta/codellama-70b', name: 'Code Llama 70B', category: 'Meta' },

  // ── DeepSeek ─────────────────────────────────────────────────────
  { id: 'deepseek-ai/deepseek-v3.2', name: 'DeepSeek V3.2', category: 'DeepSeek' },
  { id: 'deepseek-ai/deepseek-v3.1', name: 'DeepSeek V3.1', category: 'DeepSeek' },
  { id: 'deepseek-ai/deepseek-v3.1-terminus', name: 'DeepSeek V3.1 Terminus', category: 'DeepSeek' },
  { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1', category: 'DeepSeek' },
  { id: 'deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill 32B', category: 'DeepSeek' },
  { id: 'deepseek-ai/deepseek-r1-distill-qwen-14b', name: 'DeepSeek R1 Distill 14B', category: 'DeepSeek' },
  { id: 'deepseek-ai/deepseek-r1-distill-qwen-7b', name: 'DeepSeek R1 Distill Qwen 7B', category: 'DeepSeek' },
  { id: 'deepseek-ai/deepseek-r1-distill-llama-8b', name: 'DeepSeek R1 Distill Llama 8B', category: 'DeepSeek' },

  // ── Qwen ─────────────────────────────────────────────────────────
  { id: 'qwen/qwen3-coder-480b-a35b-instruct', name: 'Qwen3 Coder 480B', category: 'Qwen' },
  { id: 'qwen/qwen3-235b-a22b', name: 'Qwen3 235B', category: 'Qwen' },
  { id: 'qwen/qwen3-next-80b-a3b-instruct', name: 'Qwen3 Next 80B', category: 'Qwen' },
  { id: 'qwen/qwen3-next-80b-a3b-thinking', name: 'Qwen3 Next 80B Thinking', category: 'Qwen' },
  { id: 'qwen/qwq-32b', name: 'QwQ 32B', category: 'Qwen' },
  { id: 'qwen/qwen2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', category: 'Qwen' },
  { id: 'qwen/qwen2.5-72b-instruct', name: 'Qwen 2.5 72B', category: 'Qwen' },
  { id: 'qwen/qwen2.5-7b-instruct', name: 'Qwen 2.5 7B', category: 'Qwen' },
  { id: 'qwen/qwen2.5-coder-7b-instruct', name: 'Qwen 2.5 Coder 7B', category: 'Qwen' },
  { id: 'qwen/qwen2-7b-instruct', name: 'Qwen 2 7B', category: 'Qwen' },

  // ── Mistral ──────────────────────────────────────────────────────
  { id: 'mistralai/mistral-large-2-instruct', name: 'Mistral Large 2', category: 'Mistral' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large', category: 'Mistral' },
  { id: 'mistralai/mistral-nemotron', name: 'Mistral NeMo-tron', category: 'Mistral' },
  { id: 'mistralai/devstral-2-123b-instruct-2512', name: 'Devstral 2 123B', category: 'Mistral' },
  { id: 'mistralai/magistral-small-2506', name: 'Magistral Small', category: 'Mistral' },
  { id: 'mistralai/mistral-small-24b-instruct', name: 'Mistral Small 24B', category: 'Mistral' },
  { id: 'mistralai/mixtral-8x22b-instruct', name: 'Mixtral 8x22B', category: 'Mistral' },
  { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B', category: 'Mistral' },
  { id: 'mistralai/codestral-22b-instruct-v0.1', name: 'Codestral 22B', category: 'Mistral' },
  { id: 'mistralai/mathstral-7b-v01', name: 'Mathstral 7B', category: 'Mistral' },
  { id: 'mistralai/mamba-codestral-7b-v0.1', name: 'Mamba Codestral 7B', category: 'Mistral' },
  { id: 'mistralai/mistral-7b-instruct-v0.3', name: 'Mistral 7B v0.3', category: 'Mistral' },
  { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', category: 'Mistral' },

  // ── Google ───────────────────────────────────────────────────────
  { id: 'google/gemma-3-1b-it', name: 'Gemma 3 1B', category: 'Google' },
  { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', category: 'Google' },
  { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', category: 'Google' },
  { id: 'google/gemma-2-2b-it', name: 'Gemma 2 2B', category: 'Google' },
  { id: 'google/gemma-7b', name: 'Gemma 7B', category: 'Google' },
  { id: 'google/codegemma-1.1-7b', name: 'CodeGemma 1.1 7B', category: 'Google' },
  { id: 'google/codegemma-7b', name: 'CodeGemma 7B', category: 'Google' },

  // ── Microsoft ────────────────────────────────────────────────────
  { id: 'microsoft/phi-4-mini-flash-reasoning', name: 'Phi-4 Mini Flash Reasoning', category: 'Microsoft' },
  { id: 'microsoft/phi-4-mini-instruct', name: 'Phi-4 Mini', category: 'Microsoft' },
  { id: 'microsoft/phi-3.5-mini', name: 'Phi-3.5 Mini', category: 'Microsoft' },
  { id: 'microsoft/phi-3-medium-128k-instruct', name: 'Phi-3 Medium 128K', category: 'Microsoft' },
  { id: 'microsoft/phi-3-medium-4k-instruct', name: 'Phi-3 Medium 4K', category: 'Microsoft' },
  { id: 'microsoft/phi-3-small-128k-instruct', name: 'Phi-3 Small 128K', category: 'Microsoft' },
  { id: 'microsoft/phi-3-small-8k-instruct', name: 'Phi-3 Small 8K', category: 'Microsoft' },
  { id: 'microsoft/phi-3-mini-128k-instruct', name: 'Phi-3 Mini 128K', category: 'Microsoft' },
  { id: 'microsoft/phi-3-mini-4k-instruct', name: 'Phi-3 Mini 4K', category: 'Microsoft' },

  // ── OpenAI (Open-Source) ─────────────────────────────────────────
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', category: 'OpenAI' },
  { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', category: 'OpenAI' },

  // ── MiniMax ──────────────────────────────────────────────────────
  { id: 'minimaxai/minimax-m2.1', name: 'MiniMax M2.1', category: 'MiniMax' },
  { id: 'minimaxai/minimax-m2', name: 'MiniMax M2', category: 'MiniMax' },

  // ── Moonshot (Kimi) ──────────────────────────────────────────────
  { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2', category: 'Moonshot' },
  { id: 'moonshotai/kimi-k2-instruct-0905', name: 'Kimi K2 0905', category: 'Moonshot' },
  { id: 'moonshotai/kimi-k2-thinking', name: 'Kimi K2 Thinking', category: 'Moonshot' },

  // ── StepFun ──────────────────────────────────────────────────────
  { id: 'stepfun-ai/step-3-5-flash', name: 'Step 3.5 Flash', category: 'StepFun' },

  // ── Zhipu (GLM) ──────────────────────────────────────────────────
  { id: 'z-ai/glm4.7', name: 'GLM 4.7', category: 'Zhipu' },
  { id: 'thudm/chatglm3-6b', name: 'ChatGLM3 6B', category: 'Zhipu' },

  // ── ByteDance ────────────────────────────────────────────────────
  { id: 'bytedance/seed-oss-36b-instruct', name: 'Seed OSS 36B', category: 'ByteDance' },

  // ── IBM Granite ──────────────────────────────────────────────────
  { id: 'ibm/granite-3.3-8b-instruct', name: 'Granite 3.3 8B', category: 'IBM' },
  { id: 'ibm/granite-34b-code-instruct', name: 'Granite 34B Code', category: 'IBM' },
  { id: 'ibm/granite-8b-code-instruct', name: 'Granite 8B Code', category: 'IBM' },

  // ── iGenius ──────────────────────────────────────────────────────
  { id: 'igenius/colosseum_355b_instruct_16k', name: 'Colosseum 355B', category: 'iGenius' },
  { id: 'igenius/italia_10b_instruct_16k', name: 'Italia 10B', category: 'iGenius' },

  // ── Stockmark ────────────────────────────────────────────────────
  { id: 'stockmark/stockmark-2-100b-instruct', name: 'Stockmark 2 100B', category: 'Stockmark' },

  // ── AbacusAI ─────────────────────────────────────────────────────
  { id: 'abacusai/dracarys-llama-3.1-70b-instruct', name: 'Dracarys Llama 3.1 70B', category: 'AbacusAI' },

  // ── AI21 Labs ────────────────────────────────────────────────────
  { id: 'ai21labs/jamba-1.5-mini-instruct', name: 'Jamba 1.5 Mini', category: 'AI21' },

  // ── TII (Falcon) ────────────────────────────────────────────────
  { id: 'tiiuae/falcon3-7b-instruct', name: 'Falcon 3 7B', category: 'TII' },

  // ── Databricks ───────────────────────────────────────────────────
  { id: 'databricks/dbrx-instruct', name: 'DBRX', category: 'Databricks' },

  // ── BigCode ──────────────────────────────────────────────────────
  { id: 'bigcode/starcoder2-7b', name: 'StarCoder2 7B', category: 'BigCode' },

  // ── Marin ────────────────────────────────────────────────────────
  { id: 'marin/marin-8b-instruct', name: 'Marin 8B', category: 'Marin' },

  // ── Upstage ──────────────────────────────────────────────────────
  { id: 'upstage/solar-10.7b-instruct', name: 'Solar 10.7B', category: 'Upstage' },

  // ── Regional / Multilingual ──────────────────────────────────────
  { id: 'speakleash/bielik-11b-v2_6-instruct', name: 'Bielik 11B (Polish)', category: 'Regional' },
  { id: 'opengpt-x/teuken-7b-instruct-commercial-v0.4', name: 'Teuken 7B (EU)', category: 'Regional' },
  { id: 'utter-project/eurollm-9b-instruct', name: 'EuroLLM 9B', category: 'Regional' },
  { id: 'sarvamai/sarvam-m', name: 'Sarvam M (Indic)', category: 'Regional' },
  { id: 'aisingapore/sea-lion-7b-instruct', name: 'SEA-LION 7B', category: 'Regional' },
  { id: 'mediatek/breeze-7b-instruct', name: 'Breeze 7B (Taiwan)', category: 'Regional' },
  { id: 'yentinglin/llama-3-taiwan-70b-instruct', name: 'Llama 3 Taiwan 70B', category: 'Regional' },
  { id: 'institute-of-science-tokyo/llama-3.1-swallow-70b-instruct-v01', name: 'Swallow 70B (Japanese)', category: 'Regional' },
  { id: 'institute-of-science-tokyo/llama-3.1-swallow-8b-instruct-v0.1', name: 'Swallow 8B (Japanese)', category: 'Regional' },
  { id: 'tokyotech-llm/llama-3-swallow-70b-instruct-v01', name: 'Swallow 70B Legacy', category: 'Regional' },
  { id: 'rakuten/rakutenai-7b-instruct', name: 'RakutenAI 7B', category: 'Regional' },
  { id: 'rakuten/rakutenai-7b-chat', name: 'RakutenAI 7B Chat', category: 'Regional' },
  { id: 'seallms/seallm-7b-v2.5', name: 'SeaLLM 7B', category: 'Regional' },
  { id: 'baichuan-inc/baichuan2-13b-chat', name: 'Baichuan2 13B', category: 'Regional' },
  { id: 'gotocompany/gemma-2-9b-cpt-sahabatai-instruct', name: 'SahabatAI 9B (Indonesian)', category: 'Regional' },
  { id: '01-ai/yi-large', name: 'Yi Large', category: 'Regional' },
];

function getApiKey(): string {
  return import.meta.env.VITE_NVIDIA_API_KEY || '';
}

function getModel(): string {
  return import.meta.env.VITE_NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';
}

// Module-level model override (set by UI)
let activeModel: string | null = null;

export function setNvidiaModel(modelId: string) {
  activeModel = modelId;
}

export function getNvidiaModel(): string {
  return activeModel || getModel();
}

export function isNvidiaAvailable(): boolean {
  return !!getApiKey();
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function buildMessages(agent: Agent, conversationHistory: Message[], topic: string): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: agent.systemPrompt },
  ];

  // Add conversation history (last 10 messages)
  for (const m of conversationHistory.slice(-10)) {
    let text = `${m.agentName}: ${m.content}`;
    if (m.media && m.media.length > 0) {
      text += ` [Shared ${m.media.length} media file(s)]`;
    }
    messages.push({
      role: m.agentId === 'human' ? 'user' : 'assistant',
      content: text,
    });
  }

  // Add the instruction as a final user message
  const hasMedia = conversationHistory[conversationHistory.length - 1]?.media?.length;
  messages.push({
    role: 'user',
    content: `CURRENT TOPIC: "${topic}"\n\n${hasMedia ? 'NOTE: The last message includes media. Analyze and respond to it thoughtfully.\n\n' : ''}Now respond as ${agent.name}. Remember: 2-3 sentences max, build on what others said, reference them by name.`,
  });

  return messages;
}

export async function generateAgentResponse(
  agent: Agent,
  conversationHistory: Message[],
  topic: string,
  onChunk?: (text: string) => void
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('NVIDIA API key not configured. Set VITE_NVIDIA_API_KEY in your .env file.');
  }

  const model = getNvidiaModel();
  const messages = buildMessages(agent, conversationHistory, topic);
  const useStreaming = !!onChunk;

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 512,
      stream: useStreaming,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`NVIDIA API error (${response.status}): ${errorBody}`);
  }

  if (useStreaming && response.body) {
    return parseSSEStream(response.body, onChunk!);
  }

  // Non-streaming fallback
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Generates a non-streaming completion using the specified NVIDIA model.
 * Useful for structured data extraction or complex reasoning where streaming isn't needed.
 */
export async function generateCompletion(
  prompt: string,
  systemPrompt: string = 'You are a helpful AI assistant.',
  modelId?: string
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('NVIDIA API key not configured.');
  }

  const model = modelId || getNvidiaModel();

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1, // Lower temperature for more deterministic/structured output
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`NVIDIA API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function parseSSEStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // Keep the last potentially incomplete line in the buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          onChunk(fullText);
        }
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }

  return fullText;
}
