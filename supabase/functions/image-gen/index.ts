// Supabase Edge Function: image-gen
// Generates images via Gemini API, gated by image credits.
// Users must purchase credit packs — 1 credit = 1 image.
//
// Deploy: npx supabase functions deploy image-gen --project-ref eoxxpyixdieprsxlpwcs
// Secrets: GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType, requireJsonBody, requireFields } from '../_shared/validate.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

interface ImageGenPayload {
  prompt?: string
  image?: string           // base64 of previous image for refinement
  image_mime_type?: string  // e.g. 'image/png'
  reference_images?: Array<{ data: string; mime_type: string }>  // uploaded files/images as style/content references
  action?: 'check_credits' | 'get_auto_reload' | 'set_auto_reload'
  pack?: string | null
  threshold?: number
}

type PackType = 'starter' | 'standard' | 'power'
const PACK_AMOUNTS: Record<PackType, number> = { starter: 499, standard: 1299, power: 2999 }
const PACK_CREDITS: Record<PackType, number> = { starter: 25, standard: 75, power: 200 }

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req)
  }

  const CORS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    // ── Content-type check ──────────────────────────────
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS)

    // ── Auth: verify JWT ────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const userId = user.id

    // ── Admin bypass ──────────────────────────────────────
    const ADMIN_IDS = new Set(
      (Deno.env.get('ADMIN_USER_IDS') || '').split(',').map(s => s.trim()).filter(Boolean)
    )
    const isAdmin = ADMIN_IDS.has(userId)

    // ── Service client for RPCs ─────────────────────────
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ── Check image credits ─────────────────────────────
    const { data: creditData, error: creditErr } = await svc.rpc('check_image_credits', {
      p_user_id: userId,
    })

    if (creditErr) {
      console.error('check_image_credits RPC error:', creditErr)
      return new Response(
        JSON.stringify({ error: 'Failed to check credits' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const credits = (creditData as { credits: number })?.credits ?? 0

    // ── Parse body ──────────────────────────────────────
    // 20MB limit to accommodate multiple reference images (up to 4 × 4MB base64)
    const { body, error: bodyErr } = await requireJsonBody<ImageGenPayload>(req, 20 * 1024 * 1024)
    if (bodyErr) return bodyErr(CORS)

    // ── Action handlers ──────────────────────────────────
    if (body?.action === 'check_credits') {
      return new Response(
        JSON.stringify({ credits }),
        { headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    if (body?.action === 'get_auto_reload') {
      const { data, error } = await svc.rpc('get_auto_reload', { p_user_id: userId })
      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to get auto-reload settings' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
        )
      }
      return new Response(
        JSON.stringify(data),
        { headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    if (body?.action === 'set_auto_reload') {
      const { data, error } = await svc.rpc('set_auto_reload', {
        p_user_id: userId,
        p_pack: body.pack ?? null,
        p_threshold: body.threshold ?? 5,
      })
      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to update auto-reload settings' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
        )
      }
      return new Response(
        JSON.stringify(data),
        { headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    // ── Require credits for generation (admins bypass) ────
    if (!isAdmin && credits <= 0) {
      return new Response(
        JSON.stringify({ error: 'no_credits', credits: 0 }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    // ── Rate limit: 10/min (admins bypass) ────────────────
    if (!isAdmin) {
      const rl = await checkRateLimit(svc, userId, 'image-gen', 'free')
      if (!rl.allowed) return rateLimitResponse(rl, CORS)
    }

    // ── Validate prompt ─────────────────────────────────
    if (!body?.prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: prompt' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const { prompt, image: inputImage, image_mime_type: inputMimeType, reference_images: refImages } = body

    // Sanitize prompt length
    if (prompt.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Prompt too long (max 2000 characters)' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    // Validate input image size (4MB base64 limit to prevent OOM)
    if (inputImage && inputImage.length > 4 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Input image too large (max 4MB)' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    // Validate reference images (max 4, each max 4MB)
    const validRefImages = (refImages || [])
      .filter(r => r.data && r.mime_type && r.data.length <= 4 * 1024 * 1024)
      .slice(0, 4)

    // ── Call Gemini API ─────────────────────────────────
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      console.error('Missing GEMINI_API_KEY')
      return new Response(
        JSON.stringify({ error: 'Image generation not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`

    // Build multimodal request — refinement image, reference images, then prompt
    const parts: Array<Record<string, unknown>> = []
    if (inputImage && inputMimeType) {
      parts.push({ inlineData: { mimeType: inputMimeType, data: inputImage } })
    }
    // Add reference images so Gemini uses them for style/content guidance
    for (const ref of validRefImages) {
      parts.push({ inlineData: { mimeType: ref.mime_type, data: ref.data } })
    }
    // Augment prompt with reference context when images are provided
    const hasReferences = validRefImages.length > 0
    const augmentedPrompt = hasReferences
      ? `${prompt}\n\nUse the provided reference image${validRefImages.length > 1 ? 's' : ''} to inform the style, composition, colors, and content of the generated image.`
      : prompt
    parts.push({ text: augmentedPrompt })

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error('Gemini API error:', geminiRes.status, errText)
      return new Response(
        JSON.stringify({ error: 'Image generation failed', details: `Gemini API returned ${geminiRes.status}` }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const geminiData = await geminiRes.json()

    // Extract image from response parts
    const responseParts = geminiData?.candidates?.[0]?.content?.parts
    if (!responseParts || !Array.isArray(responseParts)) {
      console.error('Gemini response missing parts:', JSON.stringify(geminiData).slice(0, 500))
      return new Response(
        JSON.stringify({ error: 'Image generation failed', details: 'No content in response' }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const imagePart = responseParts.find(
      (p: { inlineData?: { mimeType?: string; data?: string } }) =>
        p.inlineData?.mimeType?.startsWith('image/')
    )

    if (!imagePart?.inlineData) {
      // Gemini may have returned text-only (e.g., content policy refusal)
      const textPart = responseParts.find((p: { text?: string }) => p.text)
      const reason = textPart?.text || 'No image generated'
      return new Response(
        JSON.stringify({ error: 'no_image', details: reason }),
        { status: 422, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const imageBase64 = imagePart.inlineData.data
    const imageMimeType = imagePart.inlineData.mimeType

    // ── Upload to Supabase Storage + persist metadata ──────────
    let imageUrl: string | undefined
    try {
      const ext = (imageMimeType as string).split('/')[1] || 'png'
      const imageId = crypto.randomUUID()
      const storagePath = `${userId}/${imageId}.${ext}`

      // Decode base64 → Uint8Array for upload
      const raw = atob(imageBase64 as string)
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)

      const { error: uploadErr } = await svc.storage
        .from('generated-images')
        .upload(storagePath, bytes, {
          contentType: imageMimeType as string,
          upsert: false,
        })

      if (uploadErr) {
        console.error('Storage upload error:', uploadErr)
      } else {
        // Insert metadata row
        await svc.from('generated_images').insert({
          user_id: userId,
          prompt,
          storage_path: storagePath,
          mime_type: imageMimeType,
        })

        // Get signed URL (1 year expiry)
        const { data: signedData } = await svc.storage
          .from('generated-images')
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

        imageUrl = signedData?.signedUrl
      }
    } catch (storageErr) {
      // Non-blocking — image was still generated, just not persisted
      console.error('Image storage error:', storageErr)
    }

    // ── Decrement credit (only after successful generation, admins skip) ──
    let decrData = null
    if (!isAdmin) {
      const { data, error: decrErr } = await svc.rpc('decrement_image_credit', {
        p_user_id: userId,
      })
      decrData = data
      if (decrErr) {
        console.error('decrement_image_credit RPC error:', decrErr)
        // Image was generated but credit wasn't deducted — log and return image anyway
        // (better UX than failing after generation; audit trail catches discrepancies)
      }
    }

    const decrResult = decrData as { success: boolean; credits: number } | null
    let creditsRemaining = isAdmin ? Infinity : (decrResult?.credits ?? credits - 1)
    let autoReloaded = false
    let reloadedPack: string | null = null
    let reloadedCredits = 0

    // ── Auto-reload check ─────────────────────────────────
    try {
      const { data: reloadSettings } = await svc.rpc('get_auto_reload', { p_user_id: userId })
      const settings = reloadSettings as { enabled: boolean; pack: string; threshold: number; has_payment_method: boolean } | null

      if (settings?.enabled && settings.has_payment_method && creditsRemaining <= settings.threshold) {
        const pack = settings.pack as PackType
        if (PACK_AMOUNTS[pack] && PACK_CREDITS[pack]) {
          // Get Stripe customer ID
          const { data: memRow } = await svc
            .from('user_memory')
            .select('stripe_customer_id')
            .eq('user_id', userId)
            .single()
          const customerId = memRow?.stripe_customer_id

          if (customerId) {
            const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
            if (stripeKey) {
              // 1. Get saved payment method
              const pmRes = await fetch(
                `https://api.stripe.com/v1/customers/${customerId}/payment_methods?type=card&limit=1`,
                { headers: { Authorization: `Bearer ${stripeKey}` } }
              )
              if (pmRes.ok) {
                const pmData = await pmRes.json()
                const paymentMethodId = pmData.data?.[0]?.id
                if (paymentMethodId) {
                  // 2. Create off-session PaymentIntent
                  const piParams = new URLSearchParams()
                  piParams.set('amount', String(PACK_AMOUNTS[pack]))
                  piParams.set('currency', 'usd')
                  piParams.set('customer', customerId)
                  piParams.set('payment_method', paymentMethodId)
                  piParams.set('off_session', 'true')
                  piParams.set('confirm', 'true')
                  piParams.set('metadata[supabase_user_id]', userId)
                  piParams.set('metadata[pack]', pack)
                  piParams.set('metadata[auto_reload]', 'true')

                  const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${stripeKey}`,
                      'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: piParams.toString(),
                  })

                  if (piRes.ok) {
                    // 3. Add credits
                    const { data: addData } = await svc.rpc('add_image_credits', {
                      p_user_id: userId,
                      p_amount: PACK_CREDITS[pack],
                    })
                    const addResult = addData as { success: boolean; credits: number } | null
                    if (addResult?.success) {
                      creditsRemaining = addResult.credits
                      autoReloaded = true
                      reloadedPack = pack
                      reloadedCredits = PACK_CREDITS[pack]
                      console.log(`Auto-reloaded ${PACK_CREDITS[pack]} credits (${pack}) for user ${userId}`)
                    }
                  } else {
                    const piErr = await piRes.text()
                    console.error('Auto-reload PaymentIntent failed:', piRes.status, piErr)
                  }
                }
              }
            }
          }
        }
      }
    } catch (reloadErr) {
      // Non-blocking — don't fail the image response
      console.error('Auto-reload check failed:', reloadErr)
    }

    // ── Audit log ───────────────────────────────────────
    logAudit(svc, {
      actorId: userId,
      eventType: 'edge_function.call',
      action: 'image-gen',
      source: 'image-gen',
      status: 'success',
      statusCode: 200,
      metadata: {
        promptLength: prompt.length,
        mimeType: imageMimeType,
        creditsRemaining,
        ...(inputImage && { isRefinement: true }),
        ...(validRefImages.length > 0 && { referenceImageCount: validRefImages.length }),
        ...(autoReloaded && { autoReloaded: true, reloadedPack, reloadedCredits }),
      },
      ip: getClientIP(req),
      userAgent: getUA(req),
    })

    return new Response(
      JSON.stringify({
        image: imageBase64,
        mimeType: imageMimeType,
        credits_remaining: creditsRemaining,
        ...(imageUrl && { image_url: imageUrl }),
        ...(autoReloaded && { auto_reloaded: true, reloaded_pack: reloadedPack, reloaded_credits: reloadedCredits }),
      }),
      { headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (error) {
    console.error('image-gen error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }
})
