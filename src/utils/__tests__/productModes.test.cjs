const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveQtyOnlyProductMode } = require('../productModes');

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const parseBooleanLoose = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const text = normalizeText(value);
  if (['1', 'true', 'yes', 'ya', 'y', 'on', 'enabled', 'aktif'].includes(text)) return true;
  if (['0', 'false', 'no', 'tidak', 'off', 'disabled', 'nonaktif'].includes(text)) return false;
  return null;
};
const toSourceProduct = (row) => row?.sourceProduct || row?.source_product || null;
const toSourceMeta = (row) => {
  const sourceProduct = toSourceProduct(row);
  const meta = sourceProduct?.meta;
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
};
const resolveProductCalcType = (product, productDetail = null) => {
  const rows = [
    product,
    productDetail,
    toSourceProduct(product),
    toSourceProduct(productDetail),
    toSourceMeta(product),
    toSourceMeta(productDetail),
  ].filter(Boolean);

  for (const row of rows) {
    const value = String(row?.calc_type || row?.calculation_type || '').trim().toLowerCase();
    if (value) {
      return value;
    }
  }

  return '';
};
const isGroupBundleProduct = (product, productDetail = null) => {
  const rows = [
    product,
    productDetail,
    toSourceProduct(product),
    toSourceProduct(productDetail),
    toSourceMeta(product),
    toSourceMeta(productDetail),
  ].filter(Boolean);

  return rows.some((row) => Boolean(row?.is_group_product) || Number(row?.group_component_count || 0) > 0);
};
const helpers = {
  normalizeText,
  parseBooleanLoose,
  toSourceProduct,
  toSourceMeta,
  resolveProductCalcType,
  isGroupBundleProduct,
};

test('resolveQtyOnlyProductMode marks stampel unit_only products as qty-based without ukuran', () => {
  const product = {
    calc_type: 'unit',
    sourceProduct: {
      product_type: 'manufacturing',
      meta: {
        template_scope: 'stampel',
        pos_input_mode: 'unit_only',
      },
    },
    unit_only: true,
  };

  const mode = resolveQtyOnlyProductMode(product, null, helpers);
  assert.equal(mode.enabled, true);
  assert.equal(mode.kind, 'stampel');
  assert.equal(mode.inputLabel, 'Qty / Satuan');
  assert.equal(mode.statusLabel, 'Tanpa Ukuran');
  assert.match(mode.helperText, /stampel/i);
});

test('resolveQtyOnlyProductMode keeps service unit products on service qty-only flow', () => {
  const product = {
    calc_type: 'unit',
    sourceProduct: {
      product_type: 'service',
      meta: {},
    },
  };

  const mode = resolveQtyOnlyProductMode(product, null, helpers);
  assert.equal(mode.enabled, true);
  assert.equal(mode.kind, 'service');
  assert.equal(mode.materialFallbackLabel, 'Tanpa Material');
  assert.match(mode.helperText, /jasa/i);
});

test('resolveQtyOnlyProductMode leaves size-based printing products outside qty-only flow', () => {
  const product = {
    calc_type: 'area',
    sourceProduct: {
      product_type: 'printing',
      meta: {
        sales_schema: 'mmt',
      },
    },
  };

  const mode = resolveQtyOnlyProductMode(product, null, helpers);
  assert.equal(mode.enabled, false);
  assert.equal(mode.kind, '');
});

test('resolveQtyOnlyProductMode keeps group bundle printing products outside qty-only flow', () => {
  const product = {
    calc_type: 'area',
    is_group_product: true,
    group_component_count: 2,
    sourceProduct: {
      product_type: 'printing',
      meta: {
        sales_schema: 'mmt',
      },
    },
  };

  const mode = resolveQtyOnlyProductMode(product, null, helpers);
  assert.equal(mode.enabled, false);
  assert.equal(mode.kind, '');
});

test('resolveQtyOnlyProductMode allows group bundle printing products when calc_type is unit', () => {
  const product = {
    calc_type: 'unit',
    is_group_product: true,
    group_component_count: 2,
    sourceProduct: {
      product_type: 'printing',
      meta: {
        sales_schema: 'banner',
      },
    },
  };

  const mode = resolveQtyOnlyProductMode(product, null, helpers);
  assert.equal(mode.enabled, true);
  assert.equal(mode.kind, 'bundle');
  assert.equal(mode.inputLabel, 'Qty Only');
});

test('money amount normalization supports Indonesian decimal input examples', () => {
  const normalizeMoneyAmountInput = (value) => {
    const text = String(value || '').replace(/[^0-9.,]/g, '').trim();
    if (!text) return '';

    const lastCommaIndex = text.lastIndexOf(',');
    const lastDotIndex = text.lastIndexOf('.');
    const separatorIndex = Math.max(lastCommaIndex, lastDotIndex);

    if (separatorIndex < 0) {
      return text.replace(/[^0-9]/g, '');
    }

    const integerPartRaw = text.slice(0, separatorIndex);
    const fractionalPartRaw = text.slice(separatorIndex + 1);
    const integerDigits = integerPartRaw.replace(/[^0-9]/g, '');
    const fractionalDigits = fractionalPartRaw.replace(/[^0-9]/g, '');

    if (!fractionalDigits) {
      return integerDigits;
    }

    if (fractionalDigits.length > 2) {
      return `${integerDigits}${fractionalDigits}`;
    }

    const normalizedInteger = integerDigits || '0';
    return `${normalizedInteger}.${fractionalDigits}`;
  };
  const sanitizeMoneyAmountTextInput = (value) => String(value || '').replace(/[^0-9.,]/g, '').trim();
  const formatIntegerWithDotSeparator = (value) => {
    const digits = String(value || '').replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '') || '0';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  const formatRupiahMoneyInputDisplay = (value) => {
    const text = sanitizeMoneyAmountTextInput(value);
    if (!text) {
      return 'Rp 0,00';
    }

    const lastCommaIndex = text.lastIndexOf(',');
    const lastDotIndex = text.lastIndexOf('.');
    const separatorIndex = Math.max(lastCommaIndex, lastDotIndex);
    if (separatorIndex < 0) {
      return `Rp ${formatIntegerWithDotSeparator(text)},00`;
    }

    const integerDigits = text.slice(0, separatorIndex).replace(/[^0-9]/g, '') || '0';
    const fractionalDigits = text.slice(separatorIndex + 1).replace(/[^0-9]/g, '');
    if (fractionalDigits.length > 2) {
      return `Rp ${formatIntegerWithDotSeparator(`${integerDigits}${fractionalDigits}`)},00`;
    }

    return `Rp ${formatIntegerWithDotSeparator(integerDigits)},${fractionalDigits.padEnd(2, '0').slice(0, 2)}`;
  };

  assert.equal(normalizeMoneyAmountInput('20.000,10'), '20000.10');
  assert.equal(normalizeMoneyAmountInput('20,000.10'), '20000.10');
  assert.equal(normalizeMoneyAmountInput('20.000.10'), '20000.10');
  assert.equal(normalizeMoneyAmountInput('20000,10'), '20000.10');
  assert.equal(normalizeMoneyAmountInput('20.000'), '20000');
  assert.equal(normalizeMoneyAmountInput('1'), '1');
  assert.equal(normalizeMoneyAmountInput('10'), '10');
  assert.equal(normalizeMoneyAmountInput('100'), '100');
  assert.equal(normalizeMoneyAmountInput('1000'), '1000');
  assert.equal(normalizeMoneyAmountInput('10.000'), '10000');
  assert.equal(normalizeMoneyAmountInput('100.000'), '100000');
  assert.equal(normalizeMoneyAmountInput('1.000.000'), '1000000');
  assert.equal(normalizeMoneyAmountInput('1.000.000,00'), '1000000.00');
  assert.equal(normalizeMoneyAmountInput('10.000,50'), '10000.50');
  assert.equal(normalizeMoneyAmountInput('100.000,75'), '100000.75');
  assert.equal(sanitizeMoneyAmountTextInput('10.000,23'), '10.000,23');
  assert.equal(normalizeMoneyAmountInput(sanitizeMoneyAmountTextInput('10.000,23')), '10000.23');
  assert.equal(formatRupiahMoneyInputDisplay('100000'), 'Rp 100.000,00');
  assert.equal(formatRupiahMoneyInputDisplay('100000,23'), 'Rp 100.000,23');
  assert.equal(formatRupiahMoneyInputDisplay('100000,2'), 'Rp 100.000,20');
  assert.equal(formatRupiahMoneyInputDisplay('10.000,23'), 'Rp 10.000,23');
});
