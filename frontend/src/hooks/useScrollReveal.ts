import { useEffect, useRef, useState } from 'react';

interface UseScrollRevealOptions {
    threshold?: number;
    rootMargin?: string;
    triggerOnce?: boolean;
    delay?: number;
}

/**
 * Hook for scroll-triggered reveal animations
 * Uses Intersection Observer for performance
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
    options: UseScrollRevealOptions = {}
) {
    const {
        threshold = 0.1,
        rootMargin = '0px 0px -50px 0px',
        triggerOnce = true,
        delay = 0
    } = options;

    const ref = useRef<T>(null);
    const [isRevealed, setIsRevealed] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;

        if (prefersReducedMotion) {
            setIsRevealed(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        if (delay > 0) {
                            setTimeout(() => setIsRevealed(true), delay);
                        } else {
                            setIsRevealed(true);
                        }

                        if (triggerOnce) {
                            observer.unobserve(element);
                        }
                    } else if (!triggerOnce) {
                        setIsRevealed(false);
                    }
                });
            },
            { threshold, rootMargin }
        );

        observer.observe(element);

        return () => observer.disconnect();
    }, [threshold, rootMargin, triggerOnce, delay]);

    return { ref, isRevealed };
}

/**
 * Hook for staggered reveal of multiple elements
 */
export function useStaggeredReveal(
    itemCount: number,
    options: UseScrollRevealOptions & { staggerDelay?: number } = {}
) {
    const { staggerDelay = 100, ...revealOptions } = options;
    const containerRef = useRef<HTMLDivElement>(null);
    const [revealedItems, setRevealedItems] = useState<boolean[]>(
        new Array(itemCount).fill(false)
    );

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const prefersReducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;

        if (prefersReducedMotion) {
            setRevealedItems(new Array(itemCount).fill(true));
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // Stagger the reveal of each item
                        for (let i = 0; i < itemCount; i++) {
                            setTimeout(() => {
                                setRevealedItems((prev) => {
                                    const next = [...prev];
                                    next[i] = true;
                                    return next;
                                });
                            }, i * staggerDelay);
                        }

                        if (revealOptions.triggerOnce !== false) {
                            observer.unobserve(element);
                        }
                    }
                });
            },
            {
                threshold: revealOptions.threshold ?? 0.1,
                rootMargin: revealOptions.rootMargin ?? '0px 0px -50px 0px'
            }
        );

        observer.observe(element);

        return () => observer.disconnect();
    }, [itemCount, staggerDelay, revealOptions.threshold, revealOptions.rootMargin, revealOptions.triggerOnce]);

    return { containerRef, revealedItems };
}

/**
 * Hook for hero entrance animation (triggers on mount)
 */
export function useHeroEntrance(totalElements: number = 5, baseDelay: number = 100) {
    const [visibleElements, setVisibleElements] = useState<boolean[]>(
        new Array(totalElements).fill(false)
    );

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;

        if (prefersReducedMotion) {
            setVisibleElements(new Array(totalElements).fill(true));
            return;
        }

        // Stagger the entrance of hero elements
        for (let i = 0; i < totalElements; i++) {
            setTimeout(() => {
                setVisibleElements((prev) => {
                    const next = [...prev];
                    next[i] = true;
                    return next;
                });
            }, 200 + i * baseDelay); // Start after 200ms initial delay
        }
    }, [totalElements, baseDelay]);

    return visibleElements;
}

/**
 * Hook for parallax scroll effect
 */
export function useParallax(speed: number = 0.5) {
    const ref = useRef<HTMLDivElement>(null);
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;

        if (prefersReducedMotion) return;

        const handleScroll = () => {
            if (!ref.current) return;

            const rect = ref.current.getBoundingClientRect();
            const scrolled = window.innerHeight - rect.top;
            const parallaxOffset = scrolled * speed;

            setOffset(parallaxOffset);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial calculation

        return () => window.removeEventListener('scroll', handleScroll);
    }, [speed]);

    return { ref, offset };
}

export default useScrollReveal;
