import { useAfterIdle } from "@/lib/motion/use-after-idle";
import { useMediaQuery } from "@/lib/motion/use-media-query";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";

/**
 * Whether an FX component should load its motion chunk now.
 *
 * False on the server, during hydration and until the browser is idle (the
 * static markup is all that exists then), and false for good under reduced
 * motion, so those visitors never download the code. `pointer: true` also
 * requires a mouse-like device (hover + fine pointer) for effects that follow
 * the cursor.
 *
 * It follows the preference live: flipping reduced motion on unmounts the motion
 * chunk (its `useMotion` reverts everything), flipping it off mounts it again.
 */
export function useFxReady(options: { pointer?: boolean } = {}): boolean {
  const reduced = useReducedMotion();
  const idle = useAfterIdle();
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  return idle && !reduced && (options.pointer !== true || finePointer);
}
