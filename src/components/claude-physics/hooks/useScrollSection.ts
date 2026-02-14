import { useRef } from 'react'
import { useScroll, useTransform, useSpring, type MotionValue } from 'framer-motion'

interface UseScrollSectionOptions {
  offset?: [string, string]
}

interface UseScrollSectionReturn {
  ref: React.RefObject<HTMLDivElement | null>
  scrollYProgress: MotionValue<number>
  smoothProgress: MotionValue<number>
}

export function useScrollSection(options?: UseScrollSectionOptions): UseScrollSectionReturn {
  const ref = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: (options?.offset ?? ["start end", "end start"]) as unknown as undefined,
  })

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  return { ref, scrollYProgress, smoothProgress }
}

export function useScrollTransform(
  scrollYProgress: MotionValue<number>,
  inputRange: number[],
  outputRange: number[],
) {
  return useTransform(scrollYProgress, inputRange, outputRange)
}
