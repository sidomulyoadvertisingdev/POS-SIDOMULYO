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

const ClosingStorePanel = ({ currentUser, isActive, onNotify }) => {
  const [date, setDate] = useState(todayIso());
  const [payload, setPayload] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingKey, setUploadingKey] = useState('');
  const [openingCash, setOpeningCash] = useState('');
  const [physicalCash, setPhysicalCash] = useState('');
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
  const expectedCashPreview = parseAmount(openingCash) + expectedMovement;
  const physicalCashValue = parseAmount(physicalCash);
  const cashDifferencePreview = physicalCashValue - expectedCashPreview;
  const openOrders = Array.isArray(summary?.open_orders) ? summary.open_orders : [];
  const incompleteOpenOrders = openOrders.filter((row) => (
    !safeText(row.reason) || !Number(row.pic_user_id || 0) || !safeText(row.follow_up)
  ));
  const checklists = Array.isArray(summary?.checklists) ? summary.checklists : [];
  const blockers = Array.isArray(summary?.blockers) ? summary.blockers : [];
  const missingExpenses = Array.isArray(summary?.expenses?.missing_evidence) ? summary.expenses.missing_evidence : [];
  const missingPurchases = Array.isArray(summary?.purchases?.missing_evidence) ? summary.purchases.missing_evidence : [];
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
      setOpeningCash(sanitizeAmount(cash.opening_cash));
      setPhysicalCash(sanitizeAmount(cash.physical_cash));
      setCashReason(safeText(cash.reason));
      setResponsibleUserId(Number(cash.responsible_user_id || 0) || null);
    } else {
      setOpeningCash('');
      setPhysicalCash('');
      setCashReason('');
      setResponsibleUserId(null);
    }
    const drafts = {};
    (nextPayload?.summary?.open_orders || []).forEach((row) => {
      drafts[row.id] = {
        reason: safeText(row.reason),
        pic_user_id: Number(row.pic_user_id || currentUser?.id || 0) || null,
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

  const saveCashValidation = async () => {
    if (!(closingId > 0)) return;
    if (cashDifferencePreview !== 0 && (!cashReason || !responsibleUserId || !cashEvidence) && !existingCash?.evidence_path) {
      onNotify?.('Validasi Cash', 'Selisih cash membutuhkan alasan, penanggung jawab, dan bukti.');
      return;
    }
    try {
      setSubmitting(true);
      const nextPayload = await saveStoreClosingCashValidation(closingId, {
        opening_cash: parseAmount(openingCash),
        physical_cash: physicalCashValue,
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
    if (!Number(draft.pic_user_id || 0)) missingFields.push('PIC');
    if (!safeText(draft.follow_up)) missingFields.push('follow-up');
    if (missingFields.length > 0) {
      onNotify?.('Order Belum Closing', `Lengkapi ${missingFields.join(', ')} sebelum menyimpan tindak lanjut order.`);
      return;
    }
    try {
      setSubmitting(true);
      const nextPayload = await saveStoreClosingOrderIssue(closingId, issue.id, {
        reason: safeText(draft.reason),
        pic_user_id: Number(draft.pic_user_id || 0),
        follow_up: safeText(draft.follow_up),
        resolution_status: 'follow_up',
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
    if (!Number(bulkOrderPicUserId || 0)) missingFields.push('PIC');
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
        pic_user_id: Number(bulkOrderPicUserId),
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
          <Text style={styles.title}>Closing Toko Harian</Text>
          <Text style={styles.subtitle}>Checklist kasir, validasi cash, bukti, dan order menggantung dinilai oleh backend.</Text>
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
              <TextInput value={openingCash} onChangeText={(value) => setOpeningCash(sanitizeAmount(value))} style={styles.input} placeholder="Cash awal laci" editable={!isLocked} />
              <TextInput value={physicalCash} onChangeText={(value) => setPhysicalCash(sanitizeAmount(value))} style={styles.input} placeholder="Cash fisik saat closing" editable={!isLocked} />
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

          {openOrders.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Order / Customer Belum Closing</Text>
              <Text style={styles.meta}>{incompleteOpenOrders.length} dari {openOrders.length} order belum memiliki alasan, PIC, dan follow-up lengkap.</Text>
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
                    <TextInput value={draft.reason || ''} onChangeText={(value) => updateOrderDraft(issue.id, 'reason', value)} style={styles.input} placeholder="Reason order menggantung" editable={!isLocked} />
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
  panel: { gap: 14, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#d7dfd2', backgroundColor: '#f7f8f2' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 },
  title: { fontSize: 21, fontWeight: '900', color: '#203128' },
  subtitle: { fontSize: 12, lineHeight: 18, color: '#58675f', maxWidth: 660 },
  status: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  statusReady: { backgroundColor: '#e1f2d6' },
  statusSafe: { backgroundColor: '#1d6c43' },
  statusCorrection: { backgroundColor: '#f3dcae' },
  statusBlocked: { backgroundColor: '#ffe5cf' },
  statusText: { fontSize: 12, fontWeight: '900', color: '#24362d' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  dateInput: { borderWidth: 1, borderColor: '#bdc9bf', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, minWidth: 130 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { flexGrow: 1, minWidth: 145, padding: 12, borderRadius: 14, backgroundColor: '#e7f0e0', borderWidth: 1, borderColor: '#cad9bd' },
  summaryWarning: { backgroundColor: '#fff2df', borderColor: '#edd2a7' },
  summaryLabel: { fontSize: 11, fontWeight: '800', color: '#5b6b63' },
  summaryValue: { marginTop: 6, fontSize: 17, fontWeight: '900', color: '#203128' },
  blockerCard: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#f4b88b', backgroundColor: '#fff0e4', gap: 5 },
  blockerText: { fontSize: 12, lineHeight: 17, color: '#8a3d16', fontWeight: '700' },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexGrow: 1, minWidth: 300, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#d9e0d7', backgroundColor: '#fff', gap: 9 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#24362d' },
  meta: { fontSize: 11, lineHeight: 16, color: '#617269' },
  input: { borderWidth: 1, borderColor: '#d0d8d0', backgroundColor: '#fbfcfa', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, fontSize: 12, color: '#203128' },
  multiline: { minHeight: 54, textAlignVertical: 'top' },
  cashDiff: { fontSize: 13, fontWeight: '900' },
  goodText: { color: '#1d6c43' },
  badText: { color: '#aa4a1d' },
  primaryButton: { backgroundColor: '#276641', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#aebdaf', backgroundColor: '#f2f6ee', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#2d513b', fontSize: 11, fontWeight: '900' },
  picRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { borderRadius: 999, borderWidth: 1, borderColor: '#d0d8d0', paddingHorizontal: 10, paddingVertical: 6 },
  choiceActive: { borderColor: '#276641', backgroundColor: '#dfeddd' },
  choiceText: { fontSize: 10, fontWeight: '800', color: '#304b3b' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: '#adbcae', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#276641', borderColor: '#276641' },
  checkboxText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  checkTextWrap: { flex: 1 },
  checkLabel: { fontSize: 12, fontWeight: '800', color: '#24362d' },
  finalButton: { marginTop: 7, backgroundColor: '#173c2a', paddingVertical: 12, borderRadius: 11, alignItems: 'center' },
  finalButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  disabledButton: { opacity: 0.45 },
  issueCard: { padding: 11, borderRadius: 11, borderWidth: 1, borderColor: '#e1e6df', backgroundColor: '#fafbf8', gap: 7 },
  bulkCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#b9cfb8', backgroundColor: '#f1f7ee', gap: 8 },
  issueTitle: { fontSize: 12, color: '#263d30', fontWeight: '900' },
  evidenceRow: { flexDirection: 'row', gap: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#edf0ea', paddingVertical: 7 },
  finalSnapshot: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#9bbf9d', backgroundColor: '#e6f0e5', gap: 5 },
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
