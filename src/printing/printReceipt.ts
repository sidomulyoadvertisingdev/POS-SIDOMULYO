import { EscPosBuilder } from './EscPosBuilder';
import { BrowserPrintAdapter } from './adapters/BrowserPrintAdapter';
import { LocalServicePrintAdapter } from './adapters/LocalServicePrintAdapter';
import { QzTrayPrintAdapter } from './adapters/QzTrayPrintAdapter';
import { TcpEscPosPrintAdapter } from './adapters/TcpEscPosPrintAdapter';
import { normalizePrinterProfile, validatePrinterProfile } from './profiles';
import { renderReceiptText } from './renderReceiptText';
import type { PrintAdapter, PrinterProfile, ReceiptData } from './types';

export interface PrintReceiptOptions {
  adapter?: PrintAdapter;
  browserFallbackAdapter?: PrintAdapter;
  localServiceEndpoint?: string;
}

const resolveAdapter = (profile: PrinterProfile, options: PrintReceiptOptions): PrintAdapter => {
  if (options.adapter) {
    return options.adapter;
  }

  if (profile.connection === 'browser' || profile.type === 'browser') {
    return new BrowserPrintAdapter();
  }
  if (profile.connection === 'qz_tray') {
    return new QzTrayPrintAdapter();
  }
  if (profile.connection === 'local_service') {
    return new LocalServicePrintAdapter({
      endpoint: options.localServiceEndpoint || 'http://localhost:3001/print',
    });
  }
  if (profile.connection === 'lan' || profile.connection === 'wifi') {
    return new TcpEscPosPrintAdapter();
  }

  return new BrowserPrintAdapter();
};

const buildEscPosReceipt = async (receipt: ReceiptData, profile: PrinterProfile, receiptText: string): Promise<Uint8Array> => {
  const builder = new EscPosBuilder();
  builder.init();

  if (profile.cashDrawer && profile.openDrawerBeforePrint) {
    builder.openCashDrawer();
  }

  builder.align('left');
  builder.bold(false);
  builder.size(1, 1);
  builder.text(receiptText);
  builder.feed(2);

  if (receipt.qrCode) {
    builder.align('center').qr(receipt.qrCode).align('left');
  }
  if (receipt.barcode) {
    builder.align('center').barcode(receipt.barcode).align('left');
  }

  if (profile.cutter) {
    builder.cut();
  }

  if (profile.cashDrawer && profile.openDrawerAfterPrint) {
    builder.openCashDrawer();
  }

  return builder.build();
};

export const printReceipt = async (
  receipt: ReceiptData,
  printerProfile: PrinterProfile,
  options: PrintReceiptOptions = {},
): Promise<void> => {
  const profile = normalizePrinterProfile(printerProfile);
  validatePrinterProfile(profile);

  const receiptText = renderReceiptText(receipt, profile);
  const fallbackAdapter = options.browserFallbackAdapter || new BrowserPrintAdapter();

  if (profile.type === 'browser') {
    await fallbackAdapter.print(receiptText, profile);
    return;
  }

  const adapter = resolveAdapter(profile, options);

  try {
    if (profile.type === 'thermal_escpos') {
      const raw = await buildEscPosReceipt(receipt, profile, receiptText);
      await adapter.print(raw, profile);
      return;
    }

    await adapter.print(receiptText, profile);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown printing error';
    if (profile.type !== 'browser') {
      await fallbackAdapter.print(receiptText, {
        ...profile,
        type: 'browser',
        connection: 'browser',
      });
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(`Raw print gagal dan dialihkan ke browser print. Detail: ${reason}`);
      }
      return;
    }
    throw new Error(`Print gagal: ${reason}`);
  }
};
