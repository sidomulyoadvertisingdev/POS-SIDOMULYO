const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CUSTOMER_PHONE_CONFLICT_MESSAGE,
  getCustomerPhoneSearchFragments,
  isCustomerPhoneConflictError,
  matchesCustomerSearch,
  normalizeIndonesianPhone,
} = require('../customerPhone');

test('normalizeIndonesianPhone converts supported Indonesian mobile formats to canonical 628', () => {
  assert.equal(normalizeIndonesianPhone('081234567890'), '6281234567890');
  assert.equal(normalizeIndonesianPhone('+6281234567890'), '6281234567890');
  assert.equal(normalizeIndonesianPhone('6281234567890'), '6281234567890');
  assert.equal(normalizeIndonesianPhone('08 1234-5678-90'), '6281234567890');
});

test('normalizeIndonesianPhone rejects unsupported formats', () => {
  assert.throws(() => normalizeIndonesianPhone('71234567890'), /format/i);
  assert.throws(() => normalizeIndonesianPhone('08123abc890'), /format/i);
});

test('getCustomerPhoneSearchFragments keeps phone search compatible with 08 and 628 input', () => {
  assert.deepEqual(
    getCustomerPhoneSearchFragments('081234567890'),
    ['081234567890', '6281234567890'],
  );
  assert.deepEqual(
    getCustomerPhoneSearchFragments('+6281234567890'),
    ['6281234567890', '081234567890'],
  );
});

test('matchesCustomerSearch can search customers by name and phone fragments', () => {
  const customer = {
    name: 'Budi Sidomulyo',
    phone: '6281234567890',
  };

  assert.equal(matchesCustomerSearch(customer, 'budi'), true);
  assert.equal(matchesCustomerSearch(customer, '081234567890'), true);
  assert.equal(matchesCustomerSearch(customer, '+6281234567890'), true);
  assert.equal(matchesCustomerSearch(customer, '089999999999'), false);
});

test('isCustomerPhoneConflictError recognizes backend duplicate phone responses', () => {
  assert.equal(
    isCustomerPhoneConflictError({
      status: 409,
      body: {
        errors: {
          phone: [CUSTOMER_PHONE_CONFLICT_MESSAGE],
        },
      },
    }),
    true,
  );
});
