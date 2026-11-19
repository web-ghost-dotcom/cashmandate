import { animate, useInView } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  readonly target: number;
  readonly format: (value: number) => string;
}

/** Counts from zero to the target the first time it scrolls into view. */
export function CountUp({ target, format }: CountUpProps) {
  const containerReference = useRef<HTMLSpanElement>(null);
  const isInView = useInView(containerReference, { once: true });
  const [displayedValue, setDisplayedValue] = useState(0);

  useEffect(
    function runCountUp() {
      if (!isInView) {
        return undefined;
      }
      const animation = animate(0, target, {
        duration: 1.1,
        ease: [0.2, 0.7, 0.2, 1],
        onUpdate: function storeValue(latestValue) {
          setDisplayedValue(Math.round(latestValue));
        },
      });
      return function stopAnimation() {
        animation.stop();
      };
    },
    [isInView, target],
  );

  return (
    <span ref={containerReference} className="tabular">
      {format(displayedValue)}
    </span>
  );
}
