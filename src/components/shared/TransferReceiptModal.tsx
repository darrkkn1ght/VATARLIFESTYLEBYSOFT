import { useState } from 'react';
import { Check, CheckCircle2, Copy, Download, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatNaira } from '@/features/treasury/services/treasuryService';

export interface TransferReceiptData {
  title: string;
  reference: string;
  recipient: string;
  senders: string[];
  totalAmount: number;
  sentAmount: number;
  status: string;
  timestamp: string;
  priceNgn?: number | null;
  txCount?: number | null;
  note?: string | null;
}

interface TransferReceiptModalProps {
  receipt: TransferReceiptData | null;
  onClose: () => void;
}

function formatReceiptDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildReceiptText(receipt: TransferReceiptData): string {
  const pct =
    receipt.totalAmount > 0
      ? Math.min(100, Math.round((receipt.sentAmount / receipt.totalAmount) * 100))
      : 100;
  const lines = [
    'VATAR LIFESTYLE BY SOFT — TRANSFER RECEIPT',
    '------------------------------------------',
    `Type: ${receipt.title}`,
    `Reference: ${receipt.reference}`,
    `Status: ${receipt.status.toUpperCase()} (${pct}%)`,
    `Recipient: @${receipt.recipient.replace(/^@/, '')}`,
    `Amount Sent: ${formatNaira(receipt.sentAmount)} of ${formatNaira(receipt.totalAmount)}`,
    receipt.priceNgn ? `Order Value: ₦${receipt.priceNgn.toLocaleString()}` : null,
    receipt.senders.length > 0
      ? `Sender(s): ${receipt.senders.map((s) => `@${s.replace(/^@/, '')}`).join(', ')}`
      : null,
    receipt.txCount ? `Transactions: ${receipt.txCount}` : null,
    `Date: ${formatReceiptDate(receipt.timestamp)}`,
    receipt.note ? `Note: ${receipt.note}` : null,
    '------------------------------------------',
    'Verified by VATAR LIFESTYLE BY SOFT',
  ].filter(Boolean);
  return lines.join('\n');
}

function downloadReceiptPng(receipt: TransferReceiptData) {
  const width = 900;
  const height = 1040;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, width, height);

  // Outer gold border
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 32, width - 64, height - 64);

  // Header brand
  ctx.fillStyle = '#d4af37';
  ctx.font = '700 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('VATAR LIFESTYLE BY SOFT', 72, 108);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '500 18px system-ui, -apple-system, sans-serif';
  ctx.fillText('OFFICIAL TRANSFER PROOF & RECEIPT', 72, 140);

  // Divider
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(72, 172);
  ctx.lineTo(width - 72, 172);
  ctx.stroke();

  // Amount highlight
  const pct =
    receipt.totalAmount > 0
      ? Math.min(100, Math.round((receipt.sentAmount / receipt.totalAmount) * 100))
      : 100;

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 58px system-ui, -apple-system, sans-serif';
  ctx.fillText(formatNaira(receipt.sentAmount), 72, 256);

  ctx.fillStyle = '#34d399';
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${receipt.status.toUpperCase()}  •  ${pct}% DELIVERED`, 72, 298);

  // Key-value rows
  const rows: [string, string][] = [
    ['RECEIPT TYPE', receipt.title],
    ['REFERENCE', receipt.reference],
    ['RECIPIENT', `@${receipt.recipient.replace(/^@/, '')}`],
    ['TARGET AMOUNT', formatNaira(receipt.totalAmount)],
    [
      'SENDER ACCOUNT(S)',
      receipt.senders.length > 0
        ? receipt.senders.map((s) => `@${s.replace(/^@/, '')}`).join(', ')
        : 'VATAR Admin Pool',
    ],
    ...(receipt.priceNgn ? ([['ORDER VALUE', `₦${receipt.priceNgn.toLocaleString()}`]] as [string, string][]) : []),
    ...(receipt.txCount ? ([['TRANSACTIONS', String(receipt.txCount)]] as [string, string][]) : []),
    ['TIMESTAMP', formatReceiptDate(receipt.timestamp)],
  ];

  let y = 368;
  for (const [label, value] of rows) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(72, y - 34);
    ctx.lineTo(width - 72, y - 34);
    ctx.stroke();

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '600 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(label, 72, y);

    ctx.fillStyle = '#f4f4f5';
    ctx.font = '600 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(value.slice(0, 44), 320, y);

    y += 66;
  }

  // Footer
  ctx.fillStyle = '#d4af37';
  ctx.font = '600 16px system-ui, -apple-system, sans-serif';
  ctx.fillText('VERIFIED BY VATAR LIFESTYLE BY SOFT  •  vatar-lifestyle-by-soft.onrender.com', 72, height - 74);

  const link = document.createElement('a');
  link.download = `VATAR-Receipt-${receipt.reference.replace(/[^A-Za-z0-9_-]/g, '')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function TransferReceiptModal({ receipt, onClose }: TransferReceiptModalProps) {
  const [copied, setCopied] = useState(false);

  if (!receipt) return null;

  const pct =
    receipt.totalAmount > 0
      ? Math.min(100, Math.round((receipt.sentAmount / receipt.totalAmount) * 100))
      : 100;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildReceiptText(receipt));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Official Transfer Receipt"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-brand-gold/60 bg-brand-black p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b hairline-border pb-4">
          <div>
            <p className="flex items-center gap-1.5 font-heading text-[0.65rem] tracking-[0.22em] text-brand-gold uppercase">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              VATAR Official Receipt
            </p>
            <h3 className="mt-1 font-heading text-xl text-brand-white">
              {receipt.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer p-1 text-brand-muted hover:text-brand-white"
            aria-label="Close receipt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Amount & Progress */}
        <div className="mt-5 border border-brand-gold/30 bg-brand-charcoal/70 p-4 text-center">
          <p className="font-heading text-3xl font-semibold text-brand-white">
            {formatNaira(receipt.sentAmount)}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 font-heading text-[0.7rem] tracking-[0.18em] text-emerald-300 uppercase">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {receipt.status} &bull; {pct}% Delivered
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden bg-brand-black">
            <div
              className="h-full bg-brand-gold transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Details */}
        <dl className="mt-4 divide-y divide-brand-cream/10 text-xs">
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-brand-muted uppercase">Reference</dt>
            <dd className="font-heading tracking-[0.14em] text-brand-gold">
              {receipt.reference}
            </dd>
          </div>
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-brand-muted uppercase">Recipient</dt>
            <dd className="font-medium text-brand-white">
              @{receipt.recipient.replace(/^@/, '')}
            </dd>
          </div>
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-brand-muted uppercase">Target Amount</dt>
            <dd className="font-medium text-brand-white">
              {formatNaira(receipt.totalAmount)}
            </dd>
          </div>
          {receipt.priceNgn ? (
            <div className="flex justify-between gap-3 py-2.5">
              <dt className="text-brand-muted uppercase">Order Value</dt>
              <dd className="font-medium text-brand-white">
                ₦{receipt.priceNgn.toLocaleString()}
              </dd>
            </div>
          ) : null}
          {receipt.senders.length > 0 && (
            <div className="flex justify-between gap-3 py-2.5">
              <dt className="text-brand-muted uppercase">Sender(s)</dt>
              <dd className="text-right font-medium text-brand-cream">
                {receipt.senders.map((s) => `@${s.replace(/^@/, '')}`).join(', ')}
              </dd>
            </div>
          )}
          {receipt.txCount ? (
            <div className="flex justify-between gap-3 py-2.5">
              <dt className="text-brand-muted uppercase">Transactions</dt>
              <dd className="font-medium text-brand-white">{receipt.txCount}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-brand-muted uppercase">Date &amp; Time</dt>
            <dd className="font-medium text-brand-cream">
              {formatReceiptDate(receipt.timestamp)}
            </dd>
          </div>
          {receipt.note && (
            <div className="flex justify-between gap-3 py-2.5">
              <dt className="text-brand-muted uppercase">Proof Note</dt>
              <dd className="max-w-[230px] text-right text-brand-muted">{receipt.note}</dd>
            </div>
          )}
        </dl>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => void handleCopy()}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Text
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => downloadReceiptPng(receipt)}
          >
            <Download className="h-3.5 w-3.5" />
            Save Image
          </Button>
        </div>
      </div>
    </div>
  );
}
