import { normalizePrinterProfile } from './profiles';
import type { PrinterProfile, ReceiptData } from './types';

const mmToPt = (mm: number): number => (mm * 72) / 25.4;

const encodePdfStream = (value: string): Uint8Array => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value);
  }

  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
};

const escapePdfText = (value: string): string => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const formatReceiptAmount = (value: number): string => {
  const amount = Number(value || 0);
  const sign = amount < 0 ? '-' : '';
  const grouped = Math.abs(Math.round(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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

const wrapText = (value: string, maxChars: number): string[] => {
  const text = String(value || '').trim();
  if (!text) return [];
  if (text.length <= maxChars) return [text];

  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    if (!current) {
      if (word.length <= maxChars) {
        current = word;
        return;
      }
      let chunk = word;
      while (chunk.length > maxChars) {
        lines.push(chunk.slice(0, maxChars));
        chunk = chunk.slice(maxChars);
      }
      current = chunk;
      return;
    }

    const candidate = `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      return;
    }

    lines.push(current);
    if (word.length <= maxChars) {
      current = word;
      return;
    }

    let chunk = word;
    while (chunk.length > maxChars) {
      lines.push(chunk.slice(0, maxChars));
      chunk = chunk.slice(maxChars);
    }
    current = chunk;
  });

  if (current) {
    lines.push(current);
  }

  return lines;
};

type PdfLine = {
  text: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  size?: number;
  gapAfter?: number;
};

const addWrappedLines = (
  target: PdfLine[],
  value: string | undefined,
  maxChars: number,
  options: Omit<PdfLine, 'text'> = {},
): void => {
  if (!hasValue(value)) return;
  wrapText(String(value || '').trim(), maxChars).forEach((line) => {
    target.push({ text: line, ...options });
  });
};

const buildReceiptPdfLines = (receipt: ReceiptData, profile: PrinterProfile): PdfLine[] => {
  const lines: PdfLine[] = [];
  const widthChars = Math.max(Number(profile.charsPerLine || 32), 24);
  const detailChars = Math.max(widthChars - 2, 20);
  const separator = '-'.repeat(Math.max(widthChars - 2, 24));

  addWrappedLines(lines, receipt.store.name, widthChars, { align: 'center', bold: true });
  addWrappedLines(lines, receipt.store.tagline, widthChars, { align: 'center' });
  addWrappedLines(lines, receipt.store.address, widthChars, { align: 'center' });
  addWrappedLines(lines, receipt.store.phone, widthChars, { align: 'center' });
  addWrappedLines(lines, receipt.store.title, widthChars, { align: 'center' });
  addWrappedLines(lines, receipt.store.headerText, widthChars, { align: 'center' });
  lines.push({ text: separator, align: 'center', gapAfter: 2 });

  const metaRows = [
    ['No. Nota', receipt.transaction.invoiceNo],
    ['Tanggal', receipt.transaction.date],
    [receipt.layout?.showOrderId === false ? '' : 'Order ID', receipt.transaction.orderId],
    [receipt.layout?.showCustomer === false ? '' : 'Pelanggan', receipt.transaction.customer],
    [receipt.layout?.showCustomer === false ? '' : 'No Telp', receipt.transaction.customerPhone],
    [receipt.layout?.showCashier === false ? '' : 'Kasir', receipt.transaction.cashier],
    ['Dicetak', receipt.transaction.printedAt],
  ].filter(([label, value]) => hasValue(label) && hasValue(value));

  metaRows.forEach(([label, value]) => {
    lines.push({ text: `${String(label)}\t${String(value)}` });
  });

  if (hasValue(receipt.transaction.notes)) {
    addWrappedLines(lines, `Catatan: ${String(receipt.transaction.notes || '').trim()}`, detailChars);
  }

  lines.push({ text: separator, align: 'center', gapAfter: 2 });
  lines.push({ text: 'Nama Barang\tTotal Harga', bold: true, gapAfter: 2 });
  lines.push({ text: separator, align: 'center', gapAfter: 2 });

  receipt.items.forEach((item) => {
    lines.push({ text: `${String(item.name || '').trim()}\t${formatReceiptAmount(item.total)}`, bold: true });
    lines.push({ text: `${formatQty(item.qty)} x ${formatReceiptAmount(item.price)}` });
    if (hasValue(item.size)) addWrappedLines(lines, `Ukuran  : ${String(item.size || '').trim()}`, detailChars);
    if (hasValue(item.material)) addWrappedLines(lines, `Bahan   : ${String(item.material || '').trim()}`, detailChars);
    if (hasValue(item.finishing)) addWrappedLines(lines, `Finishing: ${String(item.finishing || '').trim()}`, detailChars);
    if (hasValue(item.lbMax)) addWrappedLines(lines, `LB Max  : ${String(item.lbMax || '').trim()}`, detailChars);
    if (typeof item.pages === 'number' && Number.isFinite(item.pages) && item.pages > 1) {
      lines.push({ text: `Halaman : ${item.pages}` });
    }
    if (hasValue(item.notes)) addWrappedLines(lines, `Catatan : ${String(item.notes || '').trim()}`, detailChars);
    lines.push({ text: separator, align: 'center', gapAfter: 2 });
  });

  lines.push({ text: `Sub Total\t${formatReceiptAmount(receipt.summary.subtotal)}`, bold: true });
  lines.push({ text: `Diskon\t${formatReceiptAmount(receipt.summary.discount || 0)}` });
  if (typeof receipt.summary.tax === 'number' && receipt.summary.tax > 0) {
    lines.push({ text: `Pajak\t${formatReceiptAmount(receipt.summary.tax)}` });
  }
  if (typeof receipt.summary.serviceCharge === 'number' && receipt.summary.serviceCharge > 0) {
    lines.push({ text: `Biaya Layanan\t${formatReceiptAmount(receipt.summary.serviceCharge)}` });
  }
  if (receipt.payment?.method) {
    lines.push({ text: `Pembayaran ${receipt.payment.method}\t${formatReceiptAmount(receipt.payment.amount || receipt.summary.grandTotal)}`, bold: true });
  }
  lines.push({ text: `Total\t${formatReceiptAmount(receipt.summary.grandTotal)}`, bold: true });
  if (typeof receipt.summary.change === 'number' && receipt.summary.change > 0) {
    lines.push({ text: `Kembalian\t${formatReceiptAmount(receipt.summary.change)}` });
  }
  if (typeof receipt.summary.remainingDue === 'number' && receipt.summary.remainingDue > 0) {
    lines.push({ text: `Sisa\t${formatReceiptAmount(receipt.summary.remainingDue)}` });
  }

  const thankYouText = String(receipt.detail?.thankYouText || '').trim();
  if (thankYouText) {
    lines.push({ text: '', gapAfter: 2 });
    addWrappedLines(lines, thankYouText, widthChars, { align: 'center', bold: true });
  }
  if (hasValue(receipt.store.footer)) {
    addWrappedLines(lines, receipt.store.footer, widthChars, { align: 'center' });
  }

  return lines;
};

const buildPdfContentStream = (
  lines: PdfLine[],
  pageWidth: number,
  pageHeight: number,
  fontSize: number,
): string => {
  const leftPadding = 10;
  const rightPadding = 10;
  const textWidth = pageWidth - leftPadding - rightPadding;
  const lineHeight = fontSize + 2;
  const charWidth = fontSize * 0.56;
  let y = pageHeight - 18;
  const commands: string[] = ['0 g'];

  lines.forEach((line) => {
    const text = String(line.text || '');
    const effectiveSize = Number(line.size || fontSize);
    const effectiveCharWidth = effectiveSize * 0.56;
    const renderedText = text.includes('\t') ? text : text;
    let x = leftPadding;

    if (text.includes('\t')) {
      const [leftRaw, rightRaw] = text.split('\t');
      const leftText = String(leftRaw || '').trim();
      const rightText = String(rightRaw || '').trim();
      commands.push('BT');
      commands.push(`/${line.bold ? 'F2' : 'F1'} ${effectiveSize} Tf`);
      commands.push(`${leftPadding.toFixed(2)} ${y.toFixed(2)} Td`);
      commands.push(`(${escapePdfText(leftText)}) Tj`);
      commands.push('ET');
      commands.push('BT');
      commands.push(`/${line.bold ? 'F2' : 'F1'} ${effectiveSize} Tf`);
      const rightX = Math.max(
        leftPadding,
        pageWidth - rightPadding - (rightText.length * effectiveCharWidth),
      );
      commands.push(`${rightX.toFixed(2)} ${y.toFixed(2)} Td`);
      commands.push(`(${escapePdfText(rightText)}) Tj`);
      commands.push('ET');
    } else {
      if (line.align === 'center') {
        x = leftPadding + Math.max(0, (textWidth - (renderedText.length * effectiveCharWidth)) / 2);
      } else if (line.align === 'right') {
        x = pageWidth - rightPadding - (renderedText.length * effectiveCharWidth);
      }
      commands.push('BT');
      commands.push(`/${line.bold ? 'F2' : 'F1'} ${effectiveSize} Tf`);
      commands.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
      commands.push(`(${escapePdfText(renderedText)}) Tj`);
      commands.push('ET');
    }

    y -= lineHeight + Number(line.gapAfter || 0);
  });

  return commands.join('\n');
};

export interface DownloadReceiptPdfOptions {
  filename?: string;
}

export const downloadReceiptPdf = (
  receiptData: ReceiptData,
  profileInput: PrinterProfile,
  options: DownloadReceiptPdfOptions = {},
): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof URL === 'undefined') {
    return false;
  }

  const profile = normalizePrinterProfile(profileInput);
  const fontSize = profile.paperWidth === '58mm' ? 9 : 10;
  const paperWidthMm = profile.paperWidth === '58mm' ? 58 : 80;
  const pageWidth = mmToPt(paperWidthMm);
  const pdfLines = buildReceiptPdfLines(receiptData, profile);
  const lineHeight = fontSize + 2;
  const pageHeight = Math.max(mmToPt(120), 32 + (pdfLines.length * lineHeight) + 18);
  const stream = buildPdfContentStream(pdfLines, pageWidth, pageHeight, fontSize);
  const contentObject = `<< /Length ${encodePdfStream(stream).length} >>\nstream\n${stream}\nendstream`;
  const pageObject = `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Contents 6 0 R >>`;

  const chunks: Uint8Array[] = [];
  const pdfHeader = encodePdfStream('%PDF-1.4\n');
  chunks.push(pdfHeader);

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    `3 0 obj\n${pageObject}\nendobj\n`,
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>\nendobj\n',
    `6 0 obj\n${contentObject}\nendobj\n`,
  ];

  let offset = pdfHeader.length;
  const offsets = [0];
  const objectBytes = objects.map((objectText) => {
    offsets.push(offset);
    const bytes = encodePdfStream(objectText);
    offset += bytes.length;
    return bytes;
  });
  objectBytes.forEach((bytes) => chunks.push(bytes));

  const xrefStart = offset;
  const xrefLines = [
    `xref\n0 ${offsets.length}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map((item) => `${String(item).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`,
  ];
  xrefLines.forEach((line) => chunks.push(encodePdfStream(line)));

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let writeOffset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, writeOffset);
    writeOffset += chunk.length;
  });

  const blob = new Blob([output], { type: 'application/pdf' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = String(options.filename || 'nota.pdf').trim() || 'nota.pdf';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
  return true;
};
