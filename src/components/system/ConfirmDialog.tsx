'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './ConfirmDialog.module.css';

type Props = {
  open: boolean;
  /** Heading, e.g. "Delete Playlist". */
  title: string;
  /** The question. Wrap the subject in <strong> so it reads like the heading. */
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` paints the confirm button rose — use it for anything destructive. */
  tone?: 'danger' | 'default';
  /** While true the actions lock, so a slow DELETE can't be fired twice. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * The site's confirm popup — what window.confirm() would have shown, in the
 * site's own chrome. Escape and a backdrop click cancel; focus starts on Cancel
 * (never on the destructive button) and returns to the trigger on close.
 *
 * Portalled to <body> so a card with `overflow: hidden` can't clip it.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreFocusTo = useRef<Element | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement;
    cancelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (restoreFocusTo.current instanceof HTMLElement) restoreFocusTo.current.focus();
    };
  }, [open, busy, onCancel]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (!busy && e.target === e.currentTarget) onCancel();
      }}
    >
      <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button
          type="button"
          className={styles.close}
          onClick={onCancel}
          disabled={busy}
          aria-label="Close"
        >
          &#215;
        </button>

        <h3 id={titleId} className={styles.title}>
          {title}
        </h3>

        <p className={styles.body}>{children}</p>

        <div className={styles.actions}>
          <button ref={cancelRef} type="button" className={styles.btn} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${tone === 'danger' ? styles.danger : ''}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
