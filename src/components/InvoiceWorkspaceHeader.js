import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatRupiah } from '../utils/currency';

const AREA_CARDS = [
  {
    key: 'draft',
    menu: 'draft_orders',
    label: 'Draft Order',
    meta: 'Order aktif yang masih bisa direvisi',
  },
  {
    key: 'success',
    menu: 'invoice_success',
    label: 'Invoice Sukses',
    meta: 'Invoice resmi yang sudah difakturkan',
  },
  {
    key: 'approval',
    menu: 'approval_queue',
    label: 'Butuh Approval',
    meta: 'Approval aktif yang masih mengunci proses',
  },
  {
    key: 'receivable',
    menu: 'receivable',
    label: 'Piutang',
  },
];

const PRIMARY_FILTERS = [
  { key: 'draft', label: 'Draft Order' },
  { key: 'success', label: 'Invoice Sukses' },
  { key: 'approval', label: 'Butuh Approval' },
  { key: 'receivable', label: 'Piutang' },
];

const APPROVAL_FILTERS = [
  { key: 'all', label: 'Semua Approval' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
];

const DATE_FILTER_DISABLED_AREAS = new Set(['draft', 'approval', 'receivable']);

const resolveAreaCount = (summary = {}, key = '') => {
  if (key === 'draft') return Number(summary?.draftCount || 0) || 0;
  if (key === 'success') return Number(summary?.successCount || 0) || 0;
  if (key === 'approval') return Number(summary?.approvalCount || 0) || 0;
  if (key === 'receivable') return Number(summary?.receivableCount || 0) || 0;
  return 0;
};

const resolveAreaMeta = (summary = {}, key = '', fallback = '') => {
  return fallback;
};

const resolveAreaAmount = (summary = {}, key = '') => {
  if (key === 'draft') return formatRupiah(summary?.draftAmount || 0);
  if (key === 'success') return formatRupiah(summary?.successAmount || 0);
  if (key === 'receivable') return formatRupiah(summary?.receivableDueTotal || 0);
  return '';
};

const resolveAreaAmountLabel = (key = '') => {
  if (key === 'draft') return 'Total Draft';
  if (key === 'success') return 'Total Sukses';
  if (key === 'receivable') return 'Total Piutang';
  return '';
};

const resolveAreaAmountStyle = (styles, key = '') => {
  if (key === 'draft') return styles.areaAmountDraft;
  if (key === 'success') return styles.areaAmountSuccess;
  if (key === 'receivable') return styles.areaAmountReceivable;
  return null;
};

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
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
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
      key: toIsoDate(date),
      iso: toIsoDate(date),
      label: String(date.getDate()),
      inCurrentMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
};
const isIsoDateInRange = (isoDate, fromDate, toDate) => {
  if (!fromDate || !toDate) {
    return false;
  }
  const start = fromDate <= toDate ? fromDate : toDate;
  const end = fromDate <= toDate ? toDate : fromDate;
  return isoDate > start && isoDate < end;
};
const resolveInitialCalendarCursor = (fromDate, toDate) => (
  startOfLocalMonth(parseIsoDate(fromDate) || parseIsoDate(toDate) || new Date())
);

const InvoiceWorkspaceHeader = ({
  sectionMeta,
  onFlushQueue,
  onRefresh,
  isLoading,
  invoiceListMeta,
  invoiceRealtimeState,
  onApplyRealtimeUpdates,
  invoiceFilter,
  onSelectAreaMenu,
  onSelectAreaFilter,
  invoiceAreaSummary,
  approvalStatusFilter,
  onChangeApprovalStatusFilter,
  invoiceSearch,
  onChangeInvoiceSearch,
  invoiceDateFrom,
  invoiceDateTo,
  onChangeInvoiceDateFrom,
  onChangeInvoiceDateTo,
  onClearInvoiceDateFilter,
}) => {
  const [isDateModalVisible, setIsDateModalVisible] = useState(false);
  const [activeDateField, setActiveDateField] = useState('from');
  const [draftDateFrom, setDraftDateFrom] = useState(String(invoiceDateFrom || '').trim());
  const [draftDateTo, setDraftDateTo] = useState(String(invoiceDateTo || '').trim());
  const [calendarCursor, setCalendarCursor] = useState(() => resolveInitialCalendarCursor(invoiceDateFrom, invoiceDateTo));
  const calendarCells = useMemo(() => buildCalendarCells(calendarCursor), [calendarCursor]);
  const pendingRealtimeCount = Math.max(Number(invoiceRealtimeState?.pendingCount || 0) || 0, 0);
  const shouldShowDateFilter = !DATE_FILTER_DISABLED_AREAS.has(String(invoiceFilter || '').trim());
  const cacheSource = String(invoiceListMeta?.source || '').trim();
  const realtimeMessage = cacheSource === 'local_success_cache'
    ? 'Invoice sukses tampil dari cache lokal. Search/Refresh tetap ambil server.'
    : cacheSource === 'local_success_cache_date_filter'
      ? 'Invoice sukses sesuai tanggal tampil dari cache lokal. Sinkron server tetap berjalan.'
      : String(invoiceRealtimeState?.message || '').trim();

  const openDateModal = () => {
    setDraftDateFrom(String(invoiceDateFrom || '').trim());
    setDraftDateTo(String(invoiceDateTo || '').trim());
    setActiveDateField('from');
    setCalendarCursor(resolveInitialCalendarCursor(invoiceDateFrom, invoiceDateTo));
    setIsDateModalVisible(true);
  };

  const closeDateModal = () => {
    setIsDateModalVisible(false);
  };

  const focusDateField = (field) => {
    setActiveDateField(field);
    const targetDate = field === 'from' ? draftDateFrom : draftDateTo;
    const parsed = parseIsoDate(targetDate);
    if (parsed) {
      setCalendarCursor(startOfLocalMonth(parsed));
    }
  };

  const handleSelectCalendarDate = (isoDate) => {
    if (activeDateField === 'from') {
      const nextTo = draftDateTo && draftDateTo < isoDate ? isoDate : draftDateTo;
      setDraftDateFrom(isoDate);
      setDraftDateTo(nextTo);
      setActiveDateField('to');
      return;
    }

    if (draftDateFrom && isoDate < draftDateFrom) {
      setDraftDateFrom(isoDate);
      setDraftDateTo(draftDateFrom);
      return;
    }

    setDraftDateTo(isoDate);
  };

  const handleApplyDateFilter = () => {
    onChangeInvoiceDateFrom?.(draftDateFrom);
    onChangeInvoiceDateTo?.(draftDateTo);
    closeDateModal();
  };

  const handleClearDateFilter = () => {
    setDraftDateFrom('');
    setDraftDateTo('');
    setActiveDateField('from');
    onClearInvoiceDateFilter?.();
  };

  return (
    <>
    <View style={styles.headerRow}>
      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle}>{sectionMeta?.title || 'Pusat Invoice'}</Text>
        <Text style={styles.headerDescription}>{sectionMeta?.description || ''}</Text>
      </View>
      <View style={styles.headerActions}>
        {pendingRealtimeCount > 0 ? (
          <Pressable style={[styles.refreshButton, styles.realtimeUpdateButton]} onPress={onApplyRealtimeUpdates}>
            <Text style={[styles.refreshButtonText, styles.realtimeUpdateButtonText]}>
              {pendingRealtimeCount >= 99 ? '99+' : pendingRealtimeCount} update baru
            </Text>
          </Pressable>
        ) : realtimeMessage ? (
          <Text style={styles.realtimeHint}>{realtimeMessage}</Text>
        ) : null}
        <Pressable style={styles.refreshButton} onPress={onFlushQueue}>
          <Text style={styles.refreshButtonText}>Kirim Ulang Antrian</Text>
        </Pressable>
        <Pressable style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>{isLoading ? 'Memuat...' : 'Refresh'}</Text>
        </Pressable>
      </View>
    </View>

    <View style={styles.areaGrid}>
      {AREA_CARDS.map((card) => {
        const active = invoiceFilter === card.key;
        const amount = resolveAreaAmount(invoiceAreaSummary, card.key);
        const amountLabel = resolveAreaAmountLabel(card.key);
        return (
          <Pressable
            key={card.key}
            style={[styles.areaCard, active ? styles.areaCardActive : null]}
            onPress={() => onSelectAreaMenu(card.menu)}
          >
            <Text style={[styles.areaCount, active ? styles.areaCountActive : null]}>
              {resolveAreaCount(invoiceAreaSummary, card.key)}
            </Text>
            <Text style={[styles.areaLabel, active ? styles.areaLabelActive : null]}>
              {card.label}
            </Text>
            {amount ? (
              <View style={styles.areaAmountWrap}>
                <Text style={styles.areaAmountLabel}>{amountLabel}</Text>
                <Text style={[styles.areaAmount, resolveAreaAmountStyle(styles, card.key)]}>
                  {amount}
                </Text>
              </View>
            ) : null}
            <Text style={[styles.areaMeta, active ? styles.areaMetaActive : null]}>
              {resolveAreaMeta(invoiceAreaSummary, card.key, card.meta)}
            </Text>
          </Pressable>
        );
      })}
    </View>

    <View style={styles.filterRow}>
      {PRIMARY_FILTERS.map((filter) => {
        const active = invoiceFilter === filter.key;
        return (
          <Pressable
            key={filter.key}
            style={[styles.filterButton, active ? styles.filterButtonActive : null]}
            onPress={() => onSelectAreaFilter(filter.key)}
          >
            <Text style={[styles.filterButtonText, active ? styles.filterButtonTextActive : null]}>
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </View>

    {invoiceFilter === 'approval' ? (
      <View style={styles.filterRow}>
        {APPROVAL_FILTERS.map((filter) => {
          const active = approvalStatusFilter === filter.key;
          return (
            <Pressable
              key={filter.key}
              style={[styles.filterButton, active ? styles.filterButtonActive : null]}
              onPress={() => onChangeApprovalStatusFilter(filter.key)}
            >
              <Text style={[styles.filterButtonText, active ? styles.filterButtonTextActive : null]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ) : null}

    <TextInput
      value={invoiceSearch}
      onChangeText={onChangeInvoiceSearch}
      placeholder="Cari customer / no HP / invoice / order / request approval..."
      placeholderTextColor="#777777"
      style={styles.searchInput}
    />

    {shouldShowDateFilter ? (
      <View style={styles.datePickerCard}>
        <Text style={styles.datePickerTitle}>Filter Tanggal</Text>
        <Text style={styles.datePickerMeta}>
          {invoiceDateFrom || invoiceDateTo
            ? `Periode aktif: ${invoiceDateFrom || 'awal'} s/d ${invoiceDateTo || 'akhir'}`
            : 'Periode aktif: Semua tanggal'}
        </Text>

        <View style={styles.dateActionRow}>
          <Pressable
            style={styles.dateOpenButton}
            onPress={openDateModal}
          >
            <Text style={styles.dateOpenButtonText}>
              Buka Kalender
            </Text>
          </Pressable>
          <Pressable
            style={styles.dateResetButton}
            onPress={handleClearDateFilter}
          >
            <Text style={styles.dateResetButtonText}>
              Reset Tanggal
            </Text>
          </Pressable>
        </View>
      </View>
    ) : null}

    {shouldShowDateFilter ? (
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
            <Text style={styles.modalTitle}>Pilih Tanggal Invoice</Text>
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
              <Text style={styles.modalPrimaryButtonText}>Terapkan</Text>
            </Pressable>
          </View>
        </View>
      </View>
      </Modal>
    ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#173c87',
    marginBottom: 2,
  },
  headerDescription: {
    fontSize: 11,
    color: '#667897',
    lineHeight: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#0755b8',
    backgroundColor: '#0755b8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
  },
  realtimeUpdateButton: {
    borderColor: '#1d9a57',
    backgroundColor: '#1d9a57',
  },
  realtimeUpdateButtonText: {
    color: '#ffffff',
  },
  realtimeHint: {
    maxWidth: 240,
    color: '#667897',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'right',
  },
  areaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  areaCard: {
    flexGrow: 1,
    flexBasis: 180,
    minHeight: 124,
    borderWidth: 1,
    borderColor: '#c7d7ef',
    backgroundColor: '#f7fbff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'space-between',
  },
  areaCardActive: {
    borderColor: '#0755b8',
    backgroundColor: '#eef4ff',
  },
  areaCount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#163a85',
  },
  areaCountActive: {
    color: '#11469f',
  },
  areaLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
    color: '#24426f',
    textTransform: 'uppercase',
  },
  areaLabelActive: {
    color: '#11469f',
  },
  areaMeta: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    color: '#5c6780',
  },
  areaMetaActive: {
    color: '#35507a',
  },
  areaAmountWrap: {
    marginTop: 6,
    marginBottom: 4,
  },
  areaAmountLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#667085',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  areaAmount: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  areaAmountDraft: {
    color: '#b42318',
  },
  areaAmountSuccess: {
    color: '#067647',
  },
  areaAmountReceivable: {
    color: '#101828',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: '#d4dcea',
    backgroundColor: '#f7f9fd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterButtonActive: {
    borderColor: '#0755b8',
    backgroundColor: '#0755b8',
  },
  filterButtonText: {
    fontSize: 11,
    color: '#445878',
    fontWeight: '800',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d4dcea',
    backgroundColor: '#fbfdff',
    borderRadius: 8,
    color: '#14233d',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
  },
  datePickerCard: {
    borderWidth: 1,
    borderColor: '#c7d7ef',
    backgroundColor: '#f7fbff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  datePickerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#24426f',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  datePickerMeta: {
    fontSize: 11,
    color: '#5c6780',
    marginBottom: 8,
  },
  dateActionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dateOpenButton: {
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: '#0755b8',
    backgroundColor: '#0755b8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  dateOpenButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  dateResetButton: {
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: '#c7d2e5',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  dateResetButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#344054',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  modalBackdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 390,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#d8e2f2',
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalCloseButton: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  modalCloseButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#344054',
  },
  modalHelperText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#475467',
    marginBottom: 12,
  },
  selectionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  selectionCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  selectionCardActive: {
    borderColor: '#0755b8',
    backgroundColor: '#eef4ff',
  },
  selectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#667085',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  selectionValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#101828',
  },
  calendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  calendarNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#c7d2e5',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1d4ed8',
  },
  calendarMonthLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  calendarDayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  calendarDayHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 12,
  },
  calendarDayCell: {
    width: '13.3%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayCellMuted: {
    backgroundColor: '#f8fafc',
    borderColor: '#edf2f7',
  },
  calendarDayCellInRange: {
    backgroundColor: '#dbeafe',
    borderColor: '#bfdbfe',
  },
  calendarDayCellSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
  },
  calendarDayCellText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  calendarDayCellTextMuted: {
    color: '#94a3b8',
  },
  calendarDayCellTextSelected: {
    color: '#ffffff',
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  modalSecondaryButton: {
    flexGrow: 1,
    minWidth: 84,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modalSecondaryButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#344054',
  },
  modalPrimaryButton: {
    flexGrow: 1,
    minWidth: 100,
    borderWidth: 1,
    borderColor: '#0755b8',
    backgroundColor: '#0755b8',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modalPrimaryButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },
});

export default InvoiceWorkspaceHeader;
