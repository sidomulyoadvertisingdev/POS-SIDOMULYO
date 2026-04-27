import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatRupiah } from '../utils/currency';

const STATUS_FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'waiting_design', label: 'Menunggu Design' },
  { key: 'waiting_production', label: 'Menunggu Produksi' },
  { key: 'in_batch', label: 'In Batch' },
  { key: 'printed', label: 'Printed' },
];

const toText = (value, fallback = '-') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const resolveProductionStatusKey = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';
  if (['waiting_design', 'pending_design', 'menunggu_design', 'menunggu design'].includes(key)) return 'waiting_design';
  if (['waiting_production', 'pending_production', 'menunggu_produksi', 'menunggu produksi'].includes(key)) return 'waiting_production';
  if (['in_batch', 'batch', 'proses_produksi', 'proses produksi'].includes(key)) return 'in_batch';
  if (['printed', 'finished', 'completed', 'done', 'ready_pickup', 'ready_for_pickup', 'siap_ambil', 'siap ambil'].includes(key)) return 'printed';
  if (['not_required'].includes(key)) return 'not_required';
  return key;
};

const humanizeStatusLabel = (value) => {
  const text = String(value || '').trim().replace(/[_-]+/g, ' ');
  if (!text) return '-';
  return text
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const toStatusLabel = (value) => {
  const key = resolveProductionStatusKey(value);
  if (key === 'waiting_design') return 'Menunggu Design';
  if (key === 'waiting_production') return 'Menunggu Produksi';
  if (key === 'in_batch') return 'In Batch';
  if (key === 'printed') return 'Printed / Selesai';
  if (key === 'not_required') return 'Tidak Perlu Produksi';
  return humanizeStatusLabel(key);
};

const statusBadgeStyle = (status) => {
  const key = resolveProductionStatusKey(status);
  if (key === 'printed') return styles.badgePrinted;
  if (key === 'in_batch') return styles.badgeBatch;
  if (key === 'waiting_design') return styles.badgeWaitingDesign;
  if (key === 'not_required') return styles.badgeNeutral;
  return styles.badgeWaitingProduction;
};

const ProductionPanel = ({
  rows,
  isLoading,
  statusFilter,
  onChangeStatusFilter,
  searchText,
  onChangeSearchText,
  onRefresh,
  onUpdateStatus,
  updatingItemId,
}) => {
  const items = Array.isArray(rows) ? rows : [];
  const counts = {
    waiting_design: 0,
    waiting_production: 0,
    in_batch: 0,
    printed: 0,
  };

  items.forEach((row) => {
    const key = resolveProductionStatusKey(row?.production_status);
    if (Object.prototype.hasOwnProperty.call(counts, key)) {
      counts[key] += 1;
    }
  });

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Daftar Produksi</Text>
        <Pressable style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>{isLoading ? 'Memuat...' : 'Refresh'}</Text>
        </Pressable>
      </View>

      <View style={styles.counterRow}>
        <Text style={styles.counterText}>Design: {counts.waiting_design}</Text>
        <Text style={styles.counterText}>Produksi: {counts.waiting_production}</Text>
        <Text style={styles.counterText}>In Batch: {counts.in_batch}</Text>
        <Text style={styles.counterText}>Printed: {counts.printed}</Text>
      </View>

      <TextInput
        value={searchText}
        onChangeText={onChangeSearchText}
        placeholder="Cari invoice / customer / produk..."
        placeholderTextColor="#777777"
        style={styles.searchInput}
      />

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((option) => (
          <Pressable
            key={option.key}
            style={[
              styles.filterButton,
              statusFilter === option.key ? styles.filterButtonActive : null,
            ]}
            onPress={() => onChangeStatusFilter?.(option.key)}
          >
            <Text
              style={[
                styles.filterButtonText,
                statusFilter === option.key ? styles.filterButtonTextActive : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {items.length === 0 ? (
        <Text style={styles.emptyText}>
          {isLoading ? 'Memuat data produksi...' : 'Belum ada item produksi.'}
        </Text>
      ) : (
        <View style={styles.listWrap}>
          {items.map((row, index) => {
            const rowId = Number(row?.id || 0);
            const orderId = Number(row?.pos_order_id || 0);
            const invoiceNo = toText(row?.order?.invoice?.invoice_no);
            const customerName = toText(row?.order?.customer?.name, 'Pelanggan umum');
            const productName = toText(row?.product?.name || row?.product_name, `Produk #${Number(row?.pos_product_id || 0)}`);
            const status = resolveProductionStatusKey(row?.production_status);
            const itemTotal = Number(row?.line_total || 0);
            const isUpdating = Number(updatingItemId || 0) === rowId;
            const canMoveToBatch = status === 'waiting_production';
            const canMoveToPrinted = status === 'in_batch';

            return (
              <View key={String(rowId || `prod-${index}`)} style={styles.card}>
                <View style={styles.infoWrap}>
                  <Text style={styles.cardTitle}>Item #{rowId} | Order #{orderId} | {invoiceNo}</Text>
                  <Text style={styles.cardMeta}>Customer: {customerName}</Text>
                  <Text style={styles.cardMeta}>Produk: {productName}</Text>
                  <Text style={styles.cardMeta}>Qty: {Number(row?.qty || 0)} | Total: {formatRupiah(itemTotal)}</Text>
                  <View style={[styles.badge, statusBadgeStyle(status)]}>
                    <Text style={styles.badgeText}>{toStatusLabel(status)}</Text>
                  </View>
                </View>
                <View style={styles.actionWrap}>
                  {canMoveToBatch ? (
                    <Pressable
                      style={[styles.actionButton, isUpdating ? styles.actionDisabled : null]}
                      disabled={isUpdating}
                      onPress={() => onUpdateStatus?.(row, 'in_batch')}
                    >
                      <Text style={styles.actionButtonText}>{isUpdating ? 'Memproses...' : 'Masuk Batch'}</Text>
                    </Pressable>
                  ) : null}
                  {canMoveToPrinted ? (
                    <Pressable
                      style={[styles.actionButton, isUpdating ? styles.actionDisabled : null]}
                      disabled={isUpdating}
                      onPress={() => onUpdateStatus?.(row, 'printed')}
                    >
                      <Text style={styles.actionButtonText}>{isUpdating ? 'Memproses...' : 'Tandai Printed'}</Text>
                    </Pressable>
                  ) : null}
                  {status === 'waiting_design' ? (
                    <Text style={styles.hintText}>Butuh upload design dulu.</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#999999',
    backgroundColor: 'rgba(255,255,255,0.55)',
    padding: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f1f1f',
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
  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  counterText: {
    fontSize: 11,
    color: '#2f2f2f',
    fontWeight: '600',
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
  emptyText: {
    fontSize: 12,
    color: '#505050',
  },
  listWrap: {
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#c2c2c2',
    backgroundColor: '#ffffff',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  infoWrap: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1f1f1f',
  },
  cardMeta: {
    fontSize: 11,
    color: '#343434',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  badgeWaitingDesign: {
    backgroundColor: '#f7e6c4',
  },
  badgeWaitingProduction: {
    backgroundColor: '#dce7ff',
  },
  badgeBatch: {
    backgroundColor: '#d8eef9',
  },
  badgePrinted: {
    backgroundColor: '#d8f3d4',
  },
  badgeNeutral: {
    backgroundColor: '#edf0f3',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1f1f1f',
  },
  actionWrap: {
    minWidth: 120,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 6,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  hintText: {
    fontSize: 10,
    color: '#7a2d2d',
    fontWeight: '700',
  },
});

export default ProductionPanel;
