import {
  HeroSection,
  TokenizationSection,
  AttentionSection,
  TransformerSection,
  TemperatureSection,
  ContextWindowSection,
  ReasoningSection,
  ClosingSection,
} from '../components/claude-physics'

export function ClaudePhysicsPage() {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <HeroSection />
      <TokenizationSection />
      <AttentionSection />
      <TransformerSection />
      <TemperatureSection />
      <ContextWindowSection />
      <ReasoningSection />
      <ClosingSection />
    </div>
  )
}
