import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { recordFeedback } from '../../engine/ReasoningEngine';

export function FeedbackButtons({
  reasoningId,
  context,
  conclusion,
  onFeedback
}: {
  reasoningId: string;
  context: string;
  conclusion: string;
  onFeedback?: (rating: 'positive' | 'negative') => void;
}) {
  const [submitted, setSubmitted] = useState<'positive' | 'negative' | null>(null);

  const handleFeedback = (rating: 'positive' | 'negative') => {
    recordFeedback(reasoningId, rating, context, conclusion);
    setSubmitted(rating);
    onFeedback?.(rating);
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="opacity-60">Thanks for the feedback!</span>
        <span className={submitted === 'positive' ? 'text-green-600' : 'text-red-600'}>
          {submitted === 'positive' ? '+1' : '-1'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs opacity-50">Was this helpful?</span>
      <button
        onClick={() => handleFeedback('positive')}
        className="p-2 rounded-full hover:bg-green-100 transition-colors"
        title="Good reasoning"
      >
        <ThumbsUp size={16} className="text-green-600" />
      </button>
      <button
        onClick={() => handleFeedback('negative')}
        className="p-2 rounded-full hover:bg-red-100 transition-colors"
        title="Could be better"
      >
        <ThumbsDown size={16} className="text-red-600" />
      </button>
    </div>
  );
}
