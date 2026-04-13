const STRIP_SELECTOR = '[data-testid="learner-module-library-strip"]';

/**
 * Returns true when a Radix "outside interaction" event (pointerDownOutside,
 * interactOutside, focusOutside) originated inside the learner-module-library
 * strip.  Callers should `e.preventDefault()` when this returns true so that
 * modal dialogs / sheets don't dismiss while the user is working in the strip.
 */
export function shouldIgnoreOutsideInteraction(
  event: { target: EventTarget | null; detail?: { originalEvent?: Event } },
): boolean {
  const strip = document.querySelector(STRIP_SELECTOR);
  if (!strip) return false;
  const target = event.target;
  if (target instanceof Node && strip.contains(target)) return true;
  const original = (event as any).detail?.originalEvent;
  if (original && typeof original.composedPath === "function") {
    return original.composedPath().some((el: EventTarget) => el instanceof Node && strip.contains(el));
  }
  return false;
}
