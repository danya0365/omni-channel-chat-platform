'use client';

import { useEffect, useMemo, useState } from 'react';

interface Bubble {
  id: number;
  size: number;
  left: number;
  top: number;
  delay: number;
  duration: number;
  opacity: number;
  color: string;
}

interface CrystalBubbleProps {
  count?: number;
}

/**
 * CrystalBubble Component
 * Decorative floating bubbles in the background
 */
export function CrystalBubble({ count = 10 }: CrystalBubbleProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const bubbles: Bubble[] = useMemo(() => {
    const colors = [
      'rgba(5, 150, 105, 0.12)',
      'rgba(245, 158, 11, 0.10)',
      'rgba(14, 165, 233, 0.10)',
      'rgba(5, 150, 105, 0.08)',
    ];

    return Array.from({ length: count }, (_, i) => ({
      id: i,
      size: 60 + Math.random() * 200,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 4,
      duration: 6 + Math.random() * 6,
      opacity: 0.3 + Math.random() * 0.4,
      color: colors[i % colors.length],
    }));
  }, [count]);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {bubbles.map((bubble) => (
        <div
          key={bubble.id}
          className="gradient-orb animate-float"
          style={{
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            left: `${bubble.left}%`,
            top: `${bubble.top}%`,
            background: bubble.color,
            animationDelay: `${bubble.delay}s`,
            animationDuration: `${bubble.duration}s`,
            opacity: bubble.opacity,
          }}
        />
      ))}
    </div>
  );
}
