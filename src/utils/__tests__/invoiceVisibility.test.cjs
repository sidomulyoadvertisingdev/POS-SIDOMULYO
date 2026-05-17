const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canUserAccessInvoiceRow,
  canUserViewInvoiceRow,
  filterInvoiceRowsForUser,
  isApprovalInvoiceRow,
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

test('kasir A tidak bisa mengakses aksi draft yang dibuat oleh kasir B', () => {
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

  assert.equal(canUserAccessInvoiceRow(row, cashierA), false);
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
