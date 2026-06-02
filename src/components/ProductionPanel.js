import { useState } from 'react';
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

const normalizeTextKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const sanitizeCodeSegment = (value, fallback = 'ITEM') => {
  const text = String(value || '').trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 10);
  return text || fallback;
};

const parseDateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addHours = (date, hours) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + Number(hours || 0) * 60 * 60 * 1000);
};

const formatDateTime = (value) => {
  const date = value instanceof Date ? value : parseDateValue(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const toLocalInputDateTime = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const buildDelayPresetValue = (preset) => {
  const date = new Date();
  if (preset === 'plus_2h') {
    date.setHours(date.getHours() + 2);
  } else if (preset === 'plus_4h') {
    date.setHours(date.getHours() + 4);
  } else if (preset === 'tomorrow_morning') {
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
  } else if (preset === 'tomorrow_afternoon') {
    date.setDate(date.getDate() + 1);
    date.setHours(15, 0, 0, 0);
  }
  return toLocalInputDateTime(date);
};

const normalizeDelayDateInput = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const normalized = text.replace('T', ' ');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return '';
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  if (Number.isNaN(date.getTime())) return '';
  if (
    date.getFullYear() !== Number(year)
    || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day)
    || date.getHours() !== Number(hour)
    || date.getMinutes() !== Number(minute)
  ) {
    return '';
  }
  return toLocalInputDateTime(date);
};

const resolveMaterialName = (row) => toText(
  row?.material?.name
  || row?.material_text
  || row?.spec_snapshot?.cart_restore?.material_text
  || row?.spec_snapshot?.specs?.material
  || row?.product?.name
  || row?.product_name,
  'Bahan belum dipilih',
);

const resolveServiceLabel = (row) => toText(
  row?.service_label
  || row?.express_label
  || row?.order?.express_level
  || row?.spec_snapshot?.cart_restore?.express_label
  || row?.spec_snapshot?.express_label
  || row?.spec_snapshot?.service_label,
  'Reguler',
);

const resolveSlaHours = (row) => {
  const serviceText = normalizeTextKey(resolveServiceLabel(row));
  const directHour = Number(
    row?.sla_hours
    || row?.spec_snapshot?.sla_hours
    || row?.spec_snapshot?.cart_restore?.sla_hours
    || 0,
  );
  if (directHour > 0) return directHour;
  const hourMatch = serviceText.match(/(\d+)\s*jam/);
  if (hourMatch) return Number(hourMatch[1]);
  if (serviceText.includes('express') || serviceText.includes('expres')) return 2;
  if (serviceText.includes('24')) return 24;
  return 24;
};

const resolveDueAt = (row) => {
  const explicitDue = parseDateValue(
    row?.due_at
    || row?.deadline_at
    || row?.pickup_due_at
    || row?.spec_snapshot?.due_at
    || row?.spec_snapshot?.deadline_at,
  );
  if (explicitDue) return explicitDue;
  return addHours(parseDateValue(row?.order?.created_at || row?.created_at), resolveSlaHours(row));
};

const resolveLayoutMode = (row) => {
  const status = resolveProductionStatusKey(row?.production_status);
  const snapshotMode = normalizeTextKey(
    row?.layout_status
    || row?.layout_mode
    || row?.spec_snapshot?.layout_mode
    || row?.spec_snapshot?.cart_restore?.layout_mode,
  );
  if (snapshotMode.includes('langsung') || snapshotMode.includes('tidak perlu')) {
    return {
      key: 'direct_print',
      label: 'Langsung Cetak',
      tone: 'green',
    };
  }
  if (snapshotMode.includes('layout')) {
    return {
      key: 'layout',
      label: 'Proses Layout',
      tone: 'blue',
    };
  }
  if (status === 'waiting_design') {
    return {
      key: 'layout',
      label: 'Proses Layout',
      tone: 'blue',
    };
  }
  return {
    key: 'direct_print',
    label: 'Langsung Cetak',
    tone: 'green',
  };
};

const buildLayoutCode = (row, index) => {
  if (String(row?.layout_code || '').trim()) {
    return String(row.layout_code).trim();
  }
  const date = parseDateValue(row?.order?.created_at || row?.created_at) || new Date();
  const dateCode = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  const materialCode = sanitizeCodeSegment(resolveMaterialName(row));
  const sequence = String(index + 1).padStart(3, '0');
  return `LAY-${dateCode}-${materialCode}-${sequence}`;
};

const resolveDesignFileInfo = (row) => {
  const openUrl = String(row?.design_open_url || '').trim();
  const filePath = String(row?.design_file_path || '').trim();
  const relativePath = String(row?.design_relative_path || '').trim();
  const fileName = toText(
    row?.design_original_name
    || row?.design_file_name
    || (relativePath ? relativePath.split(/[\\/]+/).filter(Boolean).pop() : '')
    || (filePath ? filePath.split(/[\\/]+/).filter(Boolean).pop() : ''),
    '',
  );
  const location = openUrl || relativePath || filePath;
  return {
    hasFile: Boolean(openUrl || relativePath || filePath),
    fileName: fileName || 'File layout produksi',
    location,
    storage: String(row?.design_storage || '').trim(),
  };
};

const resolveProductionFlow = (row, designFile) => {
  const status = resolveProductionStatusKey(row?.production_status);
  const usesProofing = row?.proofing_required === true || Boolean(row?.proofing);
  const hasFile = Boolean(designFile?.hasFile);
  const layoutStatus = normalizeTextKey(row?.layout_status);

  const steps = [
    {
      key: 'file',
      label: usesProofing ? 'Proofing/Layout' : 'File Final',
      done: hasFile || ['waiting_production', 'in_batch', 'printed'].includes(status),
      active: status === 'waiting_design',
    },
    {
      key: 'queue',
      label: 'Antrean Produksi',
      done: ['in_batch', 'printed'].includes(status),
      active: status === 'waiting_production',
    },
    {
      key: 'batch',
      label: 'Cetak / Batch',
      done: status === 'printed',
      active: status === 'in_batch',
    },
    {
      key: 'printed',
      label: 'Selesai',
      done: status === 'printed',
      active: status === 'printed',
    },
  ];

  let title = 'Ikuti alur produksi backend';
  let hint = 'Status item akan bergerak sesuai gerbang validasi backend.';

  if (status === 'waiting_design') {
    title = usesProofing ? 'Menunggu layout hasil proofing' : 'Menunggu file final/layout';
    hint = usesProofing
      ? 'Naikkan dari menu Layout setelah proofing approved, pembayaran memenuhi syarat, dan file layout terupload.'
      : (hasFile
        ? 'File sudah ada. Tekan Masuk Produksi untuk menjalankan gerbang validasi backend.'
        : 'Upload file final/layout dulu. Backend menolak masuk produksi bila file final belum siap.');
  } else if (status === 'waiting_production') {
    title = 'Sudah masuk antrean produksi';
    hint = layoutStatus === 'proses_layout'
      ? 'Layout sedang diproses. Setelah siap cetak, operator bisa download file lalu Masuk Batch.'
      : 'Item sudah lolos gate. Operator bisa download file layout lalu Masuk Batch.';
  } else if (status === 'in_batch') {
    title = 'Sedang proses cetak/batch';
    hint = 'Tandai Printed hanya setelah cetak selesai dan siap lanjut ke proses berikutnya.';
  } else if (status === 'printed') {
    title = 'Produksi selesai';
    hint = 'Item sudah selesai cetak menurut status backend.';
  }

  return {
    status,
    usesProofing,
    hasFile,
    steps,
    title,
    hint,
  };
};

const buildLayoutRows = (items) => items
  .map((row, index) => {
    const dueAt = parseDateValue(row?.layout_due_at) || resolveDueAt(row);
    return {
      row,
      index,
      dueAt,
      materialName: resolveMaterialName(row),
      serviceLabel: resolveServiceLabel(row),
      layoutMode: resolveLayoutMode(row),
      code: buildLayoutCode(row, index),
    };
  })
  .sort((left, right) => {
    const leftTime = left.dueAt?.getTime?.() || Number.MAX_SAFE_INTEGER;
    const rightTime = right.dueAt?.getTime?.() || Number.MAX_SAFE_INTEGER;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return Number(left.row?.id || 0) - Number(right.row?.id || 0);
  });

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
  onReleaseToProduction,
  onUpdateLayoutPlan,
  onDownloadLayoutFile,
  onBuildDelayWhatsapp,
  updatingItemId,
}) => {
  const [delayItemId, setDelayItemId] = useState(null);
  const [delayExpectedAt, setDelayExpectedAt] = useState('');
  const [delayReason, setDelayReason] = useState('');
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

  const layoutRows = buildLayoutRows(items)
    .filter(({ row }) => ['waiting_design', 'waiting_production'].includes(resolveProductionStatusKey(row?.production_status)))
    .slice(0, 8);

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

      {layoutRows.length > 0 ? (
        <View style={styles.layoutBoard}>
          <View style={styles.layoutBoardHeader}>
            <View>
              <Text style={styles.layoutBoardTitle}>Antrian Layout & Siap Cetak</Text>
              <Text style={styles.layoutBoardHint}>Urut otomatis dari deadline terdekat agar operator tahu mana yang harus didahulukan.</Text>
            </View>
          </View>
          <View style={styles.layoutTableHeader}>
            <Text style={[styles.layoutColumnText, styles.layoutColumnWide]}>Jenis Order</Text>
            <Text style={styles.layoutColumnText}>Status</Text>
            <Text style={styles.layoutColumnText}>Deadline</Text>
            <Text style={styles.layoutColumnText}>Kode</Text>
          </View>
          {layoutRows.map(({ row, materialName, serviceLabel, layoutMode, dueAt, code }, visibleIndex) => {
            const productName = toText(row?.product?.name || row?.product_name, `Produk #${Number(row?.pos_product_id || 0)}`);
            return (
              <View key={`layout-${row?.id || visibleIndex}`} style={styles.layoutTableRow}>
                <View style={styles.layoutColumnWide}>
                  <Text style={styles.layoutItemTitle}>{visibleIndex + 1}. {materialName}</Text>
                  <Text style={styles.layoutItemMeta}>{productName} | {serviceLabel}</Text>
                </View>
                <View style={[styles.layoutModeBadge, layoutMode.tone === 'green' ? styles.layoutModeGreen : styles.layoutModeBlue]}>
                  <Text style={styles.layoutModeText}>{layoutMode.label}</Text>
                </View>
                <Text style={styles.layoutCellText}>{formatDateTime(dueAt)}</Text>
                <Text style={styles.layoutCodeText}>{code}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

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
            const usesProofing = row?.proofing_required === true || Boolean(row?.proofing);
            const designFile = resolveDesignFileInfo(row);
            const flow = resolveProductionFlow(row, designFile);
            const canReleaseWaitingDesign = status === 'waiting_design' && !usesProofing && designFile.hasFile;
            const canPlanLayout = status === 'waiting_production';
            const canSendDelayInfo = ['waiting_design', 'waiting_production', 'in_batch'].includes(status);

            return (
              <View key={String(rowId || `prod-${index}`)} style={styles.card}>
                <View style={styles.cardMain}>
                  <View style={styles.infoWrap}>
                    <Text style={styles.cardTitle}>Item #{rowId} | Order #{orderId} | {invoiceNo}</Text>
                    <Text style={styles.cardMeta}>Customer: {customerName}</Text>
                    <Text style={styles.cardMeta}>Produk: {productName}</Text>
                    <Text style={styles.cardMeta}>Qty: {Number(row?.qty || 0)} | Total: {formatRupiah(itemTotal)}</Text>
                    {designFile.hasFile ? (
                      <View style={styles.fileInfoBox}>
                        <Text style={styles.fileInfoTitle}>File Layout: {designFile.fileName}</Text>
                        <Text style={styles.fileInfoMeta}>{designFile.location}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.badge, statusBadgeStyle(status)]}>
                      <Text style={styles.badgeText}>{toStatusLabel(status)}</Text>
                    </View>
                    <View style={styles.flowBox}>
                      <Text style={styles.flowTitle}>{flow.title}</Text>
                      <View style={styles.flowStepRow}>
                        {flow.steps.map((step) => (
                          <View
                            key={`${rowId}-${step.key}`}
                            style={[
                              styles.flowStep,
                              step.done ? styles.flowStepDone : null,
                              step.active ? styles.flowStepActive : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.flowStepText,
                                step.done || step.active ? styles.flowStepTextActive : null,
                              ]}
                            >
                              {step.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.flowHint}>{flow.hint}</Text>
                    </View>
                  </View>
                  <View style={styles.actionWrap}>
                    {designFile.hasFile ? (
                      <Pressable
                        style={[styles.actionButton, styles.actionDownloadButton, isUpdating ? styles.actionDisabled : null]}
                        disabled={isUpdating}
                        onPress={() => onDownloadLayoutFile?.(row)}
                      >
                        <Text style={styles.actionDownloadButtonText}>Download File Layout</Text>
                      </Pressable>
                    ) : null}
                    {canReleaseWaitingDesign ? (
                      <>
                        <Pressable
                          style={[styles.actionButton, isUpdating ? styles.actionDisabled : null]}
                          disabled={isUpdating}
                          onPress={() => onReleaseToProduction?.(row)}
                        >
                          <Text style={styles.actionButtonText}>{isUpdating ? 'Memproses...' : 'Masuk Produksi'}</Text>
                        </Pressable>
                        <Text style={styles.hintText}>Backend akan cek invoice, payment, file final, approval, dan spesifikasi.</Text>
                      </>
                    ) : null}
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
                    {status === 'waiting_design' && usesProofing ? (
                      <Text style={styles.hintText}>Release item proofing lewat menu Layout setelah file layout terupload.</Text>
                    ) : null}
                    {status === 'waiting_design' && !usesProofing && !designFile.hasFile ? (
                      <Text style={styles.hintText}>Belum bisa Masuk Produksi: file final/layout belum ada.</Text>
                    ) : null}
                    {canPlanLayout ? (
                      <>
                        <Pressable
                          style={[styles.actionButton, styles.actionSoftButton, isUpdating ? styles.actionDisabled : null]}
                          disabled={isUpdating}
                          onPress={() => onUpdateLayoutPlan?.(row, 'proses_layout')}
                        >
                          <Text style={styles.actionSoftButtonText}>{isUpdating ? 'Memproses...' : 'Proses Layout'}</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.actionButton, styles.actionSoftGreen, isUpdating ? styles.actionDisabled : null]}
                          disabled={isUpdating}
                          onPress={() => onUpdateLayoutPlan?.(row, 'langsung_cetak')}
                        >
                          <Text style={styles.actionSoftButtonText}>{isUpdating ? 'Memproses...' : 'Langsung Cetak'}</Text>
                        </Pressable>
                      </>
                    ) : null}
                    {canSendDelayInfo ? (
                      <>
                        <Pressable
                          style={[styles.actionButton, styles.actionSoftOrange, isUpdating ? styles.actionDisabled : null]}
                          disabled={isUpdating}
                          onPress={() => {
                            setDelayItemId(delayItemId === rowId ? null : rowId);
                            setDelayExpectedAt('');
                            setDelayReason('');
                          }}
                        >
                          <Text style={styles.actionSoftButtonText}>Info Delay WA</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                </View>
                {delayItemId === rowId ? (
                  <View style={styles.delayBox}>
                    <Text style={styles.delayTitle}>Info keterlambatan ke customer</Text>
                    <TextInput
                      value={delayExpectedAt}
                      onChangeText={setDelayExpectedAt}
                      placeholder="Estimasi baru, contoh: 2026-05-31 21:00"
                      placeholderTextColor="#8a9ab3"
                      style={styles.delayInput}
                    />
                    <View style={styles.delayPresetRow}>
                      <Pressable style={styles.delayPresetButton} onPress={() => setDelayExpectedAt(buildDelayPresetValue('plus_2h'))}>
                        <Text style={styles.delayPresetText}>+2 jam</Text>
                      </Pressable>
                      <Pressable style={styles.delayPresetButton} onPress={() => setDelayExpectedAt(buildDelayPresetValue('plus_4h'))}>
                        <Text style={styles.delayPresetText}>+4 jam</Text>
                      </Pressable>
                      <Pressable style={styles.delayPresetButton} onPress={() => setDelayExpectedAt(buildDelayPresetValue('tomorrow_morning'))}>
                        <Text style={styles.delayPresetText}>Besok pagi</Text>
                      </Pressable>
                      <Pressable style={styles.delayPresetButton} onPress={() => setDelayExpectedAt(buildDelayPresetValue('tomorrow_afternoon'))}>
                        <Text style={styles.delayPresetText}>Besok sore</Text>
                      </Pressable>
                    </View>
                    <TextInput
                      value={delayReason}
                      onChangeText={setDelayReason}
                      placeholder="Alasan singkat, contoh: antrian layout penuh"
                      placeholderTextColor="#8a9ab3"
                      style={styles.delayInput}
                    />
                    <View style={styles.delayActionRow}>
                      <Pressable
                        style={[styles.actionButton, styles.actionSoftButton]}
                        onPress={() => {
                          setDelayItemId(null);
                          setDelayExpectedAt('');
                          setDelayReason('');
                        }}
                      >
                        <Text style={styles.actionSoftButtonText}>Tutup</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, isUpdating || !normalizeDelayDateInput(delayExpectedAt) ? styles.actionDisabled : null]}
                        disabled={isUpdating || !normalizeDelayDateInput(delayExpectedAt)}
                        onPress={() => onBuildDelayWhatsapp?.(row, {
                          expected_at: normalizeDelayDateInput(delayExpectedAt),
                          reason: delayReason.trim(),
                        })}
                      >
                        <Text style={styles.actionButtonText}>{isUpdating ? 'Memproses...' : 'Buat Link WA'}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
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
    borderColor: '#c8d8f2',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '900',
    color: '#173c87',
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
  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  counterText: {
    fontSize: 11,
    color: '#435674',
    fontWeight: '800',
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
  emptyText: {
    fontSize: 12,
    color: '#505050',
  },
  layoutBoard: {
    borderWidth: 1,
    borderColor: '#d7e2f4',
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    gap: 7,
  },
  layoutBoardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  layoutBoardTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#173c87',
  },
  layoutBoardHint: {
    fontSize: 10,
    color: '#53647d',
    fontWeight: '700',
    marginTop: 2,
  },
  layoutTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#d7e2f4',
    paddingBottom: 5,
    gap: 8,
  },
  layoutTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#edf2fb',
    paddingVertical: 7,
    gap: 8,
  },
  layoutColumnWide: {
    flex: 1.3,
  },
  layoutColumnText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    color: '#243957',
  },
  layoutItemTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#14233d',
  },
  layoutItemMeta: {
    fontSize: 10,
    color: '#53647d',
    fontWeight: '700',
    marginTop: 2,
  },
  layoutModeBadge: {
    flex: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  layoutModeBlue: {
    backgroundColor: '#dce7ff',
  },
  layoutModeGreen: {
    backgroundColor: '#daf4df',
  },
  layoutModeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#17324f',
  },
  layoutCellText: {
    flex: 1,
    fontSize: 10,
    color: '#243957',
    fontWeight: '800',
  },
  layoutCodeText: {
    flex: 1,
    fontSize: 10,
    color: '#0755b8',
    fontWeight: '900',
  },
  listWrap: {
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#dce5f4',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  cardMain: {
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
    color: '#173c87',
  },
  cardMeta: {
    fontSize: 11,
    color: '#435674',
  },
  fileInfoBox: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: '#c8d8f2',
    backgroundColor: '#f7fbff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 4,
    gap: 2,
  },
  fileInfoTitle: {
    fontSize: 10,
    color: '#173c87',
    fontWeight: '900',
  },
  fileInfoMeta: {
    fontSize: 10,
    color: '#53647d',
    fontWeight: '700',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
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
  flowBox: {
    borderWidth: 1,
    borderColor: '#e1e8f5',
    backgroundColor: '#fbfdff',
    borderRadius: 10,
    padding: 8,
    marginTop: 5,
    gap: 6,
  },
  flowTitle: {
    fontSize: 11,
    color: '#173c87',
    fontWeight: '900',
  },
  flowStepRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  flowStep: {
    borderWidth: 1,
    borderColor: '#d7e2f4',
    backgroundColor: '#f3f6fb',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  flowStepDone: {
    borderColor: '#9dd4ad',
    backgroundColor: '#eaf8ec',
  },
  flowStepActive: {
    borderColor: '#0755b8',
    backgroundColor: '#e8f1ff',
  },
  flowStepText: {
    fontSize: 9,
    color: '#65758d',
    fontWeight: '900',
  },
  flowStepTextActive: {
    color: '#173c87',
  },
  flowHint: {
    fontSize: 10,
    color: '#53647d',
    fontWeight: '700',
  },
  actionWrap: {
    minWidth: 120,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 6,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: '#0755b8',
    backgroundColor: '#0755b8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
  },
  actionSoftButton: {
    borderColor: '#9fb6d8',
    backgroundColor: '#edf4ff',
  },
  actionSoftGreen: {
    borderColor: '#a5d6ae',
    backgroundColor: '#eaf8ec',
  },
  actionSoftOrange: {
    borderColor: '#f2c178',
    backgroundColor: '#fff4df',
  },
  actionDownloadButton: {
    borderColor: '#1d7a45',
    backgroundColor: '#eaf8ec',
  },
  actionDownloadButtonText: {
    color: '#146238',
    fontWeight: '900',
    fontSize: 11,
  },
  actionSoftButtonText: {
    color: '#17324f',
    fontWeight: '800',
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
  delayBox: {
    borderWidth: 1,
    borderColor: '#f0d4a5',
    backgroundColor: '#fffaf0',
    borderRadius: 10,
    padding: 9,
    gap: 7,
  },
  delayTitle: {
    fontSize: 11,
    color: '#7a4b12',
    fontWeight: '900',
  },
  delayInput: {
    borderWidth: 1,
    borderColor: '#e5cfaa',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    color: '#14233d',
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  delayPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  delayPresetButton: {
    borderWidth: 1,
    borderColor: '#e7c88d',
    backgroundColor: '#fff7e8',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  delayPresetText: {
    fontSize: 10,
    color: '#754812',
    fontWeight: '900',
  },
  delayActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
});

export default ProductionPanel;
