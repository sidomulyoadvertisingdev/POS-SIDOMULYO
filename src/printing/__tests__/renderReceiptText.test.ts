import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrinterProfile } from '../profiles';
import { renderReceiptText } from '../renderReceiptText';
import type { ReceiptData } from '../types';

const receipt: ReceiptData = {
  store: {
    title: 'Nota Penjualan',
    name: 'Toko Test',
    tagline: 'Cepat & Rapi',
    headerText: 'Buka 24 jam',
    footer: 'Terima kasih',
  },
  transaction: {
    invoiceNo: 'INV-001',
    orderId: 'ORD-001',
    date: '2026-05-02 21:00',
    cashier: 'Kasir Test',
    customer: 'Budi',
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
    assert.ok(line.length <= 32 || line.includes('Rp'));
  });
  assert.match(output, /INV-001/);
  assert.match(output, /ORD-001/);
  assert.match(output, /Kasir/);
  assert.match(output, /Customer/);
  assert.match(output, /Uk:/);
  assert.match(output, /Bahan:/);
  assert.match(output, /Finishing:/);
  assert.match(output, /Catatan:/);
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
    assert.ok(line.length <= 48 || line.includes('Rp'));
  });
  assert.match(output, /Nama Item/);
  assert.match(output, /Nota Penjualan/);
  assert.match(output, /Cepat & Rapi/);
  assert.match(output, /Buka 24 jam/);
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
  assert.doesNotMatch(output, /Customer/);
  assert.doesNotMatch(output, /Bayar/);
  assert.doesNotMatch(output, /Tunai/);
  assert.doesNotMatch(output, /Kembali/);
});
