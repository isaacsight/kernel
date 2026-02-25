import { useState, useEffect, useRef } from 'react'

export function useScrollTracking(messageCount: number) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const prevCountRef = useRef(messageCount)

  // Track scroll position — stable listener, no dependency on messageCount
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      setIsNearBottom(nearBottom)
      setShowScrollBtn(!nearBottom)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Auto-scroll only when new messages arrive AND user is near bottom
  useEffect(() => {
    if (messageCount > prevCountRef.current && isNearBottom) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
    prevCountRef.current = messageCount
  }, [messageCount, isNearBottom])

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }

  return { scrollRef, isNearBottom, showScrollBtn, scrollToBottom }
}
