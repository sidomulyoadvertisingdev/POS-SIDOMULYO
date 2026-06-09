import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  createStoreClosingCorrection,
  decideStoreClosingCashDifference,
  decideStoreClosingCorrection,
  evaluateStoreDailyClosing,
  fetchStoreDailyClosing,
  fetchUserDirectory,
  finalizeStoreDailyClosing,
  saveStoreClosingCashValidation,
  saveStoreClosingChecklist,
  saveStoreClosingOrderIssue,
  saveStoreClosingOrderIssuesBulk,
  uploadStoreClosingExpenseEvidence,
  uploadStoreClosingPurchaseEvidence,
} from '../services/erpApi';
import { formatRupiah } from '../utils/currency';

const todayIso = () => new Date().toISOString().slice(0, 10);
const sanitizeAmount = (value) => String(value || '').replace(/[^\d]/g, '');
const parseAmount = (value) => Number(sanitizeAmount(value) || 0);
const safeText = (value) => String(value || '').trim();
const CASH_DENOMINATIONS = [
  100000,
  50000,
  20000,
  10000,
  5000,
  2000,
  1000,
  500,
  200,
  100,
];
const CLOSING_VALIDATION_REFERENCES = [
  {
    no: 1,
    title: 'Nota penjualan',
    valid: 'Valid jika invoice lunas sesuai metode bayar dan nominal pembayaran. Tunai sudah diinput, TF/QRIS terdeteksi, split payment sesuai, dan kelebihan bayar sudah dikonfirmasi sebagai deposit/refund/kas toko.',
    invalid: 'Tidak valid jika pembayaran belum cocok, TF/QRIS belum terdeteksi, cash belum diisi, split payment belum sesuai, atau kelebihan bayar belum diputuskan.',
  },
  {
    no: 2,
    title: 'Uang lebih dari nota',
    valid: 'Valid jika pembayaran lebih dari customer sudah dialokasikan dengan jelas sebagai refund, deposit customer, atau kas toko/pendapatan lain.',
    invalid: 'Tidak valid jika ada pembayaran lebih dari total nota tetapi belum diputuskan alokasinya.',
  },
  {
    no: 3,
    title: 'Uang lebih dari setoran',
    valid: 'Valid jika uang setoran lebih sudah ditemukan sumbernya dan dialokasikan jelas, misalnya pembayaran tunai yang belum tercatat, deposit customer, refund, atau kas toko.',
    invalid: 'Tidak valid jika uang setoran lebih belum jelas sumbernya atau belum dipilih alokasinya.',
  },
  {
    no: 4,
    title: 'Draft',
    valid: 'Valid jika draft sudah ditangani dengan keputusan jelas: dipush/follow up ke customer, dialihkan ke kasir lain, diteruskan ke atasan/owner, atau dibatalkan.',
    invalid: 'Tidak valid jika draft masih menggantung, belum ada keputusan, belum ada PIC follow up, atau belum ada alasan batal transaksi.',
  },
  {
    no: 5,
    title: 'Pengeluaran',
    valid: 'Valid jika pengeluaran sudah memiliki permintaan, jadwal/plafon sesuai, nota, bukti penerimaan, serta status hutang dan metode bayar jelas.',
    invalid: 'Tidak valid jika pengeluaran belum lengkap, belum ada bukti, belum sesuai jadwal/plafon, atau status hutang dan metode bayar belum jelas.',
  },
  {
    no: 6,
    title: 'Pembelian',
    valid: 'Valid jika pembelian sudah memiliki permintaan, nota pembelian, bukti barang diterima, serta status hutang dan metode bayar sudah diputuskan.',
    invalid: 'Tidak valid jika pembelian belum ada permintaan, nota belum lengkap, barang belum terbukti diterima, atau status hutang dan metode bayar belum jelas.',
  },
];
const matchesAnyToken = (value, tokens = []) => {
  const text = safeText(value).toLowerCase();
  return tokens.some((token) => text.includes(String(token || '').toLowerCase()));
};
const createEmptyCashBreakdown = () => Object.fromEntries(CASH_DENOMINATIONS.map((value) => [String(value), '']));
const normalizeCashBreakdownRows = (rows = []) => {
  const breakdown = createEmptyCashBreakdown();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const denomination = String(Number(row?.denomination || 0) || '');
    if (Object.prototype.hasOwnProperty.call(breakdown, denomination)) {
      breakdown[denomination] = String(Number(row?.qty || 0) || '');
    }
  });
  return breakdown;
};
const buildCashBreakdownPayload = (breakdown = {}) => CASH_DENOMINATIONS
  .map((denomination) => {
    const qty = Number(sanitizeAmount(breakdown[String(denomination)] || '')) || 0;
    return {
      denomination,
      qty,
      subtotal: denomination * qty,
    };
  })
  .filter((row) => row.qty > 0);
const calculateCashBreakdownTotal = (breakdown = {}) => buildCashBreakdownPayload(breakdown)
  .reduce((total, row) => total + Number(row.subtotal || 0), 0);
const correctionTypes = [
  ['klarifikasi_telat', 'Klarifikasi telat'],
  ['bukti_tambahan', 'Bukti tambahan'],
  ['selisih_cash', 'Selisih cash'],
  ['kesalahan_beban', 'Kesalahan beban'],
];
const correctionDecisions = [
  ['employee_burden', 'Beban karyawan'],
  ['management_burden', 'Beban management'],
  ['shared_team', 'Dibagi tim'],
  ['cancelled', 'Dibatalkan'],
  ['carry_forward', 'Koreksi berikutnya'],
];
const cashDecisions = [
  ['approved', 'Disetujui'],
  ['charge_employee', 'Beban karyawan'],
  ['management', 'Beban management'],
  ['shared_team', 'Dibagi tim'],
  ['rejected', 'Tolak - Validasi ulang'],
];
const surplusAllocationOptions = [
  ['store_cash_savings', 'Tabungan untuk kas toko'],
  ['other_income', 'Pendapatan lain-lain / kas toko'],
  ['customer_deposit', 'Deposit customer'],
  ['customer_refund', 'Refund ke customer'],
];
const surplusAllocationLabel = (value) => Object.fromEntries(surplusAllocationOptions)[value] || value || 'Belum dialokasikan';
const orderActionOptions = [
  ['cancel', 'Cancel'],
  ['push_same_cashier', 'Push kasir saya'],
  ['push_other_cashier', 'Push kasir lain'],
  ['push_store_head', 'Push kepala toko'],
  ['push_ops_head', 'Push kepala ops'],
  ['push_owner', 'Push owner'],
];
const orderActionLabel = (value) => Object.fromEntries(orderActionOptions)[value] || value || 'Belum dipilih';
const financeStatusLabel = (value) => ({
  system_verified: 'Dibaca Sistem',
  cash_validated: 'Cash Valid',
  needs_cash_validation: 'Butuh Validasi Cash',
  overdue_attention: 'Ada Piutang Lewat Tempo',
  monitored: 'Termonitor',
}[String(value || '')] || value || '-');
const receivableRiskTone = (value) => ({
  critical: '#9f1239',
  danger: '#b42318',
  warning: '#b45309',
}[String(value || '')] || '#174a8c');

const statusLabel = (value) => ({
  draft: 'Draft',
  ada_selisih: 'Ada Selisih',
  butuh_bukti: 'Butuh Bukti',
  belum_bisa_closing: 'Belum Bisa Closing',
  final_closing: 'Final Closing',
  ada_koreksi: 'Ada Koreksi',
}[String(value || '').toLowerCase()] || value || 'Draft');
const correctionTypeLabel = (value) => Object.fromEntries(correctionTypes)[value] || value || '-';
const correctionDecisionLabel = (value) => ({
  pending_review: 'Menunggu Review',
  ...Object.fromEntries(correctionDecisions),
}[value] || value || '-');
const cashDecisionLabel = (value) => ({
  pending: 'Menunggu Review',
  ...Object.fromEntries(cashDecisions),
  rejected: 'Ditolak - validasi ulang',
}[value] || value || '-');
const cashDifferenceLabel = (row) => (
  safeText(row?.difference_label)
  || (Number(row?.difference || 0) > 0 ? 'Selisih Lebih' : 'Selisih Kurang')
);
const cashDifferenceTreatmentText = (row) => safeText(row?.accounting_treatment)
  || (Number(row?.difference || 0) > 0
    ? 'Selisih lebih akan masuk pendapatan lain-lain setelah approval admin.'
    : 'Selisih kurang menunggu keputusan pembebanan admin.');

const chooseBrowserFile = () => new Promise((resolve, reject) => {
  if (typeof document === 'undefined') {
    reject(new Error('Upload bukti tersedia pada aplikasi web/desktop.'));
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.jpg,.jpeg,.png,.webp,.pdf';
  input.onchange = () => resolve(input.files?.[0] || null);
  input.onerror = () => reject(new Error('Gagal membuka pemilih file.'));
  input.click();
});

const ClosingStorePanel = ({
  currentUser,
  isActive,
  onNotify,
  onPrintReport,
  onExportPdfReport,
  autoOpenFinalizeToken = 0,
  finalizeOnly = false,
  onFinalizeModalClose,
  onReviewClosing,
}) => {
  const [date, setDate] = useState(todayIso());
  const [payload, setPayload] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingKey, setUploadingKey] = useState('');
  const [physicalCash, setPhysicalCash] = useState('');
  const [cashBreakdown, setCashBreakdown] = useState(createEmptyCashBreakdown);
  const [cashReason, setCashReason] = useState('');
  const [responsibleUserId, setResponsibleUserId] = useState(null);
  const [surplusAllocationType, setSurplusAllocationType] = useState('store_cash_savings');
  const [surplusAllocationNote, setSurplusAllocationNote] = useState('');
  const [cashEvidence, setCashEvidence] = useState(null);
  const [orderDrafts, setOrderDrafts] = useState({});
  const [bulkOrderReason, setBulkOrderReason] = useState('');
  const [bulkOrderPicUserId, setBulkOrderPicUserId] = useState(null);
  const [bulkOrderFollowUp, setBulkOrderFollowUp] = useState('');
  const [cashDecisionNotes, setCashDecisionNotes] = useState({});
  const [isFinalizeModalVisible, setIsFinalizeModalVisible] = useState(false);
  const [correctionType, setCorrectionType] = useState('klarifikasi_telat');
  const [correctionAmount, setCorrectionAmount] = useState('');
  const [correctionDescription, setCorrectionDescription] = useState('');
  const [correctionRelatedUserId, setCorrectionRelatedUserId] = useState(null);
  const [correctionEvidence, setCorrectionEvidence] = useState(null);
  const [correctionDrafts, setCorrectionDrafts] = useState({});
  const [highlightCashReview, setHighlightCashReview] = useState(false);
  const reviewHighlightTimerRef = useRef(null);
  const handledAutoFinalizeTokenRef = useRef(0);

  const closing = payload?.closing || null;
  const summary = payload?.summary || null;
  const workflow = payload?.workflow || {};
  const closingId = Number(closing?.id || 0);
  const existingCash = summary?.cash_validation?.data || null;
  const expectedMovement = Number(summary?.cash_validation?.expected_cash_movement || 0);
  const openingCash = Number(summary?.cash_validation?.opening_cash || summary?.cash_validation?.management_opening_cash || existingCash?.opening_cash || 0);
  const cashIncomeTotal = Number(summary?.cash_validation?.cash_income_total || 0);
  const cashExpenseTotal = Number(summary?.cash_validation?.cash_expense_total || 0);
  const expectedCashPreview = openingCash + expectedMovement;
  const isCashValidationRejected = String(existingCash?.decision_status || '') === 'rejected';
  const cashBreakdownTotal = calculateCashBreakdownTotal(cashBreakdown);
  const cashBreakdownQtyTotal = buildCashBreakdownPayload(cashBreakdown)
    .reduce((total, row) => total + Number(row.qty || 0), 0);
  const physicalCashValue = parseAmount(physicalCash);
  const cashDifferencePreview = physicalCashValue - expectedCashPreview;
  const openOrders = Array.isArray(summary?.open_orders) ? summary.open_orders : [];
  const incompleteOpenOrders = openOrders.filter((row) => (
    !safeText(row.reason)
    || !safeText(row.action_type)
    || (
      !['push_store_head', 'push_ops_head', 'push_owner'].includes(safeText(row.action_type))
      && !Number(row.pic_user_id || 0)
    )
    || !safeText(row.follow_up)
  ));
  const checklists = Array.isArray(summary?.checklists) ? summary.checklists : [];
  const blockers = Array.isArray(summary?.blockers) ? summary.blockers : [];
  const missingExpenses = Array.isArray(summary?.expenses?.missing_evidence) ? summary.expenses.missing_evidence : [];
  const missingPurchases = Array.isArray(summary?.purchases?.missing_evidence) ? summary.purchases.missing_evidence : [];
  const expenseTotal = Number(summary?.expenses?.total ?? summary?.expenses?.amount ?? summary?.expenses?.total_amount ?? 0) || 0;
  const expenseCount = Number(summary?.expenses?.count ?? summary?.expenses?.transaction_count ?? 0) || 0;
  const purchaseTotal = Number(summary?.purchases?.total ?? summary?.purchases?.amount ?? summary?.purchases?.total_amount ?? 0) || 0;
  const purchaseCount = Number(summary?.purchases?.count ?? summary?.purchases?.transaction_count ?? 0) || 0;
  const financeBalance = summary?.finance_balance && typeof summary.finance_balance === 'object' ? summary.finance_balance : {};
  const cashDifferenceSummary = summary?.cash_difference && typeof summary.cash_difference === 'object'
    ? summary.cash_difference
    : {};
  const cashDifferenceRows = Array.isArray(cashDifferenceSummary?.items) ? cashDifferenceSummary.items : [];
  const receivables = summary?.receivables && typeof summary.receivables === 'object' ? summary.receivables : {};
  const cashierReceivableRisks = Array.isArray(receivables?.cashier_risks) ? receivables.cashier_risks : [];
  const receivableGuard = receivables?.operational_guard && typeof receivables.operational_guard === 'object'
    ? receivables.operational_guard
    : null;
  const receivableBuckets = [
    ['due_today', 'Jatuh tempo hari ini'],
    ['due_next_3_days', 'Akan jatuh tempo 3 hari'],
    ['overdue_1_to_3_days', 'Telat 1-3 hari'],
    ['overdue_4_to_7_days', 'Telat 4-7 hari'],
    ['overdue_8_to_30_days', 'Telat 8-30 hari'],
    ['overdue_more_than_30_days', 'Telat >30 hari'],
    ['without_due_date', 'Tanpa tempo'],
  ];
  const cashValidations = Array.isArray(workflow?.cash_validations) ? workflow.cash_validations : [];
  const differenceValidations = cashValidations.filter((row) => (
    Number(row?.difference || 0) < 0
    && String(row?.decision_status || '') === 'pending'
  ));
  const hasPendingShortageReview = differenceValidations.length > 0;
  const corrections = Array.isArray(workflow?.corrections) ? workflow.corrections : [];
  const auditEvents = Array.isArray(workflow?.audit_events) ? workflow.audit_events : [];
  const canReview = Boolean(workflow?.can_review);
  const isLocked = Boolean(closing?.is_locked);
  const blockerMatches = (tokens = []) => blockers.some((row) => matchesAnyToken(
    `${row?.code || ''} ${row?.message || ''} ${row?.label || ''}`,
    tokens,
  ));
  const uncheckedChecklistMatches = (tokens = []) => checklists.some((row) => (
    !row?.is_checked
    && matchesAnyToken(`${row?.code || ''} ${row?.label || ''} ${row?.validation_message || ''}`, tokens)
  ));
  const hasSavedCashValidation = Boolean(existingCash) && !isCashValidationRejected;
  const existingCashDifference = Number(existingCash?.difference || 0);
  const existingCashDecisionStatus = String(existingCash?.decision_status || '');
  const isExistingCashDifferenceResolved = !hasSavedCashValidation
    || Math.abs(existingCashDifference) === 0
    || (
      existingCashDifference > 0
      && Boolean(safeText(existingCash?.surplus_allocation_type))
      && existingCashDecisionStatus === 'approved'
    )
    || (
      existingCashDifference < 0
      && ['approved', 'charge_employee', 'management', 'shared_team'].includes(existingCashDecisionStatus)
    );
  const cashDifferenceIsSurplus = cashDifferencePreview > 0;
  const cashDifferenceIsShortage = cashDifferencePreview < 0;
  const selectedSurplusAllocation = safeText(surplusAllocationType || existingCash?.surplus_allocation_type);
  const cashDifferenceHasRequiredInput = !cashDifferenceIsSurplus && !cashDifferenceIsShortage
    ? true
    : cashDifferenceIsSurplus
      ? Boolean(selectedSurplusAllocation)
      : (
      safeText(cashReason)
      && Number(responsibleUserId || 0) > 0
      && (cashEvidence || existingCash?.evidence_path)
    );
  const validationRows = CLOSING_VALIDATION_REFERENCES.map((reference) => {
    let isValid = true;
    let reason = 'Sistem tidak menemukan blocker pada validasi ini.';

    if (reference.no === 1) {
      const invalid = blockerMatches(['nota', 'invoice', 'penjualan', 'payment', 'pembayaran', 'qris', 'transfer'])
        || uncheckedChecklistMatches(['nota', 'invoice', 'penjualan', 'payment', 'pembayaran', 'qris', 'transfer']);
      isValid = !invalid;
      reason = isValid
        ? 'Nota dan pembayaran tidak memiliki blocker aktif.'
        : 'Masih ada nota/pembayaran yang belum cocok atau belum tervalidasi.';
    } else if (reference.no === 2) {
      const invalid = blockerMatches(['lebih bayar', 'overpay', 'deposit', 'refund', 'kelebihan bayar'])
        || uncheckedChecklistMatches(['lebih bayar', 'overpay', 'deposit', 'refund', 'kelebihan bayar']);
      isValid = !invalid;
      reason = isValid
        ? 'Tidak ada kelebihan bayar customer yang belum dialokasikan.'
        : 'Masih ada kelebihan bayar customer yang perlu keputusan alokasi.';
    } else if (reference.no === 3) {
      const invalid = !hasSavedCashValidation
        || !cashDifferenceHasRequiredInput
        || !isExistingCashDifferenceResolved
        || isCashValidationRejected;
      isValid = !invalid;
      reason = isValid
        ? 'Cash fisik sudah tervalidasi. Uang lebih sudah dialokasikan atau uang kurang sudah diputuskan reviewer.'
        : 'Cash fisik belum valid, uang lebih belum dialokasikan, uang kurang belum lengkap/approved, atau validasi cash ditolak reviewer.';
    } else if (reference.no === 4) {
      isValid = incompleteOpenOrders.length === 0;
      reason = isValid
        ? 'Draft/piutang follow-up sudah lengkap.'
        : `${incompleteOpenOrders.length} draft/piutang belum punya alasan, aksi, PIC, atau follow-up.`;
    } else if (reference.no === 5) {
      const hasExpenseActivity = expenseTotal > 0
        || expenseCount > 0
        || cashExpenseTotal > 0
        || missingExpenses.length > 0;
      if (!hasExpenseActivity) {
        isValid = true;
        reason = 'Tidak ada pengeluaran pada closing hari ini.';
      } else {
        const invalid = missingExpenses.length > 0
          || blockerMatches(['pengeluaran', 'expense'])
          || uncheckedChecklistMatches(['pengeluaran', 'expense']);
        isValid = !invalid;
        reason = isValid
          ? 'Pengeluaran kasir sudah tercatat, dicek, dan tidak ada bukti yang kurang.'
          : `${missingExpenses.length} pengeluaran masih kurang bukti atau belum tervalidasi.`;
      }
    } else if (reference.no === 6) {
      const hasPurchaseActivity = purchaseTotal > 0
        || purchaseCount > 0
        || missingPurchases.length > 0;
      if (!hasPurchaseActivity) {
        isValid = true;
        reason = 'Tidak ada pembelian pada closing hari ini.';
      } else {
        const invalid = missingPurchases.length > 0
          || blockerMatches(['pembelian', 'purchase'])
          || uncheckedChecklistMatches(['pembelian', 'purchase']);
        isValid = !invalid;
        reason = isValid
          ? 'Pembelian sudah tercatat, dicek, dan tidak ada bukti yang kurang.'
          : `${missingPurchases.length} pembelian masih kurang bukti atau belum tervalidasi.`;
      }
    }

    return {
      ...reference,
      isValid,
      statusLabel: isValid ? 'Valid' : 'Tidak Valid',
      reason,
    };
  });
  const allValidationRowsValid = validationRows.every((row) => row.isValid);
  const nonChecklistBlockers = blockers.filter((row) => String(row?.code || '') !== 'manual_checklist_incomplete');
  const closingValidationReady = allValidationRowsValid && nonChecklistBlockers.length === 0;
  const canFinalizeClosing = closingValidationReady && !isLocked;
  const closingActionMode = isLocked
    ? 'locked'
    : hasPendingShortageReview
      ? 'review'
      : canFinalizeClosing
        ? 'finalize'
        : 'blocked';
  const closingActionLabel = closingActionMode === 'review'
    ? 'Review'
    : closingActionMode === 'finalize'
      ? 'Final Closing'
      : 'Final Closing';
  const closingActionDisabled = closingActionMode === 'blocked' || submitting;
  const statusTone = closing?.status === 'ada_koreksi'
    ? styles.statusCorrection
    : closing?.status === 'final_closing' || closingValidationReady
    ? styles.statusSafe
    : (closing?.is_ready ? styles.statusReady : styles.statusBlocked);
  const statusText = isLocked
    ? statusLabel(closing?.status)
    : closingValidationReady
      ? 'Valid'
      : (closing?.is_ready ? 'Aman untuk Closing' : statusLabel(closing?.status));

  const userOptions = useMemo(() => {
    const rows = Array.isArray(users) ? users : [];
    if (rows.some((row) => Number(row?.id || 0) === Number(currentUser?.id || 0))) {
      return rows;
    }
    return currentUser?.id ? [currentUser, ...rows] : rows;
  }, [currentUser, users]);

  const hydrateForm = (nextPayload) => {
    const cash = nextPayload?.summary?.cash_validation?.data || null;
    setCashEvidence(null);
    if (cash) {
      setPhysicalCash(sanitizeAmount(cash.physical_cash));
      setCashBreakdown(normalizeCashBreakdownRows(cash.cash_breakdown));
      setCashReason(safeText(cash.reason));
      setResponsibleUserId(Number(cash.responsible_user_id || 0) || null);
      setSurplusAllocationType(safeText(cash.surplus_allocation_type) || 'store_cash_savings');
      setSurplusAllocationNote(safeText(cash.surplus_allocation_note));
    } else {
      setPhysicalCash('');
      setCashBreakdown(createEmptyCashBreakdown());
      setCashReason('');
      setResponsibleUserId(null);
      setSurplusAllocationType('store_cash_savings');
      setSurplusAllocationNote('');
    }
    const drafts = {};
    (nextPayload?.summary?.open_orders || []).forEach((row) => {
      drafts[row.id] = {
        reason: safeText(row.reason),
        action_type: safeText(row.action_type) || 'push_same_cashier',
        pic_user_id: Number(row.pic_user_id || currentUser?.id || 0) || null,
        escalation_role: safeText(row.escalation_role),
        escalated_user_id: Number(row.escalated_user_id || 0) || null,
        follow_up: safeText(row.follow_up),
      };
    });
    setOrderDrafts(drafts);
    const decisionNotes = {};
    (nextPayload?.workflow?.cash_validations || []).forEach((row) => {
      decisionNotes[row.id] = safeText(row.decision_note);
    });
    setCashDecisionNotes(decisionNotes);
    const correctionRows = {};
    (nextPayload?.workflow?.corrections || []).forEach((row) => {
      correctionRows[row.id] = {
        decision: row.decision === 'pending_review' ? 'management_burden' : row.decision,
        decision_note: safeText(row.decision_note),
        carry_forward_date: safeText(row.carry_forward_date),
      };
    });
    setCorrectionDrafts(correctionRows);
  };

  const loadClosing = async () => {
    try {
      setLoading(true);
      const nextPayload = await fetchStoreDailyClosing(date);
      setPayload(nextPayload);
      hydrateForm(nextPayload);
    } catch (error) {
      onNotify?.('Closing Toko', `Gagal memuat closing: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isActive) return;
    loadClosing();
    fetchUserDirectory().then(setUsers).catch(() => setUsers([]));
  }, [isActive]);

  useEffect(() => () => {
    if (reviewHighlightTimerRef.current) {
      clearTimeout(reviewHighlightTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const token = Number(autoOpenFinalizeToken || 0);
    if (!isActive || !(token > 0) || handledAutoFinalizeTokenRef.current === token) {
      return;
    }
    if (!(closingId > 0) || isLocked || !canFinalizeClosing) {
      return;
    }
    handledAutoFinalizeTokenRef.current = token;
    setIsFinalizeModalVisible(true);
  }, [autoOpenFinalizeToken, isActive, closingId, isLocked, canFinalizeClosing]);

  const refreshEvaluation = async () => {
    if (!(closingId > 0)) return;
    const nextPayload = await evaluateStoreDailyClosing(closingId);
    setPayload(nextPayload);
    hydrateForm(nextPayload);
  };

  const updateCashBreakdownQty = (denomination, value) => {
    const qtyText = sanitizeAmount(value);
    setCashBreakdown((current) => {
      const next = {
        ...current,
        [String(denomination)]: qtyText,
      };
      setPhysicalCash(String(calculateCashBreakdownTotal(next) || ''));
      return next;
    });
  };

  const saveCashValidation = async () => {
    if (!(closingId > 0)) return;
    if (cashDifferenceIsSurplus && !safeText(surplusAllocationType)) {
      onNotify?.('Validasi Cash', 'Uang lebih wajib dipilih alokasinya.');
      return;
    }
    if (cashDifferenceIsShortage && (!cashReason || !responsibleUserId || !cashEvidence) && !existingCash?.evidence_path) {
      onNotify?.('Validasi Cash', 'Uang kurang membutuhkan alasan, penanggung jawab, bukti, dan approval reviewer.');
      return;
    }
    try {
      setSubmitting(true);
      const nextPayload = await saveStoreClosingCashValidation(closingId, {
        physical_cash: physicalCashValue,
        cash_breakdown: buildCashBreakdownPayload(cashBreakdown),
        reason: cashReason,
        responsible_user_id: responsibleUserId,
        surplus_allocation_type: cashDifferenceIsSurplus ? surplusAllocationType : null,
        surplus_allocation_note: cashDifferenceIsSurplus ? surplusAllocationNote : '',
        evidence: cashEvidence,
      });
      setCashEvidence(null);
      setPayload(nextPayload);
      hydrateForm(nextPayload);
      onNotify?.('Validasi Cash', 'Cash fisik berhasil divalidasi.');
    } catch (error) {
      onNotify?.('Validasi Cash', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectCashEvidence = async () => {
    try {
      const file = await chooseBrowserFile();
      setCashEvidence(file || null);
    } catch (error) {
      onNotify?.('Validasi Cash', error.message);
    }
  };

  const saveCashDecision = async (validation, decisionStatus) => {
    const decisionNote = safeText(cashDecisionNotes[validation.id]);
    if (decisionStatus === 'rejected' && !decisionNote) {
      onNotify?.('Review Selisih', 'Catatan penolakan wajib diisi agar kasir tahu apa yang harus divalidasi ulang.');
      return;
    }
    try {
      setSubmitting(true);
      const nextPayload = await decideStoreClosingCashDifference(closingId, {
        cashier_id: validation.cashier_id,
        decision_status: decisionStatus,
        decision_note: decisionNote,
      });
      setPayload(nextPayload);
      hydrateForm(nextPayload);
      onNotify?.('Review Selisih', 'Keputusan selisih cash berhasil disimpan.');
    } catch (error) {
      onNotify?.('Review Selisih', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleChecklist = async (item) => {
    if (isLocked || !item?.is_manual || !(closingId > 0)) return;
    try {
      const nextPayload = await saveStoreClosingChecklist(closingId, [{
        code: item.code,
        is_checked: !item.is_checked,
      }]);
      setPayload(nextPayload);
    } catch (error) {
      onNotify?.('Checklist Closing', error.message);
    }
  };

  const updateOrderDraft = (issueId, key, value) => {
    setOrderDrafts((current) => ({
      ...current,
      [issueId]: { ...(current[issueId] || {}), [key]: value },
    }));
  };

  const saveOrderIssue = async (issue) => {
    const draft = orderDrafts[issue.id] || {};
    const missingFields = [];
    if (!safeText(draft.reason)) missingFields.push('alasan');
    const actionType = safeText(draft.action_type) || 'push_same_cashier';
    if (actionType === 'push_other_cashier' && !Number(draft.pic_user_id || 0)) missingFields.push('user kasir tujuan');
    if (!safeText(draft.follow_up)) missingFields.push('follow-up');
    if (missingFields.length > 0) {
      onNotify?.('Follow-up Closing', `Lengkapi ${missingFields.join(', ')} sebelum menyimpan tindak lanjut draft/piutang.`);
      return;
    }
    try {
      setSubmitting(true);
      const nextPayload = await saveStoreClosingOrderIssue(closingId, issue.id, {
        reason: safeText(draft.reason),
        action_type: actionType,
        pic_user_id: Number(draft.pic_user_id || 0) || null,
        escalation_role: safeText(draft.escalation_role) || null,
        escalated_user_id: Number(draft.escalated_user_id || 0) || null,
        follow_up: safeText(draft.follow_up),
        resolution_status: actionType === 'cancel' ? 'cancelled' : 'follow_up',
      });
      setPayload(nextPayload);
      hydrateForm(nextPayload);
      onNotify?.('Follow-up Closing', 'Reason dan follow-up berhasil disimpan.');
    } catch (error) {
      onNotify?.('Follow-up Closing', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const saveBulkOrderIssues = async () => {
    if (!(closingId > 0) || incompleteOpenOrders.length === 0) return;
    const missingFields = [];
    if (!safeText(bulkOrderReason)) missingFields.push('alasan');
    if (!safeText(bulkOrderFollowUp)) missingFields.push('follow-up');
    if (missingFields.length > 0) {
      onNotify?.('Follow-up Closing', `Lengkapi ${missingFields.join(', ')} untuk pengisian bersama.`);
      return;
    }
    try {
      setSubmitting(true);
      const nextPayload = await saveStoreClosingOrderIssuesBulk(closingId, {
        issue_ids: incompleteOpenOrders.map((row) => row.id),
        reason: safeText(bulkOrderReason),
        action_type: 'push_same_cashier',
        pic_user_id: Number(bulkOrderPicUserId || currentUser?.id || 0) || null,
        follow_up: safeText(bulkOrderFollowUp),
        resolution_status: 'follow_up',
        only_incomplete: true,
      });
      setPayload(nextPayload);
      hydrateForm(nextPayload);
      setBulkOrderReason('');
      setBulkOrderPicUserId(null);
      setBulkOrderFollowUp('');
      onNotify?.('Follow-up Closing', `${nextPayload?.updated_count || 0} item berhasil diberi tindak lanjut.`);
    } catch (error) {
      onNotify?.('Follow-up Closing', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const uploadEvidence = async (type, row) => {
    try {
      const file = await chooseBrowserFile();
      if (!file) return;
      const key = `${type}-${row.id}`;
      setUploadingKey(key);
      const nextPayload = type === 'expense'
        ? await uploadStoreClosingExpenseEvidence(closingId, row.id, file)
        : await uploadStoreClosingPurchaseEvidence(closingId, row.id, file);
      setPayload(nextPayload);
      onNotify?.('Bukti Closing', 'Bukti berhasil diupload dan divalidasi ulang.');
    } catch (error) {
      onNotify?.('Bukti Closing', error.message);
    } finally {
      setUploadingKey('');
    }
  };

  const selectCorrectionEvidence = async () => {
    try {
      const file = await chooseBrowserFile();
      setCorrectionEvidence(file || null);
    } catch (error) {
      onNotify?.('Case Koreksi', error.message);
    }
  };

  const submitCorrection = async () => {
    if (!safeText(correctionDescription)) {
      onNotify?.('Case Koreksi', 'Uraian masalah wajib diisi.');
      return;
    }
    try {
      setSubmitting(true);
      const nextPayload = await createStoreClosingCorrection(closingId, {
        issue_type: correctionType,
        amount: parseAmount(correctionAmount),
        related_user_id: correctionRelatedUserId,
        description: safeText(correctionDescription),
        evidence: correctionEvidence,
      });
      setPayload(nextPayload);
      hydrateForm(nextPayload);
      setCorrectionAmount('');
      setCorrectionDescription('');
      setCorrectionRelatedUserId(null);
      setCorrectionEvidence(null);
      onNotify?.('Case Koreksi', 'Case koreksi berhasil dikirim untuk review.');
    } catch (error) {
      onNotify?.('Case Koreksi', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateCorrectionDraft = (id, key, value) => {
    setCorrectionDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), [key]: value },
    }));
  };

  const saveCorrectionDecision = async (correction) => {
    const draft = correctionDrafts[correction.id] || {};
    try {
      setSubmitting(true);
      const nextPayload = await decideStoreClosingCorrection(closingId, correction.id, {
        decision: draft.decision || 'management_burden',
        decision_note: safeText(draft.decision_note),
        carry_forward_date: draft.decision === 'carry_forward' ? safeText(draft.carry_forward_date) : null,
      });
      setPayload(nextPayload);
      hydrateForm(nextPayload);
      onNotify?.('Review Koreksi', 'Keputusan case koreksi berhasil disimpan.');
    } catch (error) {
      onNotify?.('Review Koreksi', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitFinalClosing = async () => {
    try {
      setSubmitting(true);
      const nextPayload = await finalizeStoreDailyClosing(closingId);
      setPayload(nextPayload);
      hydrateForm(nextPayload);
      setIsFinalizeModalVisible(false);
      onFinalizeModalClose?.();
      onNotify?.('Closing Toko', 'Final closing berhasil dikunci.');
    } catch (error) {
      const backendBlockers = error?.body?.blockers || [];
      const message = backendBlockers.length
        ? 'Closing belum dapat dikunci. Selesaikan pemeriksaan yang ditandai pada panel.'
        : error.message;
      setIsFinalizeModalVisible(false);
      onNotify?.('Closing Toko', message);
      await refreshEvaluation();
    } finally {
      setSubmitting(false);
    }
  };

  const finalize = () => {
    setIsFinalizeModalVisible(true);
  };

  const closeFinalizeModal = () => {
    if (submitting) return;
    setIsFinalizeModalVisible(false);
    onFinalizeModalClose?.();
  };

  const reviewClosingFromFinalize = () => {
    if (submitting) return;
    setIsFinalizeModalVisible(false);
    if (typeof onReviewClosing === 'function') {
      onReviewClosing();
      return;
    }
    onFinalizeModalClose?.();
  };

  const handleClosingAction = () => {
    if (closingActionMode === 'review') {
      setHighlightCashReview(true);
      if (reviewHighlightTimerRef.current) {
        clearTimeout(reviewHighlightTimerRef.current);
      }
      reviewHighlightTimerRef.current = setTimeout(() => setHighlightCashReview(false), 3200);
      onNotify?.(
        'Review Selisih Cash',
        canReview
          ? 'Uang kurang masih butuh keputusan reviewer. Isi catatan lalu pilih keputusan pada panel Review Selisih Cash.'
          : 'Uang kurang sudah masuk antrean review. Tunggu approval reviewer sebelum Final Closing.',
      );
      return;
    }
    if (closingActionMode === 'finalize') {
      finalize();
      return;
    }
    if (closingActionMode === 'locked') {
      onNotify?.('Closing Toko', 'Closing tanggal ini sudah dikunci. Buka tanggal baru untuk closing berikutnya.');
      return;
    }
    onNotify?.('Closing Toko', 'Closing belum valid. Selesaikan validasi yang masih merah terlebih dahulu.');
  };

  const finalizeDialogCard = (
    <View style={styles.finalizeModalCard}>
      <View style={styles.modalHeader}>
        <View style={styles.modalBadge}>
          <Text style={styles.modalBadgeText}>SIAP DIKUNCI</Text>
        </View>
        <Pressable style={styles.modalCloseButton} onPress={closeFinalizeModal} disabled={submitting}>
          <Text style={styles.modalCloseButtonText}>Tutup</Text>
        </Pressable>
      </View>
      <Text style={styles.modalTitle}>Konfirmasi Final Closing</Text>
      <Text style={styles.modalDescription}>Pastikan seluruh pemeriksaan harian sudah benar sebelum mengunci laporan toko.</Text>
      <View style={styles.modalFacts}>
        <View style={styles.modalFact}>
          <Text style={styles.modalFactLabel}>Tanggal Closing</Text>
          <Text style={styles.modalFactValue}>{closing?.date || date || '-'}</Text>
        </View>
        <View style={styles.modalFact}>
          <Text style={styles.modalFactLabel}>Pendapatan Tercatat</Text>
          <Text style={styles.modalFactValue}>{formatRupiah(summary?.sales?.total || 0)}</Text>
        </View>
      </View>
      <View style={styles.modalWarning}>
        <Text style={styles.modalWarningTitle}>Laporan akan dikunci permanen</Text>
        <Text style={styles.modalWarningText}>Setelah Final Closing, data laporan tidak dapat diedit langsung. Klarifikasi atau perubahan berikutnya wajib dibuat sebagai case koreksi.</Text>
      </View>
      <View style={styles.modalActions}>
        <Pressable style={styles.modalCancelButton} onPress={reviewClosingFromFinalize} disabled={submitting}>
          <Text style={styles.modalCancelButtonText}>Kembali Periksa</Text>
        </Pressable>
        <Pressable style={[styles.modalConfirmButton, (submitting || !(closingId > 0)) && styles.disabledButton]} onPress={submitFinalClosing} disabled={submitting || !(closingId > 0)}>
          <Text style={styles.modalConfirmButtonText}>{submitting ? 'Mengunci...' : !(closingId > 0) ? 'Memuat Closing...' : 'Kunci Final Closing'}</Text>
        </Pressable>
      </View>
    </View>
  );

  const finalizeModal = (
    <Modal
      visible={isFinalizeModalVisible}
      transparent
      animationType="fade"
      onRequestClose={closeFinalizeModal}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalBackdropDismiss} onPress={closeFinalizeModal} />
        {finalizeDialogCard}
      </View>
    </Modal>
  );

  if (finalizeOnly) {
    return (
      <View style={styles.finalizeOnlyCardMount}>
        {finalizeDialogCard}
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Remittance Harian / Closing Toko</Text>
          <Text style={styles.subtitle}>Syarat closing, checklist kasir, cash fisik, bukti transaksi, draft, dan piutang jatuh tempo disatukan dalam satu validasi harian.</Text>
        </View>
        <View style={[styles.status, statusTone]}>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TextInput value={date} onChangeText={setDate} style={styles.dateInput} placeholder="YYYY-MM-DD" />
        <Pressable style={styles.secondaryButton} onPress={loadClosing}>
          <Text style={styles.secondaryButtonText}>{loading ? 'Memuat...' : 'Buka Hari'}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={refreshEvaluation} disabled={!closingId}>
          <Text style={styles.secondaryButtonText}>Validasi Ulang</Text>
        </Pressable>
      </View>

      {summary ? (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Pendapatan" value={summary.sales?.total} />
            <SummaryCard label="Cash" value={summary.payments?.cash_total} />
            <SummaryCard label="Transfer" value={summary.payments?.transfer_total} />
            <SummaryCard label="QRIS" value={summary.payments?.qris_total} />
            <SummaryCard label="Saldo Pelanggan" value={summary.payments?.customer_deposit_total} />
            <SummaryCard label="Top Up Deposit Agen" value={summary.deposit_topups?.amount || summary.payments?.deposit_topup_total || 0} />
            <SummaryCard label="Pengeluaran" value={summary.expenses?.total} warning />
            <SummaryCard label="Pembelian" value={summary.purchases?.total} warning />
          </View>

          {isLocked ? (
            <View style={styles.finalReportCard}>
              <View style={styles.finalReportHeader}>
                <View style={styles.flex}>
                  <Text style={styles.finalReportEyebrow}>Laporan Closing Terkunci</Text>
                  <Text style={styles.finalReportTitle}>Final Closing {closing?.date || date || '-'}</Text>
                  <Text style={styles.finalReportMeta}>Dikunci pada {closing?.finalized_at || '-'} | Perubahan berikutnya wajib dibuat sebagai case koreksi.</Text>
                </View>
                <View style={styles.finalReportActions}>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => onPrintReport?.(closing?.date || date)}
                    disabled={!onPrintReport}
                  >
                    <Text style={styles.primaryButtonText}>Print Laporan</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.secondaryButton, !onExportPdfReport ? styles.disabledButton : null]}
                    onPress={() => onExportPdfReport?.(closing?.date || date)}
                    disabled={!onExportPdfReport}
                  >
                    <Text style={styles.secondaryButtonText}>Export PDF</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.finalReportGrid}>
                <SummaryCard label="Cash Seharusnya" value={summary.cash_validation?.expected_cash || 0} />
                <SummaryCard label="Cash Fisik" value={summary.cash_validation?.data?.physical_cash || summary.cash_validation?.expected_cash || 0} />
                <SummaryCard label="Selisih Cash" value={summary.cash_validation?.data?.difference || 0} warning={Math.abs(Number(summary.cash_validation?.data?.difference || 0)) > 0} />
                <SummaryCard label="Modal Kasir" value={openingCash} />
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Keuangan Balance</Text>
            <Text style={styles.meta}>QRIS dan bank dibaca sistem dari transaksi. Cash mengikuti validasi pecahan uang. Piutang ditarik dari invoice aktif yang punya jatuh tempo.</Text>
            <View style={styles.financeGrid}>
              {['qris', 'bank', 'cash', 'receivable'].map((key) => {
                const item = financeBalance[key] || {};
                const danger = ['needs_cash_validation', 'overdue_attention'].includes(String(item.status || ''));
                return (
                  <View key={`finance-${key}`} style={[styles.financeCard, danger ? styles.financeCardWarning : null]}>
                    <Text style={styles.financeLabel}>{item.label || key}</Text>
                    <Text style={styles.financeValue}>{formatRupiah(item.amount || 0)}</Text>
                    <Text style={[styles.financeStatus, danger ? styles.badText : styles.goodText]}>{financeStatusLabel(item.status)}</Text>
                    <Text style={styles.meta}>{item.source || '-'}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {cashDifferenceSummary?.has_difference ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ringkasan Selisih Cash</Text>
              <Text style={styles.meta}>
                Selisih lebih {formatRupiah(cashDifferenceSummary.surplus_total || 0)} | Selisih kurang {formatRupiah(cashDifferenceSummary.shortage_total || 0)} | Net {formatRupiah(cashDifferenceSummary.net_difference || 0)}
              </Text>
              {cashDifferenceRows.map((row, index) => (
                <View key={`cash-diff-summary-${row.id || index}`} style={styles.issueCard}>
                  <Text style={styles.issueTitle}>{cashDifferenceLabel(row)} {row.cashier_name || '-'} - {formatRupiah(row.amount || Math.abs(Number(row.difference || 0)))}</Text>
                  <Text style={styles.meta}>Keputusan: {row.decision_label || cashDecisionLabel(row.decision_status)} | Tujuan: {row.burden_target_label || '-'}</Text>
                  <Text style={styles.meta}>{cashDifferenceTreatmentText(row)}</Text>
                  {row.surplus_allocation_note ? <Text style={styles.meta}>Catatan alokasi: {row.surplus_allocation_note}</Text> : null}
                  {row.reason ? <Text style={styles.meta}>Alasan: {row.reason}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          {blockers.length > 0 || closingValidationReady ? (
            <View style={[styles.blockerCard, closingValidationReady ? styles.blockerCardValid : null]}>
              <Text style={[styles.sectionTitle, closingValidationReady ? styles.sectionTitleValid : null]}>
                {closingValidationReady ? 'Valid Final Closing' : 'Belum Bisa Final Closing'}
              </Text>
              {closingValidationReady ? (
                <Text style={[styles.blockerText, styles.blockerTextValid]}>- Checklist pengecekan kasir valid.</Text>
              ) : (
                blockers.map((row) => (
                  <Text key={row.code} style={styles.blockerText}>- {row.message}</Text>
                ))
              )}
            </View>
          ) : null}

          <View style={styles.twoColumns}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Validasi Cash</Text>
              <Text style={styles.meta}>Modal kasir dari management: {formatRupiah(openingCash)} | Pergerakan cash transaksi: {formatRupiah(expectedMovement)}</Text>
              <View style={styles.cashMovementBox}>
                <View style={styles.cashMovementRow}>
                  <Text style={styles.meta}>Modal kasir untuk uang kembali</Text>
                  <Text style={styles.cashMovementValue}>{formatRupiah(openingCash)}</Text>
                </View>
                <View style={styles.cashMovementRow}>
                  <Text style={styles.meta}>Cash masuk laporan</Text>
                  <Text style={styles.cashMovementValue}>{formatRupiah((summary?.payments?.cash_total || 0) + cashIncomeTotal)}</Text>
                </View>
                {cashExpenseTotal > 0 ? (
                  <View style={styles.cashMovementRow}>
                    <Text style={styles.meta}>Pengeluaran metode cash</Text>
                    <Text style={[styles.cashMovementValue, styles.badText]}>- {formatRupiah(cashExpenseTotal)}</Text>
                  </View>
                ) : null}
                <View style={styles.cashMovementRow}>
                  <Text style={styles.issueTitle}>Cash seharusnya termasuk modal kasir</Text>
                  <Text style={[styles.cashMovementValue, styles.goodText]}>{formatRupiah(expectedCashPreview)}</Text>
                </View>
              </View>
              {isCashValidationRejected ? (
                <View style={styles.rejectedNotice}>
                  <Text style={styles.rejectedNoticeTitle}>Validasi cash ditolak reviewer</Text>
                  <Text style={styles.meta}>Catatan reviewer: {existingCash?.decision_note || '-'}</Text>
                  <Text style={styles.meta}>Kasir harus hitung ulang pecahan / cash fisik lalu simpan validasi cash baru.</Text>
                </View>
              ) : null}
              <View style={styles.cashBreakdownBox}>
                <View style={styles.cashBreakdownHeader}>
                  <Text style={styles.cashBreakdownTitle}>Validasi Cash</Text>
                  <Text style={styles.cashBreakdownTotal}>{formatRupiah(cashBreakdownTotal)}</Text>
                </View>
                <View style={styles.cashValidationLayout}>
                  <View style={styles.cashBreakdownTable}>
                    <View style={[styles.cashBreakdownTableRow, styles.cashBreakdownTableHeader]}>
                      <Text style={[styles.cashBreakdownTableHeadText, styles.cashDenominationCell]}>Jenis Uang</Text>
                      <Text style={[styles.cashBreakdownTableHeadText, styles.cashQtyCell]}>Jumlah Lembar / Keping</Text>
                      <Text style={[styles.cashBreakdownTableHeadText, styles.cashTotalCell]}>Total</Text>
                    </View>
                    {CASH_DENOMINATIONS.map((denomination) => {
                      const qty = cashBreakdown[String(denomination)] || '';
                      const subtotal = denomination * (Number(qty || 0) || 0);
                      return (
                        <View key={`cash-denomination-${denomination}`} style={styles.cashBreakdownTableRow}>
                          <Text style={[styles.cashDenominationLabel, styles.cashDenominationCell]}>{formatRupiah(denomination)}</Text>
                          <View style={[styles.cashQtyCell, styles.cashQtyCellWrap]}>
                            <TextInput
                              value={qty}
                              onChangeText={(value) => updateCashBreakdownQty(denomination, value)}
                              style={styles.cashQtyInput}
                              placeholder="0"
                              keyboardType="numeric"
                              editable={!isLocked}
                            />
                          </View>
                          <Text style={[styles.cashSubtotalText, styles.cashTotalCell]}>{formatRupiah(subtotal)}</Text>
                        </View>
                      );
                    })}
                    <View style={[styles.cashBreakdownTableRow, styles.cashBreakdownTotalRow]}>
                      <Text style={[styles.cashBreakdownTotalLabel, styles.cashDenominationCell]}>TOTAL</Text>
                      <Text style={[styles.cashBreakdownTotalQtyValue, styles.cashQtyCell]}>{cashBreakdownQtyTotal}</Text>
                      <Text style={[styles.cashBreakdownTotalValue, styles.cashTotalCell]}>{formatRupiah(cashBreakdownTotal)}</Text>
                    </View>
                  </View>
                  <View style={styles.cashValidationSummaryCard}>
                    <Text style={styles.cashValidationSummaryLabel}>Total Cash Fisik</Text>
                    <Text style={styles.cashValidationSummaryValue}>{formatRupiah(physicalCashValue || cashBreakdownTotal)}</Text>
                    <View style={styles.cashValidationSummaryDivider} />
                    <Text style={styles.cashValidationSummaryLabel}>Total Sistem</Text>
                    <Text style={styles.cashValidationSummaryValue}>{formatRupiah(expectedCashPreview)}</Text>
                    <View style={styles.cashValidationSummaryDivider} />
                    <Text style={[styles.cashValidationSummaryLabel, cashDifferencePreview === 0 ? styles.goodText : styles.badText]}>
                      {cashDifferencePreview > 0 ? 'Selisih (Uang Lebih)' : cashDifferencePreview < 0 ? 'Selisih (Uang Kurang)' : 'Selisih'}
                    </Text>
                    <Text style={[styles.cashValidationSummaryValue, cashDifferencePreview === 0 ? styles.goodText : styles.badText]}>
                      {formatRupiah(cashDifferencePreview)}
                    </Text>
                  </View>
                </View>
              </View>
              <TextInput value={physicalCash} onChangeText={(value) => setPhysicalCash(sanitizeAmount(value))} style={styles.input} placeholder="Cash fisik saat closing" editable={!isLocked} />
              <Text style={styles.meta}>Cash fisik otomatis mengikuti total pecahan. Input manual tetap bisa dipakai jika ada nominal lain.</Text>
              <Text style={styles.meta}>Cash seharusnya: modal {formatRupiah(openingCash)} + pergerakan transaksi {formatRupiah(expectedMovement)} = {formatRupiah(expectedCashPreview)}</Text>
              <Text style={[styles.cashDiff, cashDifferencePreview === 0 ? styles.goodText : styles.badText]}>
                Selisih: {formatRupiah(cashDifferencePreview)}
              </Text>
              {cashDifferenceIsSurplus ? (
                <View style={styles.allocationBox}>
                  <Text style={styles.issueTitle}>Jika ada uang lebih, alokasikan ke:</Text>
                  <Text style={styles.meta}>Uang lebih tidak membutuhkan approval. Pilih tujuan alokasi agar validasi otomatis menjadi valid.</Text>
                  <View style={styles.wrapRow}>
                    {surplusAllocationOptions.map(([value, label]) => (
                      <Pressable
                        key={`surplus-allocation-${value}`}
                        style={[styles.allocationChoice, surplusAllocationType === value && styles.allocationChoiceActive]}
                        onPress={() => setSurplusAllocationType(value)}
                        disabled={isLocked}
                      >
                        <Text style={[styles.allocationChoiceText, surplusAllocationType === value && styles.allocationChoiceTextActive]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={surplusAllocationNote}
                    onChangeText={setSurplusAllocationNote}
                    style={[styles.input, styles.multiline]}
                    multiline
                    placeholder="Catatan alokasi uang lebih (opsional)"
                    editable={!isLocked}
                  />
                  <Text style={styles.meta}>Alokasi dipilih: {surplusAllocationLabel(surplusAllocationType)}</Text>
                </View>
              ) : null}
              {cashDifferenceIsShortage ? (
                <View style={styles.shortageBox}>
                  <Text style={styles.issueTitle}>Uang kurang membutuhkan approval reviewer</Text>
                  <Text style={styles.meta}>Lengkapi alasan, penanggung jawab, dan bukti sebelum dikirim ke antrean review.</Text>
                  <TextInput value={cashReason} onChangeText={setCashReason} style={[styles.input, styles.multiline]} multiline placeholder="Alasan selisih" editable={!isLocked} />
                  <ScrollView horizontal contentContainerStyle={styles.picRow}>
                    {userOptions.map((row) => (
                      <Pressable key={`cash-pic-${row.id}`} style={[styles.choice, Number(responsibleUserId) === Number(row.id) && styles.choiceActive]} onPress={() => setResponsibleUserId(row.id)} disabled={isLocked}>
                        <Text style={styles.choiceText}>{row.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  {!isLocked ? (
                    <Pressable style={styles.secondaryButton} onPress={selectCashEvidence}>
                      <Text style={styles.secondaryButtonText}>{cashEvidence?.name || existingCash?.evidence_path ? 'Bukti Dipilih' : 'Upload Bukti Selisih'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              {!isLocked ? (
                <Pressable style={styles.primaryButton} onPress={saveCashValidation} disabled={submitting}>
                  <Text style={styles.primaryButtonText}>Simpan Validasi Cash</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Validasi Otomatis Closing</Text>
              <Text style={styles.meta}>Status valid/tidak valid dihitung sistem dari nota, cash, draft/piutang, pengeluaran, dan pembelian.</Text>
              <View style={styles.validationReferenceTable}>
                <View style={[styles.validationReferenceRow, styles.validationReferenceHeader]}>
                  <Text style={[styles.validationReferenceHeadText, styles.validationReferenceNoCell]}>No</Text>
                  <Text style={[styles.validationReferenceHeadText, styles.validationReferenceNameCell]}>Validasi</Text>
                  <Text style={[styles.validationReferenceHeadText, styles.validationReferenceStatusCell]}>Status</Text>
                  <Text style={[styles.validationReferenceHeadText, styles.validationReferenceReasonCell]}>Keterangan Sistem</Text>
                </View>
                {validationRows.map((row) => (
                  <View key={`closing-validation-row-${row.no}`} style={[
                    styles.validationReferenceRow,
                    row.isValid ? styles.validationReferenceRowValid : styles.validationReferenceRowInvalid,
                  ]}>
                    <Text style={[styles.validationReferenceText, styles.validationReferenceNoCell]}>{row.no}</Text>
                    <Text style={[styles.validationReferenceTitle, styles.validationReferenceNameCell]}>{row.title}</Text>
                    <View style={styles.validationReferenceStatusCell}>
                      <View style={[styles.validationStatusBadge, row.isValid ? styles.validationStatusBadgeValid : styles.validationStatusBadgeInvalid]}>
                        <Text style={[styles.validationStatusBadgeText, row.isValid ? styles.validationStatusBadgeTextValid : styles.validationStatusBadgeTextInvalid]}>
                          {row.statusLabel}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.validationReferenceText, styles.validationReferenceReasonCell]}>{row.reason}</Text>
                  </View>
                ))}
              </View>
              {isLocked ? (
                <View style={styles.lockedClosingNotice}>
                  <Text style={styles.lockedClosingNoticeText}>Closing tanggal ini sudah dikunci. Buka tanggal baru untuk menjalankan closing berikutnya.</Text>
                </View>
              ) : null}
            </View>
          </View>

          {differenceValidations.length > 0 ? (
            <View style={[styles.card, highlightCashReview ? styles.reviewCardActive : null]}>
              <Text style={styles.sectionTitle}>Review Selisih Cash</Text>
              <Text style={styles.meta}>Keputusan reviewer diperlukan sebelum closing dapat dikunci.</Text>
              {differenceValidations.map((validation) => (
                <View key={`cash-review-${validation.id}`} style={styles.issueCard}>
                  <Text style={styles.issueTitle}>{validation.cashier_name} - Selisih {formatRupiah(validation.difference)}</Text>
                  <Text style={styles.meta}>Alasan: {validation.reason || '-'} | Penanggung jawab: {validation.responsible_user_name || '-'}</Text>
                  <Text style={styles.meta}>Status keputusan: {cashDecisionLabel(validation.decision_status)} {validation.has_evidence ? '| Bukti tersedia' : '| Bukti belum tersedia'}</Text>
                  {canReview && !isLocked ? (
                    <>
                      <TextInput value={cashDecisionNotes[validation.id] || ''} onChangeText={(value) => setCashDecisionNotes((current) => ({ ...current, [validation.id]: value }))} style={[styles.input, styles.multiline]} placeholder="Catatan keputusan reviewer" multiline />
                      <View style={styles.wrapRow}>
                        {cashDecisions.map(([value, label]) => (
                          <Pressable key={`${validation.id}-${value}`} style={styles.secondaryButton} onPress={() => saveCashDecision(validation, value)} disabled={submitting}>
                            <Text style={styles.secondaryButtonText}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {(missingExpenses.length > 0 || missingPurchases.length > 0) ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Bukti Yang Kurang</Text>
              {missingExpenses.map((row) => (
                <EvidenceRow key={`expense-${row.id}`} label={`Pengeluaran ${row.transaction_no} - ${row.category}`} value={row.amount} loading={uploadingKey === `expense-${row.id}`} onUpload={() => uploadEvidence('expense', row)} disabled={isLocked} />
              ))}
              {missingPurchases.map((row) => (
                <EvidenceRow key={`purchase-${row.id}`} label={`Pembelian ${row.request_no} - ${row.category}`} value={row.amount} loading={uploadingKey === `purchase-${row.id}`} onUpload={() => uploadEvidence('purchase', row)} disabled={isLocked} />
              ))}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Piutang Customer & Reminder</Text>
            <Text style={styles.meta}>Muncul di remittance agar kasir melihat piutang hari ini, 3 hari ke depan, dan yang sudah terlambat sebelum closing.</Text>
            <View style={styles.financeGrid}>
              {receivableBuckets.map(([key, label]) => {
                const bucket = receivables[key] || {};
                const danger = String(key).startsWith('overdue') || key === 'without_due_date';
                return (
                  <View key={`receivable-bucket-${key}`} style={[styles.financeCard, danger && Number(bucket.total || 0) > 0 ? styles.financeCardWarning : null]}>
                    <Text style={styles.financeLabel}>{label}</Text>
                    <Text style={styles.financeValue}>{formatRupiah(bucket.total || 0)}</Text>
                    <Text style={styles.meta}>{bucket.count || 0} invoice</Text>
                  </View>
                );
              })}
            </View>
            {Array.isArray(receivables?.overdue?.items) && receivables.overdue.items.length > 0 ? (
              <View style={styles.receivableList}>
                <Text style={styles.issueTitle}>Piutang Terlambat yang Perlu Dipush</Text>
                {receivables.overdue.items.slice(0, 6).map((row) => (
                  <Text key={`overdue-${row.invoice_id}`} style={styles.meta}>
                    {row.invoice_no} | {row.customer_name} | {formatRupiah(row.due_total)} | Tempo {row.due_at || '-'} | Kasir {row.cashier_name || '-'}
                  </Text>
                ))}
              </View>
            ) : null}
            {cashierReceivableRisks.length > 0 ? (
              <View style={styles.receivableRiskBox}>
                <Text style={styles.issueTitle}>Alarm Tanggung Jawab Kasir</Text>
                {receivableGuard?.message ? (
                  <Text style={styles.meta}>{receivableGuard.message}</Text>
                ) : null}
                {cashierReceivableRisks.slice(0, 6).map((row) => (
                  <View key={`cashier-risk-${row.cashier_id || row.cashier_name}`} style={styles.receivableRiskCard}>
                    <View style={styles.receivableRiskHeader}>
                      <Text style={styles.receivableRiskName}>{row.cashier_name || 'Kasir belum tercatat'}</Text>
                      <Text style={[styles.receivableRiskStage, { color: receivableRiskTone(row.severity) }]}>{row.recommended_label || '-'}</Text>
                    </View>
                    <Text style={styles.meta}>
                      {row.overdue_count || 0} invoice | {formatRupiah(row.overdue_total || 0)} | telat paling lama {row.max_overdue_days || 0} hari
                    </Text>
                    <Text style={styles.receivableRiskAction}>{row.recommended_action || '-'}</Text>
                    <Text style={styles.meta}>Mode aman: akun tetap bisa transaksi sampai ada approval peralihan tanggung jawab di modul leader/HRD.</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {openOrders.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Follow-up Draft / Piutang Overdue</Text>
              <Text style={styles.meta}>{incompleteOpenOrders.length} dari {openOrders.length} item belum memiliki alasan, aksi, penanggung jawab, dan follow-up lengkap.</Text>
              {!isLocked && incompleteOpenOrders.length > 1 ? (
                <View style={styles.bulkCard}>
                  <Text style={styles.issueTitle}>Isi Bersama untuk Item Belum Lengkap</Text>
                  <Text style={styles.meta}>Gunakan bila alasan dan tindak lanjut memang sama. Status transaksi tidak diubah dan aksi ini tetap masuk audit log.</Text>
                  <TextInput value={bulkOrderReason} onChangeText={setBulkOrderReason} style={styles.input} placeholder="Alasan bersama draft/piutang" />
                  <ScrollView horizontal contentContainerStyle={styles.picRow}>
                    {userOptions.map((row) => (
                      <Pressable key={`bulk-issue-pic-${row.id}`} style={[styles.choice, Number(bulkOrderPicUserId) === Number(row.id) && styles.choiceActive]} onPress={() => setBulkOrderPicUserId(row.id)}>
                        <Text style={styles.choiceText}>{row.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <TextInput value={bulkOrderFollowUp} onChangeText={setBulkOrderFollowUp} style={[styles.input, styles.multiline]} placeholder="Follow-up bersama" multiline />
                  <Pressable style={styles.primaryButton} onPress={saveBulkOrderIssues} disabled={submitting}>
                    <Text style={styles.primaryButtonText}>Terapkan ke {incompleteOpenOrders.length} Item Belum Lengkap</Text>
                  </Pressable>
                </View>
              ) : null}
              {openOrders.map((issue) => {
                const draft = orderDrafts[issue.id] || {};
                return (
                  <View key={`issue-${issue.id}`} style={styles.issueCard}>
                    <Text style={styles.issueTitle}>{issue.invoice_no} - {issue.customer_name}</Text>
                    <Text style={styles.meta}>{issue.issue_type} | Status: {issue.order_status}</Text>
                    <Text style={styles.meta}>Aksi saat ini: {orderActionLabel(draft.action_type || issue.action_type)} {issue.escalation_role ? `| Eskalasi: ${issue.escalation_role}` : ''}</Text>
                    <TextInput value={draft.reason || ''} onChangeText={(value) => updateOrderDraft(issue.id, 'reason', value)} style={styles.input} placeholder="Reason draft/piutang overdue" editable={!isLocked} />
                    <View style={styles.wrapRow}>
                      {orderActionOptions.map(([value, label]) => (
                        <Pressable
                          key={`issue-${issue.id}-action-${value}`}
                          style={[styles.choice, (draft.action_type || 'push_same_cashier') === value && styles.choiceActive]}
                          onPress={() => {
                            updateOrderDraft(issue.id, 'action_type', value);
                            if (value === 'push_same_cashier') {
                              updateOrderDraft(issue.id, 'pic_user_id', currentUser?.id || null);
                            }
                            if (value !== 'push_other_cashier') {
                              updateOrderDraft(issue.id, 'escalation_role', value.replace(/^push_/, ''));
                            }
                          }}
                          disabled={isLocked}
                        >
                          <Text style={styles.choiceText}>{label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {(draft.action_type || 'push_same_cashier') === 'push_other_cashier' ? (
                      <Text style={styles.meta}>Pilih user kasir tujuan:</Text>
                    ) : null}
                    <ScrollView horizontal contentContainerStyle={styles.picRow}>
                      {userOptions.map((row) => (
                        <Pressable key={`issue-${issue.id}-pic-${row.id}`} style={[styles.choice, Number(draft.pic_user_id) === Number(row.id) && styles.choiceActive]} onPress={() => updateOrderDraft(issue.id, 'pic_user_id', row.id)} disabled={isLocked}>
                          <Text style={styles.choiceText}>{row.name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <TextInput value={draft.follow_up || ''} onChangeText={(value) => updateOrderDraft(issue.id, 'follow_up', value)} style={[styles.input, styles.multiline]} placeholder="Follow-up berikutnya" multiline editable={!isLocked} />
                    {!isLocked ? (
                      <Pressable style={styles.secondaryButton} onPress={() => saveOrderIssue(issue)}>
                        <Text style={styles.secondaryButtonText}>Simpan Follow-up</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {isLocked ? (
            <>
              <View style={styles.twoColumns}>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Buat Case Koreksi</Text>
                  <ScrollView horizontal contentContainerStyle={styles.picRow}>
                    {correctionTypes.map(([value, label]) => (
                      <Pressable key={value} style={[styles.choice, correctionType === value && styles.choiceActive]} onPress={() => setCorrectionType(value)}>
                        <Text style={styles.choiceText}>{label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <TextInput value={correctionAmount} onChangeText={(value) => setCorrectionAmount(sanitizeAmount(value))} style={styles.input} placeholder="Nominal koreksi, isi 0 jika non-finansial" />
                  <TextInput value={correctionDescription} onChangeText={setCorrectionDescription} style={[styles.input, styles.multiline]} placeholder="Uraian masalah / klarifikasi" multiline />
                  <Text style={styles.meta}>User atau tim terkait (opsional)</Text>
                  <ScrollView horizontal contentContainerStyle={styles.picRow}>
                    {userOptions.map((row) => (
                      <Pressable key={`correction-user-${row.id}`} style={[styles.choice, Number(correctionRelatedUserId) === Number(row.id) && styles.choiceActive]} onPress={() => setCorrectionRelatedUserId(row.id)}>
                        <Text style={styles.choiceText}>{row.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Pressable style={styles.secondaryButton} onPress={selectCorrectionEvidence}>
                    <Text style={styles.secondaryButtonText}>{correctionEvidence?.name ? 'Bukti Dipilih' : 'Upload Bukti Tambahan'}</Text>
                  </Pressable>
                  <Pressable style={styles.primaryButton} onPress={submitCorrection} disabled={submitting}>
                    <Text style={styles.primaryButtonText}>Kirim Koreksi</Text>
                  </Pressable>
                </View>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Riwayat Koreksi</Text>
                  {corrections.length === 0 ? <Text style={styles.meta}>Belum ada case koreksi untuk closing ini.</Text> : null}
                  {corrections.map((correction) => {
                    const draft = correctionDrafts[correction.id] || {};
                    return (
                      <View key={`correction-${correction.id}`} style={styles.issueCard}>
                        <Text style={styles.issueTitle}>{correctionTypeLabel(correction.issue_type)} - {formatRupiah(correction.amount)}</Text>
                        <Text style={styles.meta}>{correction.description}</Text>
                        <Text style={styles.meta}>Status: {correctionDecisionLabel(correction.decision)} | Pembuat: {correction.created_by_name || '-'}</Text>
                        {canReview && correction.decision === 'pending_review' ? (
                          <>
                            <View style={styles.wrapRow}>
                              {correctionDecisions.map(([value, label]) => (
                                <Pressable key={`${correction.id}-${value}`} style={[styles.choice, draft.decision === value && styles.choiceActive]} onPress={() => updateCorrectionDraft(correction.id, 'decision', value)}>
                                  <Text style={styles.choiceText}>{label}</Text>
                                </Pressable>
                              ))}
                            </View>
                            {draft.decision === 'carry_forward' ? (
                              <TextInput value={draft.carry_forward_date || ''} onChangeText={(value) => updateCorrectionDraft(correction.id, 'carry_forward_date', value)} style={styles.input} placeholder="Tanggal koreksi berikutnya (YYYY-MM-DD)" />
                            ) : null}
                            <TextInput value={draft.decision_note || ''} onChangeText={(value) => updateCorrectionDraft(correction.id, 'decision_note', value)} style={[styles.input, styles.multiline]} placeholder="Catatan keputusan" multiline />
                            <Pressable style={styles.primaryButton} onPress={() => saveCorrectionDecision(correction)} disabled={submitting}>
                              <Text style={styles.primaryButtonText}>Simpan Keputusan</Text>
                            </Pressable>
                          </>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
              {auditEvents.length > 0 ? (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Audit Terakhir</Text>
                  {auditEvents.slice(0, 8).map((event) => (
                    <Text key={`audit-${event.id}`} style={styles.meta}>{event.created_at || '-'} | {event.actor_name} | {event.event_type}</Text>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <Text style={styles.subtitle}>Pilih tanggal untuk membuka dashboard closing.</Text>
      )}

      {finalizeModal}
    </View>
  );
};

const SummaryCard = ({ label, value, warning = false }) => (
  <View style={[styles.summaryCard, warning && styles.summaryWarning]}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{formatRupiah(value || 0)}</Text>
  </View>
);

const EvidenceRow = ({ label, value, loading, onUpload, disabled }) => (
  <View style={styles.evidenceRow}>
    <View style={styles.flex}>
      <Text style={styles.issueTitle}>{label}</Text>
      <Text style={styles.meta}>{formatRupiah(value || 0)}</Text>
    </View>
    {!disabled ? (
      <Pressable style={styles.secondaryButton} onPress={onUpload}>
        <Text style={styles.secondaryButtonText}>{loading ? 'Mengupload...' : 'Upload'}</Text>
      </Pressable>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  finalizeOnlyMount: { width: 1, height: 1 },
  finalizeOnlyCardMount: { width: '100%', maxWidth: 520, alignItems: 'center' },
  panel: { gap: 14, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#c8d8f2', backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 },
  title: { fontSize: 21, fontWeight: '900', color: '#173c87' },
  subtitle: { fontSize: 12, lineHeight: 18, color: '#667897', maxWidth: 660 },
  status: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  statusReady: { backgroundColor: '#e1f2d6' },
  statusSafe: { backgroundColor: '#1d6c43' },
  statusCorrection: { backgroundColor: '#f3dcae' },
  statusBlocked: { backgroundColor: '#ffe5cf' },
  statusText: { fontSize: 12, fontWeight: '900', color: '#173c87' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  dateInput: { borderWidth: 1, borderColor: '#d4dcea', backgroundColor: '#fbfdff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, minWidth: 130 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { flexGrow: 1, minWidth: 145, padding: 12, borderRadius: 14, backgroundColor: '#f1f6ff', borderWidth: 1, borderColor: '#c8d8f2' },
  summaryWarning: { backgroundColor: '#fff2df', borderColor: '#edd2a7' },
  summaryLabel: { fontSize: 11, fontWeight: '800', color: '#435674' },
  summaryValue: { marginTop: 6, fontSize: 17, fontWeight: '900', color: '#173c87' },
  finalReportCard: { borderWidth: 1, borderColor: '#9bbf9d', backgroundColor: '#edf7ee', borderRadius: 16, padding: 14, gap: 12 },
  finalReportHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  finalReportEyebrow: { color: '#166534', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  finalReportTitle: { color: '#173c2a', fontSize: 18, fontWeight: '900', marginTop: 3 },
  finalReportMeta: { color: '#43614c', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 4 },
  finalReportActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'flex-end' },
  finalReportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  financeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  financeCard: { flexGrow: 1, flexBasis: 180, borderWidth: 1, borderColor: '#dce5f4', backgroundColor: '#f8fbff', borderRadius: 12, padding: 10, gap: 4 },
  financeCardWarning: { borderColor: '#efce9c', backgroundColor: '#fff7eb' },
  financeLabel: { color: '#435674', fontSize: 11, fontWeight: '900' },
  financeValue: { color: '#173c87', fontSize: 16, fontWeight: '900' },
  financeStatus: { fontSize: 10, fontWeight: '900' },
  receivableList: { borderWidth: 1, borderColor: '#ead7bd', backgroundColor: '#fffaf2', borderRadius: 12, padding: 10, gap: 4 },
  receivableRiskBox: { borderWidth: 1, borderColor: '#f0c7b8', backgroundColor: '#fff7f3', borderRadius: 12, padding: 10, gap: 8 },
  receivableRiskCard: { borderWidth: 1, borderColor: '#f2d0c4', backgroundColor: '#fffefd', borderRadius: 10, padding: 10, gap: 4 },
  receivableRiskHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  receivableRiskName: { color: '#173c87', fontSize: 12, fontWeight: '900' },
  receivableRiskStage: { fontSize: 11, fontWeight: '900' },
  receivableRiskAction: { color: '#6b2f18', fontSize: 11, lineHeight: 16, fontWeight: '800' },
  blockerCard: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#f4b88b', backgroundColor: '#fff0e4', gap: 5 },
  blockerCardValid: { borderColor: '#9bd2a8', backgroundColor: '#f4fbf6' },
  blockerText: { fontSize: 12, lineHeight: 17, color: '#8a3d16', fontWeight: '700' },
  blockerTextValid: { color: '#166534' },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexGrow: 1, minWidth: 300, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#dce5f4', backgroundColor: '#fff', gap: 9 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#173c87' },
  sectionTitleValid: { color: '#166534' },
  meta: { fontSize: 11, lineHeight: 16, color: '#667897' },
  input: { borderWidth: 1, borderColor: '#d4dcea', backgroundColor: '#fbfdff', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, fontSize: 12, color: '#14233d' },
  multiline: { minHeight: 54, textAlignVertical: 'top' },
  cashBreakdownBox: { borderWidth: 1, borderColor: '#dce5f4', backgroundColor: '#f8fbff', borderRadius: 12, padding: 10, gap: 10 },
  cashBreakdownHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cashBreakdownTitle: { fontSize: 12, fontWeight: '900', color: '#173c87' },
  cashBreakdownTotal: { fontSize: 13, fontWeight: '900', color: '#1d6c43' },
  cashValidationLayout: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' },
  cashBreakdownTable: { flex: 1, flexBasis: 620, minWidth: 520, borderWidth: 1, borderColor: '#d8e1ef', backgroundColor: '#ffffff', borderRadius: 10, overflow: 'hidden' },
  cashBreakdownTableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#edf1f7', minHeight: 38 },
  cashBreakdownTableHeader: { backgroundColor: '#f2f6fc' },
  cashBreakdownTableHeadText: { color: '#34405f', fontSize: 10, fontWeight: '900', textAlign: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  cashDenominationCell: { flex: 1.05, minWidth: 132 },
  cashQtyCell: { flex: 0.9, minWidth: 136 },
  cashTotalCell: { flex: 1.1, minWidth: 142 },
  cashQtyCellWrap: { alignItems: 'center', justifyContent: 'center' },
  cashDenominationLabel: { fontSize: 11, color: '#243957', fontWeight: '800', paddingHorizontal: 12 },
  cashQtyInput: { width: '82%', maxWidth: 180, minWidth: 96, borderWidth: 1, borderColor: '#d4dcea', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, marginHorizontal: 10, fontSize: 12, color: '#14233d', textAlign: 'center' },
  cashSubtotalText: { textAlign: 'right', fontSize: 11, color: '#435674', fontWeight: '800', paddingHorizontal: 12 },
  cashBreakdownTotalRow: { backgroundColor: '#f6f9ff', borderBottomWidth: 0 },
  cashBreakdownTotalLabel: { color: '#173c87', fontSize: 11, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 9 },
  cashBreakdownTotalQtyValue: { color: '#0755b8', fontSize: 12, fontWeight: '900', textAlign: 'center', paddingHorizontal: 8, paddingVertical: 9 },
  cashBreakdownTotalValue: { color: '#0755b8', fontSize: 12, fontWeight: '900', textAlign: 'right', paddingHorizontal: 12, paddingVertical: 9 },
  cashValidationSummaryCard: { width: 230, borderWidth: 1, borderColor: '#d8e1ef', backgroundColor: '#ffffff', borderRadius: 12, padding: 13, gap: 6 },
  cashValidationSummaryLabel: { color: '#667897', fontSize: 11, fontWeight: '900' },
  cashValidationSummaryValue: { color: '#173c87', fontSize: 16, fontWeight: '900' },
  cashValidationSummaryDivider: { height: 1, backgroundColor: '#e6edf7', marginVertical: 4 },
  cashDiff: { fontSize: 13, fontWeight: '900' },
  cashMovementBox: { borderWidth: 1, borderColor: '#dce5f4', backgroundColor: '#fbfdff', borderRadius: 12, padding: 10, gap: 6 },
  cashMovementRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' },
  cashMovementValue: { fontSize: 12, fontWeight: '900', color: '#173c87' },
  allocationBox: { borderWidth: 1, borderColor: '#9bd2a8', backgroundColor: '#f4fbf6', borderRadius: 12, padding: 11, gap: 8 },
  allocationChoice: { borderRadius: 10, borderWidth: 1, borderColor: '#b6d7bf', backgroundColor: '#ffffff', paddingHorizontal: 11, paddingVertical: 8 },
  allocationChoiceActive: { borderColor: '#1d6c43', backgroundColor: '#e7f7eb' },
  allocationChoiceText: { fontSize: 11, fontWeight: '900', color: '#35624a' },
  allocationChoiceTextActive: { color: '#166534' },
  shortageBox: { borderWidth: 1, borderColor: '#efce9c', backgroundColor: '#fff7eb', borderRadius: 12, padding: 11, gap: 8 },
  rejectedNotice: { borderWidth: 1, borderColor: '#efb3a0', backgroundColor: '#fff4f0', borderRadius: 12, padding: 10, gap: 4 },
  rejectedNoticeTitle: { fontSize: 12, fontWeight: '900', color: '#9f3318' },
  goodText: { color: '#1d6c43' },
  badText: { color: '#aa4a1d' },
  primaryButton: { backgroundColor: '#0755b8', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#b9c8e1', backgroundColor: '#f5f9ff', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#174a8c', fontSize: 11, fontWeight: '900' },
  picRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { borderRadius: 999, borderWidth: 1, borderColor: '#d4dcea', paddingHorizontal: 10, paddingVertical: 6 },
  choiceActive: { borderColor: '#0755b8', backgroundColor: '#eef4ff' },
  choiceText: { fontSize: 10, fontWeight: '800', color: '#174a8c' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: '#b9c8e1', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#0755b8', borderColor: '#0755b8' },
  checkboxText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  checkTextWrap: { flex: 1 },
  checkLabel: { fontSize: 12, fontWeight: '800', color: '#173c87' },
  finalButton: { marginTop: 7, backgroundColor: '#043f92', paddingVertical: 12, borderRadius: 11, alignItems: 'center' },
  reviewButton: { backgroundColor: '#b45309' },
  finalButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  lockedClosingNotice: { marginTop: 7, borderWidth: 1, borderColor: '#b8d6bd', backgroundColor: '#f4fbf6', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10 },
  lockedClosingNoticeText: { color: '#166534', fontSize: 11, fontWeight: '800', lineHeight: 16, textAlign: 'center' },
  disabledButton: { opacity: 0.45 },
  issueCard: { padding: 11, borderRadius: 11, borderWidth: 1, borderColor: '#e1e6df', backgroundColor: '#fafbf8', gap: 7 },
  reviewCardActive: { borderColor: '#d97706', backgroundColor: '#fff7ed' },
  bulkCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#b9cfb8', backgroundColor: '#f1f7ee', gap: 8 },
  issueTitle: { fontSize: 12, color: '#263d30', fontWeight: '900' },
  validationReferenceTable: { borderWidth: 1, borderColor: '#d8e1ef', borderRadius: 10, overflow: 'hidden', backgroundColor: '#ffffff' },
  validationReferenceRow: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: '#e8edf5', minHeight: 48 },
  validationReferenceRowValid: { backgroundColor: '#f4fbf6' },
  validationReferenceRowInvalid: { backgroundColor: '#fff5f5' },
  validationReferenceHeader: { backgroundColor: '#f2f6fc', minHeight: 34 },
  validationReferenceHeadText: { color: '#34405f', fontSize: 10, fontWeight: '900', textAlign: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  validationReferenceText: { color: '#34405f', fontSize: 10, lineHeight: 15, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 7 },
  validationReferenceTitle: { color: '#26344d', fontSize: 10, lineHeight: 15, fontWeight: '900', textAlign: 'center', paddingHorizontal: 8, paddingVertical: 7 },
  validationReferenceNoCell: { width: 42, justifyContent: 'center' },
  validationReferenceNameCell: { width: 132, justifyContent: 'center' },
  validationReferenceParamCell: { flex: 1, minWidth: 260, justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: '#e8edf5', borderRightWidth: 1, borderRightColor: '#e8edf5' },
  validationReferenceStatusCell: { width: 104, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#e8edf5', borderRightWidth: 1, borderRightColor: '#e8edf5' },
  validationReferenceReasonCell: { flex: 1, minWidth: 200, justifyContent: 'center' },
  validationStatusBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5 },
  validationStatusBadgeValid: { borderColor: '#9bd2a8', backgroundColor: '#e7f7eb' },
  validationStatusBadgeInvalid: { borderColor: '#f0aaa8', backgroundColor: '#ffe8e7' },
  validationStatusBadgeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  validationStatusBadgeTextValid: { color: '#166534' },
  validationStatusBadgeTextInvalid: { color: '#b42318' },
  evidenceRow: { flexDirection: 'row', gap: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#edf0ea', paddingVertical: 7 },
  finalSnapshot: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#9bbf9d', backgroundColor: '#e6f0e5', gap: 5 },
  finalSnapshotActions: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20, 32, 25, 0.52)', justifyContent: 'center', alignItems: 'center', padding: 18 },
  modalBackdropDismiss: { ...StyleSheet.absoluteFillObject },
  finalizeModalCard: { width: '100%', maxWidth: 470, padding: 20, borderRadius: 22, borderWidth: 1, borderColor: '#d2ddd3', backgroundColor: '#fffefb', shadowColor: '#122419', shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8, gap: 13 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#deeddf', borderWidth: 1, borderColor: '#b2cfb5' },
  modalBadgeText: { fontSize: 10, letterSpacing: 0.7, color: '#1d603d', fontWeight: '900' },
  modalCloseButton: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: '#d5ddd6', backgroundColor: '#f6f8f4' },
  modalCloseButtonText: { color: '#53665c', fontSize: 11, fontWeight: '800' },
  modalTitle: { color: '#172b21', fontSize: 20, fontWeight: '900' },
  modalDescription: { color: '#586b61', fontSize: 12, lineHeight: 18 },
  modalFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalFact: { flexGrow: 1, minWidth: 170, borderRadius: 12, borderWidth: 1, borderColor: '#dae4da', backgroundColor: '#f5f8f3', padding: 11, gap: 5 },
  modalFactLabel: { color: '#65786e', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  modalFactValue: { color: '#1c3629', fontSize: 14, fontWeight: '900' },
  modalWarning: { borderRadius: 12, borderWidth: 1, borderColor: '#efce9c', backgroundColor: '#fff6e8', padding: 12, gap: 5 },
  modalWarningTitle: { color: '#704418', fontSize: 12, fontWeight: '900' },
  modalWarningText: { color: '#815b31', fontSize: 11, lineHeight: 17 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  modalCancelButton: { minWidth: 132, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 11, borderWidth: 1, borderColor: '#cbd6cc', backgroundColor: '#fff', alignItems: 'center' },
  modalCancelButtonText: { color: '#3d5448', fontSize: 12, fontWeight: '900' },
  modalConfirmButton: { minWidth: 176, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 11, backgroundColor: '#173c2a', alignItems: 'center' },
  modalConfirmButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  flex: { flex: 1 },
});

export default ClosingStorePanel;
