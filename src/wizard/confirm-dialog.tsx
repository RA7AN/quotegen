/**
 * wizard/confirm-dialog.tsx — an in-app confirmation modal (FR-2.3 / AC-9, #49).
 *
 * The wizard never uses the browser's window.alert/confirm/prompt (an eval gate greps
 * for those call sites), so destructive actions route through this accessible dialog:
 * role="alertdialog", aria-modal, Escape/backdrop to cancel.
 *
 * Phone ergonomics (#49), all of which the audit measured failing before this change:
 *  - bottom sheet on small screens (`items-end`, full width, square bottom edge) and a
 *    centred card from `sm:` up. A centred `fixed` box drifts out of view when the
 *    on-screen keyboard resizes the visual viewport on iOS; an edge-anchored sheet does not.
 *  - `max-h-[80svh]` + `overflow-y-auto`, so a long message (multi-line profile names,
 *    clause previews) scrolls inside the sheet instead of pushing buttons off-screen.
 *  - buttons are 44 px tall and 12 px apart, stacked on phones.
 *  - **Cancel** takes initial focus, never the destructive action: focus used to land on
 *    "Delete", so an Enter/Space from a re-render or a keyboard user confirmed by accident.
 *    DOM order keeps Cancel first; `flex-col-reverse` paints the destructive action above it
 *    on phones, leaving the safe action on the bottom edge under the thumb.
 *  - background scroll is locked and Tab is trapped (see `useModal`).
 */

import { useRef } from 'react';
import { useModal } from '@/ui/modal';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useModal<HTMLDivElement>(open, onCancel, cancelRef);

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-band/50 sm:items-center sm:p-4"
      onPointerDown={onCancel}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="flex max-h-[80svh] w-full flex-col overflow-y-auto rounded-t-2xl border border-neutral-300 bg-white p-5 shadow-lg outline-none sm:max-w-sm sm:rounded-lg sm:p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-black sm:text-sm">{title}</h2>
        <p className="mt-2 text-base leading-relaxed text-neutral-700 sm:text-sm">{message}</p>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-[2.75rem] rounded border border-neutral-400 px-4 text-base sm:text-sm hover:bg-neutral-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[2.75rem] rounded bg-red-700 px-4 text-base font-semibold text-white sm:text-sm hover:bg-red-800"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
