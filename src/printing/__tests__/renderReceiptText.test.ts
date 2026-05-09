import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createPrinterProfile } from '../profiles';
import { renderReceiptText } from '../renderReceiptText';
import type { ReceiptData } from '../types';

const receipt: ReceiptData = {
  store: {
    name: 'SIDOMULYO',
    tagline: 'ADVERTISING & PRINTING',
    address: 'Jl. Kartini No 108 Salatiga, Jateng',
  },
  transaction: {
    invoiceNo: 'INV-001',
    orderId: 'ORD-001',
    date: '2026-05-02 21:00',
    cashier: 'Kasir Test',
    customer: 'Budi',
    customerPhone: '08123456789',
    printedAt: '2026-05-02 21:05',
  },
  items: [
    {
      name: 'Produk sangat panjang untuk wrapping',
      qty: 2,
      price: 10000,
      size: '30 x 40 cm',
      material: 'Art Paper 150gr',
      finishing: 'Laminasi Doff',
      notes: 'Warna dominan biru',
      total: 20000,
    },
  ],
  summary: {
    subtotal: 20000,
    grandTotal: 20000,
    paid: 50000,
    change: 30000,
  },
  payment: {
    method: 'Cash',
    amount: 50000,
  },
  detail: {
    deadline: '2026-05-04',
    orderDetails: ['Produk sangat panjang untuk wrapping qty 2'],
  },
};

test('renderReceiptText respects 32 char compact layout', () => {
  const profile = createPrinterProfile({
    id: 'test-32',
    name: 'Thermal 58',
    type: 'thermal_escpos',
    connection: 'qz_tray',
    paperWidth: '58mm',
    charsPerLine: 32,
  });
  const output = renderReceiptText(receipt, profile);
  output.trimEnd().split('\n').forEach((line) => {
    assert.ok(line.length <= 32);
  });
  assert.match(output, /INV-001/);
  assert.match(output, /ORD-001/);
  assert.match(output, /Kasir/);
  assert.match(output, /Pelanggan/);
  assert.match(output, /No Telp/);
  assert.match(output, /Ukuran/);
  assert.match(output, /Bahan/);
  assert.match(output, /Finishing:/);
  assert.match(output, /Dicetak/);
  assert.match(output, /Deadline/);
  assert.match(output, /Kembalian/);
});

test('renderReceiptText respects 48 char wide layout', () => {
  const profile = createPrinterProfile({
    id: 'test-48',
    name: 'Thermal 80',
    type: 'thermal_escpos',
    connection: 'qz_tray',
    paperWidth: '80mm',
    charsPerLine: 48,
  });
  const output = renderReceiptText(receipt, profile);
  output.trimEnd().split('\n').forEach((line) => {
    assert.ok(line.length <= 48);
  });
  assert.match(output, /Nama Barang/);
  assert.match(output, /SIDOMULYO/);
  assert.match(output, /ADVERTISING & PRINTING/);
  assert.match(output, /Jl. Kartini/);
  assert.match(output, /Art Paper 150gr/);
  assert.match(output, /Laminasi Doff/);
});

test('renderReceiptText can hide optional receipt sections', () => {
  const profile = createPrinterProfile({
    id: 'test-hidden',
    name: 'Thermal Hidden',
    type: 'thermal_escpos',
    connection: 'qz_tray',
    paperWidth: '80mm',
    charsPerLine: 48,
  });
  const hiddenReceipt: ReceiptData = {
    ...receipt,
    layout: {
      showOrderId: false,
      showCashier: false,
      showCustomer: false,
      showPaymentDetail: false,
    },
  };

  const output = renderReceiptText(hiddenReceipt, profile);
  assert.doesNotMatch(output, /Order ID/);
  assert.doesNotMatch(output, /Kasir/);
  assert.doesNotMatch(output, /Pelanggan/);
  assert.doesNotMatch(output, /Pembayaran/);
});

test('renderReceiptText keeps payment summary lines consistent with discount and remaining due', () => {
  const profile = createPrinterProfile({
    id: 'test-summary',
    name: 'Thermal Summary',
    type: 'thermal_escpos',
    connection: 'qz_tray',
    paperWidth: '80mm',
    charsPerLine: 48,
  });
  const discountedReceipt: ReceiptData = {
    ...receipt,
    summary: {
      subtotal: 25000,
      discount: 5000,
      grandTotal: 20000,
      paid: 10000,
      remainingDue: 10000,
    },
    payment: {
      method: 'Transfer',
      amount: 10000,
    },
  };

  const output = renderReceiptText(discountedReceipt, profile);
  assert.match(output, /Sub Total/);
  assert.match(output, /25\.000/);
  assert.match(output, /Diskon/);
  assert.match(output, /5\.000/);
  assert.match(output, /Pembayaran Transfer/);
  assert.match(output, /10\.000/);
  assert.match(output, /Total/);
  assert.match(output, /20\.000/);
  assert.match(output, /Sisa/);
});

test('renderReceiptText can render production work order without payment section', () => {
  const profile = createPrinterProfile({
    id: 'test-spk',
    name: 'Thermal SPK',
    type: 'thermal_escpos',
    connection: 'qz_tray',
    paperWidth: '58mm',
    charsPerLine: 32,
  });
  const spkReceipt: ReceiptData = {
    ...receipt,
    store: {
      ...receipt.store,
      title: 'SPK PRODUKSI',
    },
    payment: undefined,
    layout: {
      showPaymentDetail: false,
    },
    detail: {
      ...receipt.detail,
      footerNotes: [
        'Estimasi: -',
        'Prioritas: Normal',
        'Checklist Produksi',
        '[ ] Desain / brief siap',
        'TTD Produksi: ____________',
      ],
      thankYouText: 'SPK PRODUKSI',
    },
  };

  const output = renderReceiptText(spkReceipt, profile);
  output.trimEnd().split('\n').forEach((line) => {
    assert.ok(line.length <= 32);
  });
  assert.match(output, /SPK PRODUKSI/);
  assert.match(output, /Checklist Produksi/);
  assert.match(output, /TTD Produksi/);
  assert.doesNotMatch(output, /Pembayaran/);
});
