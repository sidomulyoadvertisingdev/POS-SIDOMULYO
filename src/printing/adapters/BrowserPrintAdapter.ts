import type { BrowserPrintOptions, PrintAdapter, PrinterProfile } from '../types';
import { printHtmlWithIframe } from '../browserPrintDom';

const resolvePaperCssWidth = (profile: PrinterProfile): string => {
  if (profile.paperWidth === '58mm') return '58mm';
  if (profile.paperWidth === '80mm') return '80mm';
  return `calc(${Math.max(profile.charsPerLine, 32)}ch + 16px)`;
};

const escapeHtml = (value: string): string => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const stripLeadingTitleLine = (text: string, titleText: string): string => {
  const lines = String(text || '').split('\n');
  const normalizedTitle = String(titleText || '').trim();
  let removed = false;
  const filtered = lines.filter((line) => {
    if (removed) {
      return true;
    }
    if (String(line || '').trim() === normalizedTitle) {
      removed = true;
      return false;
    }
    return true;
  });
  return filtered.join('\n');
};

export const renderReceiptHtml = (
  text: string,
  profile: PrinterProfile,
  title = 'Receipt',
  options: Pick<BrowserPrintOptions, 'logoUrl' | 'hideTitleText' | 'titleText'> = {},
): string => {
  const paperWidth = resolvePaperCssWidth(profile);
  const preparedText = options.hideTitleText && options.titleText
    ? stripLeadingTitleLine(text, options.titleText)
    : String(text || '');
  const escaped = escapeHtml(preparedText);
  const logoUrl = String(options.logoUrl || '').trim();
  const logoBlock = logoUrl
    ? `<div class="receipt-logo-wrap"><img class="receipt-logo" src="${escapeHtml(logoUrl)}" alt="Logo Toko" /></div>`
    : '';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: auto; margin: 4mm; }
    body { margin: 0; padding: 0; background: #fff; font-family: "Courier New", monospace; }
    .receipt {
      width: ${paperWidth};
      margin: 0 auto;
      color: #000;
    }
    .receipt-logo-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0 0 8px;
    }
    .receipt-logo {
      max-width: min(70%, 160px);
      max-height: 72px;
      object-fit: contain;
      display: block;
    }
    .receipt-text {
      white-space: pre-wrap;
      font-size: 12px;
      line-height: 1.35;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="receipt">
    ${logoBlock}
    <pre class="receipt-text">${escaped}</pre>
  </div>
</body>
</html>`;
};

export class BrowserPrintAdapter implements PrintAdapter {
  constructor(private readonly options: BrowserPrintOptions = {}) {}

  async print(data: Uint8Array | string, profile: PrinterProfile): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Browser print hanya tersedia di environment browser.');
    }

    const receiptText = typeof data === 'string' ? data : new TextDecoder().decode(data);
    const html = renderReceiptHtml(receiptText, profile, this.options.title || 'Receipt', {
      logoUrl: this.options.logoUrl,
      hideTitleText: this.options.hideTitleText,
      titleText: this.options.titleText,
    });
    const printed = printHtmlWithIframe(html);
    if (!printed) {
      throw new Error('Browser iframe print tidak tersedia.');
    }
  }
}
