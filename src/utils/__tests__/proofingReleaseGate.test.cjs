const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveProofingReleaseState } = require('../proofingReleaseGate');

test('proofing release ikut aktif saat invoice sudah lunas walau status invoice belum sinkron', () => {
  const row = {
    id: 91,
    status: 'approved',
    can_release_to_production: false,
    order: {
      id: 501,
      invoice: {
        status: 'unpaid',
        total: 125000,
        paid_total: 125000,
        due_total: 0,
      },
    },
  };

  const releaseState = resolveProofingReleaseState(row);

  assert.equal(releaseState.canRelease, true);
  assert.equal(releaseState.paymentReady, true);
  assert.equal(releaseState.paymentStatusLabel, 'Lunas');
});

test('proofing release tetap terkunci bila payment masih kurang', () => {
  const row = {
    id: 92,
    status: 'approved',
    can_release_to_production: false,
    order: {
      id: 502,
      invoice: {
        status: 'partially_paid',
        total: 200000,
        paid_total: 50000,
        due_total: 150000,
      },
    },
  };

  const releaseState = resolveProofingReleaseState(row);

  assert.equal(releaseState.canRelease, false);
  assert.equal(releaseState.paymentReady, false);
  assert.equal(releaseState.paymentStatusLabel, 'DP');
});

test('proofing release tetap terkunci bila belum approved walau invoice sudah lunas', () => {
  const row = {
    id: 93,
    status: 'sent',
    can_release_to_production: false,
    order: {
      id: 503,
      invoice: {
        status: 'lunas',
        total: 95000,
        paid_total: 95000,
        due_total: 0,
      },
    },
  };

  const releaseState = resolveProofingReleaseState(row);

  assert.equal(releaseState.canRelease, false);
  assert.equal(releaseState.paymentReady, true);
  assert.match(releaseState.blockingHint, /proofing approved/i);
});

test('proofing release ditandai sudah masuk produksi saat status produksi sudah berjalan', () => {
  const row = {
    id: 94,
    status: 'approved',
    can_release_to_production: false,
    item: {
      production_status: 'waiting_production',
    },
    order: {
      id: 504,
      invoice: {
        status: 'lunas',
        total: 180000,
        paid_total: 180000,
        due_total: 0,
      },
    },
  };

  const releaseState = resolveProofingReleaseState(row);

  assert.equal(releaseState.releasedToProduction, true);
  assert.equal(releaseState.canRelease, false);
  assert.match(releaseState.releasedLabel, /masuk produksi/i);
  assert.match(releaseState.releasedLabel, /menunggu produksi/i);
});
