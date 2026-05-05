import test from 'node:test';
import assert from 'node:assert/strict';
import { centerText, leftRight, wrapText } from '../receiptHelpers';

test('centerText centers content within width', () => {
  assert.equal(centerText('ABC', 7), '  ABC  ');
});

test('leftRight keeps right text aligned when space is enough', () => {
  assert.equal(leftRight('Total', 'Rp10.000', 20), 'Total       Rp10.000');
});

test('wrapText breaks long text into safe width lines', () => {
  assert.deepEqual(wrapText('Nama item sangat panjang untuk test', 10), [
    'Nama item',
    'sangat',
    'panjang',
    'untuk test',
  ]);
});
