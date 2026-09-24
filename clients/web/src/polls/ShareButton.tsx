import { QRCodeSVG } from 'qrcode.react';
import { useId, useRef, useState } from 'react';
import type { Poll } from '../api/types';
import Dialog from '../ui/Dialog';
import { ShareIcon } from '../ui/icons';

interface ShareButtonProps {
  poll: Pick<Poll, 'id' | 'title' | 'visibility'>;
  className?: string;
}

/** The poll's link, as text to copy, as a QR code, and through the device's own share sheet. */
export default function ShareButton({ poll, className = 'button secondary' }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const url = `${window.location.origin}/p/${poll.id}`;

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
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <ShareIcon /> Share
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Share this poll">
        <p className="hint">
          Anyone with this link can vote.
          {poll.visibility === 'UNLISTED' && ' The poll is not listed anywhere else.'}
        </p>
        <label className="visually-hidden" htmlFor={inputId}>Link to the poll</label>
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
            onClick={() => navigator.share({ title: poll.title, url }).catch(() => {})}
          >
            <ShareIcon /> Share through an app
          </button>
        )}
      </Dialog>
    </>
  );
}
