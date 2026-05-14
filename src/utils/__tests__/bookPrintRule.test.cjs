const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BOOK_PRODUCT_DIRECTION_RULES,
  DEFAULT_BOOK_PRINT_RULE_FIELD_OPTIONS,
  buildBookDirectionSummary,
  buildBookPrintRulePayload,
  buildBookQuickSummary,
  computeBookPageValidation,
  filterBookFieldOptionsByFlowContext,
  filterBookMaterialOptionsByFlowContext,
  DEFAULT_BOOK_PRINT_RULE_WIZARD_STEPS,
  filterBookOptionsByRule,
  getBookDirectionRule,
  getBookPrintRuleConfig,
  getBookWizardProductContext,
  isBookSalesProduct,
  normalizeBookMultiSelection,
  normalizeBookSelection,
  normalizePrintSideCode,
  resolveBookAutoSelection,
  resolveBookPageMultiple,
  resolveBookPrintRuleFromSource,
  resolveBookWizardStepsForFlowContext,
} = require('../bookPrintRule');

test('isBookSalesProduct detects explicit product_type book', () => {
  const product = {
    product_type: 'book',
  };

  assert.equal(isBookSalesProduct(product), true);
});

test('isBookSalesProduct detects book configurator in source meta', () => {
  const product = {
    sourceProduct: {
      meta: {
        configurator: 'book',
      },
    },
  };

  assert.equal(isBookSalesProduct(product), true);
});

test('getBookPrintRuleConfig falls back to default field options', () => {
  const config = getBookPrintRuleConfig({}, null);

  assert.deepEqual(config.field_options.finished_size, DEFAULT_BOOK_PRINT_RULE_FIELD_OPTIONS.finished_size);
  assert.equal(config.messages.blank_pages_not_needed, 'Jumlah halaman sudah sesuai kelipatan produksi.');
  assert.deepEqual(config.wizard_steps, DEFAULT_BOOK_PRINT_RULE_WIZARD_STEPS);
});

test('getBookPrintRuleConfig normalizes backend wizard steps safely', () => {
  const config = getBookPrintRuleConfig({
    book_print_rule_config: {
      wizard_steps: [
        {
          code: 'book_type',
          title: 'Pilih Jenis Buku',
          short_label: 'Jenis',
          description: 'Atur jenis buku dulu.',
        },
      ],
    },
  }, null);

  assert.equal(config.wizard_steps[0].code, 'book_type');
  assert.equal(config.wizard_steps[0].shortLabel, 'Jenis');
});

test('getBookPrintRuleConfig preserves live product pricing metadata on options', () => {
  const config = getBookPrintRuleConfig({
    book_print_rule_config: {
      field_options: {
        binding_type: [
          {
            value: 'spiral',
            label: 'Spiral',
            product_id: 15,
            sku: 'SPIRAL',
            selling_price: 8000,
            unit_price: 8000,
          },
        ],
      },
    },
  }, null);

  assert.equal(config.field_options.binding_type[0].product_id, 15);
  assert.equal(config.field_options.binding_type[0].selling_price, 8000);
  assert.equal(config.field_options.binding_type[0].sku, 'SPIRAL');
});

test('normalizeBookSelection keeps allowed value and falls back safely', () => {
  const options = [
    { value: 'A4', label: 'A4' },
    { value: 'A5', label: 'A5' },
  ];

  assert.equal(normalizeBookSelection('a5', options, 'A4'), 'A5');
  assert.equal(normalizeBookSelection('unknown', options, 'A4'), 'A4');
});

test('normalizeBookMultiSelection keeps only allowed unique values', () => {
  const options = [
    { value: 'creasing', label: 'Creasing' },
    { value: 'lipat', label: 'Lipat' },
  ];

  assert.deepEqual(
    normalizeBookMultiSelection(['creasing', 'invalid', 'lipat', 'creasing'], options),
    ['creasing', 'lipat'],
  );
});

test('buildBookPrintRulePayload emits customer-facing book fields and duplex print mode', () => {
  const payload = buildBookPrintRulePayload({
    finishedSize: 'A5',
    printModel: 'Cetak Susun Buku / Lipat Buku',
    printSide: 'Cetak Bolak-Balik',
    customerPageCount: 12,
    productName: 'Buku Yasin',
    productType: 'book',
  });

  assert.deepEqual(payload, {
    finished_size: 'A5',
    print_model: 'Cetak Susun Buku / Lipat Buku',
    print_side: 'Cetak Bolak-Balik',
    customer_page_count: 12,
    page_count: 12,
    product_name: 'Buku Yasin',
    product_type: 'book',
    print_mode: 'duplex',
  });
});

test('buildBookPrintRulePayload supports materials binding and addons', () => {
  const payload = buildBookPrintRulePayload({
    bookType: 'buku_yasin',
    finishedSize: 'A5',
    materialInside: 'MAT-HVS-80',
    materialCover: 'MAT-IVORY-230',
    materialInsideProductId: 101,
    materialCoverProductId: 202,
    printModel: 'Cetak Susun Buku / Lipat Buku / Imposisi',
    printSide: 'Cetak 2 Sisi',
    customerPageCount: 12,
    insidePrint: 'bw',
    coverPrint: 'color',
    bindingType: 'staples_tengah',
    materialSourceMode: 'warehouse',
    selectedExtraFinishings: ['creasing'],
    extraFinishingOptions: [{ value: 'creasing', label: 'Creasing', default_unit: 'order' }],
  });

  assert.equal(payload.book_type, 'buku_yasin');
  assert.equal(payload.material_inside_product_id, 101);
  assert.equal(payload.material_cover_product_id, 202);
  assert.deepEqual(payload.material_product_ids, [101, 202]);
  assert.equal(payload.print_mode, 'duplex');
  assert.equal(payload.binding_type, 'staples_tengah');
  assert.equal(payload.addons.length, 1);
  assert.equal(payload.addons[0].option_code, 'creasing');
});

test('resolveBookPrintRuleFromSource reads direct response and snapshot fallback', () => {
  const direct = resolveBookPrintRuleFromSource({
    book_print_rule: {
      required_page_multiple: 8,
      blank_page_count: 4,
    },
  });
  const nested = resolveBookPrintRuleFromSource({
    spec_snapshot: {
      book_print_rule: {
        required_page_multiple: 4,
        blank_page_count: 1,
      },
    },
  });

  assert.equal(direct.required_page_multiple, 8);
  assert.equal(nested.blank_page_count, 1);
});

test('buildBookQuickSummary renders concise production summary', () => {
  const summary = buildBookQuickSummary({
    required_page_multiple: 8,
    production_page_count: 16,
    blank_page_count: 4,
    estimated_a3_plus_sheets: 2,
  });

  assert.equal(summary, 'Kelipatan 8 | Produksi 16 hlm | Kosong 4 hlm | A3+ 2 lbr');
});

test('buildBookQuickSummary marks manual custom layout cases', () => {
  const summary = buildBookQuickSummary({
    needs_manual_layout_check: true,
  });

  assert.equal(summary, 'Perlu cek layout manual');
});

test('getBookDirectionRule returns cashier direction metadata for known book types', () => {
  const rule = getBookDirectionRule('buku_yasin');

  assert.equal(rule.segment, 'Buku Keagamaan & Acara Keluarga');
  assert.equal(rule.pageMultipleRules['A5|Cetak Bolak-Balik'], 8);
});

test('filterBookOptionsByRule narrows size, print model, and print side safely', () => {
  const fieldOptions = {
    finished_size: DEFAULT_BOOK_PRINT_RULE_FIELD_OPTIONS.finished_size,
    print_model: DEFAULT_BOOK_PRINT_RULE_FIELD_OPTIONS.print_model,
    print_side: DEFAULT_BOOK_PRINT_RULE_FIELD_OPTIONS.print_side,
  };

  const filtered = filterBookOptionsByRule(fieldOptions, BOOK_PRODUCT_DIRECTION_RULES.nota);

  assert.deepEqual(filtered.finished_size.map((row) => row.value), ['A4', 'A5']);
  assert.deepEqual(filtered.print_model.map((row) => row.value), ['Cetak Normal / Per Halaman']);
  assert.deepEqual(filtered.print_side.map((row) => row.value), ['Cetak 1 Sisi']);
});

test('resolveBookPageMultiple supports size and side combinations', () => {
  const multiple = resolveBookPageMultiple({
    rule: BOOK_PRODUCT_DIRECTION_RULES.skripsi_tugas_makalah,
    size: 'A4',
    printSide: 'Cetak 1 Sisi',
  });

  assert.equal(multiple, 2);
});

test('computeBookPageValidation rounds page count and calculates blank pages', () => {
  const validation = computeBookPageValidation({
    inputPages: 22,
    multiple: 8,
  });

  assert.deepEqual(validation, {
    inputPages: 22,
    requiredMultiple: 8,
    blankPages: 2,
    totalPrintPages: 24,
    isExact: false,
    isManualCheck: false,
  });
});

test('resolveBookAutoSelection keeps valid choices and auto-picks a single filtered option', () => {
  const rows = [{ value: 'A5', label: 'A5' }];

  assert.equal(resolveBookAutoSelection({ currentValue: 'A4', options: rows }), 'A5');
  assert.equal(resolveBookAutoSelection({ currentValue: 'A5', options: rows }), 'A5');
});

test('buildBookDirectionSummary renders concise cashier-facing page summary', () => {
  const summary = buildBookDirectionSummary({
    validation: {
      inputPages: 22,
      requiredMultiple: 8,
      blankPages: 2,
      totalPrintPages: 24,
      isExact: false,
      isManualCheck: false,
    },
  });

  assert.equal(summary, 'Kelipatan 8 | 22 -> 24 hlm');
});

test('getBookWizardProductContext normalizes locked print side from backend config', () => {
  const context = getBookWizardProductContext({
    product_context: {
      locked_print_side: true,
      forced_print_side_code: 'double_sided',
      forced_print_side: 'Cetak Bolak-Balik',
      locked_fields: ['print_side'],
    },
  });

  assert.equal(context.locked_print_side, true);
  assert.equal(context.forced_print_side_code, 'double_sided');
  assert.deepEqual(context.locked_fields, ['print_side']);
});

test('resolveBookWizardStepsForFlowContext removes print_side step when product flow locks side', () => {
  const steps = resolveBookWizardStepsForFlowContext(DEFAULT_BOOK_PRINT_RULE_WIZARD_STEPS, {
    locked_print_side: true,
    forced_print_side_code: 'double_sided',
  });

  assert.equal(steps.some((row) => row.code === 'print_side'), false);
});

test('filterBookFieldOptionsByFlowContext narrows print side to forced product flow', () => {
  const filtered = filterBookFieldOptionsByFlowContext({
    print_side: DEFAULT_BOOK_PRINT_RULE_FIELD_OPTIONS.print_side,
  }, {
    locked_print_side: true,
    forced_print_side_code: 'double_sided',
  });

  assert.deepEqual(
    filtered.print_side.map((row) => normalizePrintSideCode(row.code || row.value || row.label || '')),
    ['double_sided', 'double_sided'],
  );
});

test('filterBookMaterialOptionsByFlowContext keeps only side-matching rows when explicit matches exist', () => {
  const filtered = filterBookMaterialOptionsByFlowContext([
    { value: '101', label: 'BAHAN AP 120 1 SISI', book_print_side_code: 'single_sided' },
    { value: '202', label: 'BAHAN AP 120 2 SISI', book_print_side_code: 'double_sided' },
  ], {
    locked_print_side: true,
    forced_print_side_code: 'double_sided',
  });

  assert.deepEqual(filtered.map((row) => row.value), ['202']);
});
