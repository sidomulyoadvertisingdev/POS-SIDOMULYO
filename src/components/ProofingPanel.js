import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
const { resolveProofingReleaseState } = require('../utils/proofingReleaseGate');

const STATUS_FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Terkirim' },
  { key: 'approved', label: 'Approved' },
  { key: 'revision', label: 'Revisi' },
];

const toText = (value, fallback = '-') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const resolveProofingStatusKey = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';
  if (['sent', 'terkirim'].includes(key)) return 'sent';
  if (['approved', 'disetujui'].includes(key)) return 'approved';
  if (['revision', 'revisi'].includes(key)) return 'revision';
  if (['cancelled', 'dibatalkan'].includes(key)) return 'cancelled';
  if (['draft'].includes(key)) return 'draft';
  return key;
};

const toStatusLabel = (value) => {
  const key = resolveProofingStatusKey(value);
  if (key === 'draft') return 'Draft';
  if (key === 'sent') return 'Sudah Dikirim';
  if (key === 'approved') return 'Approved';
  if (key === 'revision') return 'Revisi';
  if (key === 'cancelled') return 'Dibatalkan';
  return toText(key, '-');
};

const toFlowLabel = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'proofing_first') return 'Proofing dulu';
  if (key === 'pay_first') return 'Bayar dulu';
  if (key === 'none') return 'Tanpa proofing';
  return toText(key.replace(/_/g, ' '), '-');
};

const toActorName = (logRow) => {
  const actorName = String(logRow?.actor?.name || '').trim();
  if (actorName) return actorName;
  const designerName = String(logRow?.designer?.name || '').trim();
  if (designerName) return designerName;
  const customerName = String(logRow?.customer?.name || '').trim();
  if (customerName) return customerName;
  return '-';
};

const statusBadgeStyle = (status) => {
  const key = resolveProofingStatusKey(status);
  if (key === 'approved') return styles.badgeApproved;
  if (key === 'sent') return styles.badgeSent;
  if (key === 'revision') return styles.badgeRevision;
  if (key === 'cancelled') return styles.badgeCancelled;
  return styles.badgeDraft;
};

const ProofingPanel = ({
  rows,
  isLoading,
  statusFilter,
  onChangeStatusFilter,
  searchText,
  onChangeSearchText,
  onRefresh,
  onUploadPreview,
  onUploadFinal,
  onOpenPublicLink,
  onViewHistory,
  onSendWhatsapp,
  onReleaseToProduction,
  processingProofingId,
}) => {
  const items = Array.isArray(rows) ? rows : [];
  const counts = {
    draft: 0,
    sent: 0,
    approved: 0,
    revision: 0,
  };

  items.forEach((row) => {
    const key = resolveProofingStatusKey(row?.status);
    if (Object.prototype.hasOwnProperty.call(counts, key)) {
      counts[key] += 1;
    }
  });

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Queue Proofing Design</Text>
          <Text style={styles.subtitle}>
            Task proofing per item order untuk designer, kirim link customer, dan pelepasan ke produksi.
          </Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>{isLoading ? 'Memuat...' : 'Refresh'}</Text>
        </Pressable>
      </View>

      <View style={styles.counterRow}>
        <Text style={styles.counterText}>Draft: {counts.draft}</Text>
        <Text style={styles.counterText}>Terkirim: {counts.sent}</Text>
        <Text style={styles.counterText}>Approved: {counts.approved}</Text>
        <Text style={styles.counterText}>Revisi: {counts.revision}</Text>
      </View>

      <TextInput
        value={searchText}
        onChangeText={onChangeSearchText}
        placeholder="Cari proofing / invoice / customer / item..."
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
          {isLoading ? 'Memuat data proofing...' : 'Belum ada task proofing.'}
        </Text>
      ) : (
        <View style={styles.listWrap}>
          {items.map((row, index) => {
            const proofingId = Number(row?.id || 0);
            const isBusy = Number(processingProofingId || 0) === proofingId;
            const releaseState = resolveProofingReleaseState(row);
            const paymentGateLabel = toText(row?.payment_gate?.label, 'Pembayaran belum dievaluasi');
            const canRelease = releaseState.canRelease === true;
            const releasedToProduction = releaseState.releasedToProduction === true;
            const productName = toText(row?.item?.name, 'Item desain');
            const flowText = toFlowLabel(row?.item?.proofing_flow);
            const latestLog = row?.latest_log && typeof row.latest_log === 'object' ? row.latest_log : null;
            const latestLogActor = toActorName(latestLog);

            return (
              <View key={String(proofingId || `proofing-${index}`)} style={styles.card}>
                <View style={styles.infoWrap}>
                  <Text style={styles.cardTitle}>
                    {toText(row?.proofing_code, `Proofing #${proofingId}`)} | Order #{Number(row?.order?.id || 0)}
                  </Text>
                  <Text style={styles.cardMeta}>
                    Invoice: {toText(row?.order?.invoice?.invoice_no)} | Item #{Number(row?.item?.id || 0)}
                  </Text>
                  <Text style={styles.cardMeta}>Customer: {toText(row?.customer?.name, 'Pelanggan umum')}</Text>
                  <Text style={styles.cardMeta}>No WA: {toText(row?.customer?.phone)}</Text>
                  <Text style={styles.cardMeta}>Item: {productName}</Text>
                  <Text style={styles.cardMeta}>
                    Ukuran input: {toText(row?.item?.input_width_mm)} x {toText(row?.item?.input_height_mm)} mm
                  </Text>
                  <Text style={styles.cardMeta}>
                    Ukuran produksi: {toText(row?.item?.internal_width_mm)} x {toText(row?.item?.internal_height_mm)} mm
                  </Text>
                  <Text style={styles.cardMeta}>Designer / PIC: {toText(row?.designer?.name)}</Text>
                  <Text style={styles.cardMeta}>Flow proofing: {flowText}</Text>
                  <Text style={styles.cardMeta}>
                    Status bayar: {toText(releaseState.paymentStatusLabel)} | Gate produksi: {paymentGateLabel}
                  </Text>
                  <Text style={styles.cardMeta}>History event: {Number(row?.history_count || 0)}</Text>
                  {toText(row?.revision_note_from_customer, '') ? (
                    <Text style={styles.revisionText}>
                      Revisi customer: {toText(row?.revision_note_from_customer, '-')}
                    </Text>
                  ) : null}
                  {toText(row?.notes_from_designer, '') ? (
                    <Text style={styles.cardMeta}>Catatan designer: {row.notes_from_designer}</Text>
                  ) : null}
                  {latestLog ? (
                    <View style={styles.latestLogWrap}>
                      <Text style={styles.latestLogTitle}>Log terakhir: {toText(latestLog?.event_label)}</Text>
                      <Text style={styles.latestLogMeta}>
                        Oleh: {latestLogActor} | Waktu: {toText(latestLog?.created_at)}
                      </Text>
                      {toText(latestLog?.event_note, '') ? (
                        <Text style={styles.latestLogNote}>{toText(latestLog?.event_note)}</Text>
                      ) : null}
                    </View>
                  ) : null}
                  <View style={[styles.badge, statusBadgeStyle(row?.status)]}>
                    <Text style={styles.badgeText}>{toStatusLabel(row?.status)}</Text>
                  </View>
                </View>

                <View style={styles.actionWrap}>
                  <Pressable
                    style={[styles.actionButton, styles.secondaryButton, isBusy ? styles.actionDisabled : null]}
                    disabled={isBusy}
                    onPress={() => onUploadPreview?.(row)}
                  >
                    <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
                      {isBusy ? 'Memproses...' : 'Upload Preview'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.secondaryButton, isBusy ? styles.actionDisabled : null]}
                    disabled={isBusy}
                    onPress={() => onUploadFinal?.(row)}
                  >
                    <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
                      {isBusy ? 'Memproses...' : 'Upload Final'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, isBusy ? styles.actionDisabled : null]}
                    disabled={isBusy || !String(row?.proofing_url || '').trim()}
                    onPress={() => onOpenPublicLink?.(row)}
                  >
                    <Text style={styles.actionButtonText}>Buka Link Proofing</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.secondaryButton, isBusy ? styles.actionDisabled : null]}
                    disabled={isBusy}
                    onPress={() => onViewHistory?.(row)}
                  >
                    <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Lihat History</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, isBusy ? styles.actionDisabled : null]}
                    disabled={isBusy || !String(row?.preview_url || '').trim()}
                    onPress={() => onSendWhatsapp?.(row)}
                  >
                    <Text style={styles.actionButtonText}>Kirim Proofing WA</Text>
                  </Pressable>
                  {!releasedToProduction ? (
                    <Pressable
                      style={[
                        styles.actionButton,
                        canRelease ? styles.releaseReadyButton : styles.actionDisabled,
                      ]}
                      disabled={isBusy || !canRelease}
                      onPress={() => onReleaseToProduction?.(row)}
                    >
                      <Text style={styles.actionButtonText}>
                        {isBusy ? 'Memproses...' : 'Masuk Produksi'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {releasedToProduction ? (
                    <View style={styles.releaseDoneBadge}>
                      <Text style={styles.releaseDoneText}>
                        {toText(releaseState.releasedLabel, 'Sudah masuk produksi')}
                      </Text>
                    </View>
                  ) : null}
                  {!releasedToProduction && !canRelease ? (
                    <Text style={styles.hintText}>
                      {toText(releaseState.blockingHint, 'Tombol produksi aktif setelah proofing approved dan syarat pembayaran terpenuhi.')}
                    </Text>
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
    backgroundColor: 'rgba(255,255,255,0.58)',
    padding: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1f1f1f',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 11,
    color: '#4b5565',
    lineHeight: 16,
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
    gap: 10,
  },
  infoWrap: {
    flex: 1,
    gap: 3,
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
  latestLogWrap: {
    marginTop: 4,
    padding: 6,
    borderWidth: 1,
    borderColor: '#d3d9e8',
    backgroundColor: '#f3f7ff',
    gap: 2,
  },
  latestLogTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#163976',
  },
  latestLogMeta: {
    fontSize: 10,
    color: '#36527f',
  },
  latestLogNote: {
    fontSize: 10,
    color: '#2e3b57',
  },
  revisionText: {
    fontSize: 11,
    color: '#9b1c1c',
    fontWeight: '700',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  badgeDraft: {
    backgroundColor: '#e5e7eb',
  },
  badgeSent: {
    backgroundColor: '#dbeafe',
  },
  badgeApproved: {
    backgroundColor: '#dcfce7',
  },
  badgeRevision: {
    backgroundColor: '#fef3c7',
  },
  badgeCancelled: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1f1f1f',
  },
  actionWrap: {
    minWidth: 178,
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
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderColor: '#2250c9',
  },
  secondaryButtonText: {
    color: '#2250c9',
  },
  releaseReadyButton: {
    backgroundColor: '#0f9d58',
    borderColor: '#0f9d58',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
    textAlign: 'center',
  },
  actionDisabled: {
    opacity: 0.55,
  },
  hintText: {
    fontSize: 10,
    color: '#7a2d2d',
    fontWeight: '700',
    lineHeight: 14,
  },
  releaseDoneBadge: {
    borderWidth: 1,
    borderColor: '#0f9d58',
    backgroundColor: '#ecfdf3',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  releaseDoneText: {
    color: '#067647',
    fontWeight: '800',
    fontSize: 11,
    textAlign: 'center',
  },
});

export default ProofingPanel;
