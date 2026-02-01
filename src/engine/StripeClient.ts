// Stripe Integration for Sovereign Swarm
// Handles checkout sessions and payment processing

import { loadStripe, Stripe } from '@stripe/stripe-js';
import type { ProjectQuote } from './PricingEngine';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.warn('Stripe publishable key not found');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

// For client-side only - redirects to Stripe hosted checkout
export async function createCheckoutSession(
  quote: ProjectQuote,
  clientEmail: string,
  successUrl: string,
  cancelUrl: string
): Promise<CheckoutSession | null> {
  // In production, this would call your backend API
  // For now, we'll use Stripe Payment Links or a serverless function

  const stripe = await getStripe();
  if (!stripe) {
    console.error('Stripe not initialized');
    return null;
  }

  // Create line items from quote
  const lineItems = [
    {
      name: `${quote.type.replace('_', ' ').toUpperCase()} - ${quote.complexity}`,
      description: quote.description.slice(0, 200),
      amount: Math.round(quote.total * 100), // Stripe uses cents
      currency: 'usd',
      quantity: 1
    }
  ];

  // For demo purposes, return a mock session
  // In production, call your backend to create a real Checkout Session
  const mockSession: CheckoutSession = {
    id: `cs_demo_${Date.now()}`,
    url: `https://checkout.stripe.com/demo?amount=${quote.total}&project=${quote.id}`
  };

  console.log('Checkout session created:', mockSession);
  console.log('Line items:', lineItems);
  console.log('Client email:', clientEmail);

  return mockSession;
}

// Verify payment status (call from backend webhook in production)
export async function verifyPayment(paymentIntentId: string): Promise<boolean> {
  // In production, verify with Stripe API on backend
  console.log('Verifying payment:', paymentIntentId);
  return true;
}

// Format price for display
export function formatPrice(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(amount);
}

// Generate a Stripe Payment Link (for simple integration)
export function generatePaymentLink(quote: ProjectQuote): string {
  // This would be pre-created in Stripe Dashboard
  // Format: https://buy.stripe.com/xxxxx?prefilled_email=xxx&client_reference_id=xxx

  const baseUrl = import.meta.env.VITE_STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/test';
  const params = new URLSearchParams({
    client_reference_id: quote.id,
    // prefilled_email would be added dynamically
  });

  return `${baseUrl}?${params.toString()}`;
}
