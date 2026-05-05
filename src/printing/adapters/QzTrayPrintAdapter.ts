import type { PrintAdapter, PrinterProfile } from '../types';

type QzNamespace = {
  websocket: { connect(): Promise<void>; isActive(): boolean };
  printers: { find(printerName: string): Promise<string> };
  configs: { create(printerName: string, options?: Record<string, unknown>): unknown };
  print(config: unknown, data: unknown[]): Promise<void>;
};

declare global {
  interface Window {
    qz?: QzNamespace;
  }
}

export class QzTrayPrintAdapter implements PrintAdapter {
  async print(data: Uint8Array | string, profile: PrinterProfile): Promise<void> {
    if (typeof window === 'undefined' || !window.qz) {
      throw new Error('QZ Tray tidak tersedia di browser ini.');
    }
    if (!profile.printerName) {
      throw new Error('Printer profile QZ Tray membutuhkan printerName.');
    }

    const qz = window.qz;
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect();
    }

    const printer = await qz.printers.find(profile.printerName);
    const config = qz.configs.create(printer, {
      encoding: profile.encoding || 'UTF-8',
    });

    if (typeof data === 'string') {
      await qz.print(config, [{ type: 'raw', format: 'plain', data }]);
      return;
    }

    const hex = Array.from(data)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    await qz.print(config, [{ type: 'raw', format: 'hex', data: hex }]);
  }
}
