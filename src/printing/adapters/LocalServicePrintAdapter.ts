import type { LocalServiceOptions, PrintAdapter, PrinterProfile } from '../types';

const toBase64 = (data: Uint8Array): string => {
  if (typeof btoa === 'function') {
    let binary = '';
    data.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  throw new Error('Base64 encoder tidak tersedia di environment ini.');
};

export class LocalServicePrintAdapter implements PrintAdapter {
  constructor(private readonly options: LocalServiceOptions) {}

  async print(data: Uint8Array | string, profile: PrinterProfile): Promise<void> {
    if (typeof fetch !== 'function') {
      throw new Error('Fetch API tidak tersedia untuk LocalServicePrintAdapter.');
    }

    const rawData = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const response = await fetch(this.options.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.options.headers || {}),
      },
      body: JSON.stringify({
        profile,
        data: toBase64(rawData),
        format: 'base64',
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Local service print gagal: ${response.status} ${body}`.trim());
    }
  }
}
