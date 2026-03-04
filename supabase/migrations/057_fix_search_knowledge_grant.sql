-- ═══════════════════════════════════════════════════════════════
--  057 — Fix search_knowledge: auth guard + grant to authenticated
-- ═══════════════════════════════════════════════════════════════

-- The RPC was SECURITY DEFINER with execute revoked from authenticated,
-- so frontend calls via user JWT returned 403. Added auth.uid() guard
-- and granted execute to authenticated.

CREATE OR REPLACE FUNCTION public.search_knowledge(p_user_id uuid, p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, content text, summary text, topic text, subtopic text, domain text, item_type text, source_type text, source_title text, confidence real, keywords text[], mention_count integer, created_at timestamp with time zone, similarity real)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Auth guard: callers can only search their own knowledge
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    ki.id,
    ki.content,
    ki.summary,
    ki.topic,
    ki.subtopic,
    ki.domain,
    ki.item_type,
    ki.source_type,
    ki.source_title,
    ki.confidence,
    ki.keywords,
    ki.mention_count,
    ki.created_at,
    GREATEST(
      similarity(ki.content, p_query),
      similarity(COALESCE(ki.summary, ''), p_query),
      similarity(COALESCE(ki.topic, ''), p_query) * 1.2
    )::REAL AS similarity
  FROM knowledge_items ki
  WHERE ki.user_id = p_user_id
    AND ki.superseded_by IS NULL
    AND (ki.expires_at IS NULL OR ki.expires_at > now())
    AND (
      ki.content % p_query
      OR COALESCE(ki.summary, '') % p_query
      OR COALESCE(ki.topic, '') % p_query
      OR p_query = ANY(ki.keywords)
    )
  ORDER BY similarity DESC, ki.confidence DESC, ki.mention_count DESC
  LIMIT p_limit;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.search_knowledge TO authenticated;
