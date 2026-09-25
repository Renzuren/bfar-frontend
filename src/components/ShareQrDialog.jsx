// src/components/ShareQrDialog.jsx
// QR code for a questionnaire's public link, so respondents can scan it
// instead of being sent the URL. The code is drawn in the browser (no
// external service) and can be downloaded as a PNG for printing or chat.

import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { copyToClipboard } from '@/lib/utils';

// Drawn large and scaled down on screen, so the downloaded PNG prints sharply.
const QR_PIXELS = 1024;

const fileNameFor = (title) =>
  `qr-${String(title || 'questionnaire').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'questionnaire'}.png`;

export default function ShareQrDialog({ open, onOpenChange, url, title }) {
  const canvasWrapRef = useRef(null);

  const handleDownload = () => {
    const canvas = canvasWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = fileNameFor(title);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleCopy = async () => {
    if (await copyToClipboard(url)) toast.success('Questionnaire link copied!');
    else toast.error('Could not copy the link');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">QR Code</DialogTitle>
          <DialogDescription>
            I-scan para buksan ang questionnaire{title ? ` "${title}"` : ''}. I-download para i-print o ipadala.
          </DialogDescription>
        </DialogHeader>

        <div ref={canvasWrapRef} className="flex justify-center rounded-xl border border-slate-200 bg-white p-4">
          <QRCodeCanvas
            value={url || ''}
            size={QR_PIXELS}
            level="M"
            marginSize={2}
            style={{ width: '100%', maxWidth: 256, height: 'auto' }}
            aria-label="QR code for the questionnaire link"
          />
        </div>
        <p className="break-all text-center text-xs text-slate-500">{url}</p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button onClick={handleDownload} className="gap-2 bg-slate-900 hover:bg-slate-800">
            <Download className="h-4 w-4" /> Download PNG
          </Button>
          <Button variant="outline" onClick={handleCopy} className="gap-2">
            <Copy className="h-4 w-4" /> Copy link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
