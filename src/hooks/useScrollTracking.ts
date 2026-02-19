import { useState, useEffect, useRef } from 'react'

export function useScrollTracking(messageCount: number) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  // Track scroll position
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      setIsNearBottom(nearBottom)
      setShowScrollBtn(!nearBottom && messageCount > 0)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [messageCount])

  // Auto-scroll only when near bottom
  useEffect(() => {
    if (isNearBottom) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messageCount, isNearBottom])

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }

  return { scrollRef, isNearBottom, showScrollBtn, scrollToBottom }
}
