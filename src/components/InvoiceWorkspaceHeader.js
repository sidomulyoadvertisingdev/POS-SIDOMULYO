import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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

const RECEIVABLE_FILTERS = [
  { key: 'all', label: 'Semua Piutang' },
  { key: 'payable', label: 'Bisa Dibayar' },
  { key: 'blocked', label: 'Belum Bisa Dibayar' },
];

const APPROVAL_FILTERS = [
  { key: 'all', label: 'Semua Approval' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
  { key: 'resolved', label: 'Selesai' },
];

const resolveAreaCount = (summary = {}, key = '') => {
  if (key === 'draft') return Number(summary?.draftCount || 0) || 0;
  if (key === 'success') return Number(summary?.successCount || 0) || 0;
  if (key === 'approval') return Number(summary?.approvalCount || 0) || 0;
  if (key === 'receivable') return Number(summary?.receivableCount || 0) || 0;
  return 0;
};

const resolveAreaMeta = (summary = {}, key = '', fallback = '') => {
  if (key === 'receivable') {
    return `Outstanding ${formatRupiah(summary?.receivableDueTotal || 0)}`;
  }
  return fallback;
};

const InvoiceWorkspaceHeader = ({
  sectionMeta,
  onFlushQueue,
  onRefresh,
  isLoading,
  invoiceFilter,
  onSelectAreaMenu,
  onSelectAreaFilter,
  invoiceAreaSummary,
  receivableStatusFilter,
  onChangeReceivableStatusFilter,
  approvalStatusFilter,
  onChangeApprovalStatusFilter,
  invoiceSearch,
  onChangeInvoiceSearch,
}) => (
  <>
    <View style={styles.headerRow}>
      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle}>{sectionMeta?.title || 'Pusat Invoice'}</Text>
        <Text style={styles.headerDescription}>{sectionMeta?.description || ''}</Text>
      </View>
      <View style={styles.headerActions}>
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

    {invoiceFilter === 'receivable' ? (
      <View style={styles.filterRow}>
        {RECEIVABLE_FILTERS.map((filter) => {
          const active = receivableStatusFilter === filter.key;
          return (
            <Pressable
              key={filter.key}
              style={[styles.filterButton, active ? styles.filterButtonActive : null]}
              onPress={() => onChangeReceivableStatusFilter(filter.key)}
            >
              <Text style={[styles.filterButtonText, active ? styles.filterButtonTextActive : null]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ) : null}

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
  </>
);

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
    fontWeight: '800',
    color: '#1f1f1f',
    marginBottom: 2,
  },
  headerDescription: {
    fontSize: 11,
    color: '#3a3a3a',
    lineHeight: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
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
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#c7d7ef',
    backgroundColor: '#f7fbff',
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'space-between',
  },
  areaCardActive: {
    borderColor: '#2250c9',
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
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: '#9c9c9c',
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  filterButtonActive: {
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
  },
  filterButtonText: {
    fontSize: 11,
    color: '#2c2c2c',
    fontWeight: '700',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#bdbdbd',
    backgroundColor: '#ffffff',
    color: '#1f1f1f',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
});

export default InvoiceWorkspaceHeader;
