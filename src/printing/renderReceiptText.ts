import type { PrinterProfile, ReceiptData, ReceiptItem } from './types';
import {
  centerText,
  formatQty,
  formatReceiptAmount,
  leftRight,
  separator,
  wrapText,
} from './receiptHelpers';

const hasValue = (value: string | undefined): boolean => {
  const text = String(value || '').trim();
  return Boolean(text) && text !== '-';
};

const pushCenteredWrapped = (lines: string[], value: string | undefined, width: number): void => {
  if (!hasValue(value)) {
    return;
  }
  wrapText(String(value || '').trim(), width).forEach((line) => {
    lines.push(centerText(line, width));
  });
};

const pushWrapped = (lines: string[], value: string | undefined, width: number, prefix = ''): void => {
  if (!hasValue(value)) {
    return;
  }
  wrapText(`${prefix}${String(value || '').trim()}`, width).forEach((line) => {
    lines.push(line);
  });
};

const renderItemLines = (item: ReceiptItem, width: number): string[] => {
  const totalText = formatReceiptAmount(item.total);
  const qtyPriceText = `${formatQty(item.qty)} x ${formatReceiptAmount(item.price)}`;
  const safeNameWidth = Math.max(10, width - totalText.length - 1);
  const nameLines = wrapText(item.name, safeNameWidth);
  const lines: string[] = [];

  if (nameLines.length > 0) {
    lines.push(leftRight(nameLines[0], totalText, width));
    nameLines.slice(1).forEach((line) => lines.push(line));
  } else {
    lines.push(leftRight('-', totalText, width));
  }

  lines.push(qtyPriceText);

  if (hasValue(item.size)) {
    lines.push(`Ukuran   : ${String(item.size || '').trim()}`);
  }
  if (hasValue(item.material)) {
    lines.push(`Bahan    : ${String(item.material || '').trim()}`);
  }
  if (hasValue(item.finishing)) {
    lines.push(`Finishing: ${String(item.finishing || '').trim()}`);
  }
  if (hasValue(item.lbMax)) {
    lines.push(`LB Max   : ${String(item.lbMax || '').trim()}`);
  }
  if (typeof item.pages === 'number' && Number.isFinite(item.pages) && item.pages > 1) {
    lines.push(`Halaman  : ${item.pages}`);
  }
  if (hasValue(item.notes)) {
    wrapText(`Catatan  : ${String(item.notes || '').trim()}`, width).forEach((line) => {
      lines.push(line);
    });
  }

  return lines;
};

const DEFAULT_FOOTER_NOTES: string[] = [];

export const renderReceiptText = (receipt: ReceiptData, printerProfile: PrinterProfile): string => {
  const width = Number(printerProfile.charsPerLine || 0);
  if (!Number.isFinite(width) || width < 16) {
    throw new Error('Printer profile tidak memiliki charsPerLine yang valid.');
  }

  const lines: string[] = [];
  const layout = receipt.layout || {};
  const detail = receipt.detail || {};
  const showOrderId = layout.showOrderId !== false;
  const showCashier = layout.showCashier !== false;
  const showCustomer = layout.showCustomer !== false;
  const showPaymentDetail = layout.showPaymentDetail !== false;

  pushCenteredWrapped(lines, receipt.store.name, width);
  pushCenteredWrapped(lines, receipt.store.tagline, width);
  pushCenteredWrapped(lines, receipt.store.address, width);
  pushCenteredWrapped(lines, receipt.store.phone, width);
  if (hasValue(receipt.store.title)) {
    lines.push(centerText(String(receipt.store.title || '').trim(), width));
  }
  if (hasValue(receipt.store.headerText)) {
    pushCenteredWrapped(lines, receipt.store.headerText, width);
  }

  lines.push(separator(width, '-'));

  lines.push(leftRight('No. Nota', receipt.transaction.invoiceNo, width));
  lines.push(leftRight('Tanggal', receipt.transaction.date, width));
  if (showOrderId && hasValue(receipt.transaction.orderId)) {
    lines.push(leftRight('Order ID', String(receipt.transaction.orderId || '').trim(), width));
  }
  if (showCustomer && hasValue(receipt.transaction.customer)) {
    lines.push(leftRight('Pelanggan', String(receipt.transaction.customer || '').trim(), width));
  }
  if (showCustomer && hasValue(receipt.transaction.customerPhone)) {
    lines.push(leftRight('No Telp', String(receipt.transaction.customerPhone || '').trim(), width));
  }
  if (showCashier && hasValue(receipt.transaction.cashier)) {
    lines.push(leftRight('Kasir', String(receipt.transaction.cashier || '').trim(), width));
  }
  if (hasValue(receipt.transaction.printedAt)) {
    lines.push(leftRight('Dicetak', String(receipt.transaction.printedAt || '').trim(), width));
  }

  lines.push(separator(width, '-'));
  lines.push(leftRight('Nama Barang', 'Total Harga', width));
  lines.push(separator(width, '-'));

  receipt.items.forEach((item) => {
    renderItemLines(item, width).forEach((line) => lines.push(line));
    lines.push(separator(width, '-'));
  });

  lines.push(leftRight('Sub Total', formatReceiptAmount(receipt.summary.subtotal), width));
  lines.push(leftRight('Diskon', formatReceiptAmount(receipt.summary.discount || 0), width));
  if (typeof receipt.summary.tax === 'number' && receipt.summary.tax > 0) {
    lines.push(leftRight('Pajak', formatReceiptAmount(receipt.summary.tax), width));
  }
  if (typeof receipt.summary.serviceCharge === 'number' && receipt.summary.serviceCharge > 0) {
    lines.push(leftRight('Biaya Layanan', formatReceiptAmount(receipt.summary.serviceCharge), width));
  }
  if (showPaymentDetail && hasValue(receipt.payment?.method)) {
    lines.push(leftRight(`Pembayaran ${String(receipt.payment?.method || '').trim()}`, formatReceiptAmount(receipt.payment?.amount || receipt.summary.grandTotal), width));
  }
  lines.push(leftRight('Total', formatReceiptAmount(receipt.summary.grandTotal), width));
  if (typeof receipt.summary.change === 'number' && receipt.summary.change > 0) {
    lines.push(leftRight('Kembalian', formatReceiptAmount(receipt.summary.change), width));
  }
  if (typeof receipt.summary.remainingDue === 'number' && receipt.summary.remainingDue > 0) {
    lines.push(leftRight('Sisa', formatReceiptAmount(receipt.summary.remainingDue), width));
  }

  lines.push('');

  if (hasValue(detail.deadline)) {
    lines.push('Deadline :');
    pushWrapped(lines, detail.deadline, width);
    lines.push('');
  }

  const orderDetails = Array.isArray(detail.orderDetails)
    ? detail.orderDetails.filter((item) => hasValue(item))
    : [];
  if (orderDetails.length > 0) {
    lines.push('Rincian :');
    orderDetails.forEach((item) => {
      wrapText(String(item || '').trim(), width).forEach((line) => lines.push(line));
    });
    lines.push('');
  }

  if (hasValue(receipt.transaction.notes)) {
    lines.push('Catatan :');
    wrapText(String(receipt.transaction.notes || '').trim(), width).forEach((line) => lines.push(line));
    lines.push('');
  }

  const footerNotes = Array.isArray(detail.footerNotes) && detail.footerNotes.length > 0
    ? detail.footerNotes.filter((item) => hasValue(item))
    : DEFAULT_FOOTER_NOTES;

  if (footerNotes.length > 0) {
    lines.push('NB :');
    footerNotes.forEach((item) => {
      wrapText(`- ${String(item || '').trim()}`, width).forEach((line) => lines.push(line));
    });
    lines.push('');
  }

  pushCenteredWrapped(lines, detail.thankYouText || 'TERIMA KASIH', width);
  if (hasValue(receipt.store.footer)) {
    pushCenteredWrapped(lines, receipt.store.footer, width);
  }

  return `${lines.join('\n')}\n`;
};
