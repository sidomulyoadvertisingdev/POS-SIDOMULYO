import type { PrintAdapter, PrinterProfile } from '../types';

export class TcpEscPosPrintAdapter implements PrintAdapter {
  async print(_data: Uint8Array | string, profile: PrinterProfile): Promise<void> {
    const host = String(profile.ipAddress || '').trim();
    const port = Number(profile.port || 9100);
    throw new Error(
      `Raw TCP print ke ${host || '-'}:${port} tidak bisa dijalankan langsung dari browser. ` +
      'Gunakan backend, Electron main process, atau local print service untuk adapter LAN.',
    );
  }
}
