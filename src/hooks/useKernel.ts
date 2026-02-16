import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, SwarmState, MediaAttachment } from '../types';
import { KERNEL_AGENTS, getNextAgent } from '../agents';
import { claudeStreamChat } from '../engine/ClaudeClient';

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
  injectMessage: (content: string, media?: MediaAttachment[]) => void;
  setTopic: (topic: string) => void;
  clearMessages: () => void;
}

export const useKernel = create<KernelStore>()(
  persist(
    (set, get) => ({
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

      clearMessages: () => set({
        messages: [],
        swarm: {
          isActive: false,
          currentSpeaker: null,
          topic: 'The future of human-AI collaboration',
          turnCount: 0
        }
      }),

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
          // Build Claude messages from conversation history
          const claudeMessages: { role: string; content: string }[] = messages
            .slice(-10)
            .map(m => ({
              role: m.agentId === 'human' ? 'user' : 'assistant',
              content: `${m.agentName}: ${m.content}`,
            }));
          claudeMessages.push({
            role: 'user',
            content: `CURRENT TOPIC: "${swarm.topic}"\n\nNow respond as ${currentAgent.name}. Remember: 2-3 sentences max, build on what others said, reference them by name.`,
          });

          const response = await claudeStreamChat(
            claudeMessages,
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
            },
            { system: currentAgent.systemPrompt, model: 'sonnet', max_tokens: 512 }
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

      injectMessage: (content, media) => {
        const message: Message = {
          id: Date.now().toString(),
          agentId: 'human',
          agentName: 'Isaac',
          content,
          timestamp: new Date(),
          media
        };

        set((state) => ({
          messages: [...state.messages, message]
        }));
      },

    }),
    {
      name: 'sovereign-kernel',
      partialize: (state) => ({
        messages: state.messages,
        swarm: { ...state.swarm, isActive: false },
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Rehydrate Date objects from JSON strings
          state.messages = state.messages.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
        }
      },
    }
  )
);
