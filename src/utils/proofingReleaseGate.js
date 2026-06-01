const { isPaidInvoiceRow, resolveInvoiceStatusKey } = require('./invoiceVisibility');

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const readFirstMoney = (...candidates) => {
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return roundMoney(parsed);
    }
  }
  return 0;
};

const readFirstText = (...candidates) => {
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }
  return '';
};

const humanizeStatus = (value) => {
  const text = String(value || '').trim().replace(/[_-]+/g, ' ');
  if (!text) return '-';
  return text
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const resolveProofingStatusKey = (value) => {
  const key = normalizeText(value);
  if (!key) return '';
  if (['approved', 'disetujui'].includes(key)) return 'approved';
  if (['sent', 'terkirim'].includes(key)) return 'sent';
  if (['revision', 'revisi'].includes(key)) return 'revision';
  if (['cancelled', 'dibatalkan'].includes(key)) return 'cancelled';
  if (['draft'].includes(key)) return 'draft';
  return key;
};

const resolveProductionStatusKey = (value) => {
  const key = normalizeText(value);
  if (!key) return '';
  if (['waiting_design', 'design', 'menunggu_design', 'menunggu design'].includes(key)) return 'waiting_design';
  if (['waiting_production', 'pending_production', 'menunggu_produksi', 'menunggu produksi', 'production'].includes(key)) return 'waiting_production';
  if (['in_batch', 'batch', 'proses', 'proses_produksi', 'proses produksi'].includes(key)) return 'in_batch';
  if (['printed', 'finalize', 'finalized', 'finished', 'done', 'completed', 'ready_pickup', 'ready_for_pickup', 'siap_ambil', 'siap ambil', 'selesai'].includes(key)) {
    return 'printed';
  }
  return key;
};

const formatProductionStatusLabel = (value) => {
  const key = resolveProductionStatusKey(value);
  if (key === 'waiting_design') return 'Menunggu Design';
  if (key === 'waiting_production') return 'Menunggu Produksi';
  if (key === 'in_batch') return 'In Batch';
  if (key === 'printed') return 'Printed / Selesai';
  return key ? humanizeStatus(key) : '-';
};

const getOrderRow = (row = {}) => (
  row?.order && typeof row.order === 'object'
    ? row.order
    : row
);

const getInvoiceAmounts = (row = {}) => {
  const orderRow = getOrderRow(row);
  const total = readFirstMoney(
    orderRow?.invoice?.total,
    orderRow?.total,
    orderRow?.grand_total,
    row?.invoice?.total,
    row?.total,
    row?.grand_total,
  );
  const paid = readFirstMoney(
    orderRow?.invoice?.paid_total,
    orderRow?.paid_total,
    orderRow?.payment?.paid_total,
    orderRow?.payment?.amount,
    row?.invoice?.paid_total,
    row?.paid_total,
    row?.payment?.paid_total,
    row?.payment?.amount,
  );
  const explicitDue = readFirstMoney(
    orderRow?.invoice?.due_total,
    orderRow?.due_total,
    row?.invoice?.due_total,
    row?.due_total,
  );
  const due = explicitDue > 0
    ? explicitDue
    : roundMoney(Math.max(total - paid, 0));

  return { total, paid, due };
};

const resolvePaymentStatusSource = (row = {}) => {
  const orderRow = getOrderRow(row);
  return readFirstText(
    orderRow?.invoice?.status,
    orderRow?.invoice?.payment_status,
    orderRow?.payment_status,
    orderRow?.payment?.status,
    orderRow?.payment?.payment_status,
    row?.invoice?.status,
    row?.invoice?.payment_status,
    row?.payment_status,
    row?.payment?.status,
    row?.payment?.payment_status,
    orderRow?.status,
  );
};

const isPaymentGateReady = (row = {}) => {
  if (
    row?.can_release_to_production === true
    || row?.payment_gate?.ready === true
    || row?.payment_gate?.is_ready === true
    || row?.payment_gate?.can_release === true
    || row?.payment_gate?.ready_to_release === true
    || row?.payment_gate?.passed === true
    || row?.payment_gate?.is_paid === true
  ) {
    return true;
  }

  const gateStatus = normalizeText(
    row?.payment_gate?.status
    || row?.payment_gate?.key
    || row?.payment_gate?.code
    || '',
  );

  return ['ready', 'approved', 'paid', 'pass', 'passed', 'fulfilled', 'released'].includes(gateStatus);
};

const resolveReleasedProductionStatus = (row = {}) => {
  const rawStatus = readFirstText(
    row?.item?.production_status,
    row?.order_item?.production_status,
    row?.production_status,
    row?.item?.order_item?.production_status,
  );
  return resolveProductionStatusKey(rawStatus);
};

const isReleasedToProduction = (row = {}) => {
  if (
    row?.released_to_production === true
    || row?.is_released_to_production === true
    || row?.released_to_production_at
    || row?.production_released_at
    || row?.released_at
  ) {
    return true;
  }

  return ['waiting_production', 'in_batch', 'printed'].includes(resolveReleasedProductionStatus(row));
};

const resolveProofingPaymentState = (row = {}) => {
  const orderRow = getOrderRow(row);
  const { total, paid, due } = getInvoiceAmounts(row);
  const statusSource = resolvePaymentStatusSource(row);
  const statusKey = resolveInvoiceStatusKey(statusSource);
  const paymentReady = Boolean(
    isPaymentGateReady(row)
    || isPaidInvoiceRow(orderRow)
    || statusKey === 'paid'
    || (total > 0 && (due <= 0 || paid >= total))
  );

  return {
    total,
    paid,
    due,
    statusKey,
    statusSource,
    paymentReady,
  };
};

const formatProofingPaymentStatusLabel = (paymentState) => {
  if (paymentState?.paymentReady) {
    return 'Lunas';
  }
  if (paymentState?.statusKey === 'receivable') {
    return 'Piutang';
  }
  if (paymentState?.statusKey === 'partially_paid' || (paymentState?.paid > 0 && paymentState?.due > 0)) {
    return 'DP';
  }
  if (paymentState?.statusKey === 'pending_payment' || paymentState?.due > 0 || paymentState?.total > 0) {
    return 'Belum Lunas';
  }
  return paymentState?.statusSource
    ? humanizeStatus(paymentState.statusSource)
    : '-';
};

const resolveProofingReleaseState = (row = {}) => {
  const paymentState = resolveProofingPaymentState(row);
  const proofingApproved = resolveProofingStatusKey(row?.status) === 'approved';
  const releasedProductionStatus = resolveReleasedProductionStatus(row);
  const releasedToProduction = isReleasedToProduction(row);
  const paymentReceivable = paymentState.statusKey === 'receivable'
    || normalizeText(paymentState.statusSource).includes('piutang')
    || (
      getOrderRow(row)?.receivable_override_required === true
      || getOrderRow(row)?.receivable_override_approved_at
    );
  const precheckReady = row?.can_release_to_production === true || (proofingApproved && paymentState.paymentReady);
  const canRelease = !releasedToProduction;
  let blockingHint = '';
  let releasedLabel = '';

  if (releasedToProduction) {
    releasedLabel = `Sudah masuk produksi${releasedProductionStatus ? `: ${formatProductionStatusLabel(releasedProductionStatus)}` : ''}`;
  } else if (!precheckReady) {
    blockingHint = 'Gerbang backend akan memeriksa proofing, file final, invoice, pembayaran, spesifikasi, dan approval saat tombol ditekan.';
  }

  return {
    canRelease,
    precheckReady,
    proofingApproved,
    paymentReady: paymentState.paymentReady,
    paymentReceivable,
    paymentStatusKey: paymentState.statusKey,
    paymentTotal: paymentState.total,
    paymentPaid: paymentState.paid,
    paymentDue: paymentState.due,
    paymentStatusLabel: formatProofingPaymentStatusLabel(paymentState),
    releasedToProduction,
    releasedProductionStatus,
    releasedLabel,
    blockingHint,
  };
};

const formatProductionGateError = (errorOrPayload = {}) => {
  const payload = errorOrPayload?.body && typeof errorOrPayload.body === 'object'
    ? errorOrPayload.body
    : errorOrPayload;
  const blockers = Array.isArray(payload?.blockers)
    ? payload.blockers
    : (Array.isArray(payload?.production_gate?.blockers) ? payload.production_gate.blockers : []);

  if (blockers.length > 0) {
    return blockers
      .map((blocker) => `${String(blocker?.code || 'BLK').trim()}: ${String(blocker?.message || '').trim()}`.trim())
      .join('\n');
  }

  const validationMessages = Array.isArray(payload?.errors?.production_gate)
    ? payload.errors.production_gate
    : [];
  return validationMessages.map((message) => String(message || '').trim()).filter(Boolean).join('\n');
};

module.exports = {
  formatProductionGateError,
  formatProductionStatusLabel,
  resolveProductionStatusKey,
  resolveProofingPaymentState,
  resolveProofingReleaseState,
  resolveProofingStatusKey,
};

module.exports.default = module.exports;
