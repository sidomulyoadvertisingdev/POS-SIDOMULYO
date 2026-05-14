const normalizeText = (value) => String(value || '').trim().toLowerCase();

const DEFAULT_FIELD_OPTIONS = {
  book_type: [
    { value: 'buku_umum', label: 'Buku Umum / Personal' },
    { value: 'buku_yasin', label: 'Buku Yasin / Tahlil / Doa' },
    { value: 'wedding_book', label: 'Wedding Book / Buku Acara Pernikahan' },
    { value: 'buku_kenangan', label: 'Buku Kenangan' },
    { value: 'buku_agenda', label: 'Buku Agenda' },
    { value: 'buku_catatan', label: 'Buku Catatan / Notes' },
    { value: 'company_profile', label: 'Company Profile / SOP Book' },
    { value: 'proposal', label: 'Proposal' },
    { value: 'portfolio_book', label: 'Portofolio / Portfolio Book' },
    { value: 'katalog', label: 'Katalog / Katalog Produk' },
    { value: 'booklet', label: 'Booklet' },
    { value: 'buku_menu', label: 'Buku Menu / Menu' },
    { value: 'modul_pelatihan', label: 'Modul Pelatihan' },
    { value: 'skripsi_tugas_makalah', label: 'Skripsi / Tugas / Makalah' },
    { value: 'pricelist', label: 'Daftar Harga / Pricelist' },
    { value: 'yearbook', label: 'Buku Tahunan / Yearbook' },
    { value: 'buku_panduan', label: 'Buku Panduan / Buku Latihan' },
    { value: 'nota', label: 'Nota' },
    { value: 'dokumen_tender', label: 'Dokumen Tender / Penawaran' },
    { value: 'manual_book', label: 'Manual Book / Panduan Produk' },
    { value: 'majalah', label: 'Majalah / Magazine' },
    { value: 'buku_administrasi', label: 'Buku Administrasi' },
  ],
  material_inside: [
    { value: 'HVS', label: 'HVS' },
    { value: 'Art Paper 120 gsm', label: 'Art Paper 120 gsm' },
    { value: 'Art Paper 150 gsm', label: 'Art Paper 150 gsm' },
    { value: 'Ivory 210 gsm', label: 'Ivory 210 gsm' },
    { value: 'Ivory 230 gsm', label: 'Ivory 230 gsm' },
    { value: 'Ivory 260 gsm', label: 'Ivory 260 gsm' },
    { value: 'Ivory 300 gsm', label: 'Ivory 300 gsm' },
    { value: 'Ivory 310 gsm', label: 'Ivory 310 gsm' },
    { value: 'Ivory 350 gsm', label: 'Ivory 350 gsm' },
    { value: 'Ivory 360 gsm', label: 'Ivory 360 gsm' },
    { value: 'BC', label: 'BC / Buku Tamu / Kertas' },
    { value: 'CC', label: 'CC / Krungkut / Foto' },
    { value: 'Linen', label: 'Linen' },
    { value: 'Jasmine', label: 'Jasmine' },
    { value: 'Hammer', label: 'Hammer' },
    { value: 'LMO', label: 'LMO' },
    { value: 'Silky Photo A4', label: 'Silky Photo A4' },
  ],
  material_cover: [
    { value: 'Art Paper 150 gsm', label: 'Art Paper 150 gsm' },
    { value: 'Ivory 210 gsm', label: 'Ivory 210 gsm' },
    { value: 'Ivory 230 gsm', label: 'Ivory 230 gsm' },
    { value: 'Ivory 260 gsm', label: 'Ivory 260 gsm' },
    { value: 'Ivory 300 gsm', label: 'Ivory 300 gsm' },
    { value: 'Ivory 310 gsm', label: 'Ivory 310 gsm' },
    { value: 'Ivory 350 gsm', label: 'Ivory 350 gsm' },
    { value: 'Ivory 360 gsm', label: 'Ivory 360 gsm' },
    { value: 'BC', label: 'BC / Buku Tamu / Kertas' },
    { value: 'CC', label: 'CC / Krungkut / Foto' },
    { value: 'Linen', label: 'Linen' },
    { value: 'Jasmine', label: 'Jasmine' },
    { value: 'Hammer', label: 'Hammer' },
    { value: 'LMO', label: 'LMO' },
    { value: 'Silky Photo A4', label: 'Silky Photo A4' },
  ],
  finished_size: [
    { value: 'A4', label: 'A4' },
    { value: 'A5', label: 'A5' },
    { value: 'A6', label: 'A6' },
    { value: 'A7', label: 'A7' },
    { value: 'CUSTOM', label: 'Custom' },
  ],
  print_model: [
    { value: 'Cetak Normal / Per Halaman', label: 'Cetak Normal / Per Halaman', code: 'normal_per_page' },
    { value: 'Cetak Susun Buku / Lipat Buku', label: 'Cetak Susun Buku / Lipat Buku', code: 'booklet_imposition' },
    { value: 'Cetak Susun Buku / Lipat Buku / Imposisi', label: 'Cetak Susun Buku / Lipat Buku / Imposisi', code: 'booklet_imposition' },
  ],
  print_side: [
    { value: 'Cetak 1 Sisi', label: 'Cetak 1 Sisi', code: 'single_sided' },
    { value: 'Cetak 2 Sisi', label: 'Cetak 2 Sisi', code: 'double_sided' },
    { value: 'Cetak Bolak-Balik', label: 'Cetak Bolak-Balik', code: 'double_sided' },
  ],
  inside_print: [
    { value: 'bw', label: 'Hitam Putih' },
    { value: 'color', label: 'Full Color' },
  ],
  cover_print: [
    { value: 'bw', label: 'Hitam Putih' },
    { value: 'color', label: 'Full Color' },
  ],
  binding_type: [
    { value: 'staples_tengah', label: 'Staples Tengah', default_price: 250 },
    { value: 'staples_pinggir', label: 'Staples Pinggir', default_price: 250 },
    { value: 'ring', label: 'Ring', default_price: 500 },
    { value: 'spiral', label: 'Spiral', default_price: 8000 },
    { value: 'jilid_lem_panas', label: 'Jilid Lem Panas', default_price: 5000 },
    { value: 'jilid_ring', label: 'Jilid Ring', default_price: 500 },
    { value: 'jilid_spiral', label: 'Jilid Spiral', default_price: 8000 },
    { value: 'pembolong_kalender', label: 'Pembolong Kalender', default_price: 250 },
    { value: 'jilid_lakban', label: 'Jilid Lakban', default_price: 2500 },
    { value: 'jilid_hanging', label: 'Jilid Hanging', default_price: 10000 },
    { value: 'board_hard_cover', label: 'Board Hard Cover', default_price: 20000 },
  ],
  extra_finishings: [
    { value: 'laminasi_glossy_cover', label: 'Laminasi Glossy Cover', default_unit: 'cover' },
    { value: 'laminasi_doff_cover', label: 'Laminasi Doff Cover', default_unit: 'cover' },
    { value: 'laminasi_glossy_isi', label: 'Laminasi Glossy Isi', default_unit: 'isi' },
    { value: 'laminasi_doff_isi', label: 'Laminasi Doff Isi', default_unit: 'isi' },
    { value: 'laminating', label: 'Laminating', default_unit: 'order' },
    { value: 'creasing', label: 'Creasing', default_unit: 'order', default_price: 1000 },
    { value: 'perforasi_sobek', label: 'Perforasi / Sobek', default_unit: 'order', default_price: 500 },
    { value: 'lipat', label: 'Lipat', default_unit: 'order', default_price: 500 },
    { value: 'sisip_halaman_pembatas', label: 'Sisip Halaman Pembatas', default_unit: 'order', default_price: 500 },
    { value: 'halaman_kosong_tambahan', label: 'Halaman Kosong Tambahan', default_unit: 'halaman', default_price: 0 },
  ],
};

const DEFAULT_MESSAGES = {
  blank_pages_needed:
    'Jumlah halaman customer belum sesuai kelipatan produksi. Sistem akan menambahkan {blank_page_count} halaman kosong sehingga total halaman produksi menjadi {production_page_count} halaman.',
  blank_pages_not_needed: 'Jumlah halaman sudah sesuai kelipatan produksi.',
  custom_layout_check:
    'Ukuran custom perlu dicek layout oleh desain/produksi sebelum sistem bisa menghitung halaman dan estimasi lembar A3+ secara final.',
};

const DEFAULT_WIZARD_STEPS = [
  {
    code: 'book_type',
    title: 'Pilih Jenis Buku',
    shortLabel: 'Jenis',
    description: 'Tentukan dulu jenis produk buku agar aturan berikutnya dibentuk sesuai kebutuhan customer.',
  },
  {
    code: 'finished_size',
    title: 'Pilih Ukuran Jadi',
    shortLabel: 'Ukuran',
    description: 'Ukuran jadi menentukan kelipatan halaman dan arah produksi buku.',
  },
  {
    code: 'print_model',
    title: 'Pilih Model Cetak',
    shortLabel: 'Model',
    description: 'Kasir memilih apakah buku dicetak normal per halaman atau susun buku / lipat buku.',
  },
  {
    code: 'print_side',
    title: 'Pilih Sisi Cetak',
    shortLabel: 'Sisi',
    description: 'Pilih 1 sisi atau bolak-balik sesuai kebutuhan customer dan aturan layout.',
  },
  {
    code: 'customer_page_count',
    title: 'Isi Halaman Customer',
    shortLabel: 'Halaman',
    description: 'Masukkan jumlah halaman file customer sebelum sistem membulatkan ke kebutuhan produksi.',
  },
  {
    code: 'material_inside',
    title: 'Pilih Bahan Isi',
    shortLabel: 'Isi',
    description: 'Bahan isi dipakai untuk halaman dalam buku dan memengaruhi kalkulasi produksi.',
  },
  {
    code: 'material_cover',
    title: 'Pilih Bahan Cover',
    shortLabel: 'Cover',
    description: 'Bahan cover dipakai untuk sampul buku dan dihitung terpisah dari isi.',
  },
  {
    code: 'print_colors',
    title: 'Tentukan Mode Cetak',
    shortLabel: 'Cetak',
    description: 'Pilih mode cetak isi dan cover agar preview produksi sesuai kebutuhan customer.',
  },
  {
    code: 'finishing',
    title: 'Pilih Finishing',
    shortLabel: 'Finishing',
    description: 'Pilih finishing utama dan tambahan sebagai penutup konfigurasi Buku.',
  },
];

const normalizePrintSideCode = (value) => {
  const text = normalizeText(value);
  if (['single_sided', 'cetak 1 sisi', '1 sisi', 'simplex', 'single sided', 'single'].includes(text)) {
    return 'single_sided';
  }
  if (['double_sided', 'cetak 2 sisi', 'cetak bolak-balik', 'bolak-balik', 'bolak balik', 'duplex', 'double sided', 'double'].includes(text)) {
    return 'double_sided';
  }
  return '';
};

const BOOK_PRODUCT_DIRECTION_RULES = {
  buku_yasin: {
    label: 'Buku Yasin / Tahlil / Doa',
    segment: 'Buku Keagamaan & Acara Keluarga',
    sizes: ['A5'],
    printModels: ['Cetak Susun Buku / Lipat Buku', 'Cetak Susun Buku / Lipat Buku / Imposisi'],
    printSides: ['Cetak Bolak-Balik'],
    pageMultipleRules: {
      'A5|Cetak Bolak-Balik': 8,
    },
    cashierNote: 'Jika halaman belum kelipatan 8, tambah halaman kosong.',
  },
  wedding_book: {
    label: 'Wedding Book / Buku Acara',
    segment: 'Buku Keagamaan & Acara Keluarga',
    sizes: ['A5'],
    printModels: ['Cetak Susun Buku / Lipat Buku', 'Cetak Susun Buku / Lipat Buku / Imposisi'],
    printSides: ['Cetak Bolak-Balik'],
    pageMultipleRules: {
      'A5|Cetak Bolak-Balik': 8,
    },
    cashierNote: 'Umumnya pakai susun buku agar rapi saat dilipat.',
  },
  company_profile: {
    label: 'Company Profile',
    segment: 'Bisnis, Perusahaan & Brand',
    sizes: ['A4', 'A5'],
    printModels: ['Cetak Normal / Per Halaman'],
    printSides: ['Cetak Bolak-Balik'],
    pageMultipleRules: {
      'A4|Cetak Bolak-Balik': 4,
      'A5|Cetak Bolak-Balik': 8,
    },
    cashierNote: 'Untuk jilid lem/ring biasanya normal per halaman.',
  },
  katalog: {
    label: 'Katalog',
    segment: 'Bisnis, Perusahaan & Brand',
    sizes: ['A4', 'A5'],
    printModels: ['Cetak Normal / Per Halaman', 'Cetak Susun Buku / Lipat Buku', 'Cetak Susun Buku / Lipat Buku / Imposisi'],
    printSides: ['Cetak Bolak-Balik'],
    pageMultipleRules: {
      'A4|Cetak Bolak-Balik': 4,
      'A5|Cetak Bolak-Balik': 8,
    },
    cashierNote: 'Tentukan dulu mau jilid lem/ring atau staples tengah.',
  },
  buku_menu: {
    label: 'Menu / Buku Menu',
    segment: 'Kuliner, Restoran, Cafe & UMKM',
    sizes: ['A4', 'A5'],
    printModels: ['Cetak Normal / Per Halaman'],
    printSides: ['Cetak Bolak-Balik'],
    pageMultipleRules: {
      'A4|Cetak Bolak-Balik': 4,
      'A5|Cetak Bolak-Balik': 8,
    },
    cashierNote: 'Menu lembar tebal bisa normal, buku menu bisa jilid atau ring.',
  },
  modul_pelatihan: {
    label: 'Modul Pelatihan',
    segment: 'Pendidikan, Sekolah, Kampus & Pelatihan',
    sizes: ['A4'],
    printModels: ['Cetak Normal / Per Halaman'],
    printSides: ['Cetak Bolak-Balik'],
    pageMultipleRules: {
      'A4|Cetak Bolak-Balik': 4,
    },
    cashierNote: 'Cocok untuk ring, jilid lem, atau staples samping.',
  },
  skripsi_tugas_makalah: {
    label: 'Skripsi / Tugas / Makalah',
    segment: 'Pendidikan, Sekolah, Kampus & Pelatihan',
    sizes: ['A4'],
    printModels: ['Cetak Normal / Per Halaman'],
    printSides: ['Cetak 1 Sisi', 'Cetak Bolak-Balik'],
    pageMultipleRules: {
      'A4|Cetak 1 Sisi': 2,
      'A4|Cetak Bolak-Balik': 4,
    },
    cashierNote: 'Ikuti permintaan sekolah atau kampus.',
  },
  booklet: {
    label: 'Booklet / Buku Program Acara',
    segment: 'Event, Seminar, Komunitas & Organisasi',
    sizes: ['A5'],
    printModels: ['Cetak Susun Buku / Lipat Buku', 'Cetak Susun Buku / Lipat Buku / Imposisi'],
    printSides: ['Cetak Bolak-Balik'],
    pageMultipleRules: {
      'A5|Cetak Bolak-Balik': 8,
    },
    cashierNote: 'Paling aman jelaskan harus kelipatan 8 untuk A5.',
  },
  nota: {
    label: 'Nota / Formulir / Buku Order',
    segment: 'Administrasi, Kantor & Operasional',
    sizes: ['A4', 'A5'],
    printModels: ['Cetak Normal / Per Halaman'],
    printSides: ['Cetak 1 Sisi'],
    pageMultipleRules: {
      'A4|Cetak 1 Sisi': 2,
      'A5|Cetak 1 Sisi': 4,
    },
    cashierNote: 'Umumnya 1 sisi agar mudah diisi.',
  },
  dokumen_tender: {
    label: 'Dokumen Tender / Penawaran',
    segment: 'Tender, Penawaran & Dokumen Resmi',
    sizes: ['A4'],
    printModels: ['Cetak Normal / Per Halaman'],
    printSides: ['Cetak 1 Sisi', 'Cetak Bolak-Balik'],
    pageMultipleRules: {
      'A4|Cetak 1 Sisi': 2,
      'A4|Cetak Bolak-Balik': 4,
    },
    cashierNote: 'Jika harus 1 sisi, arahkan ke aturan A4 1 sisi.',
  },
  manual_book: {
    label: 'Panduan Produk / Manual Book',
    segment: 'Manual, Panduan Produk & After Sales',
    sizes: ['A5', 'A6'],
    printModels: ['Cetak Susun Buku / Lipat Buku', 'Cetak Susun Buku / Lipat Buku / Imposisi'],
    printSides: ['Cetak Bolak-Balik'],
    pageMultipleRules: {
      'A5|Cetak Bolak-Balik': 8,
      'A6|Cetak Bolak-Balik': 16,
    },
    cashierNote: 'Untuk buku kecil, pastikan jumlah halaman pas kelipatan.',
  },
  buku_panduan: {
    label: 'Buku Panduan / Buku Latihan',
    segment: 'Manual, Panduan Produk & After Sales',
    sizes: ['A5', 'A6'],
    printModels: ['Cetak Susun Buku / Lipat Buku', 'Cetak Susun Buku / Lipat Buku / Imposisi'],
    printSides: ['Cetak Bolak-Balik'],
    pageMultipleRules: {
      'A5|Cetak Bolak-Balik': 8,
      'A6|Cetak Bolak-Balik': 16,
    },
    cashierNote: 'Untuk buku kecil, pastikan jumlah halaman pas kelipatan.',
  },
  majalah: {
    label: 'Majalah / Magazine',
    segment: 'Media Publikasi & Bacaan',
    sizes: ['A4', 'A5'],
    printModels: ['Cetak Susun Buku / Lipat Buku', 'Cetak Susun Buku / Lipat Buku / Imposisi'],
    printSides: ['Cetak Bolak-Balik'],
    pageMultipleRules: {
      'A4|Cetak Bolak-Balik': 4,
      'A5|Cetak Bolak-Balik': 8,
    },
    cashierNote: 'Jika model majalah staples tengah, pakai susun buku.',
  },
};

const parseObject = (value) => {
  let current = value;
  for (let depth = 0; depth < 3; depth += 1) {
    if (!current) return null;
    if (typeof current === 'object' && !Array.isArray(current)) return current;
    if (typeof current === 'string') {
      try {
        current = JSON.parse(current);
        continue;
      } catch (_error) {
        return null;
      }
    }
    return null;
  }
  return null;
};

const toSourceProduct = (row) => row?.source_product || row?.sourceProduct || null;
const toSourceMeta = (row) => {
  const sourceProduct = toSourceProduct(row);
  const sourceMeta = sourceProduct?.meta;
  if (sourceMeta && typeof sourceMeta === 'object' && !Array.isArray(sourceMeta)) {
    return sourceMeta;
  }
  const rowMeta = row?.meta;
  return rowMeta && typeof rowMeta === 'object' && !Array.isArray(rowMeta) ? rowMeta : {};
};

const isBookSalesProduct = (product, productDetail = null) => {
  const rows = [
    product,
    productDetail,
    toSourceProduct(product),
    toSourceProduct(productDetail),
  ].filter(Boolean);

  return rows.some((row) => {
    const type = normalizeText(row?.product_type);
    const meta = toSourceMeta(row);
    return type === 'book'
      || normalizeText(meta?.configurator) === 'book'
      || normalizeText(meta?.book_category) !== '';
  });
};

const normalizeOptionRows = (rows, fallbackRows = []) => {
  const sourceRows = Array.isArray(rows) && rows.length > 0 ? rows : fallbackRows;
  return sourceRows
    .map((row) => {
      const value = String(row?.value || row?.label || '').trim();
      const label = String(row?.label || row?.value || '').trim() || value;
      const code = String(row?.code || '').trim();
      return value ? {
        value,
        label,
        ...(code ? { code } : {}),
        ...(row?.default_unit ? { default_unit: String(row.default_unit).trim() } : {}),
        ...(row?.default_price !== undefined ? { default_price: Number(row.default_price || 0) || 0 } : {}),
        ...(row?.unit_price !== undefined ? { unit_price: Number(row.unit_price || 0) || 0 } : {}),
        ...(row?.selling_price !== undefined ? { selling_price: Number(row.selling_price || 0) || 0 } : {}),
        ...(row?.product_id ? { product_id: Number(row.product_id || 0) || 0 } : {}),
        ...(row?.sku ? { sku: String(row.sku).trim() } : {}),
        ...(row?.name ? { name: String(row.name).trim() } : {}),
        ...(row?.book_reference ? { book_reference: String(row.book_reference).trim() } : {}),
        ...(row?.book_print_side_code ? { book_print_side_code: String(row.book_print_side_code).trim() } : {}),
        ...(row?.book_print_side ? { book_print_side: String(row.book_print_side).trim() } : {}),
        ...(row?.book_color_mode ? { book_color_mode: String(row.book_color_mode).trim() } : {}),
      } : null;
    })
      .filter(Boolean);
};

const normalizeWizardSteps = (rows, fallbackRows = DEFAULT_WIZARD_STEPS) => {
  const sourceRows = Array.isArray(rows) && rows.length > 0 ? rows : fallbackRows;
  return sourceRows
    .map((row) => {
      const code = String(row?.code || '').trim();
      const title = String(row?.title || '').trim();
      const shortLabel = String(row?.shortLabel || row?.short_label || '').trim();
      const description = String(row?.description || '').trim();
      return code && title ? {
        ...row,
        code,
        title,
        shortLabel: shortLabel || title,
        description,
      } : null;
    })
    .filter(Boolean);
};

const mergeOptionRows = (primaryRows = [], fallbackRows = []) => {
  const merged = [];
  const seen = new Set();
  [primaryRows, fallbackRows].forEach((rows) => {
    normalizeOptionRows(rows).forEach((row) => {
      const key = normalizeText(row?.value || row?.label);
      if (!key || seen.has(key)) {
        return;
      }
      seen.add(key);
      merged.push(row);
    });
  });
  return merged;
};

const getBookPrintRuleConfig = (product, productDetail = null) => {
  const configSources = [
    productDetail?.book_print_rule_config,
    product?.book_print_rule_config,
    toSourceProduct(productDetail)?.book_print_rule_config,
    toSourceProduct(product)?.book_print_rule_config,
  ];
  const config = configSources.find((row) => row && typeof row === 'object' && !Array.isArray(row)) || {};

  return {
      ...config,
      wizard_steps: normalizeWizardSteps(config?.wizard_steps, DEFAULT_WIZARD_STEPS),
      field_options: {
        book_type: mergeOptionRows(config?.field_options?.book_type, DEFAULT_FIELD_OPTIONS.book_type),
        finished_size: normalizeOptionRows(config?.field_options?.finished_size, DEFAULT_FIELD_OPTIONS.finished_size),
        material_inside: normalizeOptionRows(config?.field_options?.material_inside, DEFAULT_FIELD_OPTIONS.material_inside),
      material_cover: normalizeOptionRows(config?.field_options?.material_cover, DEFAULT_FIELD_OPTIONS.material_cover),
      print_model: normalizeOptionRows(config?.field_options?.print_model, DEFAULT_FIELD_OPTIONS.print_model),
      print_side: normalizeOptionRows(config?.field_options?.print_side, DEFAULT_FIELD_OPTIONS.print_side),
      inside_print: normalizeOptionRows(config?.field_options?.inside_print, DEFAULT_FIELD_OPTIONS.inside_print),
      cover_print: normalizeOptionRows(config?.field_options?.cover_print, DEFAULT_FIELD_OPTIONS.cover_print),
      binding_type: normalizeOptionRows(config?.field_options?.binding_type, DEFAULT_FIELD_OPTIONS.binding_type),
      extra_finishings: normalizeOptionRows(config?.field_options?.extra_finishings, DEFAULT_FIELD_OPTIONS.extra_finishings),
    },
    messages: {
      ...DEFAULT_MESSAGES,
      ...(config?.messages && typeof config.messages === 'object' ? config.messages : {}),
    },
    defaults:
      config?.defaults && typeof config.defaults === 'object' && !Array.isArray(config.defaults)
        ? config.defaults
        : {},
    material_bindings:
      config?.material_bindings && typeof config.material_bindings === 'object' && !Array.isArray(config.material_bindings)
        ? config.material_bindings
        : {},
    product_context:
      config?.product_context && typeof config.product_context === 'object' && !Array.isArray(config.product_context)
        ? config.product_context
        : {},
    product_recommendation:
      config?.product_recommendation && typeof config.product_recommendation === 'object'
        ? config.product_recommendation
        : null,
  };
};

const normalizeBookSelection = (value, options = [], fallbackValue = '') => {
  const text = normalizeText(value);
  const rows = Array.isArray(options) ? options : [];
  const exact = rows.find((row) => normalizeText(row?.value) === text || normalizeText(row?.label) === text);
  if (exact?.value) {
    return String(exact.value);
  }

  if (fallbackValue) {
    const fallback = rows.find((row) => normalizeText(row?.value) === normalizeText(fallbackValue) || normalizeText(row?.label) === normalizeText(fallbackValue));
    if (fallback?.value) {
      return String(fallback.value);
    }
  }

  return rows[0]?.value ? String(rows[0].value) : '';
};

const normalizeBookMultiSelection = (values, options = []) => {
  const rows = Array.isArray(options) ? options : [];
  const allowedValues = new Set(rows.map((row) => String(row?.value || '').trim()).filter(Boolean));
  const source = Array.isArray(values) ? values : [];
  return Array.from(
    new Set(
      source
        .map((value) => String(value || '').trim())
        .filter((value) => value && allowedValues.has(value)),
    ),
  );
};

const getBookDirectionRule = (bookType) => {
  const key = normalizeText(bookType).replace(/\s+/g, '_');
  return BOOK_PRODUCT_DIRECTION_RULES[key] || null;
};

const filterRowsByAllowedValues = (rows, allowedValues = []) => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const allowed = new Set(
    (Array.isArray(allowedValues) ? allowedValues : [])
      .map((value) => normalizeText(value))
      .filter(Boolean),
  );

  if (sourceRows.length === 0 || allowed.size === 0) {
    return sourceRows;
  }

  const filtered = sourceRows.filter((row) => {
    const value = normalizeText(row?.value);
    const label = normalizeText(row?.label);
    return allowed.has(value) || allowed.has(label);
  });

  return filtered.length > 0 ? filtered : sourceRows;
};

const filterBookOptionsByRule = (fieldOptions = {}, rule = null) => {
  const source = fieldOptions && typeof fieldOptions === 'object' ? fieldOptions : {};
  if (!rule || typeof rule !== 'object') {
    return source;
  }

  return {
    ...source,
    finished_size: filterRowsByAllowedValues(source.finished_size, rule.sizes),
    print_model: filterRowsByAllowedValues(source.print_model, rule.printModels),
    print_side: filterRowsByAllowedValues(source.print_side, rule.printSides),
  };
};

const getBookWizardProductContext = (config = {}) => {
  const context = config?.product_context && typeof config.product_context === 'object'
    ? config.product_context
    : {};
  const lockedFields = Array.isArray(context?.locked_fields)
    ? context.locked_fields.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const forcedPrintSideCode = normalizePrintSideCode(
    context?.forced_print_side_code || context?.forced_print_side || ''
  );
  const forcedPrintSide = String(context?.forced_print_side || '').trim();
  const forcedPrintModel = String(context?.forced_print_model || '').trim();
  const forcedPrintModelCode = String(context?.forced_print_model_code || '').trim();

  return {
    ...context,
    locked_fields: lockedFields,
    locked_print_side: Boolean(context?.locked_print_side) || lockedFields.includes('print_side'),
    forced_print_side_code: forcedPrintSideCode,
    forced_print_side: forcedPrintSide,
    locked_print_model: Boolean(context?.locked_print_model) || lockedFields.includes('print_model'),
    forced_print_model: forcedPrintModel,
    forced_print_model_code: forcedPrintModelCode,
  };
};

const filterBookMaterialOptionsByFlowContext = (rows = [], flowContext = {}) => {
  const options = Array.isArray(rows) ? rows : [];
  const forcedPrintSideCode = normalizePrintSideCode(flowContext?.forced_print_side_code || flowContext?.forced_print_side || '');
  if (options.length === 0 || !forcedPrintSideCode) {
    return options;
  }

  const explicitMatches = options.filter((row) => {
    const sideCode = normalizePrintSideCode(row?.book_print_side_code || row?.book_print_side || '');
    return sideCode === forcedPrintSideCode;
  });

  return explicitMatches.length > 0 ? explicitMatches : options;
};

const filterBookFieldOptionsByFlowContext = (fieldOptions = {}, flowContext = {}) => {
  const source = fieldOptions && typeof fieldOptions === 'object' ? fieldOptions : {};
  const context = getBookWizardProductContext({ product_context: flowContext });
  const forcedPrintSideCode = normalizePrintSideCode(context?.forced_print_side_code || context?.forced_print_side || '');
  const forcedPrintModel = normalizeText(context?.forced_print_model || '');
  const forcedPrintModelCode = normalizeText(context?.forced_print_model_code || '');

  const printModelOptions = Array.isArray(source.print_model) ? source.print_model : [];
  const printSideOptions = Array.isArray(source.print_side) ? source.print_side : [];
  const filteredPrintModelOptions = forcedPrintModel || forcedPrintModelCode
    ? printModelOptions.filter((row) => {
      const value = normalizeText(row?.value);
      const label = normalizeText(row?.label);
      const code = normalizeText(row?.code);
      return value === forcedPrintModel || label === forcedPrintModel || code === forcedPrintModelCode;
    }).filter(Boolean)
    : printModelOptions;
  const filteredPrintSideOptions = forcedPrintSideCode
    ? printSideOptions.filter((row) => normalizePrintSideCode(row?.code || row?.value || row?.label || '') === forcedPrintSideCode)
    : printSideOptions;

  return {
    ...source,
    print_model: filteredPrintModelOptions.length > 0 ? filteredPrintModelOptions : printModelOptions,
    print_side: filteredPrintSideOptions.length > 0 ? filteredPrintSideOptions : printSideOptions,
  };
};

const resolveBookWizardStepsForFlowContext = (steps = [], flowContext = {}) => {
  const normalizedSteps = normalizeWizardSteps(steps, DEFAULT_WIZARD_STEPS);
  const context = getBookWizardProductContext({ product_context: flowContext });
  if (!context?.locked_print_side) {
    return normalizedSteps;
  }

  return normalizedSteps.filter((row) => String(row?.code || '').trim() !== 'print_side');
};

const resolveBookPageMultiple = ({
  rule = null,
  size = '',
  printModel = '',
  printSide = '',
} = {}) => {
  const rules = rule?.pageMultipleRules && typeof rule.pageMultipleRules === 'object'
    ? rule.pageMultipleRules
    : {};
  const exactKeys = [
    `${String(size || '').trim()}|${String(printModel || '').trim()}|${String(printSide || '').trim()}`,
    `${String(size || '').trim()}|${String(printSide || '').trim()}`,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  if (exactKeys.length === 0) {
    return 0;
  }

  const match = Object.entries(rules).find(([key]) => exactKeys.includes(normalizeText(key)));
  const multiple = Number(match?.[1] || 0);
  return Number.isFinite(multiple) && multiple > 0 ? Math.floor(multiple) : 0;
};

const computeBookPageValidation = ({
  inputPages = 0,
  multiple = 0,
  needsManualLayoutCheck = false,
} = {}) => {
  const safeInput = Math.max(Math.floor(Number(inputPages) || 0), 0);
  const safeMultiple = Math.max(Math.floor(Number(multiple) || 0), 0);

  if (needsManualLayoutCheck || safeInput < 1 || safeMultiple < 1) {
    return {
      inputPages: safeInput,
      requiredMultiple: safeMultiple || null,
      blankPages: 0,
      totalPrintPages: safeInput,
      isExact: safeInput > 0 && safeMultiple > 0 ? safeInput % safeMultiple === 0 : false,
      isManualCheck: true,
    };
  }

  const remainder = safeInput % safeMultiple;
  const totalPrintPages = remainder === 0
    ? safeInput
    : Math.ceil(safeInput / safeMultiple) * safeMultiple;
  const blankPages = Math.max(totalPrintPages - safeInput, 0);

  return {
    inputPages: safeInput,
    requiredMultiple: safeMultiple,
    blankPages,
    totalPrintPages,
    isExact: blankPages === 0,
    isManualCheck: false,
  };
};

const resolveBookAutoSelection = ({
  currentValue = '',
  options = [],
  fallbackValue = '',
} = {}) => {
  const rows = Array.isArray(options) ? options : [];
  if (rows.length === 0) {
    return String(currentValue || '').trim();
  }
  if (rows.length === 1) {
    return String(rows[0]?.value || rows[0]?.label || '').trim();
  }
  return normalizeBookSelection(currentValue, rows, fallbackValue);
};

const buildBookDirectionSummary = ({ validation = null } = {}) => {
  if (!validation || typeof validation !== 'object') {
    return '';
  }

  if (validation.isManualCheck) {
    return validation.inputPages > 0 ? 'Cek layout manual' : '';
  }

  const parts = [];
  const requiredMultiple = Number(validation.requiredMultiple || 0);
  const inputPages = Number(validation.inputPages || 0);
  const blankPages = Number(validation.blankPages || 0);
  const totalPrintPages = Number(validation.totalPrintPages || 0);

  if (requiredMultiple > 0) {
    parts.push(`Kelipatan ${requiredMultiple}`);
  }
  if (inputPages > 0 && totalPrintPages > 0) {
    parts.push(blankPages > 0 ? `${inputPages} -> ${totalPrintPages} hlm` : `${totalPrintPages} hlm`);
  }

  return parts.join(' | ');
};

const resolveLegacyPrintMode = (printSide) => {
  const text = normalizeText(printSide);
  if (['cetak 1 sisi', '1 sisi', 'simplex'].includes(text)) {
    return 'simplex';
  }
  if (['cetak 2 sisi', 'cetak bolak-balik', 'bolak-balik', 'duplex'].includes(text)) {
    return 'duplex';
  }
  return '';
};

const buildBookAddonPayload = (selectedValues = [], optionRows = []) => {
  const options = Array.isArray(optionRows) ? optionRows : [];
  const selected = normalizeBookMultiSelection(selectedValues, options);
  if (selected.length === 0) {
    return [];
  }

  return selected.map((value) => {
    const option = options.find((row) => String(row?.value || '').trim() === value) || null;
    return {
      enabled: true,
      option_code: String(option?.value || value).trim(),
      code: String(option?.value || value).trim(),
      value: String(option?.value || value).trim(),
      label: String(option?.label || value).trim(),
      qty: 1,
      unit: String(option?.default_unit || 'order').trim() || 'order',
    };
  });
};

const buildBookPrintRulePayload = ({
  bookType,
  finishedSize,
  materialInside,
  materialCover,
  materialInsideProductId,
  materialCoverProductId,
  printModel,
  printSide,
  customerPageCount,
  insidePrint,
  coverPrint,
  bindingType,
  materialSourceMode,
  selectedExtraFinishings,
  extraFinishingOptions,
  productName,
  productType,
} = {}) => {
  const payload = {};
  if (String(bookType || '').trim()) payload.book_type = String(bookType).trim();
  if (String(finishedSize || '').trim()) payload.finished_size = String(finishedSize).trim();
  if (String(materialInside || '').trim()) payload.material_inside = String(materialInside).trim();
  if (String(materialCover || '').trim()) payload.material_cover = String(materialCover).trim();
  const parsedInsideMaterialId = Number(materialInsideProductId || 0);
  const parsedCoverMaterialId = Number(materialCoverProductId || 0);
  if (Number.isFinite(parsedInsideMaterialId) && parsedInsideMaterialId > 0) {
    payload.material_inside_product_id = Math.floor(parsedInsideMaterialId);
    payload.material_product_id = Math.floor(parsedInsideMaterialId);
  }
  if (Number.isFinite(parsedCoverMaterialId) && parsedCoverMaterialId > 0) {
    payload.material_cover_product_id = Math.floor(parsedCoverMaterialId);
  }
  const materialIds = []
    .concat(Number.isFinite(parsedInsideMaterialId) && parsedInsideMaterialId > 0 ? [Math.floor(parsedInsideMaterialId)] : [])
    .concat(Number.isFinite(parsedCoverMaterialId) && parsedCoverMaterialId > 0 ? [Math.floor(parsedCoverMaterialId)] : []);
  if (materialIds.length > 0) {
    payload.material_product_ids = Array.from(new Set(materialIds));
  }
  if (String(printModel || '').trim()) payload.print_model = String(printModel).trim();
  if (String(printSide || '').trim()) payload.print_side = String(printSide).trim();
  const parsedPages = Number(customerPageCount || 0);
  if (Number.isFinite(parsedPages) && parsedPages > 0) {
    payload.customer_page_count = Math.max(1, Math.floor(parsedPages));
    payload.page_count = payload.customer_page_count;
  }
  if (String(insidePrint || '').trim()) payload.inside_print = String(insidePrint).trim();
  if (String(coverPrint || '').trim()) payload.cover_print = String(coverPrint).trim();
  if (String(bindingType || '').trim()) payload.binding_type = String(bindingType).trim();
  if (String(materialSourceMode || '').trim()) payload.material_source_mode = String(materialSourceMode).trim();
  const addons = buildBookAddonPayload(selectedExtraFinishings, extraFinishingOptions);
  if (addons.length > 0) {
    payload.addons = addons;
  }
  if (String(productName || '').trim()) payload.product_name = String(productName).trim();
  if (String(productType || '').trim()) payload.product_type = String(productType).trim();
  const printMode = resolveLegacyPrintMode(printSide);
  if (printMode) {
    payload.print_mode = printMode;
  }
  return payload;
};

const resolveBookPrintRuleFromSource = (source = {}) => {
  const direct = parseObject(source?.book_print_rule);
  if (direct) {
    return direct;
  }

  const snapshot = parseObject(source?.spec_snapshot) || {};
  const fromSnapshot = parseObject(snapshot?.book_print_rule);
  if (fromSnapshot) {
    return fromSnapshot;
  }

  return null;
};

const buildBookQuickSummary = (rule = null) => {
  if (!rule || typeof rule !== 'object') {
    return '';
  }

  const parts = [];
  const requiredMultiple = Number(rule?.required_page_multiple || 0);
  const productionPageCount = Number(rule?.production_page_count || 0);
  const blankPageCount = Number(rule?.blank_page_count || 0);
  const estimatedSheets = Number(rule?.estimated_a3_plus_sheets || 0);

  if (requiredMultiple > 0) {
    parts.push(`Kelipatan ${requiredMultiple}`);
  }
  if (productionPageCount > 0) {
    parts.push(`Produksi ${productionPageCount} hlm`);
  }
  if (blankPageCount > 0) {
    parts.push(`Kosong ${blankPageCount} hlm`);
  }
  if (estimatedSheets > 0) {
    parts.push(`A3+ ${estimatedSheets} lbr`);
  }

  if (parts.length === 0 && rule?.needs_manual_layout_check) {
    return 'Perlu cek layout manual';
  }

  return parts.join(' | ');
};

module.exports = {
  BOOK_PRODUCT_DIRECTION_RULES,
  DEFAULT_BOOK_PRINT_RULE_FIELD_OPTIONS: DEFAULT_FIELD_OPTIONS,
  DEFAULT_BOOK_PRINT_RULE_MESSAGES: DEFAULT_MESSAGES,
  DEFAULT_BOOK_PRINT_RULE_WIZARD_STEPS: DEFAULT_WIZARD_STEPS,
  buildBookAddonPayload,
  buildBookDirectionSummary,
  buildBookPrintRulePayload,
  buildBookQuickSummary,
  computeBookPageValidation,
  filterBookFieldOptionsByFlowContext,
  filterBookMaterialOptionsByFlowContext,
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
  resolveLegacyPrintMode,
};
