import { BrowserPrintAdapter } from './adapters/BrowserPrintAdapter';
import { printHtmlWithIframe } from './browserPrintDom';
import type { PrintReceiptOptions } from './printReceipt';
import type { BrowserPrintOptions, PrinterProfile } from './types';

export interface BrowserPrintMessages {
  blocked?: string;
  unsupported?: string;
}

export interface ReserveBrowserPrintWindowOptions {
  title?: string;
  features?: string;
  loadingHtml?: string;
  messages?: BrowserPrintMessages;
}

const DEFAULT_MESSAGES: Required<BrowserPrintMessages> = {
  blocked: 'Popup browser diblokir. Izinkan popup untuk mencetak nota.',
  unsupported: 'Preview browser hanya tersedia pada mode web.',
};

const escapeHtml = (value: string): string => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const buildErrorHtml = (title: string, message: string, detail = ''): string => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; background: #fff; }
    .card { max-width: 720px; margin: 0 auto; border: 1px solid #d8d8d8; padding: 20px; }
    h1 { margin: 0 0 12px; font-size: 20px; }
    p { margin: 0 0 10px; line-height: 1.5; }
    pre { white-space: pre-wrap; word-break: break-word; background: #f6f6f6; padding: 12px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    ${detail ? `<pre>${escapeHtml(detail)}</pre>` : ''}
  </div>
</body>
</html>`;

export const isBrowserPrintProfile = (profile: PrinterProfile): boolean => {
  return profile.type === 'browser' || profile.connection === 'browser';
};

export const reserveBrowserPrintWindow = (
  options: ReserveBrowserPrintWindowOptions = {},
): { windowRef: Window | null; errorMessage: string | null } => {
  if (typeof window === 'undefined') {
    return {
      windowRef: null,
      errorMessage: options.messages?.unsupported || DEFAULT_MESSAGES.unsupported,
    };
  }

  return {
    windowRef: null,
    errorMessage: null,
  };
};

export const closeBrowserPrintWindow = (windowRef: Window | null | undefined): void => {
  if (!windowRef || typeof windowRef.close !== 'function') {
    return;
  }

  try {
    windowRef.close();
  } catch (_error) {
    // Ignore browser-specific close failures.
  }
};

export const writeHtmlToPrintWindow = (
  html: string,
  options: {
    title?: string;
    windowRef?: Window | null;
    reserveIfNeeded?: boolean;
    reserveOptions?: ReserveBrowserPrintWindowOptions;
  } = {},
): boolean => {
  let targetWindow = options.windowRef || null;
  const title = String(options.title || 'Cetak Nota').trim() || 'Cetak Nota';
  const resolvedHtml = String(html || '').trim()
    ? html
    : buildErrorHtml(title, 'Konten cetak kosong.', 'HTML print yang dihasilkan kosong sehingga browser hanya menampilkan about:blank.');

  if (!targetWindow && options.reserveIfNeeded !== false) {
    targetWindow = null;
  }

  if (!targetWindow) {
    return printHtmlWithIframe(resolvedHtml);
  }

  try {
    const printed = printHtmlWithIframe(resolvedHtml);
    closeBrowserPrintWindow(targetWindow);
    return printed;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown browser print error';
    try {
      const printed = printHtmlWithIframe(buildErrorHtml(title, 'Dokumen cetak gagal ditulis ke jendela browser.', detail));
      closeBrowserPrintWindow(targetWindow);
      return printed;
    } catch (_nestedError) {
      return false;
    }
  }
};

export const createBrowserPrintOptions = (
  profile: PrinterProfile,
  windowRef: Window | null | undefined,
  browserOptions: Partial<BrowserPrintOptions> = {},
): PrintReceiptOptions => {
  if (!windowRef) {
    const browserAdapter = new BrowserPrintAdapter(browserOptions);
    return {
      adapter: isBrowserPrintProfile(profile) ? browserAdapter : undefined,
      browserFallbackAdapter: browserAdapter,
    };
  }

  const browserAdapter = new BrowserPrintAdapter({ ...browserOptions, windowRef });
  return {
    adapter: isBrowserPrintProfile(profile) ? browserAdapter : undefined,
    browserFallbackAdapter: browserAdapter,
  };
};
