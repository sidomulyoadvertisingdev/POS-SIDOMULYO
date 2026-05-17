const normalizeText = (value) => String(value || '').trim().toLowerCase();

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const toPositiveId = (value) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const toLabel = (...candidates) => {
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }
  return '';
};

const uniqueTextList = (values = []) => Array.from(new Set(
  values
    .map((value) => normalizeText(value))
    .filter(Boolean),
));

const readFirstMoney = (...candidates) => {
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return roundMoney(parsed);
    }
  }
  return 0;
};

const collectRoleLabels = (user) => {
  const roleRows = Array.isArray(user?.roles)
    ? user.roles
    : (user?.roles && typeof user.roles === 'object')
      ? Object.values(user.roles)
      : [];

  const labels = [
    user?.role_name,
    user?.role,
    user?.position,
    user?.jabatan,
    user?.user_type,
    user?.level,
    ...roleRows.flatMap((row) => (
      row && typeof row === 'object'
        ? [row.name, row.title, row.label, row.code, row.slug]
        : [row]
    )),
  ];

  return uniqueTextList(labels);
};

const isCashierUser = (user) => {
  return collectRoleLabels(user).some((label) => (
    label === 'kasir'
    || label === 'cashier'
    || label.includes('kasir')
    || label.includes('cashier')
  ));
};

const collectUserIds = (user) => {
  const ids = new Set();
  [
    user?.id,
    user?.user_id,
    user?.employee_id,
    user?.cashier_id,
    user?.profile?.id,
    user?.employee?.id,
  ].forEach((value) => {
    const id = toPositiveId(value);
    if (id > 0) {
      ids.add(id);
    }
  });
  return ids;
};

const collectInvoiceOwnerIds = (row) => {
  const ids = new Set();
  [
    row?.cashier?.id,
    row?.cashier_id,
    row?.invoice?.cashier?.id,
    row?.invoice?.cashier_id,
    row?.user?.id,
    row?.user_id,
    row?.invoice?.user?.id,
    row?.invoice?.user_id,
    row?.creator?.id,
    row?.creator_id,
    row?.invoice?.creator?.id,
    row?.invoice?.creator_id,
    row?.created_by?.id,
    row?.invoice?.created_by?.id,
    row?.created_by_user?.id,
    row?.invoice?.created_by_user?.id,
    row?.created_by_user_id,
    row?.invoice?.created_by_user_id,
    row?.created_by_id,
    row?.invoice?.created_by_id,
    row?.approval?.requester?.id,
    row?.requester?.id,
    row?.order?.cashier?.id,
    row?.order?.cashier_id,
    row?.order?.user?.id,
    row?.order?.user_id,
    row?.order?.creator?.id,
    row?.order?.created_by?.id,
    row?.order?.created_by_user?.id,
    row?.order?.created_by_user_id,
  ].forEach((value) => {
    const id = toPositiveId(value);
    if (id > 0) {
      ids.add(id);
    }
  });
  return ids;
};

const collectUserNames = (user) => uniqueTextList([
  user?.name,
  user?.fullname,
  user?.full_name,
  user?.username,
  user?.user_name,
  user?.email,
]);

const collectInvoiceOwnerNames = (row) => uniqueTextList([
  row?.cashier?.name,
  row?.cashier_name,
  row?.invoice?.cashier?.name,
  row?.invoice?.cashier_name,
  row?.user?.name,
  row?.user_name,
  row?.invoice?.user?.name,
  row?.invoice?.user_name,
  row?.creator?.name,
  row?.creator_name,
  row?.invoice?.creator?.name,
  row?.invoice?.creator_name,
  row?.created_by?.name,
  row?.created_by_name,
  row?.invoice?.created_by?.name,
  row?.invoice?.created_by_name,
  row?.created_by_user?.name,
  row?.invoice?.created_by_user?.name,
  row?.approval?.requester?.name,
  row?.requester?.name,
  row?.order?.cashier?.name,
  row?.order?.user?.name,
  row?.order?.creator?.name,
  row?.order?.created_by?.name,
  row?.order?.created_by_user?.name,
]);

const isOwnedByUser = (row, user) => {
  const userIds = collectUserIds(user);
  const ownerIds = collectInvoiceOwnerIds(row);
  if (userIds.size > 0 && ownerIds.size > 0) {
    for (const id of ownerIds) {
      if (userIds.has(id)) {
        return true;
      }
    }
    return false;
  }

  const userNames = collectUserNames(user);
  const ownerNames = collectInvoiceOwnerNames(row);
  if (userNames.length > 0 && ownerNames.length > 0) {
    return ownerNames.some((name) => userNames.includes(name));
  }

  return false;
};

const resolveInvoiceStatusKey = (status) => {
  const text = normalizeText(status);
  if (!text) return '';
  if (['queued_offline'].includes(text)) return 'queued_offline';
  if (['draft'].includes(text)) return 'draft';
  if (['paid', 'lunas', 'full'].includes(text)) return 'paid';
  if (['partially_paid', 'partial_paid', 'dp'].includes(text)) return 'partially_paid';
  if (['pending_payment', 'awaiting_payment', 'unpaid'].includes(text)) return 'pending_payment';
  if (['piutang', 'receivable', 'credit', 'outstanding', 'belum_lunas', 'belum lunas'].includes(text)) return 'receivable';
  if (['completed', 'done', 'finished'].includes(text)) return 'completed';
  if (['picked_up'].includes(text)) return 'picked_up';
  return text;
};

const normalizeInvoiceStatusText = (row) => (
  normalizeText(
    row?.status
    || row?.order_status
    || row?.order?.status
    || row?.invoice?.status
    || row?.invoice?.payment_status
    || row?.payment_status
    || row?.payment?.status
    || row?.payment?.payment_status
    || '',
  )
);

const isDraftCandidate = (row) => {
  const status = normalizeText(row?.status);
  if (status === 'draft') {
    return true;
  }
  const notes = normalizeText(row?.notes);
  if (!notes.includes('mode: simpan draft')) {
    return false;
  }
  return !notes.includes('mode: proses orderan');
};

const isDraftInvoiceRow = (row) => {
  if (normalizeText(row?.__source) === 'queue') {
    return true;
  }
  return isDraftCandidate(row) || resolveInvoiceStatusKey(normalizeInvoiceStatusText(row)) === 'draft';
};
const isApprovalInvoiceRow = (row) => normalizeText(row?.__source) === 'receivable_approval';
const hasInvoiceTransactionReference = (row) => {
  return [
    row?.id,
    row?.invoice?.id,
    row?.order?.id,
    row?.approval?.orderId,
  ].some((value) => toPositiveId(value) > 0);
};

const getInvoiceAmounts = (row) => {
  const total = readFirstMoney(
    row?.invoice?.total,
    row?.total,
    row?.grand_total,
  );
  const paid = readFirstMoney(
    row?.invoice?.paid_total,
    row?.paid_total,
    row?.payment?.paid_total,
    row?.payment?.amount,
  );
  const explicitDue = readFirstMoney(
    row?.invoice?.due_total,
    row?.due_total,
  );
  const due = explicitDue > 0
    ? explicitDue
    : roundMoney(Math.max(0, total - paid));

  return { total, paid, due };
};

const isReceivableInvoiceRow = (row) => {
  if (!row || isDraftInvoiceRow(row) || isApprovalInvoiceRow(row)) {
    return false;
  }

  const { due } = getInvoiceAmounts(row);
  if (due > 0) {
    return true;
  }

  const statusKey = resolveInvoiceStatusKey(normalizeInvoiceStatusText(row));
  return ['receivable', 'partially_paid'].includes(statusKey);
};
const isSuccessfulInvoiceRow = (row) => {
  if (!row || isDraftInvoiceRow(row) || isApprovalInvoiceRow(row)) {
    return false;
  }

  if (!hasInvoiceTransactionReference(row)) {
    return false;
  }

  const statusKey = resolveInvoiceStatusKey(normalizeInvoiceStatusText(row));
  if (['cancelled', 'approval_rejected'].includes(statusKey)) {
    return false;
  }

  return true;
};

const isPaidInvoiceRow = (row) => {
  if (!row || isDraftInvoiceRow(row)) {
    return false;
  }

  const { total, paid, due } = getInvoiceAmounts(row);
  if (total > 0 && paid >= total) {
    return true;
  }

  const statusKey = resolveInvoiceStatusKey(normalizeInvoiceStatusText(row));
  if (statusKey === 'paid') {
    return true;
  }

  return due <= 0 && total > 0 && ['completed', 'picked_up'].includes(statusKey);
};

const canUserViewInvoiceRow = (row, user) => {
  if (!row || typeof row !== 'object') {
    return false;
  }

  return Boolean(user);
};

const canUserAccessInvoiceRow = (row, user) => {
  if (!row || typeof row !== 'object') {
    return false;
  }

  if (!user) {
    return false;
  }

  if (!isCashierUser(user)) {
    return true;
  }

  if (isReceivableInvoiceRow(row) || isPaidInvoiceRow(row)) {
    return true;
  }

  if (normalizeText(row?.__source) === 'queue') {
    return true;
  }

  return isOwnedByUser(row, user);
};

const filterInvoiceRowsForUser = (rows, user) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows.filter((row) => canUserViewInvoiceRow(row, user));
};

module.exports = {
  canUserAccessInvoiceRow,
  canUserViewInvoiceRow,
  collectRoleLabels,
  filterInvoiceRowsForUser,
  isApprovalInvoiceRow,
  isCashierUser,
  isDraftInvoiceRow,
  isOwnedByUser,
  isPaidInvoiceRow,
  isReceivableInvoiceRow,
  isSuccessfulInvoiceRow,
  normalizeInvoiceStatusText,
  resolveInvoiceStatusKey,
};

module.exports.default = module.exports;
