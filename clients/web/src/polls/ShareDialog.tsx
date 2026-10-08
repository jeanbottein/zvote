import { QRCodeSVG } from 'qrcode.react';
import { useId, useRef, useState, type ReactNode } from 'react';
import Dialog from '../ui/Dialog';
import { MailIcon, ShareIcon } from '../ui/icons';
import { formatJoinCode } from './format';

interface ShareDialogProps {
  open: boolean;
  onClose(): void;
  title: string;
  /** Who can do what with the link. */
  hint: ReactNode;
  url: string;
  /** What the link is called, for screen readers. */
  linkLabel: string;
  /** The poll's title: the subject of a message carrying the link. */
  subject: string;
  /** What a message says before the link. */
  message?: string;
  /** A poll's own link has a join code, to read out or show. */
  joinCode?: string;
}

/**
 * A link to share: as text to copy, as a QR code, by email, and through the
 * device's own share sheet where there is one (most phones). A poll's own
 * link comes with its join code, large enough to read from across a room.
 */
export default function ShareDialog(props: ShareDialogProps) {
  const { open, onClose, title, hint, url, linkLabel, subject, message, joinCode } = props;
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const body = message ? `${message}\n\n${url}` : url;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      input.current?.select(); // no clipboard access (e.g. plain http): let the person copy it
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="hint">{hint}</p>
      {joinCode && (
        <div className="share-code">
          <span className="share-code-label">Join code</span>
          <strong className="join-code">{formatJoinCode(joinCode)}</strong>
          <span className="hint">to enter at {window.location.host}</span>
        </div>
      )}
      <label className="visually-hidden" htmlFor={inputId}>{linkLabel}</label>
      <div className="share-link">
        <input id={inputId} ref={input} value={url} readOnly onFocus={(event) => event.target.select()} />
        <button type="button" className="button primary" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <div className="share-qr">
        <QRCodeSVG value={url} size={192} marginSize={2} title={`QR code for ${url}`} />
      </div>
      {'share' in navigator && (
        <button
          type="button"
          className="button secondary wide"
          onClick={() => navigator.share({ title: subject, text: message, url }).catch(() => {})}
        >
          <ShareIcon /> Share through an app
        </button>
      )}
      <a
        className="button secondary wide"
        href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
      >
        <MailIcon /> Send by email
      </a>
    </Dialog>
  );
}
