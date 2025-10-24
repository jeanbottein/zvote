import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, shareUrl }) => {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Select the text when modal opens
      inputRef.current.select();
    }
  }, [isOpen]);

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (inputRef.current) {
        inputRef.current.select();
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content share-modal">
        <div className="modal-header">
          <h2>Share this vote</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="share-url-section">
            <label htmlFor="share-url-input" className="share-label">
              Share link:
            </label>
            <div className="share-url-container">
              <input
                id="share-url-input"
                ref={inputRef}
                type="text"
                value={shareUrl}
                readOnly
                className="share-url-input"
                onClick={(e) => e.currentTarget.select()}
              />
              <button
                onClick={handleCopy}
                className={`copy-button ${copied ? 'copied' : ''}`}
                title={copied ? 'Copied!' : 'Copy to clipboard'}
              >
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          </div>

          <div className="qr-code-section">
            <p className="qr-label">Scan QR code:</p>
            <div className="qr-code-container">
              <QRCodeSVG
                value={shareUrl}
                size={200}
                level="M"
                includeMargin={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
