const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canUserAccessInvoiceRow,
  canUserViewInvoiceRow,
  filterInvoiceRowsForUser,
  isApprovalInvoiceRow,
  isDraftCandidate,
  isReceivableInvoiceRow,
  isSuccessfulInvoiceRow,
} = require('../invoiceVisibility');

const cashierA = {
  id: 11,
  name: 'Kasir A',
  role_name: 'kasir',
};

const cashierB = {
  id: 22,
  name: 'Kasir B',
  role_name: 'kasir',
};

const adminUser = {
  id: 99,
  name: 'Admin',
  role_name: 'admin',
};

test('kasir A bisa melihat invoice piutang yang dibuat oleh kasir B', () => {
  const row = {
    id: 1001,
    status: 'processing',
    cashier: { id: cashierB.id, name: cashierB.name },
    invoice: {
      id: 501,
      invoice_no: 'INV-PIUTANG-001',
      status: 'piutang',
      total: 150000,
      paid_total: 50000,
      due_total: 100000,
    },
  };

  assert.equal(canUserAccessInvoiceRow(row, cashierA), true);
});

test('kasir A bisa melihat invoice paid atau lunas yang dibuat oleh kasir B', () => {
  const row = {
    id: 1002,
    status: 'completed',
    cashier: { id: cashierB.id, name: cashierB.name },
    invoice: {
      id: 502,
      invoice_no: 'INV-LUNAS-001',
      status: 'lunas',
      total: 200000,
      paid_total: 200000,
      due_total: 0,
    },
  };

  assert.equal(canUserAccessInvoiceRow(row, cashierA), true);
});

test('kasir A bisa membuka dan memproses draft yang dibuat oleh kasir B', () => {
  const row = {
    id: 1003,
    status: 'draft',
    cashier: { id: cashierB.id, name: cashierB.name },
    invoice: {
      id: 503,
      invoice_no: 'INV-DRAFT-001',
      status: 'draft',
      total: 80000,
      paid_total: 0,
      due_total: 0,
    },
  };

  assert.equal(canUserAccessInvoiceRow(row, cashierA), true);
  assert.equal(canUserViewInvoiceRow(row, cashierA), true);
});

test('kasir tetap bisa melihat draft miliknya sendiri lewat field creator invoice', () => {
  const row = {
    id: 1006,
    status: 'draft',
    invoice: {
      id: 506,
      invoice_no: 'INV-DRAFT-OWN',
      status: 'draft',
      created_by_user_id: cashierA.id,
    },
  };

  assert.equal(canUserAccessInvoiceRow(row, cashierA), true);
});

test('semua bentuk draft lama dan baru tetap dikenali sebagai draft', () => {
  const rows = [
    {
      id: 1011,
      order_status: 'draft',
    },
    {
      id: 1012,
      invoice: {
        id: 512,
        status: 'draft',
      },
    },
    {
      id: 1013,
      status: 'pending',
      notes: 'Mode: Simpan Draft',
    },
    {
      id: 1014,
      status: 'pending',
      notes: '{"_type":"sales_draft","note_text":"draft lama"}',
    },
    {
      id: 1016,
      status: 'pending',
      invoice: {
        id: 516,
        status: 'pending',
      },
      items: [
        {
          spec_snapshot: JSON.stringify({
            draft_form: {
              product_name: 'Draft snapshot lama',
            },
          }),
        },
      ],
    },
    {
      id: 1018,
      status: 'pending',
      is_draft: true,
      invoice: {
        id: 518,
        status: 'pending',
      },
    },
    {
      id: 1019,
      status: 'pending',
      order: {
        id: 519,
        is_draft_order: 1,
      },
    },
    {
      id: 1023,
      status: 'open',
      __workspace_area: 'draft',
      invoice: {
        id: 523,
        status: 'unpaid',
      },
    },
  ];

  rows.forEach((row) => {
    assert.equal(isDraftCandidate(row), true);
    assert.equal(canUserAccessInvoiceRow(row, cashierA), true);
  });
});

test('snapshot non-draft tidak otomatis membuat invoice sukses menjadi draft', () => {
  const row = {
    id: 1015,
    status: 'completed',
    invoice: {
      id: 515,
      status: 'paid',
      total: 120000,
      paid_total: 120000,
      due_total: 0,
    },
    items: [
      {
        spec_snapshot: JSON.stringify({
          cart_restore: {
            pricing_locked: true,
          },
        }),
      },
    ],
  };

  assert.equal(isDraftCandidate(row), false);
  assert.equal(isSuccessfulInvoiceRow(row), true);
});

test('snapshot draft lama tidak menarik invoice final ke area draft', () => {
  const row = {
    id: 1017,
    status: 'completed',
    invoice: {
      id: 517,
      status: 'paid',
      total: 120000,
      paid_total: 120000,
      due_total: 0,
    },
    items: [
      {
        spec_snapshot: JSON.stringify({
          draft_form: {
            product_name: 'Bekas draft yang sudah final',
          },
        }),
      },
    ],
  };

  assert.equal(isDraftCandidate(row), false);
  assert.equal(isSuccessfulInvoiceRow(row), true);
});

test('row invoice hanya tampil bila ada user yang aktif', () => {
  const row = {
    id: 1010,
    status: 'processing',
    invoice: {
      id: 510,
      invoice_no: 'INV-AUTH-001',
      status: 'unpaid',
    },
  };

  assert.equal(canUserAccessInvoiceRow(row, null), false);
  assert.equal(canUserViewInvoiceRow(row, null), false);
});

test('role selain kasir tetap mengikuti aturan akses yang sudah ada', () => {
  const rows = [
    {
      id: 1004,
      status: 'draft',
      cashier: { id: cashierB.id, name: cashierB.name },
      invoice: {
        id: 504,
        invoice_no: 'INV-DRAFT-ADMIN',
        status: 'draft',
      },
    },
    {
      id: 1005,
      status: 'processing',
      cashier: { id: cashierB.id, name: cashierB.name },
      invoice: {
        id: 505,
        invoice_no: 'INV-PIUTANG-ADMIN',
        status: 'piutang',
        total: 90000,
        paid_total: 0,
        due_total: 90000,
      },
    },
  ];

  assert.deepEqual(filterInvoiceRowsForUser(rows, adminUser), rows);
});

test('row approval manual dikenali sebagai area butuh approval dan bukan invoice sukses/piutang', () => {
  const row = {
    id: 'approval-7001',
    __source: 'receivable_approval',
    status: 'pending_approval',
    approval: {
      id: 7001,
      type: 'management_burden',
      status: 'pending',
      requester: { id: cashierA.id, name: cashierA.name },
    },
    customer: {
      id: 301,
      name: 'PT Approval',
    },
    invoice: {
      id: 801,
      invoice_no: 'INV-APR-001',
      total: 125000,
      paid_total: 0,
      due_total: 0,
    },
  };

  assert.equal(isApprovalInvoiceRow(row), true);
  assert.equal(isSuccessfulInvoiceRow(row), false);
  assert.equal(isReceivableInvoiceRow(row), false);
});

test('row menunggu dan ditolak approval tidak ikut dianggap draft', () => {
  const rows = [
    {
      id: 1020,
      status: 'pending_approval',
      notes: 'Mode: Simpan Draft\nStatus: Menunggu Approval',
      items: [
        {
          spec_snapshot: JSON.stringify({
            draft_form: {
              product_name: 'Approval pending',
            },
          }),
        },
      ],
    },
    {
      id: 1021,
      status: 'approval_rejected',
      notes: 'Mode: Simpan Draft\nApproval Ditolak',
      items: [
        {
          spec_snapshot: JSON.stringify({
            draft_form: {
              product_name: 'Approval ditolak',
            },
          }),
        },
      ],
    },
  ];

  rows.forEach((row) => {
    assert.equal(isDraftCandidate(row), false);
    assert.equal(isApprovalInvoiceRow(row), true);
    assert.equal(isSuccessfulInvoiceRow(row), false);
    assert.equal(isReceivableInvoiceRow(row), false);
  });
});

test('draft tetap tampil walau payload punya metadata approval pending', () => {
  const row = {
    id: 1022,
    status: 'draft',
    notes: 'Mode: Simpan Draft',
    approval: {
      status: 'pending',
      requester: { id: cashierA.id, name: cashierA.name },
    },
    invoice: {
      id: 522,
      status: 'draft',
    },
  };

  assert.equal(isApprovalInvoiceRow(row), false);
  assert.equal(isDraftCandidate(row), true);
});

test('invoice belum lunas tetap masuk invoice sukses dan piutang', () => {
  const row = {
    id: 1007,
    status: 'processing',
    cashier: { id: cashierA.id, name: cashierA.name },
    invoice: {
      id: 507,
      invoice_no: 'INV-SUKSES-PIUTANG',
      status: 'unpaid',
      total: 300000,
      paid_total: 100000,
      due_total: 200000,
    },
  };

  assert.equal(isSuccessfulInvoiceRow(row), true);
  assert.equal(isReceivableInvoiceRow(row), true);
});

test('invoice final tetap masuk sukses walau status order lama masih draft', () => {
  const row = {
    id: 1009,
    status: 'draft',
    notes: 'Mode: Proses Orderan',
    cashier: { id: cashierA.id, name: cashierA.name },
    invoice: {
      id: 509,
      invoice_no: 'INV-LEGACY-DRAFT-ORDER',
      status: 'paid',
      total: 250000,
      paid_total: 250000,
      due_total: 0,
    },
  };

  assert.equal(isDraftCandidate(row), false);
  assert.equal(isSuccessfulInvoiceRow(row), true);
  assert.equal(isReceivableInvoiceRow(row), false);
});

test('invoice success dari payload transaksi flat tetap tampil di nota penjualan tercatat', () => {
  const row = {
    invoice_id: 601,
    invoice_no: 'INV-FLAT-SUKSES',
    invoice_status: 'paid',
    invoice_total: 150000,
    invoice_paid_total: 150000,
    invoice_due_total: 0,
    customer_name: 'Pelanggan Flat',
    payment_status: 'paid',
  };

  assert.equal(isSuccessfulInvoiceRow(row), true);
  assert.equal(isReceivableInvoiceRow(row), false);
});

test('invoice piutang dari payload transaksi flat tetap masuk sukses dan piutang', () => {
  const row = {
    invoice_id: 602,
    invoice_no: 'INV-FLAT-PIUTANG',
    invoice_status: 'unpaid',
    invoice_total: 300000,
    invoice_paid_total: 50000,
    invoice_due_total: 250000,
    customer_name: 'Pelanggan Piutang Flat',
  };

  assert.equal(isSuccessfulInvoiceRow(row), true);
  assert.equal(isReceivableInvoiceRow(row), true);
});

test('invoice beban management tidak dianggap piutang walau belum lunas', () => {
  const row = {
    id: 1010,
    status: 'processing',
    customer: { name: 'BEBAN MANAGEMENT' },
    invoice: {
      id: 610,
      invoice_no: 'INV-BM-001',
      status: 'unpaid',
      total: 300000,
      paid_total: 0,
      due_total: 300000,
    },
  };

  assert.equal(isSuccessfulInvoiceRow(row), true);
  assert.equal(isReceivableInvoiceRow(row), false);
});

test('invoice kesalahan produksi tetap dianggap piutang karena akan dibayar karyawan', () => {
  const row = {
    id: 1011,
    status: 'processing',
    customer: { name: 'KESALAHAN PRODUKSI' },
    invoice: {
      id: 611,
      invoice_no: 'INV-KP-001',
      status: 'unpaid',
      total: 200000,
      paid_total: 0,
      due_total: 200000,
    },
  };

  assert.equal(isSuccessfulInvoiceRow(row), true);
  assert.equal(isReceivableInvoiceRow(row), true);
});

test('invoice dibatalkan tidak masuk invoice sukses', () => {
  const row = {
    id: 1008,
    status: 'cancelled',
    cashier: { id: cashierA.id, name: cashierA.name },
    invoice: {
      id: 508,
      invoice_no: 'INV-BATAL-001',
      status: 'cancelled',
      total: 175000,
      paid_total: 0,
      due_total: 0,
    },
  };

  assert.equal(isSuccessfulInvoiceRow(row), false);
});
