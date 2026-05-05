const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProductPickerTree, hasA3Token } = require('../productPickerTree');

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const toLabel = (...candidates) => {
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }
  return '';
};
const normalizeCategoryName = (row) => row?.source_main_category_name || row?.source_category_name || 'Tanpa Kategori';
const normalizeSubCategoryName = (row) => row?.source_subcategory_name || 'Tanpa Sub Kategori';
const normalizeProductFamilyName = (row) => row?.name || '';
const normalizeVariantName = (row) => row?.name || '';
const helpers = {
  normalizeText,
  toLabel,
  normalizeCategoryName,
  normalizeSubCategoryName,
  normalizeProductFamilyName,
  normalizeVariantName,
  toSourceProduct: () => null,
};

test('buildProductPickerTree keeps A3+ rows in each of their subcategories', () => {
  const rows = [
    {
      id: 656,
      name: 'HVS',
      source_main_category_name: 'KERTAS A3+',
      source_subcategory_name: '1 sisi',
      source_category_name: '1 sisi',
      source_product_id: 656,
    },
    {
      id: 613,
      name: 'HVS',
      source_main_category_name: 'KERTAS A3+',
      source_subcategory_name: '2 sisi',
      source_category_name: '2 sisi',
      source_product_id: 638,
    },
  ];

  const tree = buildProductPickerTree(rows, helpers);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].name, 'KERTAS A3+');
  assert.deepEqual(
    tree[0].subcategories.map((item) => item.name),
    ['1 sisi', '2 sisi'],
  );
  assert.equal(tree[0].subcategories[0].products.length, 1);
  assert.equal(tree[0].subcategories[1].products.length, 1);
  assert.equal(tree[0].subcategories[0].products[0].name, 'HVS');
  assert.equal(tree[0].subcategories[1].products[0].name, 'HVS');
  assert.notEqual(
    tree[0].subcategories[0].products[0].key,
    tree[0].subcategories[1].products[0].key,
  );
});

test('hasA3Token recognizes A3+ labels without downgrading them to plain A3', () => {
  assert.equal(hasA3Token('KERTAS A3+'), true);
  assert.equal(hasA3Token('Kertas A3 + Laminasi'), true);
  assert.equal(hasA3Token('A3 plus glossy'), true);
  assert.equal(hasA3Token('A3'), false);
  assert.equal(hasA3Token('A3 '), false);
});

test('other multi-subcategory categories still render all subcategories', () => {
  const rows = [
    {
      id: 1,
      name: 'Sticker Vinyl',
      source_main_category_name: 'STIKER',
      source_subcategory_name: 'Indoor',
      source_category_name: 'Indoor',
      source_product_id: 11,
    },
    {
      id: 2,
      name: 'Sticker Vinyl',
      source_main_category_name: 'STIKER',
      source_subcategory_name: 'Outdoor',
      source_category_name: 'Outdoor',
      source_product_id: 12,
    },
  ];

  const tree = buildProductPickerTree(rows, helpers);
  assert.equal(tree.length, 1);
  assert.deepEqual(
    tree[0].subcategories.map((item) => item.name),
    ['Indoor', 'Outdoor'],
  );
});
