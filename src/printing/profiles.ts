import type { PaperWidth, PrinterProfile } from './types';

export const DEFAULT_CHARS_PER_LINE: Record<PaperWidth, number> = {
  '58mm': 32,
  '80mm': 48,
  custom: 42,
};

export const createPrinterProfile = (
  overrides: Partial<PrinterProfile> & Pick<PrinterProfile, 'id' | 'name' | 'type' | 'connection'>,
): PrinterProfile => {
  const paperWidth = overrides.paperWidth || (overrides.type === 'browser' ? 'custom' : '58mm');
  const charsPerLine = overrides.charsPerLine || DEFAULT_CHARS_PER_LINE[paperWidth];

  return {
    paperWidth,
    charsPerLine,
    encoding: 'utf-8',
    cutter: false,
    cashDrawer: false,
    openDrawerBeforePrint: false,
    openDrawerAfterPrint: false,
    ...overrides,
  };
};

export const DEFAULT_PRINTER_PROFILES = {
  thermal58: createPrinterProfile({
    id: 'thermal-58mm',
    name: 'Thermal 58mm',
    type: 'thermal_escpos',
    connection: 'qz_tray',
    paperWidth: '58mm',
    charsPerLine: DEFAULT_CHARS_PER_LINE['58mm'],
    cutter: true,
    cashDrawer: true,
  }),
  thermal80: createPrinterProfile({
    id: 'thermal-80mm',
    name: 'Thermal 80mm',
    type: 'thermal_escpos',
    connection: 'qz_tray',
    paperWidth: '80mm',
    charsPerLine: DEFAULT_CHARS_PER_LINE['80mm'],
    cutter: true,
    cashDrawer: true,
  }),
  browserFallback: createPrinterProfile({
    id: 'browser-fallback',
    name: 'Browser Print',
    type: 'browser',
    connection: 'browser',
    paperWidth: 'custom',
    charsPerLine: DEFAULT_CHARS_PER_LINE.custom,
  }),
  lanThermal80: createPrinterProfile({
    id: 'lan-thermal-80mm',
    name: 'LAN Thermal 80mm',
    type: 'thermal_escpos',
    connection: 'lan',
    paperWidth: '80mm',
    charsPerLine: DEFAULT_CHARS_PER_LINE['80mm'],
    ipAddress: '192.168.1.50',
    port: 9100,
    cutter: true,
  }),
};

export const resolveDefaultCharsPerLine = (paperWidth: PaperWidth): number => {
  return DEFAULT_CHARS_PER_LINE[paperWidth];
};

export const normalizePrinterProfile = (profile: PrinterProfile): PrinterProfile => {
  const rawPaperWidth = String(profile?.paperWidth || '').trim();
  const paperWidth: PaperWidth = ['58mm', '80mm', 'custom'].includes(rawPaperWidth)
    ? rawPaperWidth as PaperWidth
    : (profile?.type === 'browser' ? 'custom' : '80mm');
  const charsPerLine = Number(profile?.charsPerLine || 0) || DEFAULT_CHARS_PER_LINE[paperWidth];
  return {
    ...profile,
    paperWidth,
    charsPerLine,
    port: profile.port || (profile.connection === 'lan' || profile.connection === 'wifi' ? 9100 : profile.port),
  };
};

export const validatePrinterProfile = (profile: PrinterProfile): void => {
  if (!profile.id.trim()) {
    throw new Error('Printer profile wajib memiliki id.');
  }
  if (!profile.name.trim()) {
    throw new Error('Printer profile wajib memiliki nama.');
  }
  if (!Number.isFinite(profile.charsPerLine) || profile.charsPerLine < 16) {
    throw new Error('Characters per line harus diisi minimal 16.');
  }
  if (profile.paperWidth === 'custom' && !profile.charsPerLine) {
    throw new Error('Printer custom wajib mengisi characters per line.');
  }
  if ((profile.connection === 'lan' || profile.connection === 'wifi') && !profile.ipAddress) {
    throw new Error('Printer LAN/WiFi wajib memiliki IP address.');
  }
  if (profile.connection === 'qz_tray' && !profile.printerName) {
    throw new Error('QZ Tray membutuhkan printerName pada profile.');
  }
};
