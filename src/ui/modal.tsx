/**
 * ui/modal.tsx — the behaviour every overlay in the app shares (#49).
 *
 * A modal that works on a phone needs more than `fixed inset-0`: the page behind must stop
 * scrolling (iOS rubber-bands the document under an open sheet otherwise), Escape and Tab
 * must stay inside the dialog, the element that opened it must get focus back, and taps
 * outside must dismiss through a pointer event (`mousedown` is a compatibility event on
 * touch and is suppressed by scroll gestures and double-tap-zoom).
 *
 * `useModal` owns exactly that behaviour and no markup, so `ConfirmDialog`, the wizard's
 * library pickers and the tab bar's "More" sheet can each render their own semantics
 * (`role="alertdialog"` vs `role="dialog"`) without duplicating the plumbing.
 *
 * Positioning convention for everything built on this hook: sheets are BOTTOM-anchored on
 * phones (`items-end`, full width, square bottom corners) and centre-floating from `sm:`
 * up. A centred box on a 390 px screen leaves nothing to tap and breaks when the on-screen
 * keyboard resizes the visual viewport.
 */

'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/** Focusable descendants, in DOM order. Keep in sync with the Tab trap below. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Locks background scrolling, traps Tab, closes on Escape, moves initial focus into the
 * panel and restores focus to the trigger on close.
 *
 * @param open      whether the overlay is currently mounted/visible
 * @param onClose   Escape handler (also the caller's backdrop handler)
 * @param focusRef  element to focus on open; falls back to the panel itself (which should
 *                  then carry `tabIndex={-1}` plus its accessible name)
 * @returns         ref to attach to the panel element
 */
export function useModal<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  focusRef?: RefObject<HTMLElement | null>,
): RefObject<T | null> {
  const panelRef = useRef<T | null>(null);
  // Callers pass inline arrows; keep them out of the dependency list so the lock/restore
  // cycle runs once per open, not once per parent render.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const trigger = document.activeElement as HTMLElement | null;
    const body = document.body;
    const previous = { overflow: body.style.overflow, overscroll: body.style.overscrollBehavior };
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'contain';

    const target = focusRef?.current ?? panel;
    target?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      // Shift+Tab on the first item wraps to the last, and vice versa. Anything already
      // inside the panel is left alone.
      if (active && !panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      body.style.overflow = previous.overflow;
      body.style.overscrollBehavior = previous.overscroll;
      if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    };
    // focusRef is a stable ref object for the lifetime of the overlay.
  }, [open, focusRef]);

  return panelRef;
}
