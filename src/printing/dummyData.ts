import type { PrinterProfile, ReceiptData } from './types';
import { createPrinterProfile } from './profiles';

export const sampleReceipt: ReceiptData = {
  store: {
    title: 'Nota Penjualan',
    name: 'Sidomulyo Printing',
    tagline: 'Cepat, Rapi, Terpercaya',
    address: 'Jl. Raya Percetakan No. 88',
    phone: '0812-3456-7890',
    headerText: 'Buka setiap hari 08.00 - 21.00',
    footer: 'Terima kasih sudah berbelanja',
  },
  transaction: {
    invoiceNo: 'INV-2026-0001',
    orderId: 'ORD-2026-0001',
    date: '2026-05-02 20:30',
    cashier: 'Admin 1',
    customer: 'Bapak Andi',
    paymentStatus: 'Lunas',
  },
  items: [
    {
      name: 'Banner Flexi 280gr 1x2 meter dengan finishing mata ayam full sisi',
      qty: 1,
      price: 85000,
      total: 85000,
    },
    {
      name: 'Sticker Vinyl Custom 100 pcs',
      qty: 2,
      price: 45000,
      discount: 5000,
      total: 85000,
    },
  ],
  summary: {
    subtotal: 170000,
    discount: 5000,
    tax: 0,
    serviceCharge: 0,
    grandTotal: 165000,
    paid: 200000,
    change: 35000,
    remainingDue: 0,
  },
  payment: {
    method: 'Cash',
    amount: 200000,
    targetAccount: '1-1001 - Kas Penjualan',
  },
  layout: {
    showOrderId: true,
    showCashier: true,
    showCustomer: true,
    showPaymentDetail: true,
  },
  qrCode: 'https://dashboard.sidomulyoproject.com/invoice/INV-2026-0001',
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
