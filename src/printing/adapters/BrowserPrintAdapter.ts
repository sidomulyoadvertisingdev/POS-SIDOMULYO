import type { BrowserPrintOptions, PrintAdapter, PrinterProfile, ReceiptData, ReceiptItem } from '../types';
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

const formatReceiptAmount = (value: number): string => {
  const amount = Number(value || 0);
  const sign = amount < 0 ? '-' : '';
  const whole = Math.abs(Math.round(amount)).toString();
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped}`;
};

const formatQty = (value: number): string => {
  const amount = Number(value || 0);
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
};

const hasValue = (value: unknown): boolean => {
  const text = String(value || '').trim();
  return Boolean(text) && text !== '-';
};

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

const splitReceiptHeader = (text: string): { header: string; body: string } => {
  const lines = String(text || '').split('\n');
  const dividerIndex = lines.findIndex((line) => /^-+\s*$/.test(String(line || '')));
  if (dividerIndex <= 0) {
    return {
      header: '',
      body: String(text || ''),
    };
  }

  const headerLines = lines.slice(0, dividerIndex).join('\n').trimEnd();
  const bodyLines = lines.slice(dividerIndex).join('\n').trimStart();
  return {
    header: headerLines,
    body: bodyLines,
  };
};

const splitReceiptNotice = (text: string): { beforeNotice: string; noticeLines: string[]; afterNotice: string } => {
  const lines = String(text || '').split('\n');
  const noticeStartIndex = lines.findIndex((line) => String(line || '').trim() === 'NB :');
  if (noticeStartIndex < 0) {
    return {
      beforeNotice: String(text || ''),
      noticeLines: [],
      afterNotice: '',
    };
  }

  let noticeEndIndex = lines.length;
  for (let index = noticeStartIndex + 1; index < lines.length; index += 1) {
    if (!String(lines[index] || '').trim()) {
      noticeEndIndex = index;
      break;
    }
  }

  return {
    beforeNotice: lines.slice(0, noticeStartIndex).join('\n').trimEnd(),
    noticeLines: lines
      .slice(noticeStartIndex + 1, noticeEndIndex)
      .map((line) => String(line || '').trim())
      .filter(Boolean),
    afterNotice: lines.slice(noticeEndIndex).join('\n').trim(),
  };
};

const buildDashedDivider = (): string => '<div class="receipt-divider" aria-hidden="true"></div>';

const renderMetaRow = (label: string, value: string): string => `
  <div class="receipt-meta-row">
    <div class="receipt-meta-label">${escapeHtml(label)}</div>
    <div class="receipt-meta-value">${escapeHtml(value)}</div>
  </div>
`;

const renderDetailRow = (label: string, value: string): string => `
  <div class="receipt-item-detail-row">
    <span class="receipt-item-detail-label">${escapeHtml(label)}</span>
    <span class="receipt-item-detail-value">${escapeHtml(value)}</span>
  </div>
`;

const renderItemCard = (item: ReceiptItem): string => {
  const details: string[] = [];
  if (hasValue(item.size)) details.push(renderDetailRow('Ukuran', String(item.size || '').trim()));
  if (hasValue(item.material)) details.push(renderDetailRow('Bahan', String(item.material || '').trim()));
  if (hasValue(item.finishing)) details.push(renderDetailRow('Finishing', String(item.finishing || '').trim()));
  if (hasValue(item.lbMax)) details.push(renderDetailRow('LB Max', String(item.lbMax || '').trim()));
  if (typeof item.pages === 'number' && Number.isFinite(item.pages) && item.pages > 1) {
    details.push(renderDetailRow('Halaman', String(item.pages)));
  }
  if (hasValue(item.notes)) details.push(renderDetailRow('Catatan', String(item.notes || '').trim()));

  return `
    <div class="receipt-item">
      <div class="receipt-item-top">
        <div class="receipt-item-name">${escapeHtml(item.name)}</div>
        <div class="receipt-item-total">${escapeHtml(formatReceiptAmount(item.total))}</div>
      </div>
      <div class="receipt-item-qty-price">${escapeHtml(`${formatQty(item.qty)} x ${formatReceiptAmount(item.price)}`)}</div>
      ${details.length > 0 ? `<div class="receipt-item-details">${details.join('')}</div>` : ''}
    </div>
  `;
};

const renderSummaryRow = (label: string, value: number | string, emphasis = false): string => `
  <div class="receipt-summary-row${emphasis ? ' receipt-summary-row-emphasis' : ''}">
    <div class="receipt-summary-label">${escapeHtml(label)}</div>
    <div class="receipt-summary-value">${escapeHtml(typeof value === 'number' ? formatReceiptAmount(value) : String(value || ''))}</div>
  </div>
`;

const renderStructuredReceipt = (
  receipt: ReceiptData,
  profile: PrinterProfile,
  title: string,
  logoUrl: string,
): string => {
  const paperWidth = resolvePaperCssWidth(profile);
  const noticeLines = Array.isArray(receipt.detail?.footerNotes)
    ? receipt.detail.footerNotes.filter((item) => hasValue(item))
    : [];
  const orderDetails = Array.isArray(receipt.detail?.orderDetails)
    ? receipt.detail.orderDetails.filter((item) => hasValue(item))
    : [];
  const summaryRows = [
    renderSummaryRow('Sub Total', receipt.summary.subtotal, true),
    renderSummaryRow('Diskon', receipt.summary.discount || 0),
    typeof receipt.summary.tax === 'number' && receipt.summary.tax > 0
      ? renderSummaryRow('Pajak', receipt.summary.tax)
      : '',
    typeof receipt.summary.serviceCharge === 'number' && receipt.summary.serviceCharge > 0
      ? renderSummaryRow('Biaya Layanan', receipt.summary.serviceCharge)
      : '',
    receipt.payment?.method
      ? renderSummaryRow(`Pembayaran ${receipt.payment.method}`, receipt.payment.amount || receipt.summary.grandTotal, true)
      : '',
    renderSummaryRow('Total', receipt.summary.grandTotal, true),
    typeof receipt.summary.change === 'number' && receipt.summary.change > 0
      ? renderSummaryRow('Kembalian', receipt.summary.change)
      : '',
    typeof receipt.summary.remainingDue === 'number' && receipt.summary.remainingDue > 0
      ? renderSummaryRow('Sisa', receipt.summary.remainingDue)
      : '',
  ].filter(Boolean);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: auto; margin: 3mm; }
    :root {
      --ink: #000;
      --paper: #fff;
      --line: #000;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: "Courier New", "Liberation Mono", monospace;
    }
    .receipt {
      width: ${paperWidth};
      margin: 0 auto;
      background: var(--paper);
      color: var(--ink);
      padding: 2.5mm 2mm 3.5mm;
      font-size: ${profile.paperWidth === '58mm' ? '10px' : '11px'};
      line-height: 1.3;
    }
    .receipt-header {
      text-align: center;
    }
    .receipt-logo-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0 0 6px;
    }
    .receipt-logo {
      display: block;
      width: auto;
      max-width: min(74%, 138px);
      max-height: 48px;
      margin: 0 auto;
      object-fit: contain;
      filter: grayscale(1) contrast(1.08);
    }
    .receipt-brand {
      font-weight: 700;
      letter-spacing: 0.02em;
      word-break: break-word;
      overflow-wrap: anywhere;
      color: #000;
    }
    .receipt-address,
    .receipt-title,
    .receipt-footer-center {
      margin-top: 2px;
      word-break: break-word;
      overflow-wrap: anywhere;
      text-align: center;
      color: #000;
    }
    .receipt-title {
      margin-top: 5px;
    }
    .receipt-divider {
      width: 100%;
      border-top: 1px dashed var(--line);
      margin: 8px 0 7px;
    }
    .receipt-meta-row,
    .receipt-summary-row,
    .receipt-table-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: start;
    }
    .receipt-meta-row {
      margin-bottom: 2px;
    }
    .receipt-meta-label,
    .receipt-summary-label {
      padding-right: 6px;
      color: #000;
    }
    .receipt-meta-value,
    .receipt-summary-value,
    .receipt-head-total,
    .receipt-item-total {
      text-align: right;
      word-break: break-word;
      color: #000;
    }
    .receipt-table-head {
      font-weight: 700;
      margin-bottom: 5px;
      color: #000;
    }
    .receipt-head-name,
    .receipt-head-total {
      font-weight: 700;
    }
    .receipt-item {
      padding: 0 0 6px;
      margin-bottom: 6px;
      border-bottom: 1px dashed var(--line);
    }
    .receipt-item:last-child {
      margin-bottom: 0;
    }
    .receipt-item-top {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: start;
    }
    .receipt-item-name,
    .receipt-item-total {
      font-weight: 700;
      color: #000;
    }
    .receipt-item-name {
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .receipt-item-qty-price {
      margin-top: 2px;
      color: #000;
    }
    .receipt-item-details {
      margin-top: 3px;
      display: grid;
      gap: 1px;
      font-size: ${profile.paperWidth === '58mm' ? '9px' : '10px'};
      line-height: 1.2;
    }
    .receipt-item-detail-row {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr);
      gap: 4px;
      align-items: start;
    }
    .receipt-item-detail-label::after {
      content: " :";
    }
    .receipt-item-detail-value {
      word-break: break-word;
      overflow-wrap: anywhere;
      color: #000;
    }
    .receipt-summary {
      display: grid;
      gap: 2px;
    }
    .receipt-summary-row {
      margin-bottom: 1px;
    }
    .receipt-summary-row-emphasis .receipt-summary-label,
    .receipt-summary-row-emphasis .receipt-summary-value {
      font-weight: 700;
    }
    .receipt-summary-row:last-child .receipt-summary-label,
    .receipt-summary-row:last-child .receipt-summary-value {
      font-size: ${profile.paperWidth === '58mm' ? '11px' : '12px'};
      font-weight: 800;
    }
    .receipt-detail-block {
      margin-top: 7px;
    }
    .receipt-detail-title {
      font-weight: 700;
      margin-bottom: 2px;
      color: #000;
    }
    .receipt-detail-line {
      word-break: break-word;
      overflow-wrap: anywhere;
      margin-bottom: 1px;
      color: #000;
    }
    .receipt-notice {
      margin-top: 8px;
      font-size: ${profile.paperWidth === '58mm' ? '7.6px' : '8.6px'};
      line-height: 1.18;
      color: #000;
    }
    .receipt-notice-title {
      font-weight: 400;
      margin-bottom: 2px;
    }
    .receipt-notice-line {
      padding-left: 8px;
      text-indent: -7px;
      margin-bottom: 1px;
      font-weight: 400;
    }
    .receipt-footer {
      margin-top: 9px;
      text-align: center;
      color: #000;
    }
    .receipt-footer-thanks {
      font-weight: 700;
      margin-bottom: 2px;
      color: #000;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="receipt-header">
      ${logoUrl ? `<div class="receipt-logo-wrap"><img class="receipt-logo" src="${escapeHtml(logoUrl)}" alt="Logo Toko" /></div>` : ''}
      ${hasValue(receipt.store.name) ? `<div class="receipt-brand">${escapeHtml(receipt.store.name)}</div>` : ''}
      ${hasValue(receipt.store.address) ? `<div class="receipt-address">${escapeHtml(receipt.store.address)}</div>` : ''}
      ${hasValue(receipt.store.phone) ? `<div class="receipt-address">${escapeHtml(receipt.store.phone || '')}</div>` : ''}
      ${hasValue(receipt.store.title) ? `<div class="receipt-title">${escapeHtml(receipt.store.title || '')}</div>` : ''}
    </div>

    ${buildDashedDivider()}

    <div class="receipt-meta">
      ${renderMetaRow('No. Nota', receipt.transaction.invoiceNo)}
      ${renderMetaRow('Tanggal', receipt.transaction.date)}
      ${hasValue(receipt.transaction.orderId) ? renderMetaRow('Order ID', String(receipt.transaction.orderId || '').trim()) : ''}
      ${hasValue(receipt.transaction.customer) ? renderMetaRow('Pelanggan', String(receipt.transaction.customer || '').trim()) : ''}
      ${hasValue(receipt.transaction.customerPhone) ? renderMetaRow('No Telp', String(receipt.transaction.customerPhone || '').trim()) : ''}
      ${hasValue(receipt.transaction.cashier) ? renderMetaRow('Kasir', String(receipt.transaction.cashier || '').trim()) : ''}
      ${hasValue(receipt.transaction.printedAt) ? renderMetaRow('Dicetak', String(receipt.transaction.printedAt || '').trim()) : ''}
    </div>

    ${buildDashedDivider()}

    <div class="receipt-items">
      <div class="receipt-table-head">
        <div class="receipt-head-name">Nama Barang</div>
        <div class="receipt-head-total">Total Harga</div>
      </div>
      ${buildDashedDivider()}
      ${receipt.items.map((item) => renderItemCard(item)).join('')}
    </div>

    <div class="receipt-summary">
      ${summaryRows.join('')}
    </div>

    ${hasValue(receipt.detail?.deadline) ? `
      <div class="receipt-detail-block">
        <div class="receipt-detail-title">Deadline :</div>
        <div class="receipt-detail-line">${escapeHtml(String(receipt.detail?.deadline || '').trim())}</div>
      </div>
    ` : ''}
    ${orderDetails.length > 0 ? `
      <div class="receipt-detail-block">
        <div class="receipt-detail-title">Rincian :</div>
        ${orderDetails.map((item) => `<div class="receipt-detail-line">${escapeHtml(String(item || '').trim())}</div>`).join('')}
      </div>
    ` : ''}
    ${hasValue(receipt.transaction.notes) ? `
      <div class="receipt-detail-block">
        <div class="receipt-detail-title">Catatan :</div>
        ${String(receipt.transaction.notes || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean).map((item) => `<div class="receipt-detail-line">${escapeHtml(item)}</div>`).join('')}
      </div>
    ` : ''}

    ${noticeLines.length > 0 ? `
      <div class="receipt-notice">
        <div class="receipt-notice-title">NB :</div>
        ${noticeLines.map((line) => `<div class="receipt-notice-line">${escapeHtml(line)}</div>`).join('')}
      </div>
    ` : ''}

    <div class="receipt-footer">
      <div class="receipt-footer-thanks">${escapeHtml(receipt.detail?.thankYouText || 'TERIMA KASIH')}</div>
      ${hasValue(receipt.store.footer) ? `<div class="receipt-footer-center">${escapeHtml(receipt.store.footer || '')}</div>` : ''}
    </div>
  </div>
</body>
</html>`;
};

export const renderReceiptHtml = (
  text: string,
  profile: PrinterProfile,
  title = 'Receipt',
  options: Pick<BrowserPrintOptions, 'logoUrl' | 'hideTitleText' | 'titleText' | 'receiptData'> = {},
): string => {
  const receiptData = options.receiptData || null;
  if (receiptData && typeof receiptData === 'object') {
    return renderStructuredReceipt(
      receiptData,
      profile,
      title,
      String(options.logoUrl || receiptData.store?.logoUrl || '').trim(),
    );
  }

  const paperWidth = resolvePaperCssWidth(profile);
  const preparedText = options.hideTitleText && options.titleText
    ? stripLeadingTitleLine(text, options.titleText)
    : String(text || '');
  const { header, body } = splitReceiptHeader(preparedText);
  const { beforeNotice, noticeLines, afterNotice } = splitReceiptNotice(body || preparedText);
  const escapedHeader = escapeHtml(header);
  const escapedBodyBeforeNotice = escapeHtml(beforeNotice);
  const escapedBodyAfterNotice = escapeHtml(afterNotice);
  const noticeBlock = noticeLines.length > 0
    ? `
      <div class="receipt-notice">
        <div class="receipt-notice-title">NB :</div>
        ${noticeLines.map((line) => `<div class="receipt-notice-line">${escapeHtml(line)}</div>`).join('')}
      </div>
    `
    : '';
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
    @page { size: auto; margin: 3mm; }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: "Courier New", "Liberation Mono", monospace;
    }
    .receipt {
      width: ${paperWidth};
      margin: 0 auto;
      color: #000;
      background: #fff;
      padding: 2mm 1.5mm 3mm;
    }
    .receipt-logo-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0 0 6px;
    }
    .receipt-logo {
      max-width: min(72%, 140px);
      max-height: 46px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
      filter: grayscale(1) contrast(1.2);
    }
    .receipt-text {
      white-space: pre-wrap;
      font-size: ${profile.paperWidth === '58mm' ? '11px' : '12px'};
      line-height: 1.42;
      letter-spacing: 0;
      margin: 0;
    }
    .receipt-text-header {
      text-align: center;
      margin-bottom: 0;
    }
    .receipt-text-body {
      text-align: left;
    }
    .receipt-notice {
      margin-top: 4px;
      margin-bottom: 4px;
      font-size: ${profile.paperWidth === '58mm' ? '10px' : '11px'};
      line-height: 1.35;
    }
    .receipt-notice-title {
      font-weight: 700;
      margin-bottom: 2px;
    }
    .receipt-notice-line {
      margin: 0 0 2px;
    }
  </style>
</head>
<body>
  <div class="receipt">
    ${logoBlock}
    ${escapedHeader ? `<pre class="receipt-text receipt-text-header">${escapedHeader}</pre>` : ''}
    ${escapedBodyBeforeNotice ? `<pre class="receipt-text receipt-text-body">${escapedBodyBeforeNotice}</pre>` : ''}
    ${noticeBlock}
    ${escapedBodyAfterNotice ? `<pre class="receipt-text receipt-text-body">${escapedBodyAfterNotice}</pre>` : ''}
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
      receiptData: this.options.receiptData,
    });
    const printed = printHtmlWithIframe(html);
    if (!printed) {
      throw new Error('Browser iframe print tidak tersedia.');
    }
  }
}
