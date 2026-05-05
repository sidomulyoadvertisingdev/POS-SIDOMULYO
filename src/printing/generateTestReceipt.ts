import { separator } from './receiptHelpers';
import type { PrinterProfile, ReceiptData } from './types';

const buildWidthProbe = (width: number): string => {
  const numbers = '1234567890';
  let output = '';
  while (output.length < width) {
    output += numbers;
  }
  return output.slice(0, width);
};

export const generateTestReceipt = (profile: PrinterProfile): ReceiptData => {
  const widthInfo = `${profile.paperWidth} / ${profile.charsPerLine} cpl`;
  return {
    store: {
      title: 'Test Receipt',
      name: 'POS Kasir Test Print',
      tagline: 'Printer Validation Mode',
      address: 'Jl. Contoh No. 123, Kota Test',
      phone: '0812-0000-0000',
      headerText: `Profile ${widthInfo}`,
      footer: `Profile ${widthInfo}`,
    },
    transaction: {
      invoiceNo: 'TEST-PRINT-001',
      orderId: 'TEST-ORDER-001',
      date: new Date().toISOString(),
      cashier: 'System',
      customer: 'Pelanggan Uji Coba',
    },
    items: [
      {
        name: `Tes item sangat panjang untuk memastikan wrapping mengikuti charsPerLine. ${separator(Math.min(12, profile.charsPerLine), '=')}`,
        qty: 2,
        price: 12500,
        total: 25000,
      },
      {
        name: buildWidthProbe(Math.min(profile.charsPerLine, 64)),
        qty: 1,
        price: 9999,
        discount: 999,
        total: 9000,
      },
    ],
    summary: {
      subtotal: 34999,
      discount: 999,
      grandTotal: 34000,
      paid: 50000,
      change: 16000,
    },
    payment: {
      method: 'Cash',
      amount: 50000,
    },
    layout: {
      showOrderId: true,
      showCashier: true,
      showCustomer: true,
      showPaymentDetail: true,
    },
    qrCode: 'https://example.com/test-receipt',
  };
};
