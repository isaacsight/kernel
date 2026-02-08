import { useState, useCallback } from 'react';
import {
  evaluationEngine,
  type EntityType,
  type Tier,
  type Evaluation,
} from '../engine/EvaluationEngine';

export interface EvaluationFormState {
  entityType: EntityType;
  description: string;
  basePrice: string;
}

export interface EvaluationFilters {
  filterType: EntityType | 'all';
  filterTier: Tier | 'all';
}

export function useEvaluationState() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>(() => evaluationEngine.getHistory());
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<EvaluationFormState>({
    entityType: 'project',
    description: '',
    basePrice: '',
  });

  // Filters
  const [filters, setFilters] = useState<EvaluationFilters>({
    filterType: 'all',
    filterTier: 'all',
  });

  const runEvaluation = useCallback(() => {
    if (!form.description.trim()) {
      setError('Description is required');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const basePrice = form.basePrice ? parseFloat(form.basePrice) : undefined;
      const entityId = `${form.entityType}_${Date.now()}`;

      const evaluation = evaluationEngine.evaluate(entityId, form.entityType, {
        description: form.description,
        basePrice: isNaN(basePrice as number) ? undefined : basePrice,
      });

      setSelectedEvaluation(evaluation);
      setEvaluations(evaluationEngine.getHistory());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evaluation failed');
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  const runAIEvaluation = useCallback(async (modelId?: string) => {
    if (!form.description.trim()) {
      setError('Description is required');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const basePrice = form.basePrice ? parseFloat(form.basePrice) : undefined;
      const evaluation = await evaluationEngine.evaluateWithAI(form.description, form.entityType, {
        basePrice: isNaN(basePrice as number) ? undefined : basePrice,
        modelId,
      });

      setSelectedEvaluation(evaluation);
      setEvaluations(evaluationEngine.getHistory());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI Evaluation failed');
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  const selectEvaluation = useCallback((id: string) => {
    const found = evaluations.find(e => e.id === id);
    setSelectedEvaluation(found ?? null);
  }, [evaluations]);

  const updateOutcome = useCallback((evaluationId: string, success: boolean, revenue?: number) => {
    evaluationEngine.updateOutcome(evaluationId, {
      success,
      revenue,
      lessons: [],
    });
    setEvaluations(evaluationEngine.getHistory());
    // Refresh selected if it's the one updated
    if (selectedEvaluation?.id === evaluationId) {
      const updated = evaluationEngine.getHistory().find(e => e.id === evaluationId);
      setSelectedEvaluation(updated ?? null);
    }
  }, [selectedEvaluation]);

  const loadRankings = useCallback((type?: EntityType) => {
    return evaluationEngine.getRanking(type, 20,
      filters.filterTier !== 'all' ? { tier: filters.filterTier } : undefined
    );
  }, [filters.filterTier]);

  const getReport = useCallback((type?: EntityType) => {
    return evaluationEngine.getPerformanceReport(type);
  }, []);

  const filteredEvaluations = evaluations.filter(e => {
    if (filters.filterType !== 'all' && e.entityType !== filters.filterType) return false;
    if (filters.filterTier !== 'all' && e.tier !== filters.filterTier) return false;
    return true;
  });

  return {
    evaluations: filteredEvaluations,
    allEvaluations: evaluations,
    selectedEvaluation,
    isLoading,
    error,
    form,
    setForm,
    filters,
    setFilters,
    runEvaluation,
    selectEvaluation,
    updateOutcome,
    loadRankings,
    getReport,
    runAIEvaluation,
  };
}
