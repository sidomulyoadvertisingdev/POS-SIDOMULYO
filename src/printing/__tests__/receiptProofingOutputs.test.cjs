const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const compilePrintingModules = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-proofing-print-'));
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const tscPath = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  const sourceFiles = [
    'src/printing/receiptHelpers.ts',
    'src/printing/renderReceiptText.ts',
    'src/printing/profiles.ts',
    'src/printing/types.ts',
    'src/printing/downloadReceiptPdf.ts',
    'src/printing/browserPrintDom.ts',
    'src/printing/adapters/BrowserPrintAdapter.ts',
  ];

  execFileSync(process.execPath, [
    tscPath,
    '--outDir', tempDir,
    '--module', 'commonjs',
    '--target', 'es2020',
    ...sourceFiles,
  ], {
    cwd: repoRoot,
    stdio: 'pipe',
  });

  return {
    tempDir,
    renderReceiptText: require(path.join(tempDir, 'renderReceiptText.js')).renderReceiptText,
    createPrinterProfile: require(path.join(tempDir, 'profiles.js')).createPrinterProfile,
    renderReceiptHtml: require(path.join(tempDir, 'adapters', 'BrowserPrintAdapter.js')).renderReceiptHtml,
    buildReceiptPdfLines: require(path.join(tempDir, 'downloadReceiptPdf.js')).buildReceiptPdfLines,
  };
};

let compiledCache = null;

const getCompiledModules = () => {
  if (compiledCache) {
    return compiledCache;
  }
  compiledCache = compilePrintingModules();
  return compiledCache;
};

const sampleReceipt = () => ({
  store: {
    name: 'SIDOMULYO',
    title: 'Nota Penjualan',
    tagline: 'Advertising & Printing',
  },
  transaction: {
    invoiceNo: 'INV-PRF-001',
    orderId: '38',
    date: '2026-05-25 18:15:00',
    cashier: 'Kasir Proofing',
    customer: 'Customer Proofing',
    customerPhone: '6281234567890',
    printedAt: '2026-05-25 18:16:00',
  },
  items: [
    {
      name: 'Banner Depan Toko',
      qty: 1,
      price: 150000,
      total: 150000,
      size: '200 x 80 cm',
      material: 'Flexi',
      finishing: 'Mata ayam',
      notes: 'Pasang besok',
    },
  ],
  summary: {
    subtotal: 150000,
    discount: 0,
    grandTotal: 150000,
    paid: 150000,
  },
  payment: {
    method: 'Transfer',
    amount: 150000,
  },
  detail: {
    proofingNotes: [
      'PRF-000038-000030 | Approved | Banner Depan Toko | 25/05/26 17:37 | Des. Rina',
      'PRF-000039-000031 | Revisi | Sticker Kaca Depan | 25/05/26 18:10 | Des. Dwi',
    ],
    footerNotes: [
      'Servis dihitung setelah proofing disetujui',
    ],
    thankYouText: 'TERIMA KASIH',
  },
});

test('proofing output is rendered in text, browser html, and pdf builders', () => {
  const {
    renderReceiptText,
    createPrinterProfile,
    renderReceiptHtml,
    buildReceiptPdfLines,
  } = getCompiledModules();

  const receipt = sampleReceipt();
  const profile58 = createPrinterProfile({
    id: 'proofing-58',
    name: 'Thermal 58',
    type: 'thermal_escpos',
    connection: 'qz_tray',
    paperWidth: '58mm',
    charsPerLine: 32,
  });
  const profile80 = createPrinterProfile({
    id: 'proofing-80',
    name: 'Thermal 80',
    type: 'thermal_escpos',
    connection: 'qz_tray',
    paperWidth: '80mm',
    charsPerLine: 48,
  });

  const textOutput = renderReceiptText(receipt, profile58);
  assert.match(textOutput, /Proofing :/);
  assert.match(textOutput, /PRF-000038-000030/);

  const htmlOutput = renderReceiptHtml(textOutput, profile80, 'Nota Penjualan', { receiptData: receipt });
  assert.match(htmlOutput, /receipt-detail-title">Proofing :/);
  assert.match(htmlOutput, /PRF-000039-000031/);

  const pdfLines = buildReceiptPdfLines(receipt, profile80);
  assert.ok(Array.isArray(pdfLines));
  assert.ok(pdfLines.some((line) => String(line?.text || '').includes('Proofing :')));
  assert.ok(pdfLines.some((line) => String(line?.text || '').includes('PRF-000038-000030')));
});

test.after(() => {
  if (compiledCache?.tempDir && fs.existsSync(compiledCache.tempDir)) {
    fs.rmSync(compiledCache.tempDir, { recursive: true, force: true });
  }
});
