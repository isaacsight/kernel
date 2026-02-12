// Inquiry Service — Saves leads to Supabase + creates Stripe Checkout Session
import { supabase } from './SupabaseClient'
import type { ProjectQuote } from './PricingEngine'

export interface Inquiry {
  id: string
  name: string
  email: string
  details: string
  description: string
  evaluation_score: number
  evaluation_tier: string
  quote_total: number | null
  quote_type: string | null
  quote_complexity: string | null
  stripe_payment_link: string | null
  status: 'new' | 'contacted' | 'paid' | 'in_progress' | 'completed'
  created_at: string
}

export interface InquirySubmission {
  name: string
  email: string
  details: string
  description: string
  evaluationScore: number
  evaluationTier: string
  quote: ProjectQuote | null
}

export interface InquiryResult {
  inquiryId: string
  checkoutUrl: string | null
}

/**
 * Submit an inquiry: saves to Supabase, creates Stripe Checkout Session,
 * and fires off email notification.
 */
export async function submitInquiry(submission: InquirySubmission): Promise<InquiryResult | null> {
  const id = `inquiry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const inquiry: Omit<Inquiry, 'created_at'> = {
    id,
    name: submission.name.trim(),
    email: submission.email.trim(),
    details: submission.details.trim(),
    description: submission.description,
    evaluation_score: submission.evaluationScore,
    evaluation_tier: submission.evaluationTier,
    quote_total: submission.quote?.total ?? null,
    quote_type: submission.quote?.type ?? null,
    quote_complexity: submission.quote?.complexity ?? null,
    stripe_payment_link: null,
    status: 'new',
  }

  // 1. Save to Supabase
  const { error: dbError } = await supabase
    .from('inquiries')
    .insert(inquiry)

  if (dbError) {
    console.error('Failed to save inquiry to Supabase:', dbError)
    saveToLocalStorage(inquiry)
  }

  // 2. Create Stripe Checkout Session via Edge Function
  let checkoutUrl: string | null = null
  if (submission.quote?.total) {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: {
          inquiryId: id,
          email: submission.email.trim(),
          name: submission.name.trim(),
          amount: submission.quote.total,
          description: submission.description,
          score: submission.evaluationScore,
          tier: submission.evaluationTier,
          quoteType: submission.quote.type,
        },
      })
      if (fnError) {
        console.error('Checkout session creation failed:', fnError)
      } else if (data?.url) {
        checkoutUrl = data.url
      }
    } catch (e) {
      console.error('Edge function call failed:', e)
    }
  }

  // 3. Fire-and-forget email notification (don't block redirect)
  supabase.functions.invoke('send-inquiry-email', {
    body: { inquiry, paymentLink: checkoutUrl },
  }).catch(e => console.error('Email notification failed:', e))

  return { inquiryId: id, checkoutUrl }
}

/**
 * Get all inquiries (for dashboard use)
 */
export async function getInquiries(status?: Inquiry['status']): Promise<Inquiry[]> {
  let query = supabase
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('Failed to fetch inquiries:', error)
    return []
  }
  return data || []
}

/**
 * Update inquiry status (e.g. after payment or contact)
 */
export async function updateInquiryStatus(id: string, status: Inquiry['status']) {
  const { error } = await supabase
    .from('inquiries')
    .update({ status })
    .eq('id', id)

  if (error) console.error('Failed to update inquiry:', error)
}

// Fallback if Supabase insert fails
function saveToLocalStorage(inquiry: Omit<Inquiry, 'created_at'>) {
  try {
    const existing = JSON.parse(localStorage.getItem('project_inquiries') || '[]')
    existing.push({ ...inquiry, created_at: new Date().toISOString() })
    localStorage.setItem('project_inquiries', JSON.stringify(existing))
  } catch (e) {
    console.error('localStorage fallback also failed:', e)
  }
}
