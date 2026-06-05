import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  decideStoreClosingCashDifference,
  decideStoreClosingCorrection,
  fetchStoreClosingArchive,
  fetchStoreClosingDetail,
  fetchStoreClosingReviewQueue,
} from '../services/erpApi';
import { formatRupiah } from '../utils/currency';

const statusLabel = (value) => ({
  ada_selisih: 'Ada Selisih',
  belum_bisa_closing: 'Belum Bisa Closing',
  final_closing: 'Final Closing',
  ada_koreksi: 'Ada Koreksi',
}[String(value || '').toLowerCase()] || String(value || '-'));
const cashDecisionOptions = [
  ['approved', 'Setujui'],
  ['charge_employee', 'Beban Karyawan'],
  ['management', 'Beban Management'],
  ['shared_team', 'Dibagi Tim'],
  ['rejected', 'Tolak - Validasi Ulang'],
];
const correctionDecisionOptions = [
  ['employee_burden', 'Beban Karyawan'],
  ['management_burden', 'Beban Management'],
  ['shared_team', 'Dibagi Tim'],
  ['cancelled', 'Batalkan'],
  ['carry_forward', 'Koreksi Berikutnya'],
];
const cashDecisionLabel = (value) => ({
  pending: 'Menunggu Review',
  approved: 'Disetujui admin',
  charge_employee: 'Beban Karyawan',
  management: 'Beban Management',
  shared_team: 'Dibagi Tim',
  rejected: 'Ditolak - validasi ulang',
}[String(value || '')] || String(value || '-'));
const safeText = (value) => String(value || '').trim();
const cashDifferenceLabel = (row) => (
  safeText(row?.difference_label)
  || (Number(row?.difference || 0) > 0 ? 'Selisih Lebih' : 'Selisih Kurang')
);
const cashDifferenceTreatmentText = (row) => safeText(row?.accounting_treatment)
  || (Number(row?.difference || 0) > 0
    ? 'Selisih lebih akan masuk pendapatan lain-lain setelah approval admin.'
    : 'Selisih kurang menunggu keputusan pembebanan admin.');
const CALENDAR_DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const padDatePart = (value) => String(value).padStart(2, '0');
const startOfLocalDay = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};
const startOfLocalMonth = (value = new Date()) => {
  const date = startOfLocalDay(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};
const addLocalDays = (value, days = 0) => {
  const date = startOfLocalDay(value);
  date.setDate(date.getDate() + Number(days || 0));
  return date;
};
const addLocalMonths = (value, months = 0) => {
  const date = startOfLocalMonth(value);
  return new Date(date.getFullYear(), date.getMonth() + Number(months || 0), 1);
};
const toIsoDate = (value) => {
  const date = startOfLocalDay(value);
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
};
const parseIsoDate = (value) => {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }
  const [year, month, day] = text.split('-').map((part) => Number(part));
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }
  return parsed;
};
const formatCalendarMonthLabel = (value) => startOfLocalMonth(value).toLocaleDateString('id-ID', {
  month: 'long',
  year: 'numeric',
});
const formatSelectedDateLabel = (value) => {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return 'Belum dipilih';
  }
  return parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};
const buildCalendarCells = (cursorDate) => {
  const monthStart = startOfLocalMonth(cursorDate);
  const nativeWeekday = monthStart.getDay();
  const mondayOffset = nativeWeekday === 0 ? 6 : nativeWeekday - 1;
  const gridStart = addLocalDays(monthStart, -mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addLocalDays(gridStart, index);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      iso: toIsoDate(date),
      label: String(date.getDate()),
      inCurrentMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
};
const resolveInitialCalendarCursor = (...values) => {
  const parsed = values.map(parseIsoDate).find(Boolean);
  return startOfLocalMonth(parsed || new Date());
};
const isIsoDateInRange = (iso, from, to) => {
  if (!from || !to) return false;
  const current = parseIsoDate(iso);
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!current || !start || !end) return false;
  const min = start <= end ? start : end;
  const max = start <= end ? end : start;
  return current >= min && current <= max;
};

const downloadCsv = (rows) => {
  if (typeof document === 'undefined') {
    throw new Error('Export CSV tersedia pada aplikasi web/desktop.');
  }
  const header = ['Tanggal', 'Status', 'Pendapatan', 'Cash', 'Transfer', 'QRIS', 'Pengeluaran', 'Pembelian', 'Koreksi'];
  const values = rows.map((row) => [
    row.date,
    statusLabel(row.status),
    row.sales_total,
    row.cash_total,
    row.transfer_total,
    row.qris_total,
    row.expense_total,
    row.purchase_total,
    row.correction_count,
  ]);
  const csv = [header, ...values]
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'arsip-closing-toko.csv';
  anchor.click();
  URL.revokeObjectURL(url);
};

const ClosingArchivePanel = ({ isActive, onNotify }) => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [isDateModalVisible, setIsDateModalVisible] = useState(false);
  const [activeDateField, setActiveDateField] = useState('from');
  const [calendarCursor, setCalendarCursor] = useState(() => resolveInitialCalendarCursor());
  const [rows, setRows] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState({});
  const [carryForwardDates, setCarryForwardDates] = useState({});

  const loadReviewQueue = async () => {
    try {
      const payload = await fetchStoreClosingReviewQueue();
      const nextRows = Array.isArray(payload?.data) ? payload.data : [];
      setReviewQueue(nextRows);
      setCanReview(true);
      return nextRows;
    } catch (_error) {
      setReviewQueue([]);
      setCanReview(false);
      return [];
    }
  };

  const calendarCells = useMemo(() => buildCalendarCells(calendarCursor), [calendarCursor]);

  const openDateModal = () => {
    setDraftDateFrom(String(dateFrom || '').trim());
    setDraftDateTo(String(dateTo || '').trim());
    setActiveDateField('from');
    setCalendarCursor(resolveInitialCalendarCursor(dateFrom, dateTo));
    setIsDateModalVisible(true);
  };

  const closeDateModal = () => setIsDateModalVisible(false);

  const focusDateField = (field) => {
    setActiveDateField(field);
    const target = field === 'from' ? draftDateFrom : draftDateTo;
    const parsed = parseIsoDate(target);
    if (parsed) {
      setCalendarCursor(startOfLocalMonth(parsed));
    }
  };

  const handleSelectCalendarDate = (iso) => {
    if (activeDateField === 'from') {
      setDraftDateFrom(iso);
      setActiveDateField('to');
      return;
    }
    setDraftDateTo(iso);
  };

  const handleClearDateFilter = async () => {
    setDateFrom('');
    setDateTo('');
    setDraftDateFrom('');
    setDraftDateTo('');
    setIsDateModalVisible(false);
    try {
      setLoading(true);
      const nextReviewQueue = await loadReviewQueue();
      const payload = await fetchStoreClosingArchive({ date_from: '', date_to: '' });
      const nextRows = Array.isArray(payload?.data) ? payload.data : [];
      setRows(nextRows);
      const allRows = [...nextReviewQueue, ...nextRows];
      if (allRows.length > 0) {
        await openDetail(allRows[0]);
      } else {
        setDetail(null);
      }
    } catch (error) {
      onNotify?.('Arsip Closing', `Gagal memuat arsip: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDateFilter = async () => {
    const nextFrom = String(draftDateFrom || '').trim();
    const nextTo = String(draftDateTo || '').trim();
    setDateFrom(nextFrom);
    setDateTo(nextTo);
    setIsDateModalVisible(false);
    try {
      setLoading(true);
      const nextReviewQueue = await loadReviewQueue();
      const payload = await fetchStoreClosingArchive({ date_from: nextFrom, date_to: nextTo });
      const nextRows = Array.isArray(payload?.data) ? payload.data : [];
      setRows(nextRows);
      const allRows = [...nextReviewQueue, ...nextRows];
      if (allRows.length > 0 && !allRows.some((row) => Number(row.id) === Number(detail?.closing?.id))) {
        await openDetail(allRows[0]);
      }
      if (allRows.length === 0) {
        setDetail(null);
      }
    } catch (error) {
      onNotify?.('Arsip Closing', `Gagal memuat arsip: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadArchive = async () => {
    try {
      setLoading(true);
      const nextReviewQueue = await loadReviewQueue();
      const payload = await fetchStoreClosingArchive({ date_from: dateFrom, date_to: dateTo });
      const nextRows = Array.isArray(payload?.data) ? payload.data : [];
      setRows(nextRows);
      const allRows = [...nextReviewQueue, ...nextRows];
      if (allRows.length > 0 && !allRows.some((row) => Number(row.id) === Number(detail?.closing?.id))) {
        await openDetail(allRows[0]);
      }
      if (allRows.length === 0) {
        setDetail(null);
      }
    } catch (error) {
      onNotify?.('Arsip Closing', `Gagal memuat arsip: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (row) => {
    try {
      setDetailLoading(true);
      const nextDetail = await fetchStoreClosingDetail(row.id);
      setDetail(nextDetail);
      const notes = {};
      (nextDetail?.workflow?.cash_validations || []).forEach((validation) => {
        notes[`cash-${validation.id}`] = validation.decision_note || '';
      });
      (nextDetail?.workflow?.corrections || []).forEach((correction) => {
        notes[`correction-${correction.id}`] = correction.decision_note || '';
      });
      setDecisionNotes(notes);
    } catch (error) {
      onNotify?.('Arsip Closing', `Gagal memuat laporan final: ${error.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (isActive) loadArchive();
  }, [isActive]);

  const summary = detail?.summary || null;
  const workflow = detail?.workflow || {};
  const cashDifferenceSummary = summary?.cash_difference && typeof summary.cash_difference === 'object'
    ? summary.cash_difference
    : {};
  const cashDifferenceRows = Array.isArray(cashDifferenceSummary?.items) ? cashDifferenceSummary.items : [];
  const corrections = Array.isArray(workflow?.corrections) ? workflow.corrections : [];
  const auditEvents = Array.isArray(workflow?.audit_events) ? workflow.audit_events : [];
  const pendingCashReviews = (workflow?.cash_validations || []).filter((row) => row.decision_status === 'pending' && Math.abs(Number(row.difference || 0)) > 0);
  const pendingCorrectionReviews = corrections.filter((row) => row.decision === 'pending_review');

  const decideCash = async (row, decision) => {
    const decisionNote = safeText(decisionNotes[`cash-${row.id}`]);
    if (decision === 'rejected' && !decisionNote) {
      onNotify?.('Review Closing', 'Catatan penolakan wajib diisi agar kasir tahu apa yang harus divalidasi ulang.');
      return;
    }
    try {
      setDetail(await decideStoreClosingCashDifference(detail.closing.id, {
        cashier_id: row.cashier_id,
        decision_status: decision,
        decision_note: decisionNote,
      }));
      await loadReviewQueue();
      onNotify?.('Review Closing', 'Keputusan selisih cash berhasil disimpan.');
    } catch (error) {
      onNotify?.('Review Closing', error.message);
    }
  };

  const decideCorrection = async (row, decision) => {
    const carryForwardDate = carryForwardDates[row.id] || '';
    if (decision === 'carry_forward' && !carryForwardDate) {
      onNotify?.('Review Closing', 'Tanggal koreksi berikutnya wajib diisi.');
      return;
    }
    try {
      setDetail(await decideStoreClosingCorrection(detail.closing.id, row.id, {
        decision,
        decision_note: decisionNotes[`correction-${row.id}`] || '',
        carry_forward_date: decision === 'carry_forward' ? carryForwardDate : null,
      }));
      await loadReviewQueue();
      onNotify?.('Review Closing', 'Keputusan koreksi berhasil disimpan.');
    } catch (error) {
      onNotify?.('Review Closing', error.message);
    }
  };

  const printReport = () => {
    if (!detail?.closing?.is_locked) {
      onNotify?.('Arsip Closing', 'Hanya laporan final yang sudah dikunci dapat dicetak.');
      return;
    }
    if (typeof window === 'undefined' || typeof window.print !== 'function') {
      onNotify?.('Arsip Closing', 'Print tersedia pada aplikasi web/desktop.');
      return;
    }
    window.print();
  };

  const exportArchive = () => {
    try {
      downloadCsv(rows);
    } catch (error) {
      onNotify?.('Arsip Closing', error.message);
    }
  };

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Arsip Final Closing</Text>
          <Text style={styles.subtitle}>Laporan ini membaca snapshot yang sudah dikunci, bukan menghitung ulang transaksi berjalan.</Text>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={exportArchive}>
            <Text style={styles.secondaryText}>Export CSV</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={printReport} disabled={!summary || !detail?.closing?.is_locked}>
            <Text style={styles.primaryText}>Print Laporan</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.datePickerCard}>
        <Text style={styles.datePickerTitle}>Filter Tanggal</Text>
        <Text style={styles.datePickerMeta}>
          {dateFrom || dateTo
            ? `Periode aktif: ${dateFrom || 'awal'} s/d ${dateTo || 'akhir'}`
            : 'Periode aktif: Semua tanggal'}
        </Text>

        <View style={styles.dateActionRow}>
          <Pressable style={styles.dateOpenButton} onPress={openDateModal}>
            <Text style={styles.dateOpenButtonText}>Buka Kalender</Text>
          </Pressable>
          <Pressable style={styles.dateResetButton} onPress={handleClearDateFilter}>
            <Text style={styles.dateResetButtonText}>Reset Tanggal</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={isDateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDateModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropDismiss} onPress={closeDateModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Pilih Tanggal Closing</Text>
              <Pressable style={styles.modalCloseButton} onPress={closeDateModal}>
                <Text style={styles.modalCloseButtonText}>Tutup</Text>
              </Pressable>
            </View>

            <Text style={styles.modalHelperText}>
              Pilih tanggal mulai dan tanggal akhir langsung dari kalender.
            </Text>

            <View style={styles.selectionRow}>
              <Pressable
                style={[styles.selectionCard, activeDateField === 'from' ? styles.selectionCardActive : null]}
                onPress={() => focusDateField('from')}
              >
                <Text style={styles.selectionLabel}>Tanggal Dari</Text>
                <Text style={styles.selectionValue}>{formatSelectedDateLabel(draftDateFrom)}</Text>
              </Pressable>
              <Pressable
                style={[styles.selectionCard, activeDateField === 'to' ? styles.selectionCardActive : null]}
                onPress={() => focusDateField('to')}
              >
                <Text style={styles.selectionLabel}>Tanggal Sampai</Text>
                <Text style={styles.selectionValue}>{formatSelectedDateLabel(draftDateTo)}</Text>
              </Pressable>
            </View>

            <View style={styles.calendarNavRow}>
              <Pressable
                style={styles.calendarNavButton}
                onPress={() => setCalendarCursor((prev) => addLocalMonths(prev, -1))}
              >
                <Text style={styles.calendarNavButtonText}>{'<'}</Text>
              </Pressable>
              <Text style={styles.calendarMonthLabel}>{formatCalendarMonthLabel(calendarCursor)}</Text>
              <Pressable
                style={styles.calendarNavButton}
                onPress={() => setCalendarCursor((prev) => addLocalMonths(prev, 1))}
              >
                <Text style={styles.calendarNavButtonText}>{'>'}</Text>
              </Pressable>
            </View>

            <View style={styles.calendarDayHeaderRow}>
              {CALENDAR_DAY_LABELS.map((label) => (
                <Text key={label} style={styles.calendarDayHeaderText}>{label}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarCells.map((cell) => {
                const isFrom = cell.iso === draftDateFrom;
                const isTo = cell.iso === draftDateTo;
                const isSelected = isFrom || isTo;
                const isInRange = isIsoDateInRange(cell.iso, draftDateFrom, draftDateTo);
                return (
                  <Pressable
                    key={cell.key}
                    style={[
                      styles.calendarDayCell,
                      !cell.inCurrentMonth ? styles.calendarDayCellMuted : null,
                      isInRange ? styles.calendarDayCellInRange : null,
                      isSelected ? styles.calendarDayCellSelected : null,
                    ]}
                    onPress={() => handleSelectCalendarDate(cell.iso)}
                  >
                    <Text
                      style={[
                        styles.calendarDayCellText,
                        !cell.inCurrentMonth ? styles.calendarDayCellTextMuted : null,
                        isSelected ? styles.calendarDayCellTextSelected : null,
                      ]}
                    >
                      {cell.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalFooterRow}>
              <Pressable style={styles.modalSecondaryButton} onPress={handleClearDateFilter}>
                <Text style={styles.modalSecondaryButtonText}>Reset</Text>
              </Pressable>
              <Pressable style={styles.modalSecondaryButton} onPress={closeDateModal}>
                <Text style={styles.modalSecondaryButtonText}>Batal</Text>
              </Pressable>
              <Pressable style={styles.modalPrimaryButton} onPress={handleApplyDateFilter}>
                <Text style={styles.modalPrimaryButtonText}>{loading ? 'Memuat...' : 'Terapkan'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.content}>
        <View style={styles.listCard}>
          {canReview ? (
            <>
              <Text style={styles.sectionTitle}>Perlu Review</Text>
              {reviewQueue.length === 0 ? <Text style={styles.meta}>Tidak ada eskalasi yang menunggu keputusan.</Text> : null}
              {reviewQueue.map((row) => (
                <Pressable key={`review-${row.id}`} style={[styles.archiveRow, styles.reviewRow, Number(detail?.closing?.id) === Number(row.id) && styles.archiveRowActive]} onPress={() => openDetail(row)}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.rowTitle}>{row.date}</Text>
                    <Text style={styles.badge}>{statusLabel(row.status)}</Text>
                  </View>
                  <Text style={styles.meta}>{row.outlet_name || 'Outlet belum ditentukan'}</Text>
                  <Text style={styles.meta}>Selisih: {row.pending_cash_review_count || 0} | Koreksi: {row.pending_correction_review_count || 0}</Text>
                </Pressable>
              ))}
              <View style={styles.separator} />
            </>
          ) : null}
          <Text style={styles.sectionTitle}>Histori Closing</Text>
          {rows.length === 0 ? <Text style={styles.meta}>Belum ada final closing pada filter ini.</Text> : null}
          <ScrollView contentContainerStyle={styles.list}>
            {rows.map((row) => (
              <Pressable key={row.id} style={[styles.archiveRow, Number(detail?.closing?.id) === Number(row.id) && styles.archiveRowActive]} onPress={() => openDetail(row)}>
                <View style={styles.rowBetween}>
                  <Text style={styles.rowTitle}>{row.date}</Text>
                  <Text style={styles.badge}>{statusLabel(row.status)}</Text>
                </View>
                {row.outlet_name ? <Text style={styles.meta}>{row.outlet_name}</Text> : null}
                <Text style={styles.meta}>Pendapatan {formatRupiah(row.sales_total)} | Cash {formatRupiah(row.cash_total)}</Text>
                <Text style={styles.meta}>{row.correction_count > 0 ? `${row.correction_count} case koreksi` : 'Tanpa koreksi'}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.reportCard}>
          {detailLoading ? <Text style={styles.meta}>Memuat snapshot final...</Text> : null}
          {!summary && !detailLoading ? <Text style={styles.meta}>Pilih histori final closing untuk melihat laporan.</Text> : null}
          {summary ? (
            <>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.sectionTitle}>{detail?.closing?.is_locked ? 'Laporan Final' : 'Review Closing'} {detail?.closing?.date}</Text>
                  <Text style={styles.meta}>{detail?.closing?.is_locked ? `Dikunci: ${detail?.closing?.finalized_at || '-'}` : 'Belum dikunci; menunggu validasi reviewer.'}</Text>
                </View>
                <Text style={styles.reportStatus}>{statusLabel(detail?.closing?.status)}</Text>
              </View>
              <View style={styles.summaryGrid}>
                <Metric label="Pendapatan" value={summary.sales?.total} />
                <Metric label="Cash" value={summary.payments?.cash_total} />
                <Metric label="Transfer" value={summary.payments?.transfer_total} />
                <Metric label="QRIS" value={summary.payments?.qris_total} />
                <Metric label="Saldo Pelanggan" value={summary.payments?.customer_deposit_total} />
                <Metric label="Pengeluaran" value={summary.expenses?.total} warning />
                <Metric label="Pembelian" value={summary.purchases?.total} warning />
                <Metric label="Cash Closing" value={summary.cash_validation?.expected_cash_movement || 0} />
              </View>
              {Number(summary.cash_validation?.cash_expense_total || 0) > 0 ? (
                <View style={styles.cashNoteBox}>
                  <Text style={styles.rowTitle}>Detail pengeluaran metode cash</Text>
                  <Text style={styles.meta}>
                    Total pengeluaran tetap ditampilkan sebagai Pengeluaran. Bagian yang memakai cash
                    {' '}({formatRupiah(summary.cash_validation?.cash_expense_total || 0)}) mengurangi uang tunai closing:
                    {' '}{formatRupiah((summary.payments?.cash_total || 0) + (summary.cash_validation?.cash_income_total || 0))}
                    {' '}- {formatRupiah(summary.cash_validation?.cash_expense_total || 0)}
                    {' '}= {formatRupiah(summary.cash_validation?.expected_cash_movement || 0)}.
                  </Text>
                </View>
              ) : null}
              {cashDifferenceSummary?.has_difference ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Ringkasan Selisih Cash</Text>
                  <Text style={styles.meta}>
                    Selisih lebih {formatRupiah(cashDifferenceSummary.surplus_total || 0)} | Selisih kurang {formatRupiah(cashDifferenceSummary.shortage_total || 0)} | Net {formatRupiah(cashDifferenceSummary.net_difference || 0)}
                  </Text>
                  {cashDifferenceRows.map((row, index) => (
                    <View key={`archive-cash-diff-${row.id || index}`} style={styles.noteRow}>
                      <Text style={styles.rowTitle}>{cashDifferenceLabel(row)} {row.cashier_name || '-'} - {formatRupiah(row.amount || Math.abs(Number(row.difference || 0)))}</Text>
                      <Text style={styles.meta}>Keputusan: {row.decision_label || cashDecisionLabel(row.decision_status)} | Tujuan: {row.burden_target_label || '-'}</Text>
                      <Text style={styles.meta}>{cashDifferenceTreatmentText(row)}</Text>
                      {row.reason ? <Text style={styles.meta}>Alasan: {row.reason}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}
              {canReview && (pendingCashReviews.length > 0 || pendingCorrectionReviews.length > 0) ? (
                <View style={styles.reviewCard}>
                  <Text style={styles.sectionTitle}>Keputusan Reviewer</Text>
                  {pendingCashReviews.map((row) => (
                    <View key={`cash-action-${row.id}`} style={styles.noteRow}>
                      <Text style={styles.rowTitle}>Selisih {row.cashier_name}: {formatRupiah(row.difference)}</Text>
                      <Text style={styles.meta}>{row.reason || '-'} | PIC: {row.responsible_user_name || '-'}</Text>
                      <TextInput value={decisionNotes[`cash-${row.id}`] || ''} onChangeText={(value) => setDecisionNotes((current) => ({ ...current, [`cash-${row.id}`]: value }))} style={[styles.input, styles.textarea]} placeholder="Catatan keputusan" multiline />
                      <View style={styles.actionWrap}>
                        {cashDecisionOptions.map(([value, label]) => (
                          <Pressable key={`${row.id}-${value}`} style={styles.secondaryButton} onPress={() => decideCash(row, value)}>
                            <Text style={styles.secondaryText}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                  {pendingCorrectionReviews.map((row) => (
                    <View key={`correction-action-${row.id}`} style={styles.noteRow}>
                      <Text style={styles.rowTitle}>{row.issue_type}: {formatRupiah(row.amount)}</Text>
                      <Text style={styles.meta}>{row.description}</Text>
                      <TextInput value={decisionNotes[`correction-${row.id}`] || ''} onChangeText={(value) => setDecisionNotes((current) => ({ ...current, [`correction-${row.id}`]: value }))} style={[styles.input, styles.textarea]} placeholder="Catatan keputusan" multiline />
                      <TextInput value={carryForwardDates[row.id] || ''} onChangeText={(value) => setCarryForwardDates((current) => ({ ...current, [row.id]: value }))} style={styles.input} placeholder="Tanggal jika dikoreksi berikutnya (YYYY-MM-DD)" />
                      <View style={styles.actionWrap}>
                        {correctionDecisionOptions.map(([value, label]) => (
                          <Pressable key={`${row.id}-${value}`} style={styles.secondaryButton} onPress={() => decideCorrection(row, value)}>
                            <Text style={styles.secondaryText}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Koreksi Setelah Closing</Text>
                {corrections.length === 0 ? <Text style={styles.meta}>Tidak ada case koreksi.</Text> : null}
                {corrections.map((row) => (
                  <View key={row.id} style={styles.noteRow}>
                    <Text style={styles.rowTitle}>{row.issue_type} - {formatRupiah(row.amount)}</Text>
                    <Text style={styles.meta}>{row.decision} | {row.description}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Audit Terakhir</Text>
                {auditEvents.slice(0, 8).map((row) => (
                  <Text key={row.id} style={styles.meta}>{row.created_at || '-'} | {row.actor_name} | {row.event_type}</Text>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const Metric = ({ label, value, warning = false }) => (
  <View style={[styles.metric, warning && styles.metricWarning]}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{formatRupiah(value || 0)}</Text>
  </View>
);

const styles = StyleSheet.create({
  panel: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#c8d8f2', backgroundColor: '#ffffff', gap: 14 },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 21, fontWeight: '900', color: '#173c87' },
  subtitle: { maxWidth: 640, fontSize: 12, lineHeight: 18, color: '#667897' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  input: { minWidth: 155, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderColor: '#d4dcea', borderRadius: 10, backgroundColor: '#fbfdff', fontSize: 12 },
  datePickerCard: { borderWidth: 1, borderColor: '#c7d7ef', backgroundColor: '#f7fbff', borderRadius: 12, padding: 10 },
  datePickerTitle: { fontSize: 11, fontWeight: '800', color: '#24426f', textTransform: 'uppercase', marginBottom: 6 },
  datePickerMeta: { fontSize: 11, color: '#5c6780', marginBottom: 8 },
  dateActionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dateOpenButton: { flexGrow: 1, minWidth: 140, borderWidth: 1, borderColor: '#0755b8', backgroundColor: '#0755b8', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center' },
  dateOpenButtonText: { fontSize: 12, fontWeight: '800', color: '#ffffff' },
  dateResetButton: { flexGrow: 1, minWidth: 140, borderWidth: 1, borderColor: '#c7d2e5', backgroundColor: '#ffffff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center' },
  dateResetButtonText: { fontSize: 12, fontWeight: '800', color: '#344054' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.38)', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 18 },
  modalBackdropDismiss: { ...StyleSheet.absoluteFillObject },
  modalCard: { alignSelf: 'center', width: '100%', maxWidth: 390, backgroundColor: '#ffffff', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: '#d8e2f2', shadowColor: '#0f172a', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: '900', color: '#0f172a' },
  modalCloseButton: { borderWidth: 1, borderColor: '#d0d5dd', backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  modalCloseButtonText: { fontSize: 11, fontWeight: '800', color: '#344054' },
  modalHelperText: { fontSize: 11, lineHeight: 16, color: '#475467', marginBottom: 12 },
  selectionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  selectionCard: { flex: 1, borderWidth: 1, borderColor: '#d0d5dd', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9 },
  selectionCardActive: { borderColor: '#0755b8', backgroundColor: '#eef4ff' },
  selectionLabel: { fontSize: 10, fontWeight: '800', color: '#667085', textTransform: 'uppercase', marginBottom: 4 },
  selectionValue: { fontSize: 12, fontWeight: '800', color: '#101828' },
  calendarNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  calendarNavButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#c7d2e5', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  calendarNavButtonText: { fontSize: 16, fontWeight: '900', color: '#1d4ed8' },
  calendarMonthLabel: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '900', color: '#0f172a' },
  calendarDayHeaderRow: { flexDirection: 'row', marginBottom: 6 },
  calendarDayHeaderText: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '800', color: '#64748b' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 12 },
  calendarDayCell: { width: '13.3%', aspectRatio: 1, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  calendarDayCellMuted: { backgroundColor: '#f8fafc', borderColor: '#edf2f7' },
  calendarDayCellInRange: { backgroundColor: '#dbeafe', borderColor: '#bfdbfe' },
  calendarDayCellSelected: { backgroundColor: '#2563eb', borderColor: '#1d4ed8' },
  calendarDayCellText: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  calendarDayCellTextMuted: { color: '#94a3b8' },
  calendarDayCellTextSelected: { color: '#ffffff' },
  modalFooterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  modalSecondaryButton: { flexGrow: 1, minWidth: 84, borderWidth: 1, borderColor: '#d0d5dd', backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  modalSecondaryButtonText: { fontSize: 11, fontWeight: '800', color: '#344054' },
  modalPrimaryButton: { flexGrow: 1, minWidth: 100, borderWidth: 1, borderColor: '#0755b8', backgroundColor: '#0755b8', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  modalPrimaryButtonText: { fontSize: 11, fontWeight: '900', color: '#ffffff' },
  primaryButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#0755b8' },
  primaryText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  secondaryButton: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#b9c8e1', backgroundColor: '#f5f9ff' },
  secondaryText: { fontSize: 11, fontWeight: '900', color: '#174a8c' },
  content: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  listCard: { minWidth: 260, flexBasis: 290, flexGrow: 1, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#dce5f4', backgroundColor: '#fff', gap: 9 },
  reportCard: { minWidth: 320, flexBasis: 560, flexGrow: 2, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#dce5f4', backgroundColor: '#fff', gap: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#173c87' },
  list: { gap: 8 },
  archiveRow: { padding: 10, borderRadius: 11, borderWidth: 1, borderColor: '#dce5f4', backgroundColor: '#fbfdff', gap: 4 },
  archiveRowActive: { borderColor: '#0755b8', backgroundColor: '#eef4ff' },
  reviewRow: { borderColor: '#e2b464', backgroundColor: '#fff5df' },
  separator: { height: 1, backgroundColor: '#edf2fa', marginVertical: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' },
  rowTitle: { fontSize: 12, fontWeight: '900', color: '#173c87' },
  badge: { fontSize: 10, fontWeight: '900', color: '#755115', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, backgroundColor: '#f4e3b9' },
  reportStatus: { fontSize: 11, fontWeight: '900', color: '#174a8c', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#eef4ff' },
  meta: { fontSize: 11, lineHeight: 16, color: '#667897' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { flexGrow: 1, minWidth: 130, padding: 10, borderRadius: 12, backgroundColor: '#f1f6ff', borderWidth: 1, borderColor: '#c8d8f2' },
  metricWarning: { backgroundColor: '#fff1dc' },
  metricLabel: { fontSize: 10, fontWeight: '800', color: '#435674' },
  metricValue: { marginTop: 5, fontSize: 15, fontWeight: '900', color: '#173c87' },
  section: { borderTopWidth: 1, borderTopColor: '#edf2fa', paddingTop: 10, gap: 6 },
  reviewCard: { padding: 10, borderRadius: 12, backgroundColor: '#fff6e7', borderWidth: 1, borderColor: '#efd4a1', gap: 8 },
  noteRow: { padding: 8, borderRadius: 9, backgroundColor: '#fafbf8', gap: 3 },
  cashNoteBox: { padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#efce9c', backgroundColor: '#fff7eb', gap: 4 },
  textarea: { minHeight: 48, textAlignVertical: 'top' },
  actionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

export default ClosingArchivePanel;
