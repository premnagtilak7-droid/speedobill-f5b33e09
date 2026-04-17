import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  /** Delay (in seconds) before the animation starts. Useful for staggering siblings. */
  delay?: number;
  /** Animation duration in seconds — only used when type="tween". Defaults to 0.7s. */
  duration?: number;
  /** How far (in px) the element should travel upward as it fades in. */
  yOffset?: number;
  /** Initial scale value before snapping to 1. */
  initialScale?: number;
  /** Viewport amount (0-1) of the element that must be visible before triggering. */
  amount?: number;
  /** Optional className passed to the wrapper. */
  className?: string;
  /** Render as a different motion element (defaults to div). */
  as?: "div" | "section" | "article" | "li" | "span";
  /** Animation curve type. "spring" gives a premium, slightly bouncy feel. Defaults to "spring". */
  type?: "spring" | "tween";
  /** Spring stiffness (only when type="spring"). Higher = snappier. */
  stiffness?: number;
  /** Spring damping (only when type="spring"). Lower = more bounce. */
  damping?: number;
}

/**
 * ScrollReveal — premium scroll-triggered "fade up + scale in" wrapper.
 * Animates children only once the first time they enter the viewport.
 * Default transition is a smooth spring for a premium feel.
 */
const ScrollReveal = ({
  children,
  delay = 0,
  duration = 0.7,
  yOffset = 32,
  initialScale = 0.96,
  amount = 0.2,
  className,
  as = "div",
  type = "spring",
  stiffness = 80,
  damping = 18,
}: ScrollRevealProps) => {
  const transition =
    type === "spring"
      ? { type: "spring" as const, stiffness, damping, mass: 0.9, delay }
      : { duration, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

  const variants: Variants = {
    hidden: { opacity: 0, y: yOffset, scale: initialScale },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition,
    },
  };

  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={variants}
    >
      {children}
    </MotionTag>
  );
};

export default ScrollReveal;
