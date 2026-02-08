import { useState, useEffect } from 'react';
import { tradingBootstrap } from '../engine/TradingBootstrap';
import { cryptoTrader } from '../engine/CryptoTrader';
import { zeroDollarStrategist } from '../engine/ZeroDollarStrategist';
import { getFeedbackStats } from '../engine/ReasoningEngine';
import { autonomousLoop, type LoopState } from '../engine/AutonomousRevenueLoop';

export interface UseTradingState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  cryptoPrices: any[];
  loopState: LoopState;
  targetRevenue: number;
  setTargetRevenue: (v: number) => void;
  strategistState: ReturnType<typeof zeroDollarStrategist.getState>;
  reasoningResult: any;
  opportunityInput: string;
  setOpportunityInput: (v: string) => void;
  skills: string;
  setSkills: (v: string) => void;
  hoursPerDay: number;
  setHoursPerDay: (v: number) => void;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  setRiskTolerance: (v: 'conservative' | 'moderate' | 'aggressive') => void;
  feedbackStats: ReturnType<typeof getFeedbackStats>;
  setFeedbackStats: (v: ReturnType<typeof getFeedbackStats>) => void;
  loadCryptoPrices: () => Promise<void>;
  getPhaseAdvice: () => Promise<void>;
  evaluateOpportunity: () => Promise<void>;
  createStrategy: () => Promise<void>;
  getTodaysPlan: () => Promise<void>;
}

export function useTradingState(): UseTradingState {
  const [activeTab, setActiveTab] = useState('autonomous');
  const [cryptoPrices, setCryptoPrices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [strategistState, setStrategistState] = useState(zeroDollarStrategist.getState());
  const [reasoningResult, setReasoningResult] = useState<any>(null);
  const [opportunityInput, setOpportunityInput] = useState('');
  const [skills, setSkills] = useState('coding, writing, AI');
  const [hoursPerDay, setHoursPerDay] = useState(4);
  const [riskTolerance, setRiskTolerance] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [feedbackStats, setFeedbackStats] = useState(getFeedbackStats());
  const [loopState, setLoopState] = useState<LoopState>(autonomousLoop.getState());
  const [targetRevenue, setTargetRevenue] = useState(100);

  useEffect(() => {
    loadCryptoPrices();

    const unsubscribe = autonomousLoop.subscribe((state) => {
      setLoopState(state);
    });

    return () => unsubscribe();
  }, []);

  const loadCryptoPrices = async () => {
    setIsLoading(true);
    try {
      const prices = await cryptoTrader.getPrices();
      setCryptoPrices(prices);
    } catch (error) {
      console.error('Error loading prices:', error);
    }
    setIsLoading(false);
  };

  const getPhaseAdvice = async () => {
    setIsLoading(true);
    try {
      const advice = await zeroDollarStrategist.getPhaseAdvice();
      setReasoningResult({ type: 'phase_advice', data: advice, id: `reason_${Date.now()}` });
      setStrategistState(zeroDollarStrategist.getState());
    } catch (error) {
      console.error('Error getting advice:', error);
    }
    setIsLoading(false);
  };

  const evaluateOpportunity = async () => {
    if (!opportunityInput.trim()) return;
    setIsLoading(true);
    try {
      const result = await zeroDollarStrategist.evaluateNewOpportunity(opportunityInput);
      setReasoningResult({ type: 'opportunity', data: result, id: `reason_${Date.now()}` });
      setOpportunityInput('');
      setStrategistState(zeroDollarStrategist.getState());
    } catch (error) {
      console.error('Error evaluating:', error);
    }
    setIsLoading(false);
  };

  const createStrategy = async () => {
    setIsLoading(true);
    try {
      const skillList = skills.split(',').map(s => s.trim());
      const result = await zeroDollarStrategist.createPersonalizedPlan(skillList, hoursPerDay, riskTolerance);
      setReasoningResult({ type: 'strategy', data: result, id: `reason_${Date.now()}` });
      setStrategistState(zeroDollarStrategist.getState());
    } catch (error) {
      console.error('Error creating strategy:', error);
    }
    setIsLoading(false);
  };

  const getTodaysPlan = async () => {
    setIsLoading(true);
    try {
      const result = await zeroDollarStrategist.getTodaysActions(hoursPerDay);
      setReasoningResult({ type: 'today', data: result, id: `reason_${Date.now()}` });
    } catch (error) {
      console.error('Error getting plan:', error);
    }
    setIsLoading(false);
  };

  return {
    activeTab, setActiveTab,
    isLoading, setIsLoading,
    cryptoPrices,
    loopState,
    targetRevenue, setTargetRevenue,
    strategistState,
    reasoningResult,
    opportunityInput, setOpportunityInput,
    skills, setSkills,
    hoursPerDay, setHoursPerDay,
    riskTolerance, setRiskTolerance,
    feedbackStats, setFeedbackStats,
    loadCryptoPrices,
    getPhaseAdvice,
    evaluateOpportunity,
    createStrategy,
    getTodaysPlan,
  };
}
