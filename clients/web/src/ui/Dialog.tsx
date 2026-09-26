import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';

interface DialogProps {
  open: boolean;
  onClose(): void;
  title: string;
  children: ReactNode;
}

/**
 * A modal dialog on the native <dialog> element, which brings focus trapping,
 * Escape to close and the backdrop. Clicking the backdrop closes it too.
 *
 * Its content exists only while it is open: a page that updates live does not
 * re-render what nobody sees. It opens and closes before the browser paints,
 * so it never shows empty.
 */
export default function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) {
      dialog?.showModal();
    } else if (!open && dialog?.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose(); // the backdrop: the dialog's own box is covered by .dialog-body
        }
      }}
    >
      {open && (
        <div className="dialog-body">
          <div className="dialog-header">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
