import type { PrinterProfile, ReceiptData } from './types';
import { createPrinterProfile } from './profiles';

export const sampleReceipt: ReceiptData = {
  store: {
    name: 'SIDOMULYO',
    tagline: 'ADVERTISING & PRINTING',
    address: 'Jl. Kartini No 108 Salatiga, Jateng',
  },
  transaction: {
    invoiceNo: 'INV-2026-0001',
    orderId: 'ORD-2026-0001',
    date: '06 Mei 2026, 21:44',
    cashier: 'KASIR',
    customer: 'Darwin Retail',
    customerPhone: '0812-3456-7890',
    printedAt: '06 Mei 2026, 21:46',
  },
  items: [
    {
      name: 'LAMINATING A4/F4',
      qty: 9,
      price: 3000,
      notes: 'laminating qty 9',
      total: 27000,
    },
  ],
  summary: {
    subtotal: 27000,
    discount: 0,
    grandTotal: 27000,
    paid: 27000,
    change: 0,
  },
  payment: {
    method: 'QRIS',
    amount: 27000,
  },
  layout: {
    showOrderId: true,
    showCashier: true,
    showCustomer: true,
    showPaymentDetail: true,
  },
  detail: {
    deadline: '07 Mei 2026',
    orderDetails: ['laminating qty 9'],
    footerNotes: [
      'Tidak bisa revisi/batal ketika nota telah keluar',
      'Pengambilan maksimal 2 hari dari deadline',
      'Servis terhitung setelah desain fix dan pembayaran selesai',
    ],
    thankYouText: 'TERIMA KASIH',
  },
};

export const sampleProfiles: Record<string, PrinterProfile> = {
  thermal58: createPrinterProfile({
    id: 'sample-58mm',
    name: 'Sample Thermal 58mm',
    type: 'thermal_escpos',
    connection: 'qz_tray',
    paperWidth: '58mm',
    charsPerLine: 32,
    cutter: true,
    printerName: 'POS-58MM',
  }),
  thermal80: createPrinterProfile({
    id: 'sample-80mm',
    name: 'Sample Thermal 80mm',
    type: 'thermal_escpos',
    connection: 'qz_tray',
    paperWidth: '80mm',
    charsPerLine: 48,
    cutter: true,
    printerName: 'POS-80MM',
  }),
  browser: createPrinterProfile({
    id: 'sample-browser',
    name: 'Sample Browser',
    type: 'browser',
    connection: 'browser',
    paperWidth: 'custom',
    charsPerLine: 42,
  }),
  lan: createPrinterProfile({
    id: 'sample-lan',
    name: 'Sample LAN Thermal',
    type: 'thermal_escpos',
    connection: 'lan',
    paperWidth: '80mm',
    charsPerLine: 48,
    ipAddress: '192.168.1.10',
    port: 9100,
    cutter: true,
  }),
};
