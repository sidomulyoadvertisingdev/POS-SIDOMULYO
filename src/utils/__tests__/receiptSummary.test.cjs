const test = require('node:test');
const assert = require('node:assert/strict');
const { extractOrderDiscountAmount, parseLooseMoneyValue } = require('../receiptSummary');

test('parseLooseMoneyValue parses Indonesian formatted currency safely', () => {
  assert.equal(parseLooseMoneyValue('Rp 12.500'), 12500);
  assert.equal(parseLooseMoneyValue('12.500,50'), 12500.5);
  assert.equal(parseLooseMoneyValue(8750), 8750);
  assert.equal(parseLooseMoneyValue(''), 0);
  assert.equal(parseLooseMoneyValue('bukan angka'), 0);
});

test('extractOrderDiscountAmount prefers explicit backend discount fields', () => {
  const row = {
    invoice: {
      discount_amount: '15000',
    },
    notes: 'Diskon Order: 5000',
  };

  assert.equal(extractOrderDiscountAmount(row), 15000);
});

test('extractOrderDiscountAmount falls back to workflow note when explicit field missing', () => {
  const row = {
    notes: [
      'Customer: Budi',
      'Tanggal Order: 2026-05-07',
      'Diskon Order: Rp 7.500',
      'Catatan: Selesaikan cepat',
    ].join('\n'),
  };

  assert.equal(extractOrderDiscountAmount(row), 7500);
});

test('extractOrderDiscountAmount checks alternate note locations', () => {
  const row = {
    payment: {
      note: 'Diskon Order: 3200',
    },
  };

  assert.equal(extractOrderDiscountAmount(row), 3200);
});

test('extractOrderDiscountAmount returns zero when no valid discount exists', () => {
  const row = {
    notes: 'Catatan: tanpa diskon',
  };

  assert.equal(extractOrderDiscountAmount(row), 0);
});
