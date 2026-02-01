import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import { generateQuote, formatQuoteForDisplay, type ProjectQuote } from '../engine/PricingEngine';
import { treasury } from '../engine/Treasury';
import { formatPrice } from '../engine/StripeClient';

interface ProjectFlowProps {
  onQuoteGenerated?: (quote: ProjectQuote) => void;
}

export function ProjectFlow({ onQuoteGenerated }: ProjectFlowProps) {
  const [step, setStep] = useState<'describe' | 'quoting' | 'quote' | 'paying' | 'paid'>('describe');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [quote, setQuote] = useState<ProjectQuote | null>(null);

  const handleSubmit = async () => {
    if (!description.trim()) return;

    setStep('quoting');

    // Simulate agent thinking time
    await new Promise(resolve => setTimeout(resolve, 2000));

    const newQuote = generateQuote(description);
    setQuote(newQuote);
    setStep('quote');

    if (onQuoteGenerated) {
      onQuoteGenerated(newQuote);
    }
  };

  const handlePay = async () => {
    if (!quote || !email) return;

    setStep('paying');

    // Create project in treasury
    const project = treasury.createProject(email, description, quote);

    // In production, redirect to Stripe Checkout
    // For now, simulate payment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Record payment (simulated)
    treasury.recordPayment(project.id, `pi_simulated_${Date.now()}`);

    setStep('paid');
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <AnimatePresence mode="wait">
        {step === 'describe' && (
          <motion.div
            key="describe"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl mb-2">What do you need built?</h2>
              <p className="opacity-60 italic">Describe your project. Our AI swarm will analyze, quote, and build it.</p>
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: I need a landing page for my coffee shop with a menu section, location map, and contact form. It should feel warm and inviting..."
              className="w-full h-40 p-4 bg-[--rubin-ivory-med] rounded-lg border-none outline-none resize-none text-lg"
            />

            <button
              onClick={handleSubmit}
              disabled={!description.trim()}
              className="w-full py-4 bg-[--rubin-slate] text-[--rubin-ivory] rounded-lg mono flex items-center justify-center gap-2 disabled:opacity-30"
            >
              <Send size={18} />
              Analyze & Quote
            </button>
          </motion.div>
        )}

        {step === 'quoting' && (
          <motion.div
            key="quoting"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center py-16"
          >
            <Loader2 size={48} className="animate-spin mx-auto mb-4 opacity-50" />
            <h3 className="text-2xl mb-2">Swarm Analyzing...</h3>
            <p className="opacity-60 italic">Scout → Architect → Treasurer</p>
          </motion.div>
        )}

        {step === 'quote' && quote && (
          <motion.div
            key="quote"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="bg-[--rubin-ivory-med] rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="mono text-sm opacity-50">PROJECT TYPE</div>
                  <div className="text-xl">{quote.type.replace('_', ' ').toUpperCase()}</div>
                </div>
                <div className="text-right">
                  <div className="mono text-sm opacity-50">COMPLEXITY</div>
                  <div className="text-xl capitalize">{quote.complexity}</div>
                </div>
              </div>

              <div className="border-t border-[--rubin-ivory-dark] pt-4 mb-4">
                <div className="mono text-sm opacity-50 mb-2">DELIVERABLES</div>
                <ul className="space-y-1">
                  {quote.deliverables.map((d, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-green-600" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-[--rubin-ivory-dark] pt-4">
                <div className="mono text-sm opacity-50 mb-2">COST BREAKDOWN</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Design</span>
                    <span>{formatPrice(quote.breakdown.design)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Development</span>
                    <span>{formatPrice(quote.breakdown.development)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Testing</span>
                    <span>{formatPrice(quote.breakdown.testing)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Deployment</span>
                    <span>{formatPrice(quote.breakdown.deployment)}</span>
                  </div>
                  <div className="flex justify-between opacity-50">
                    <span>AI Processing</span>
                    <span>{formatPrice(quote.breakdown.aiCosts)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[--rubin-ivory-dark] mt-4 pt-4">
                <div className="flex justify-between text-2xl font-medium">
                  <span>Total</span>
                  <span>{formatPrice(quote.total)}</span>
                </div>
                <div className="mono text-xs opacity-50 text-right">
                  Est. {quote.estimatedHours} hours
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email for delivery"
                className="w-full px-4 py-3 bg-[--rubin-ivory-med] rounded-lg border-none outline-none"
              />

              <button
                onClick={handlePay}
                disabled={!email}
                className="w-full py-4 bg-green-600 text-white rounded-lg mono flex items-center justify-center gap-2 disabled:opacity-30 hover:bg-green-700 transition-colors"
              >
                <CreditCard size={18} />
                Pay {formatPrice(quote.total)} & Start Build
              </button>

              <button
                onClick={() => setStep('describe')}
                className="w-full py-3 text-center mono text-sm opacity-50 hover:opacity-100"
              >
                ← Revise description
              </button>
            </div>
          </motion.div>
        )}

        {step === 'paying' && (
          <motion.div
            key="paying"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center py-16"
          >
            <Loader2 size={48} className="animate-spin mx-auto mb-4 opacity-50" />
            <h3 className="text-2xl mb-2">Processing Payment...</h3>
            <p className="opacity-60 italic">Securing your project</p>
          </motion.div>
        )}

        {step === 'paid' && (
          <motion.div
            key="paid"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <CheckCircle size={64} className="mx-auto mb-4 text-green-600" />
            <h3 className="text-3xl mb-2">Payment Received!</h3>
            <p className="opacity-60 italic mb-8">
              The swarm is now building your project.
              <br />
              You'll receive updates at {email}
            </p>

            <div className="bg-[--rubin-ivory-med] rounded-lg p-4 text-left">
              <div className="mono text-sm opacity-50 mb-2">PROJECT STATUS</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Builder is starting work...</span>
              </div>
            </div>

            <button
              onClick={() => {
                setStep('describe');
                setDescription('');
                setEmail('');
                setQuote(null);
              }}
              className="mt-8 px-6 py-3 bg-[--rubin-slate] text-[--rubin-ivory] rounded-lg mono"
            >
              Start Another Project
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
