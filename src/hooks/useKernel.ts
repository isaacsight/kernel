import { create } from 'zustand';
import type { Message, SwarmState } from '../types';
import { KERNEL_AGENTS, getNextAgent } from '../agents';
import { generateAgentResponse } from '../engine/GeminiClient';

interface KernelStore {
  messages: Message[];
  swarm: SwarmState;
  isGenerating: boolean;
  streamingContent: string;

  // Actions
  addMessage: (message: Message) => void;
  updateStreamingContent: (content: string) => void;
  startSwarm: (topic: string) => void;
  stopSwarm: () => void;
  triggerNextTurn: () => Promise<void>;
  injectMessage: (content: string) => void;
  setTopic: (topic: string) => void;
}

export const useKernel = create<KernelStore>((set, get) => ({
  messages: [],
  swarm: {
    isActive: false,
    currentSpeaker: null,
    topic: 'The future of human-AI collaboration',
    turnCount: 0
  },
  isGenerating: false,
  streamingContent: '',

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  updateStreamingContent: (content) => set({ streamingContent: content }),

  startSwarm: (topic) => {
    set({
      swarm: {
        isActive: true,
        currentSpeaker: KERNEL_AGENTS[0].id,
        topic,
        turnCount: 0
      },
      messages: []
    });

    // Start the first turn
    get().triggerNextTurn();
  },

  stopSwarm: () => set((state) => ({
    swarm: { ...state.swarm, isActive: false }
  })),

  setTopic: (topic) => set((state) => ({
    swarm: { ...state.swarm, topic }
  })),

  triggerNextTurn: async () => {
    const { swarm, messages, isGenerating } = get();

    if (!swarm.isActive || isGenerating) return;

    const currentAgent = KERNEL_AGENTS.find(a => a.id === swarm.currentSpeaker) || KERNEL_AGENTS[0];

    set({ isGenerating: true, streamingContent: '' });

    const messageId = Date.now().toString();

    // Add placeholder message
    const placeholderMessage: Message = {
      id: messageId,
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };

    set((state) => ({
      messages: [...state.messages, placeholderMessage]
    }));

    try {
      const response = await generateAgentResponse(
        currentAgent,
        messages,
        swarm.topic,
        (streamedText) => {
          // Update the message content as it streams
          set((state) => ({
            messages: state.messages.map(m =>
              m.id === messageId
                ? { ...m, content: streamedText }
                : m
            ),
            streamingContent: streamedText
          }));
        }
      );

      // Finalize the message
      set((state) => ({
        messages: state.messages.map(m =>
          m.id === messageId
            ? { ...m, content: response, isStreaming: false }
            : m
        ),
        streamingContent: '',
        isGenerating: false,
        swarm: {
          ...state.swarm,
          currentSpeaker: getNextAgent(currentAgent.id).id,
          turnCount: state.swarm.turnCount + 1
        }
      }));

      // Schedule next turn if still active
      const { swarm: updatedSwarm } = get();
      if (updatedSwarm.isActive) {
        // Random delay between 2-4 seconds for contemplative pacing
        const delay = 2000 + Math.random() * 2000;
        setTimeout(() => {
          const { swarm: currentSwarm } = get();
          if (currentSwarm.isActive) {
            get().triggerNextTurn();
          }
        }, delay);
      }
    } catch (error) {
      console.error('Error generating response:', error);
      set({ isGenerating: false });

      // Remove failed message
      set((state) => ({
        messages: state.messages.filter(m => m.id !== messageId)
      }));
    }
  },

  injectMessage: (content) => {
    const message: Message = {
      id: Date.now().toString(),
      agentId: 'human',
      agentName: 'Isaac',
      content,
      timestamp: new Date()
    };

    set((state) => ({
      messages: [...state.messages, message]
    }));
  }
}));
