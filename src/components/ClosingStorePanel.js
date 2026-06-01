import { useEffect, useMemo, useState } from 'react';
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
];
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
}[value] || value || '-');

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

const ClosingStorePanel = ({ currentUser, isActive, onNotify, onPrintReport }) => {
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

  const closing = payload?.closing || null;
  const summary = payload?.summary || null;
  const workflow = payload?.workflow || {};
  const closingId = Number(closing?.id || 0);
  const existingCash = summary?.cash_validation?.data || null;
  const expectedMovement = Number(summary?.cash_validation?.expected_cash_movement || 0);
  const expectedCashPreview = expectedMovement;
  const cashBreakdownTotal = calculateCashBreakdownTotal(cashBreakdown);
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
  const financeBalance = summary?.finance_balance && typeof summary.finance_balance === 'object' ? summary.finance_balance : {};
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
  const differenceValidations = cashValidations.filter((row) => Math.abs(Number(row?.difference || 0)) > 0);
  const corrections = Array.isArray(workflow?.corrections) ? workflow.corrections : [];
  const auditEvents = Array.isArray(workflow?.audit_events) ? workflow.audit_events : [];
  const canReview = Boolean(workflow?.can_review);
  const isLocked = Boolean(closing?.is_locked);
  const statusTone = closing?.status === 'ada_koreksi'
    ? styles.statusCorrection
    : closing?.status === 'final_closing'
    ? styles.statusSafe
    : (closing?.is_ready ? styles.statusReady : styles.statusBlocked);

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
    } else {
      setPhysicalCash('');
      setCashBreakdown(createEmptyCashBreakdown());
      setCashReason('');
      setResponsibleUserId(null);
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
    if (cashDifferencePreview !== 0 && (!cashReason || !responsibleUserId || !cashEvidence) && !existingCash?.evidence_path) {
      onNotify?.('Validasi Cash', 'Selisih cash membutuhkan alasan, penanggung jawab, dan bukti.');
      return;
    }
    try {
      setSubmitting(true);
      const nextPayload = await saveStoreClosingCashValidation(closingId, {
        physical_cash: physicalCashValue,
        cash_breakdown: buildCashBreakdownPayload(cashBreakdown),
        reason: cashReason,
        responsible_user_id: responsibleUserId,
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
    try {
      setSubmitting(true);
      const nextPayload = await decideStoreClosingCashDifference(closingId, {
        cashier_id: validation.cashier_id,
        decision_status: decisionStatus,
        decision_note: safeText(cashDecisionNotes[validation.id]),
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
      onNotify?.('Order Belum Closing', `Lengkapi ${missingFields.join(', ')} sebelum menyimpan tindak lanjut order.`);
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
      onNotify?.('Order Belum Closing', 'Reason dan follow-up berhasil disimpan.');
    } catch (error) {
      onNotify?.('Order Belum Closing', error.message);
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
      onNotify?.('Order Belum Closing', `Lengkapi ${missingFields.join(', ')} untuk pengisian bersama.`);
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
      onNotify?.('Order Belum Closing', `${nextPayload?.updated_count || 0} order berhasil diberi tindak lanjut.`);
    } catch (error) {
      onNotify?.('Order Belum Closing', error.message);
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
      setIsFinalizeModalVisible(false);
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

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Remittance Harian / Closing Toko</Text>
          <Text style={styles.subtitle}>Syarat closing, checklist kasir, cash fisik, bukti transaksi, piutang, dan order menggantung disatukan dalam satu validasi harian.</Text>
        </View>
        <View style={[styles.status, statusTone]}>
          <Text style={styles.statusText}>{closing?.is_ready && !isLocked ? 'Aman untuk Closing' : statusLabel(closing?.status)}</Text>
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
            <SummaryCard label="Pengeluaran" value={summary.expenses?.total} warning />
            <SummaryCard label="Pembelian" value={summary.purchases?.total} warning />
          </View>

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

          {blockers.length > 0 ? (
            <View style={styles.blockerCard}>
              <Text style={styles.sectionTitle}>Belum Bisa Final Closing</Text>
              {blockers.map((row) => (
                <Text key={row.code} style={styles.blockerText}>- {row.message}</Text>
              ))}
            </View>
          ) : null}

          <View style={styles.twoColumns}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Validasi Cash</Text>
              <Text style={styles.meta}>Pergerakan cash transaksi: {formatRupiah(expectedMovement)}</Text>
              <View style={styles.cashBreakdownBox}>
                <View style={styles.cashBreakdownHeader}>
                  <Text style={styles.cashBreakdownTitle}>Hitung Pecahan Uang</Text>
                  <Text style={styles.cashBreakdownTotal}>{formatRupiah(cashBreakdownTotal)}</Text>
                </View>
                {CASH_DENOMINATIONS.map((denomination) => {
                  const qty = cashBreakdown[String(denomination)] || '';
                  const subtotal = denomination * (Number(qty || 0) || 0);
                  return (
                    <View key={`cash-denomination-${denomination}`} style={styles.cashBreakdownRow}>
                      <Text style={styles.cashDenominationLabel}>{formatRupiah(denomination)}</Text>
                      <TextInput
                        value={qty}
                        onChangeText={(value) => updateCashBreakdownQty(denomination, value)}
                        style={styles.cashQtyInput}
                        placeholder="0"
                        keyboardType="numeric"
                        editable={!isLocked}
                      />
                      <Text style={styles.cashSubtotalText}>{formatRupiah(subtotal)}</Text>
                    </View>
                  );
                })}
              </View>
              <TextInput value={physicalCash} onChangeText={(value) => setPhysicalCash(sanitizeAmount(value))} style={styles.input} placeholder="Cash fisik saat closing" editable={!isLocked} />
              <Text style={styles.meta}>Cash fisik otomatis mengikuti total pecahan. Input manual tetap bisa dipakai jika ada nominal lain.</Text>
              <Text style={styles.meta}>Cash seharusnya: {formatRupiah(expectedCashPreview)}</Text>
              <Text style={[styles.cashDiff, cashDifferencePreview === 0 ? styles.goodText : styles.badText]}>
                Selisih: {formatRupiah(cashDifferencePreview)}
              </Text>
              {cashDifferencePreview !== 0 ? (
                <>
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
                </>
              ) : null}
              {!isLocked ? (
                <Pressable style={styles.primaryButton} onPress={saveCashValidation} disabled={submitting}>
                  <Text style={styles.primaryButtonText}>Simpan Validasi Cash</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Checklist Closing</Text>
              {checklists.map((item) => (
                <Pressable key={item.code} style={styles.checkRow} onPress={() => toggleChecklist(item)} disabled={isLocked || !item.is_manual}>
                  <View style={[styles.checkbox, item.is_checked && styles.checkboxChecked]}>
                    <Text style={styles.checkboxText}>{item.is_checked ? 'v' : ''}</Text>
                  </View>
                  <View style={styles.checkTextWrap}>
                    <Text style={styles.checkLabel}>{item.label}</Text>
                    {!item.is_checked && item.validation_message ? <Text style={styles.meta}>{item.validation_message}</Text> : null}
                  </View>
                </Pressable>
              ))}
              <Pressable style={[styles.finalButton, (!closing?.is_ready || isLocked) && styles.disabledButton]} onPress={finalize} disabled={!closing?.is_ready || isLocked || submitting}>
                <Text style={styles.finalButtonText}>{isLocked ? 'Closing Terkunci' : 'Final Closing'}</Text>
              </Pressable>
            </View>
          </View>

          {differenceValidations.length > 0 ? (
            <View style={styles.card}>
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
              <Text style={styles.sectionTitle}>Order / Customer Belum Closing</Text>
              <Text style={styles.meta}>{incompleteOpenOrders.length} dari {openOrders.length} order belum memiliki alasan, aksi, penanggung jawab, dan follow-up lengkap.</Text>
              {!isLocked && incompleteOpenOrders.length > 1 ? (
                <View style={styles.bulkCard}>
                  <Text style={styles.issueTitle}>Isi Bersama untuk Order Belum Lengkap</Text>
                  <Text style={styles.meta}>Gunakan bila alasan dan tindak lanjut memang sama. Status order tidak diubah dan aksi ini tetap masuk audit log.</Text>
                  <TextInput value={bulkOrderReason} onChangeText={setBulkOrderReason} style={styles.input} placeholder="Alasan bersama order menggantung" />
                  <ScrollView horizontal contentContainerStyle={styles.picRow}>
                    {userOptions.map((row) => (
                      <Pressable key={`bulk-issue-pic-${row.id}`} style={[styles.choice, Number(bulkOrderPicUserId) === Number(row.id) && styles.choiceActive]} onPress={() => setBulkOrderPicUserId(row.id)}>
                        <Text style={styles.choiceText}>{row.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <TextInput value={bulkOrderFollowUp} onChangeText={setBulkOrderFollowUp} style={[styles.input, styles.multiline]} placeholder="Follow-up bersama" multiline />
                  <Pressable style={styles.primaryButton} onPress={saveBulkOrderIssues} disabled={submitting}>
                    <Text style={styles.primaryButtonText}>Terapkan ke {incompleteOpenOrders.length} Order Belum Lengkap</Text>
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
                    <TextInput value={draft.reason || ''} onChangeText={(value) => updateOrderDraft(issue.id, 'reason', value)} style={styles.input} placeholder="Reason order menggantung" editable={!isLocked} />
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
              <View style={styles.finalSnapshot}>
                <Text style={styles.sectionTitle}>Laporan Final Terkunci</Text>
                <Text style={styles.meta}>Snapshot final {closing?.date || '-'} dikunci pada {closing?.finalized_at || '-'}. Perubahan berikutnya dicatat sebagai case koreksi.</Text>
                <View style={styles.finalSnapshotActions}>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => onPrintReport?.(closing?.date || date)}
                    disabled={!onPrintReport}
                  >
                    <Text style={styles.primaryButtonText}>Print Laporan</Text>
                  </Pressable>
                </View>
              </View>
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

      <Modal
        visible={isFinalizeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !submitting && setIsFinalizeModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropDismiss} onPress={() => !submitting && setIsFinalizeModalVisible(false)} />
          <View style={styles.finalizeModalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalBadge}>
                <Text style={styles.modalBadgeText}>SIAP DIKUNCI</Text>
              </View>
              <Pressable style={styles.modalCloseButton} onPress={() => setIsFinalizeModalVisible(false)} disabled={submitting}>
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
              <Pressable style={styles.modalCancelButton} onPress={() => setIsFinalizeModalVisible(false)} disabled={submitting}>
                <Text style={styles.modalCancelButtonText}>Kembali Periksa</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirmButton, submitting && styles.disabledButton]} onPress={submitFinalClosing} disabled={submitting}>
                <Text style={styles.modalConfirmButtonText}>{submitting ? 'Mengunci...' : 'Kunci Final Closing'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  blockerText: { fontSize: 12, lineHeight: 17, color: '#8a3d16', fontWeight: '700' },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexGrow: 1, minWidth: 300, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#dce5f4', backgroundColor: '#fff', gap: 9 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#173c87' },
  meta: { fontSize: 11, lineHeight: 16, color: '#667897' },
  input: { borderWidth: 1, borderColor: '#d4dcea', backgroundColor: '#fbfdff', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, fontSize: 12, color: '#14233d' },
  multiline: { minHeight: 54, textAlignVertical: 'top' },
  cashBreakdownBox: { borderWidth: 1, borderColor: '#dce5f4', backgroundColor: '#f8fbff', borderRadius: 12, padding: 10, gap: 7 },
  cashBreakdownHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cashBreakdownTitle: { fontSize: 12, fontWeight: '900', color: '#173c87' },
  cashBreakdownTotal: { fontSize: 13, fontWeight: '900', color: '#1d6c43' },
  cashBreakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cashDenominationLabel: { flex: 1, fontSize: 11, color: '#243957', fontWeight: '800' },
  cashQtyInput: { width: 74, borderWidth: 1, borderColor: '#d4dcea', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, fontSize: 12, color: '#14233d', textAlign: 'center' },
  cashSubtotalText: { flex: 1, textAlign: 'right', fontSize: 11, color: '#435674', fontWeight: '800' },
  cashDiff: { fontSize: 13, fontWeight: '900' },
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
  finalButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  disabledButton: { opacity: 0.45 },
  issueCard: { padding: 11, borderRadius: 11, borderWidth: 1, borderColor: '#e1e6df', backgroundColor: '#fafbf8', gap: 7 },
  bulkCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#b9cfb8', backgroundColor: '#f1f7ee', gap: 8 },
  issueTitle: { fontSize: 12, color: '#263d30', fontWeight: '900' },
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
