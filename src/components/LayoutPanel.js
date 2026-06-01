import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
const { resolveProofingReleaseState } = require('../utils/proofingReleaseGate');

const SIDOMULYO_BLUE = '#0755b8';

const toText = (value, fallback = '-') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDateTime = (value, fallback = '-') => {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const date = new Date(text.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return text;
  return `${date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
};

const sizeLabel = (row, prefix = 'item') => {
  const source = prefix === 'production'
    ? [row?.item?.internal_width_mm, row?.item?.internal_height_mm]
    : [row?.item?.input_width_mm, row?.item?.input_height_mm];
  const width = toText(source[0], '');
  const height = toText(source[1], '');
  if (!width || !height) return '-';
  return `${width} x ${height} mm`;
};

const proofingKey = (row) => Number(row?.id || 0);

const resolvePreviewUrl = (row) => String(row?.final_url || row?.preview_url || '').trim();

const LayoutPanel = ({
  rows,
  isLoading,
  searchText,
  onChangeSearchText,
  onRefresh,
  onOpenPreviewFile,
  onUploadLayoutFile,
  onReleaseSelected,
  processingProofingId,
}) => {
  const items = Array.isArray(rows) ? rows : [];
  const [selectedIds, setSelectedIds] = useState({});
  const [layoutFilePath, setLayoutFilePath] = useState('');
  const [layoutMetadata, setLayoutMetadata] = useState(null);
  const selectedRows = useMemo(
    () => items.filter((row) => selectedIds[proofingKey(row)]),
    [items, selectedIds],
  );
  const selectedCount = selectedRows.length;
  const readyCount = items.filter((row) => resolveProofingReleaseState(row).canRelease).length;
  const busy = Number(processingProofingId || 0) > 0;
  const effectiveLayoutPath = layoutFilePath;

  const toggleRow = (row) => {
    const id = proofingKey(row);
    if (!(id > 0) || busy) return;
    setSelectedIds((current) => {
      const next = { ...current };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      return next;
    });
  };

  const selectAll = () => {
    if (busy) return;
    const next = {};
    items.forEach((row) => {
      const id = proofingKey(row);
      if (id > 0 && resolveProofingReleaseState(row).canRelease) {
        next[id] = true;
      }
    });
    setSelectedIds(next);
  };

  const clearSelection = () => {
    if (busy) return;
    setSelectedIds({});
  };

  const uploadLayout = async () => {
    if (selectedCount === 0 || busy) return;
    const metadata = await onUploadLayoutFile?.(selectedRows[0]);
    if (!metadata) return;
    setLayoutMetadata(metadata);
    const nextPath = String(metadata?.layout_file_path || metadata?.design_open_url || metadata?.design_relative_path || '').trim();
    if (nextPath) {
      setLayoutFilePath(nextPath);
    }
  };

  const releaseSelected = async () => {
    if (selectedCount === 0 || busy || !String(effectiveLayoutPath || '').trim()) return;
    await onReleaseSelected?.(selectedRows, {
      layout_file_path: effectiveLayoutPath,
      layout_file_category: 'layout gabungan',
      ...(layoutMetadata || {}),
    });
    setSelectedIds({});
    setLayoutMetadata(null);
    setLayoutFilePath('');
  };

  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <View>
          <Text style={styles.heroBrand}>SIDOMULYO POS</Text>
          <Text style={styles.heroTitle}>LAYOUT PRODUKSI</Text>
        </View>
        <Text style={styles.heroMeta}>Pilih produk approved dari invoice berbeda untuk satu layout produksi</Text>
      </View>

      <View style={styles.topRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Siap Layout</Text>
          <Text style={styles.metricValue}>{readyCount}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Dipilih</Text>
          <Text style={styles.metricValue}>{selectedCount}</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>{isLoading ? 'Memuat...' : 'Refresh'}</Text>
        </Pressable>
      </View>

      <View style={styles.workspace}>
        <View style={styles.listCard}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>Produk Approved Proofing</Text>
              <Text style={styles.panelSubtitle}>Pilih produk yang desainnya bisa digabung. Invoice tetap dihitung progress per item.</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable style={styles.softButton} onPress={selectAll} disabled={busy}>
                <Text style={styles.softButtonText}>Pilih Semua</Text>
              </Pressable>
              <Pressable style={styles.softButton} onPress={clearSelection} disabled={busy}>
                <Text style={styles.softButtonText}>Bersihkan</Text>
              </Pressable>
            </View>
          </View>
          <TextInput
            value={searchText}
            onChangeText={onChangeSearchText}
            placeholder="Cari invoice / customer / produk..."
            placeholderTextColor="#73839d"
            style={styles.searchInput}
          />
          {items.length === 0 ? (
            <Text style={styles.emptyText}>{isLoading ? 'Memuat item layout...' : 'Belum ada proofing approved yang siap layout.'}</Text>
          ) : (
            <ScrollView style={styles.layoutScroll} nestedScrollEnabled showsVerticalScrollIndicator>
              {items.map((row, index) => {
                const id = proofingKey(row);
                const releaseState = resolveProofingReleaseState(row);
                const selected = Boolean(selectedIds[id]);
                return (
                  <Pressable
                    key={String(id || `layout-${index}`)}
                    style={[styles.rowCard, selected ? styles.rowCardSelected : null, !releaseState.canRelease ? styles.rowCardDisabled : null]}
                    onPress={() => toggleRow(row)}
                    disabled={!releaseState.canRelease || busy}
                  >
                    <View style={styles.checkBox}>
                      <Text style={styles.checkText}>{selected ? 'OK' : ''}</Text>
                    </View>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle}>{toText(row?.order?.invoice?.invoice_no)} - {toText(row?.item?.name, 'Item desain')}</Text>
                      <Text style={styles.rowMeta}>Customer: {toText(row?.customer?.name || row?.order?.customer?.name, 'Pelanggan umum')}</Text>
                      <Text style={styles.rowMeta}>Ukuran: {sizeLabel(row)} | Produksi: {sizeLabel(row, 'production')}</Text>
                      <Text style={styles.rowMeta}>Approved: {formatDateTime(row?.approved_at)} | Payment: {toText(releaseState.paymentStatusLabel)}</Text>
                      {!releaseState.canRelease ? <Text style={styles.blockedText}>{toText(releaseState.blockingHint, releaseState.releasedLabel || 'Belum siap masuk produksi.')}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.panelTitle}>Layout Gabungan</Text>
          <Text style={styles.panelSubtitle}>Produk lintas invoice bisa masuk satu layout, tetapi status invoice tetap mengikuti progres tiap produk.</Text>
          <View style={styles.previewFrame}>
            {selectedRows.length > 0 && resolvePreviewUrl(selectedRows[0]) ? (
              <Image source={{ uri: resolvePreviewUrl(selectedRows[0]) }} style={styles.previewImage} resizeMode="contain" />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.previewBrand}>LAYOUT</Text>
                <Text style={styles.previewText}>Pilih produk untuk melihat file proofing/final pertama.</Text>
              </View>
            )}
          </View>
          <Text style={styles.inputLabel}>Path / link file layout produksi</Text>
          <View style={styles.pathReadonlyBox}>
            <Text style={effectiveLayoutPath ? styles.pathReadonlyText : styles.pathReadonlyPlaceholder}>
              {effectiveLayoutPath || 'Otomatis terisi setelah Upload File Layout'}
            </Text>
          </View>
          <View style={styles.actionGrid}>
            <Pressable style={[styles.actionButton, selectedCount === 0 || busy ? styles.actionDisabled : null]} disabled={selectedCount === 0 || busy} onPress={uploadLayout}>
              <Text style={styles.actionButtonText}>{busy ? 'Memproses...' : 'Upload File Layout'}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.actionPurple, selectedCount === 0 || busy || !String(effectiveLayoutPath || '').trim() ? styles.actionDisabled : null]}
              disabled={selectedCount === 0 || busy || !String(effectiveLayoutPath || '').trim()}
              onPress={releaseSelected}
            >
              <Text style={styles.actionButtonText}>Naikkan {selectedCount || 0} Produk ke Produksi</Text>
            </Pressable>
          </View>
          {selectedRows.length > 0 ? (
            <View style={styles.selectedBox}>
              <Text style={styles.selectedTitle}>Produk dalam layout ini</Text>
              {selectedRows.map((row) => (
                <View key={`selected-${proofingKey(row)}`} style={styles.selectedRow}>
                  <Text style={styles.selectedText}>{toText(row?.order?.invoice?.invoice_no)} | {toText(row?.item?.name)}</Text>
                  <Pressable onPress={() => onOpenPreviewFile?.(row, 'final')}>
                    <Text style={styles.openFileText}>Buka file</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { gap: 10, paddingBottom: 12 },
  hero: {
    borderRadius: 10,
    backgroundColor: SIDOMULYO_BLUE,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroBrand: { color: '#d9e7ff', fontSize: 12, fontWeight: '900' },
  heroTitle: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  heroMeta: { color: '#d9e7ff', fontSize: 11, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  metricCard: { borderWidth: 1, borderColor: '#d4dcea', backgroundColor: '#ffffff', borderRadius: 10, padding: 10, minWidth: 130 },
  metricLabel: { fontSize: 10, color: '#53647d', fontWeight: '800' },
  metricValue: { fontSize: 22, color: '#173c87', fontWeight: '900' },
  refreshButton: { marginLeft: 'auto', borderRadius: 8, backgroundColor: SIDOMULYO_BLUE, paddingHorizontal: 12, paddingVertical: 8 },
  refreshButtonText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  workspace: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  listCard: { flexGrow: 1, flexShrink: 1, flexBasis: 660, borderWidth: 1, borderColor: '#d4dcea', borderRadius: 10, backgroundColor: '#ffffff', padding: 12 },
  detailCard: { flexGrow: 1, flexShrink: 1, flexBasis: 330, borderWidth: 1, borderColor: '#d4dcea', borderRadius: 10, backgroundColor: '#ffffff', padding: 12, gap: 8 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  panelTitle: { fontSize: 14, color: '#173c87', fontWeight: '900' },
  panelSubtitle: { fontSize: 11, color: '#53647d', fontWeight: '700', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  softButton: { borderWidth: 1, borderColor: '#c7d8f4', backgroundColor: '#f4f8ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  softButtonText: { color: '#0755b8', fontSize: 11, fontWeight: '800' },
  searchInput: { borderWidth: 1, borderColor: '#d4dcea', backgroundColor: '#fbfdff', borderRadius: 8, color: '#14233d', fontSize: 12, paddingHorizontal: 12, paddingVertical: 9, marginVertical: 8 },
  layoutScroll: { maxHeight: 530 },
  emptyText: { fontSize: 12, color: '#53647d', fontWeight: '700', paddingVertical: 14 },
  rowCard: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: '#dce5f4', backgroundColor: '#ffffff', borderRadius: 10, padding: 10, marginBottom: 8 },
  rowCardSelected: { borderColor: SIDOMULYO_BLUE, backgroundColor: '#f1f6ff' },
  rowCardDisabled: { opacity: 0.65 },
  checkBox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: SIDOMULYO_BLUE, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkText: { color: SIDOMULYO_BLUE, fontSize: 15, fontWeight: '900' },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { color: '#14233d', fontSize: 12, fontWeight: '900' },
  rowMeta: { color: '#53647d', fontSize: 11, fontWeight: '700' },
  blockedText: { color: '#b45309', fontSize: 11, fontWeight: '800', marginTop: 3 },
  previewFrame: { height: 230, borderWidth: 1, borderColor: '#d7e2f4', borderRadius: 10, backgroundColor: '#f8fbff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', height: '100%' },
  previewPlaceholder: { alignItems: 'center', gap: 5, padding: 14 },
  previewBrand: { color: SIDOMULYO_BLUE, fontSize: 22, fontWeight: '900' },
  previewText: { color: '#53647d', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  inputLabel: { color: '#243957', fontSize: 11, fontWeight: '900' },
  pathReadonlyBox: { borderWidth: 1, borderColor: '#d4dcea', backgroundColor: '#f8fbff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, minHeight: 38, justifyContent: 'center' },
  pathReadonlyText: { color: '#14233d', fontSize: 12, fontWeight: '800' },
  pathReadonlyPlaceholder: { color: '#8a9ab3', fontSize: 12, fontWeight: '700' },
  actionGrid: { gap: 8 },
  actionButton: { backgroundColor: SIDOMULYO_BLUE, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  actionPurple: { backgroundColor: '#6d28d9' },
  actionDisabled: { opacity: 0.55 },
  actionButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  selectedBox: { borderWidth: 1, borderColor: '#dce5f4', borderRadius: 10, padding: 10, gap: 6 },
  selectedTitle: { color: '#173c87', fontSize: 12, fontWeight: '900' },
  selectedRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: '#edf2fb', paddingTop: 6 },
  selectedText: { flex: 1, color: '#435674', fontSize: 11, fontWeight: '700' },
  openFileText: { color: SIDOMULYO_BLUE, fontSize: 11, fontWeight: '900' },
});

export default LayoutPanel;
