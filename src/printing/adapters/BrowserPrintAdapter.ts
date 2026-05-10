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

const isWorkOrderReceipt = (receipt: ReceiptData): boolean => {
  const title = String(receipt?.store?.title || '').trim().toLowerCase();
  const thankYouText = String(receipt?.detail?.thankYouText || '').trim().toLowerCase();
  return title.includes('spk') || thankYouText.includes('spk');
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
      <div class="receipt-item-grid">
        <div class="receipt-item-name">${escapeHtml(item.name)}</div>
        <div class="receipt-item-qty">${escapeHtml(formatQty(item.qty))}</div>
        <div class="receipt-item-price">${escapeHtml(formatReceiptAmount(item.price))}</div>
        <div class="receipt-item-total">${escapeHtml(formatReceiptAmount(item.total))}</div>
      </div>
      ${details.length > 0 ? `<div class="receipt-item-details">${details.join('')}</div>` : ''}
    </div>
  `;
};

const renderSummaryRow = (
  label: string,
  value: number | string,
  emphasis = false,
  extraClass = '',
): string => `
  <div class="receipt-summary-row${emphasis ? ' receipt-summary-row-emphasis' : ''}${extraClass ? ` ${extraClass}` : ''}">
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
  const isThermal58 = profile.paperWidth === '58mm';
  const isWorkOrder = isWorkOrderReceipt(receipt);
  const documentLabel = isWorkOrder ? 'SPK' : 'Nota';
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
    renderSummaryRow('Total', receipt.summary.grandTotal, true, 'receipt-summary-row-total'),
    typeof receipt.summary.change === 'number' && receipt.summary.change > 0
      ? renderSummaryRow('Kembalian', receipt.summary.change, true)
      : '',
    typeof receipt.summary.remainingDue === 'number' && receipt.summary.remainingDue > 0
      ? renderSummaryRow('Sisa', receipt.summary.remainingDue, true)
      : '',
  ].filter(Boolean);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: ${paperWidth} auto;
      margin: ${isThermal58 ? '2.5mm' : '3mm'};
    }
    :root {
      --ink: #000;
      --paper: #fff;
      --line: #000;
      --page-width: ${paperWidth};
      --body-size: ${isThermal58 ? '11px' : '13px'};
      --meta-size: ${isThermal58 ? '11px' : '12.5px'};
      --detail-size: ${isThermal58 ? '10px' : '11px'};
      --header-size: ${isThermal58 ? '16px' : '18px'};
      --document-size: ${isThermal58 ? '13px' : '15px'};
      --table-size: ${isThermal58 ? '10px' : '12px'};
      --total-size: ${isThermal58 ? '15px' : '17px'};
      --footer-size: ${isThermal58 ? '10px' : '11px'};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: Consolas, "DejaVu Sans Mono", "Roboto Mono", "Courier New", monospace;
      font-size: var(--body-size);
      line-height: 1.28;
      font-weight: 600;
      color-adjust: exact;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      display: flex;
      justify-content: center;
    }
    .receipt {
      width: var(--page-width);
      max-width: var(--page-width);
      margin: 0 auto;
      background: var(--paper);
      color: var(--ink);
      padding: ${isThermal58 ? '2mm 2mm 3mm' : '2.5mm 2.5mm 3.5mm'};
      font-size: var(--body-size);
      line-height: 1.28;
      overflow: hidden;
      flex: 0 0 auto;
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
      max-height: ${isThermal58 ? '40px' : '52px'};
      margin: 0 auto;
      object-fit: contain;
      image-rendering: crisp-edges;
      filter: grayscale(1) contrast(1.18);
    }
    .receipt-brand {
      font-size: var(--header-size);
      font-weight: 800;
      word-break: break-word;
      overflow-wrap: anywhere;
      color: #000;
      line-height: 1.2;
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
    .receipt-address {
      font-size: var(--meta-size);
      line-height: 1.24;
      font-weight: 600;
    }
    .receipt-title {
      margin-top: 5px;
      font-size: var(--document-size);
      font-weight: 800;
      line-height: 1.2;
    }
    .receipt-divider {
      width: 100%;
      border-top: 1px solid var(--line);
      margin: 7px 0 6px;
    }
    .receipt-meta-row,
    .receipt-summary-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: start;
    }
    .receipt-meta-row {
      margin-bottom: 3px;
      font-size: var(--meta-size);
      line-height: 1.24;
    }
    .receipt-meta-label,
    .receipt-summary-label {
      padding-right: 6px;
      color: #000;
      font-weight: 700;
    }
    .receipt-meta-value,
    .receipt-summary-value,
    .receipt-item-qty,
    .receipt-item-price,
    .receipt-item-total {
      text-align: right;
      word-break: break-word;
      color: #000;
      font-weight: 700;
    }
    .receipt-items {
      font-family: Consolas, "DejaVu Sans Mono", "Roboto Mono", "Courier New", monospace;
      font-size: var(--table-size);
      line-height: 1.24;
      font-weight: 700;
    }
    .receipt-table-head {
      display: grid;
      grid-template-columns: minmax(0, ${isThermal58 ? '1.45fr' : '1.7fr'}) minmax(26px, ${isThermal58 ? '0.38fr' : '0.45fr'}) minmax(${isThermal58 ? '42px' : '48px'}, ${isThermal58 ? '0.78fr' : '0.9fr'}) minmax(${isThermal58 ? '52px' : '56px'}, 1fr);
      gap: ${isThermal58 ? '4px' : '6px'};
      align-items: end;
      margin-bottom: 4px;
      padding-bottom: 3px;
      border-bottom: 1px solid var(--line);
      color: #000;
    }
    .receipt-head-name,
    .receipt-head-qty,
    .receipt-head-price,
    .receipt-head-total {
      font-weight: 800;
    }
    .receipt-head-qty,
    .receipt-head-price,
    .receipt-head-total {
      text-align: right;
    }
    .receipt-item {
      padding: 0 0 5px;
      margin-bottom: 5px;
      border-bottom: 1px solid var(--line);
    }
    .receipt-item:last-child {
      margin-bottom: 0;
    }
    .receipt-item-grid {
      display: grid;
      grid-template-columns: minmax(0, ${isThermal58 ? '1.45fr' : '1.7fr'}) minmax(26px, ${isThermal58 ? '0.38fr' : '0.45fr'}) minmax(${isThermal58 ? '42px' : '48px'}, ${isThermal58 ? '0.78fr' : '0.9fr'}) minmax(${isThermal58 ? '52px' : '56px'}, 1fr);
      gap: ${isThermal58 ? '4px' : '6px'};
      align-items: start;
    }
    .receipt-item-name,
    .receipt-item-qty,
    .receipt-item-price,
    .receipt-item-total {
      font-weight: 700;
      color: #000;
    }
    .receipt-item-name {
      word-break: break-word;
      overflow-wrap: break-word;
      min-width: 0;
    }
    .receipt-item-details {
      margin-top: 3px;
      display: grid;
      gap: 1px;
      font-size: var(--detail-size);
      line-height: 1.22;
    }
    .receipt-item-detail-row {
      display: grid;
      grid-template-columns: ${isThermal58 ? '52px' : '66px'} minmax(0, 1fr);
      gap: 4px;
      align-items: start;
    }
    .receipt-item-detail-label {
      font-weight: 700;
    }
    .receipt-item-detail-label::after {
      content: " :";
    }
    .receipt-item-detail-value {
      word-break: break-word;
      overflow-wrap: break-word;
      color: #000;
      font-weight: 600;
    }
    .receipt-summary {
      display: grid;
      gap: 2px;
      margin-top: 7px;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      padding: 6px 0 5px;
    }
    .receipt-summary-row {
      margin-bottom: 1px;
      font-size: var(--table-size);
    }
    .receipt-summary-row-emphasis .receipt-summary-label,
    .receipt-summary-row-emphasis .receipt-summary-value {
      font-weight: 800;
    }
    .receipt-summary-row-total {
      font-size: var(--total-size);
      font-weight: 800;
      line-height: 1.2;
      padding-top: 3px;
      margin-top: 2px;
      border-top: 1px solid var(--line);
    }
    .receipt-detail-block {
      margin-top: 7px;
    }
    .receipt-detail-title {
      font-size: var(--meta-size);
      font-weight: 800;
      margin-bottom: 2px;
      color: #000;
    }
    .receipt-detail-line {
      word-break: break-word;
      overflow-wrap: break-word;
      margin-bottom: 2px;
      color: #000;
      font-size: var(--meta-size);
      line-height: 1.24;
      font-weight: 600;
    }
    .receipt-notice {
      margin-top: 8px;
      font-size: var(--footer-size);
      line-height: 1.22;
      color: #000;
    }
    .receipt-notice-title {
      font-weight: 800;
      margin-bottom: 2px;
    }
    .receipt-notice-line {
      padding-left: 8px;
      text-indent: -7px;
      margin-bottom: 1px;
      font-weight: 600;
    }
    .receipt-footer {
      margin-top: 9px;
      text-align: center;
      color: #000;
    }
    .receipt-footer-thanks {
      font-size: var(--footer-size);
      font-weight: 800;
      margin-bottom: 2px;
      color: #000;
    }
    .receipt-footer-center {
      font-size: var(--footer-size);
      line-height: 1.24;
      font-weight: 600;
    }
    .receipt-code-block {
      margin-top: 8px;
      display: grid;
      justify-items: center;
      gap: 4px;
    }
    .receipt-code-label {
      font-size: var(--footer-size);
      font-weight: 800;
      color: #000;
    }
    .receipt-code-value {
      font-family: Consolas, "DejaVu Sans Mono", "Roboto Mono", "Courier New", monospace;
      font-size: var(--meta-size);
      line-height: 1.2;
      text-align: center;
      word-break: break-word;
      color: #000;
      font-weight: 700;
    }
    @media print {
      html, body {
        width: var(--page-width);
        background: #fff;
        margin: 0 auto;
      }
      .receipt {
        width: var(--page-width);
        max-width: var(--page-width);
        margin: 0;
        padding: ${isThermal58 ? '2mm 2mm 3mm' : '2.5mm 2.5mm 3.5mm'};
      }
      body {
        display: block;
      }
      .receipt {
        margin-left: auto;
        margin-right: auto;
      }
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
      ${renderMetaRow(`No. ${documentLabel}`, receipt.transaction.invoiceNo)}
      ${renderMetaRow('Tanggal', receipt.transaction.date)}
      ${hasValue(receipt.transaction.orderId) ? renderMetaRow('Order ID', String(receipt.transaction.orderId || '').trim()) : ''}
      ${hasValue(receipt.transaction.customer) ? renderMetaRow('Pelanggan', String(receipt.transaction.customer || '').trim()) : ''}
      ${hasValue(receipt.transaction.customerPhone) ? renderMetaRow('No Telp', String(receipt.transaction.customerPhone || '').trim()) : ''}
      ${hasValue(receipt.transaction.cashier) ? renderMetaRow('Kasir', String(receipt.transaction.cashier || '').trim()) : ''}
      ${hasValue(receipt.transaction.paymentStatus) ? renderMetaRow(isWorkOrder ? 'Status' : 'Pembayaran', String(receipt.transaction.paymentStatus || '').trim()) : ''}
      ${hasValue(receipt.transaction.printedAt) ? renderMetaRow('Dicetak', String(receipt.transaction.printedAt || '').trim()) : ''}
    </div>

    ${buildDashedDivider()}

    <div class="receipt-items">
      <div class="receipt-table-head">
        <div class="receipt-head-name">Nama Item</div>
        <div class="receipt-head-qty">Qty</div>
        <div class="receipt-head-price">Harga</div>
        <div class="receipt-head-total">Subtotal</div>
      </div>
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

    ${hasValue(receipt.qrCode) ? `
      <div class="receipt-code-block">
        <div class="receipt-code-label">QR</div>
        <div class="receipt-code-value">${escapeHtml(String(receipt.qrCode || '').trim())}</div>
      </div>
    ` : ''}

    ${hasValue(receipt.barcode) ? `
      <div class="receipt-code-block">
        <div class="receipt-code-label">BARCODE</div>
        <div class="receipt-code-value">${escapeHtml(String(receipt.barcode || '').trim())}</div>
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
  const isThermal58 = profile.paperWidth === '58mm';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: ${paperWidth} auto;
      margin: ${isThermal58 ? '2.5mm' : '3mm'};
    }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Consolas, "DejaVu Sans Mono", "Roboto Mono", "Courier New", monospace;
      font-size: ${isThermal58 ? '11px' : '13px'};
      line-height: 1.3;
      font-weight: 600;
      color-adjust: exact;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      display: flex;
      justify-content: center;
    }
    .receipt {
      width: ${paperWidth};
      max-width: ${paperWidth};
      margin: 0 auto;
      color: #000;
      background: #fff;
      padding: ${isThermal58 ? '2mm 2mm 3mm' : '2.5mm 2.5mm 3.5mm'};
      flex: 0 0 auto;
    }
    .receipt-logo-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0 0 6px;
    }
    .receipt-logo {
      max-width: min(72%, 140px);
      max-height: ${isThermal58 ? '40px' : '52px'};
      object-fit: contain;
      display: block;
      margin: 0 auto;
      image-rendering: crisp-edges;
      filter: grayscale(1) contrast(1.2);
    }
    .receipt-text {
      white-space: pre-wrap;
      font-size: ${isThermal58 ? '11px' : '13px'};
      line-height: 1.3;
      letter-spacing: 0;
      margin: 0;
      font-weight: 700;
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
      font-size: ${isThermal58 ? '10px' : '11px'};
      line-height: 1.25;
    }
    .receipt-notice-title {
      font-weight: 800;
      margin-bottom: 2px;
    }
    .receipt-notice-line {
      margin: 0 0 2px;
      font-weight: 600;
    }
    @media print {
      html, body {
        width: ${paperWidth};
        background: #fff;
        margin: 0 auto;
      }
      .receipt {
        width: ${paperWidth};
        max-width: ${paperWidth};
        margin-left: auto;
        margin-right: auto;
      }
      body {
        display: block;
      }
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
