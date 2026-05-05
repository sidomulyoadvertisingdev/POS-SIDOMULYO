import type { PrinterProfile, ReceiptData, ReceiptItem } from './types';
import {
  centerText,
  formatCurrency,
  formatQty,
  leftRight,
  padLeft,
  padRight,
  separator,
  wrapText,
} from './receiptHelpers';

const pushWrappedCentered = (lines: string[], value: string | undefined, width: number): void => {
  if (!value) {
    return;
  }
  wrapText(value, width).forEach((line) => {
    lines.push(centerText(line, width));
  });
};

const hasValue = (value: string | undefined): boolean => {
  const text = String(value || '').trim();
  return Boolean(text) && text !== '-';
};

const pushWrappedPrefixed = (lines: string[], label: string, value: string | undefined, width: number): void => {
  if (!hasValue(value)) {
    return;
  }
  wrapText(`${label}: ${String(value || '').trim()}`, width).forEach((line) => {
    lines.push(line);
  });
};

const buildItemMetaLines = (item: ReceiptItem, width: number): string[] => {
  const lines: string[] = [];
  pushWrappedPrefixed(lines, 'Uk', item.size, width);
  pushWrappedPrefixed(lines, 'Bahan', item.material, width);
  pushWrappedPrefixed(lines, 'Finishing', item.finishing, width);
  pushWrappedPrefixed(lines, 'LB Max', item.lbMax, width);
  if (typeof item.pages === 'number' && Number.isFinite(item.pages) && item.pages > 1) {
    lines.push(`Halaman: ${item.pages}`);
  }
  pushWrappedPrefixed(lines, 'Catatan', item.notes, width);
  return lines;
};

const renderCompactItem = (item: ReceiptItem, width: number): string[] => {
  const nameLines = wrapText(item.name, width);
  const metaLeft = `${formatQty(item.qty)} x ${formatCurrency(item.price)}`;
  const amountRight = formatCurrency(item.total);
  const lines = [...nameLines];
  buildItemMetaLines(item, width).forEach((line) => {
    lines.push(line);
  });
  lines.push(leftRight(metaLeft, amountRight, width));
  if (item.discount) {
    lines.push(leftRight('Disc', `-${formatCurrency(item.discount)}`, width));
  }
  return lines;
};

const renderWideItem = (item: ReceiptItem, width: number): string[] => {
  const qtyWidth = 5;
  const priceWidth = 12;
  const totalWidth = 12;
  const gapCount = 3;
  const nameWidth = width - qtyWidth - priceWidth - totalWidth - gapCount;
  const safeNameWidth = Math.max(10, nameWidth);
  const nameLines = wrapText(item.name, safeNameWidth);
  const metaLines = buildItemMetaLines(item, safeNameWidth);
  const rows: string[] = [];

  [...nameLines, ...metaLines].forEach((line, index) => {
    if (index === 0) {
      rows.push(
        [
          padRight(line, safeNameWidth),
          padLeft(formatQty(item.qty), qtyWidth),
          padLeft(formatCurrency(item.price), priceWidth),
          padLeft(formatCurrency(item.total), totalWidth),
        ].join(' '),
      );
      return;
    }

    rows.push(
      [
        padRight(line, safeNameWidth),
        padLeft('', qtyWidth),
        padLeft('', priceWidth),
        padLeft('', totalWidth),
      ].join(' '),
    );
  });

  if (item.discount) {
    rows.push(leftRight('Discount Item', `-${formatCurrency(item.discount)}`, width));
  }

  return rows;
};

export const renderReceiptText = (receipt: ReceiptData, printerProfile: PrinterProfile): string => {
  const width = Number(printerProfile.charsPerLine || 0);
  if (!Number.isFinite(width) || width < 16) {
    throw new Error('Printer profile tidak memiliki charsPerLine yang valid.');
  }

  const lines: string[] = [];
  const isCompact = width <= 32;
  const layout = receipt.layout || {};
  const showOrderId = layout.showOrderId !== false;
  const showCashier = layout.showCashier !== false;
  const showCustomer = layout.showCustomer !== false;
  const showPaymentDetail = layout.showPaymentDetail !== false;

  pushWrappedCentered(lines, receipt.store.title, width);
  pushWrappedCentered(lines, receipt.store.name, width);
  pushWrappedCentered(lines, receipt.store.tagline, width);
  pushWrappedCentered(lines, receipt.store.address, width);
  pushWrappedCentered(lines, receipt.store.phone, width);
  pushWrappedCentered(lines, receipt.store.headerText, width);
  lines.push(separator(width));
  lines.push(leftRight('Invoice', receipt.transaction.invoiceNo, width));
  if (showOrderId && receipt.transaction.orderId) {
    lines.push(leftRight('Order ID', receipt.transaction.orderId, width));
  }
  lines.push(leftRight('Tanggal', receipt.transaction.date, width));
  if (receipt.transaction.paymentStatus) {
    lines.push(leftRight('Status', receipt.transaction.paymentStatus, width));
  }
  if (showCashier && receipt.transaction.cashier) {
    lines.push(leftRight('Kasir', receipt.transaction.cashier, width));
  }
  if (showCustomer && receipt.transaction.customer) {
    lines.push(leftRight('Customer', receipt.transaction.customer, width));
  }
  if (receipt.transaction.notes) {
    wrapText(`Catatan: ${receipt.transaction.notes}`, width).forEach((line) => {
      lines.push(line);
    });
  }
  lines.push(separator(width));

  if (!isCompact) {
    const qtyWidth = 5;
    const priceWidth = 12;
    const totalWidth = 12;
    const nameWidth = Math.max(10, width - qtyWidth - priceWidth - totalWidth - 3);
    lines.push(
      [
        padRight('Nama Item', nameWidth),
        padLeft('Qty', qtyWidth),
        padLeft('Harga', priceWidth),
        padLeft('Total', totalWidth),
      ].join(' '),
    );
    lines.push(separator(width));
  }

  receipt.items.forEach((item) => {
    const itemLines = isCompact ? renderCompactItem(item, width) : renderWideItem(item, width);
    itemLines.forEach((line) => {
      lines.push(line);
    });
  });

  lines.push(separator(width));
  lines.push(leftRight('Subtotal', formatCurrency(receipt.summary.subtotal), width));
  if (receipt.summary.discount) {
    lines.push(leftRight('Diskon', `-${formatCurrency(receipt.summary.discount)}`, width));
  }
  if (receipt.summary.tax) {
    lines.push(leftRight('Pajak', formatCurrency(receipt.summary.tax), width));
  }
  if (receipt.summary.serviceCharge) {
    lines.push(leftRight('Service', formatCurrency(receipt.summary.serviceCharge), width));
  }
  lines.push(leftRight('Grand Total', formatCurrency(receipt.summary.grandTotal), width));
  if (showPaymentDetail && receipt.payment?.method) {
    lines.push(leftRight('Bayar', receipt.payment.method, width));
  }
  if (showPaymentDetail && receipt.payment?.targetAccount) {
    wrapText(`Akun: ${receipt.payment.targetAccount}`, width).forEach((line) => {
      lines.push(line);
    });
  }
  if (showPaymentDetail && typeof receipt.summary.paid === 'number') {
    lines.push(leftRight('Tunai', formatCurrency(receipt.summary.paid), width));
  }
  if (showPaymentDetail && typeof receipt.summary.change === 'number') {
    lines.push(leftRight('Kembali', formatCurrency(receipt.summary.change), width));
  }
  if (typeof receipt.summary.remainingDue === 'number' && receipt.summary.remainingDue > 0) {
    lines.push(leftRight('Sisa Piutang', formatCurrency(receipt.summary.remainingDue), width));
  }
  lines.push(separator(width));

  if (receipt.store.footer) {
    wrapText(receipt.store.footer, width).forEach((line) => {
      lines.push(centerText(line, width));
    });
  }
  if (receipt.qrCode) {
    lines.push(centerText('[QR CODE]', width));
  }
  if (receipt.barcode) {
    lines.push(centerText('[BARCODE]', width));
  }

  return `${lines.join('\n')}\n`;
};
