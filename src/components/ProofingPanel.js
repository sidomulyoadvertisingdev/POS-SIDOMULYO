import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
const { resolveProofingReleaseState } = require('../utils/proofingReleaseGate');

const SIDOMULYO_BLUE = '#0755b8';
const SIDOMULYO_BLUE_DARK = '#043f92';
const PREVIEW_ZOOM_MIN = 0.5;
const PREVIEW_ZOOM_MAX = 2.5;
const PREVIEW_ZOOM_STEP = 0.1;

const STATUS_FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Terkirim' },
  { key: 'revision', label: 'Revisi' },
];

const toText = (value, fallback = '-') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseJsonObject = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
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
  if (key === 'sent') return 'Terkirim';
  if (key === 'approved') return 'Approved';
  if (key === 'revision') return 'Revisi';
  if (key === 'cancelled') return 'Dibatalkan';
  return toText(key, '-');
};

const toFlowLabel = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'proofing_first') return 'Proofing';
  if (key === 'pay_first') return 'Proofing';
  if (key === 'none') return 'Tanpa Proofing';
  return toText(key.replace(/_/g, ' '), '-');
};

const routingLabel = (row) => {
  const routing = row?.routing && typeof row.routing === 'object' ? row.routing : null;
  if (!routing) {
    return '';
  }
  const roleLabel = toText(
    routing?.target_role_label,
    String(routing?.target_role || '').toLowerCase() === 'cashier' ? 'Kasir' : 'Design',
  );
  const userName = String(routing?.target_user_name || '').trim();
  return userName ? `${roleLabel}: ${userName}` : roleLabel;
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

const formatDateTime = (value, fallback = '-') => {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const date = new Date(text.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return text;
  const datePart = date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} ${timePart}`;
};

const isImageUrl = (value) => {
  const text = String(value || '').trim().toLowerCase();
  return /\.(jpg|jpeg|png|webp)(\?|#|$)/.test(text);
};

const normalizeProofingFile = (row, source) => {
  const fileObject = row?.[`${source}_file`] && typeof row[`${source}_file`] === 'object'
    ? row[`${source}_file`]
    : null;
  const url = String(fileObject?.url || row?.[`${source}_url`] || '').trim();
  if (!url) {
    return null;
  }
  return {
    source,
    url,
    label: source === 'final' ? 'File Final' : 'Preview Proofing',
    originalName: String(
      fileObject?.original_name
      || row?.[`${source}_original_name`]
      || '',
    ).trim(),
    mimeType: String(
      fileObject?.mime_type
      || row?.[`${source}_mime_type`]
      || '',
    ).trim(),
    fileSize: Number(fileObject?.file_size || row?.[`${source}_file_size`] || 0) || 0,
  };
};

const resolveUploadedProofingFile = (row) => (
  normalizeProofingFile(row, 'preview')
  || normalizeProofingFile(row, 'final')
);

const resolveBuyerOriginalFile = (row) => {
  const snapshot = parseJsonObject(row?.item?.spec_snapshot) || parseJsonObject(row?.spec_snapshot) || {};
  const draftForm = parseJsonObject(snapshot?.draft_form) || {};
  const cartRestore = parseJsonObject(snapshot?.cart_restore) || {};
  const originalFile = row?.original_file && typeof row.original_file === 'object'
    ? row.original_file
    : row?.buyer_file && typeof row.buyer_file === 'object'
      ? row.buyer_file
      : row?.customer_file && typeof row.customer_file === 'object'
        ? row.customer_file
        : row?.customer_reference_file && typeof row.customer_reference_file === 'object'
          ? row.customer_reference_file
          : row?.item?.customer_reference_file && typeof row.item.customer_reference_file === 'object'
            ? row.item.customer_reference_file
            : snapshot?.customer_reference_file && typeof snapshot.customer_reference_file === 'object'
              ? snapshot.customer_reference_file
              : draftForm?.customer_reference_file && typeof draftForm.customer_reference_file === 'object'
                ? draftForm.customer_reference_file
                : cartRestore?.customer_reference_file && typeof cartRestore.customer_reference_file === 'object'
                  ? cartRestore.customer_reference_file
                  : null;
  const url = String(
    originalFile?.url
    || originalFile?.open_url
    || originalFile?.path
    || originalFile?.relative_path
    || row?.original_url
    || row?.buyer_file_url
    || row?.customer_file_url
    || row?.customer_reference_file_url
    || row?.source_file_url
    || row?.artwork_url
    || row?.item?.original_url
    || row?.item?.buyer_file_url
    || row?.item?.customer_file_url
    || row?.item?.customer_reference_file_url
    || snapshot?.original_file_url
    || snapshot?.customer_file_url
    || snapshot?.buyer_file_url
    || draftForm?.original_file_url
    || draftForm?.customer_file_url
    || cartRestore?.original_file_url
    || cartRestore?.customer_file_url
    || ''
  ).trim();
  if (!url) {
    return null;
  }
  return {
    source: 'original',
    url,
    label: 'File Asli Pembeli',
    originalName: String(
      originalFile?.original_name
      || originalFile?.file_name
      || row?.original_name
      || row?.buyer_file_name
      || row?.customer_file_name
      || row?.customer_reference_file_name
      || row?.item?.original_name
      || row?.item?.customer_file_name
      || row?.item?.customer_reference_file_name
      || snapshot?.original_file_name
      || snapshot?.customer_file_name
      || draftForm?.original_file_name
      || draftForm?.customer_file_name
      || cartRestore?.original_file_name
      || cartRestore?.customer_file_name
      || ''
    ).trim(),
    mimeType: String(originalFile?.mime_type || row?.original_mime_type || row?.customer_file_mime_type || '').trim(),
  };
};

const isImageProofingFile = (file) => {
  const mimeType = String(file?.mimeType || '').trim().toLowerCase();
  if (mimeType.startsWith('image/')) {
    return true;
  }
  return isImageUrl(file?.originalName || file?.url);
};

const fileTypeLabel = (file) => {
  const mimeType = String(file?.mimeType || '').trim();
  if (mimeType) {
    return mimeType;
  }
  const name = String(file?.originalName || file?.url || '').trim();
  const match = name.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
  return match ? match[1].toUpperCase() : 'File upload';
};

const clampPreviewZoom = (value) => {
  const nextValue = Number(value || 1);
  if (!Number.isFinite(nextValue)) {
    return 1;
  }
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, Math.round(nextValue * 10) / 10));
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

const statusBadgeStyle = (status) => {
  const key = resolveProofingStatusKey(status);
  if (key === 'approved') return styles.badgeApproved;
  if (key === 'sent') return styles.badgeSent;
  if (key === 'revision') return styles.badgeRevision;
  if (key === 'cancelled') return styles.badgeCancelled;
  return styles.badgeDraft;
};

const paymentBadgeStyle = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (key.includes('lunas') || key.includes('tempo') || key.includes('dp')) return styles.paymentOk;
  if (key.includes('belum') || key.includes('pending')) return styles.paymentBad;
  return styles.paymentWarn;
};

const resolveRevisionSummary = (row) => (
  row?.revision_summary && typeof row.revision_summary === 'object'
    ? row.revision_summary
    : {}
);

const sanitizePathSegment = (value, fallback = 'lainnya') => {
  const text = String(value || '').trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ');
  return text || fallback;
};

const buildDefaultLayoutFilePath = (row) => {
  const material = sanitizePathSegment(
    row?.item?.material_text
    || row?.item?.material
    || row?.item?.name
    || 'bahan-lain',
  );
  const priority = sanitizePathSegment(
    row?.item?.express_label
    || row?.item?.production_priority
    || row?.order?.production_priority
    || 'regular',
  );
  const invoiceNo = sanitizePathSegment(
    row?.order?.invoice?.invoice_no
    || row?.proofing_code
    || `proofing-${row?.id || 'baru'}`,
  );
  return `D:\\file siap layout\\${material}\\${priority}\\${invoiceNo}`;
};

const DetailRow = ({ label, value, strong }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={[styles.detailValue, strong ? styles.detailValueStrong : null]}>{toText(value)}</Text>
  </View>
);

const ActionButton = ({ label, variant = 'blue', disabled, onPress }) => (
  <Pressable
    style={[
      styles.actionButton,
      variant === 'green' ? styles.actionGreen : null,
      variant === 'orange' ? styles.actionOrange : null,
      variant === 'purple' ? styles.actionPurple : null,
      variant === 'ghost' ? styles.actionGhost : null,
      disabled ? styles.actionDisabled : null,
    ]}
    disabled={disabled}
    onPress={onPress}
  >
    <Text style={[styles.actionButtonText, variant === 'ghost' ? styles.actionGhostText : null]}>{label}</Text>
  </Pressable>
);

const ProofingPanel = ({
  rows,
  isLoading,
  statusFilter,
  onChangeStatusFilter,
  searchText,
  onChangeSearchText,
  onRefresh,
  onSendToDesign,
  onUploadPreview,
  onUploadFinal,
  onOpenPublicLink,
  onOpenCustomerWhatsapp,
  onOpenPreviewFile,
  onSendWhatsapp,
  onReleaseToProduction,
  onUploadLocalProductionFile,
  onReturnToCashier,
  onReturnToCashierReminder,
  onPrintBillingNote,
  onShareBillingNote,
  processingProofingId,
}) => {
  const [selectedProofingId, setSelectedProofingId] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [layoutFilePathById, setLayoutFilePathById] = useState({});
  const items = Array.isArray(rows) ? rows : [];
  const selectedRow = items.find((row) => Number(row?.id || 0) === Number(selectedProofingId || 0))
    || items[0]
    || null;
  const selectedReleaseState = selectedRow ? resolveProofingReleaseState(selectedRow) : {};
  const selectedProofingIdNumber = Number(selectedRow?.id || 0);
  const selectedBusy = Number(processingProofingId || 0) === selectedProofingIdNumber;
  const selectedStatus = resolveProofingStatusKey(selectedRow?.status);
  const selectedRevisionSummary = resolveRevisionSummary(selectedRow);
  const selectedRevisionHistory = Array.isArray(selectedRow?.revision_history) ? selectedRow.revision_history : [];
  const selectedRevisionLabel = toText(
    selectedRevisionSummary?.status_label,
    selectedStatus === 'revision'
      ? 'Ditolak Pembeli / Revisi Customer'
      : selectedStatus === 'sent'
        ? 'Waiting Respon Customer'
        : toStatusLabel(selectedStatus),
  );
  const selectedRevisionCount = Math.max(Number(selectedRevisionSummary?.revision_count || 0) || 0, 0);
  const selectedCurrentRound = Math.max(Number(selectedRevisionSummary?.current_round || 1) || 1, 1);
  const uploadedFile = resolveUploadedProofingFile(selectedRow);
  const buyerOriginalFile = resolveBuyerOriginalFile(selectedRow);
  const previewUrl = String(uploadedFile?.url || '').trim();
  const buyerOriginalUrl = String(buyerOriginalFile?.url || '').trim();
  const previewIsImage = isImageProofingFile(uploadedFile);
  const canZoomPreview = Boolean(previewUrl && previewIsImage);
  const zoomPercent = Math.round(previewZoom * 100);
  const canZoomOut = canZoomPreview && previewZoom > PREVIEW_ZOOM_MIN;
  const canZoomIn = canZoomPreview && previewZoom < PREVIEW_ZOOM_MAX;
  const latestLog = selectedRow?.latest_log && typeof selectedRow.latest_log === 'object'
    ? selectedRow.latest_log
    : null;
  const paymentLabel = toText(selectedReleaseState.paymentStatusLabel, selectedRow?.payment_gate?.label || '-');
  const layoutFilePath = selectedRow
    ? toText(layoutFilePathById[selectedProofingIdNumber], buildDefaultLayoutFilePath(selectedRow))
    : '';
  const showPostApprovalActions = selectedStatus === 'approved';
  const canSendProduction = showPostApprovalActions
    && selectedReleaseState.paymentReady
    && !selectedReleaseState.releasedToProduction;
  const shouldReturnCashierWithReminder = showPostApprovalActions
    && !selectedReleaseState.paymentReady
    && selectedReleaseState.paymentReceivable;
  const shouldReturnCashier = showPostApprovalActions
    && !selectedReleaseState.paymentReady
    && !selectedReleaseState.paymentReceivable;
  const lastUpdated = items
    .map((row) => row?.updated_at)
    .filter(Boolean)
    .sort()
    .at(-1);

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

  useEffect(() => {
    setPreviewZoom(1);
  }, [selectedProofingIdNumber, previewUrl]);

  const adjustPreviewZoom = (direction) => {
    if (!canZoomPreview) {
      return;
    }
    setPreviewZoom((current) => clampPreviewZoom(current + (direction * PREVIEW_ZOOM_STEP)));
  };

  const renderTimeline = () => {
    const historyLogs = Array.isArray(selectedRow?.history) ? selectedRow.history : [];
    if (historyLogs.length > 0) {
      return historyLogs
        .map((log) => {
          const label = toText(log?.event_label, log?.event_type || 'Aktivitas');
          const actorName = toActorName(log);
          const note = String(log?.event_note || '').trim();
          const detail = note || (actorName !== '-' ? `Oleh ${actorName}` : 'Aktivitas proofing dicatat.');
          return {
            key: `history-${log?.id || log?.created_at || label}`,
            label,
            time: log?.created_at,
            text: `${label}: ${detail}`,
            sortId: Number(log?.id || 0) || 0,
          };
        })
        .sort((a, b) => {
          if (a.sortId !== b.sortId) {
            return b.sortId - a.sortId;
          }
          return String(b.time || '').localeCompare(String(a.time || ''));
        });
    }

    const logs = [];
    if (selectedRow?.created_at) {
      logs.push({
        key: `created-${selectedRow.created_at}`,
        label: 'Dibuat',
        time: selectedRow.created_at,
        text: 'Dibuat: Task proofing dibuat di sistem.',
      });
    }
    if (selectedRow?.whatsapp_sent_at) {
      logs.push({
        key: `sent-${selectedRow.whatsapp_sent_at}`,
        label: 'Dikirim',
        time: selectedRow.whatsapp_sent_at,
        text: 'Dikirim: Proofing dikirim ke customer via WhatsApp link.',
      });
    }
    if (selectedRow?.approved_at) {
      logs.push({
        key: `approved-${selectedRow.approved_at}`,
        label: 'Approved',
        time: selectedRow.approved_at,
        text: 'Approved: Customer approve dan lanjut validasi produksi.',
      });
    }
    if (selectedRow?.revised_at) {
      logs.push({
        key: `revision-${selectedRow.revised_at}`,
        label: 'Revisi',
        time: selectedRow.revised_at,
        text: `Revisi: ${toText(selectedRow?.revision_note_from_customer, 'Customer meminta revisi.')}`,
      });
    }
    if (latestLog) {
      const latestLabel = toText(latestLog?.event_label, latestLog?.event_type);
      logs.push({
        key: `latest-${latestLog?.id || latestLog?.created_at || latestLabel}`,
        label: latestLabel,
        time: latestLog?.created_at,
        text: `${latestLabel}: ${latestLog?.event_note || `Oleh ${toActorName(latestLog)}`}`,
      });
    }

    return logs.sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
  };
  const timelineRows = renderTimeline();

  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.heroBrand}>SIDOMULYO POS</Text>
        <Text style={styles.heroTitle}>KONSEP PROOFING SIDOMULYO</Text>
        <Text style={styles.heroMeta}>Gerbang proofing, approval, invoice, payment, dan produksi</Text>
      </View>

      <View style={styles.topGrid}>
        <View style={[styles.panelCard, styles.queueCard]}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>Queue Proofing Design</Text>
              <Text style={styles.panelSubtitle}>
                Terakhir diperbarui: {formatDateTime(lastUpdated, isLoading ? 'Memuat...' : '-')}
              </Text>
            </View>
            <Pressable style={styles.refreshButton} onPress={onRefresh}>
              <Text style={styles.refreshButtonText}>{isLoading ? 'Memuat...' : 'Refresh'}</Text>
            </Pressable>
          </View>

          <View style={styles.metricRow}>
            <View style={[styles.metricCard, styles.metricBlue]}>
              <Text style={styles.metricLabel}>Draft</Text>
              <Text style={styles.metricValue}>{counts.draft}</Text>
              <Text style={styles.metricIcon}>DOC</Text>
            </View>
            <View style={[styles.metricCard, styles.metricGold]}>
              <Text style={styles.metricLabel}>Terkirim</Text>
              <Text style={styles.metricValue}>{counts.sent}</Text>
              <Text style={styles.metricIcon}>SEND</Text>
            </View>
            <View style={[styles.metricCard, styles.metricGreen]}>
              <Text style={styles.metricLabel}>Approved</Text>
              <Text style={styles.metricValue}>{counts.approved}</Text>
              <Text style={styles.metricIcon}>OK</Text>
            </View>
            <View style={[styles.metricCard, styles.metricRed]}>
              <Text style={styles.metricLabel}>Revisi</Text>
              <Text style={styles.metricValue}>{counts.revision}</Text>
              <Text style={styles.metricIcon}>REV</Text>
            </View>
          </View>

          <TextInput
            value={searchText}
            onChangeText={onChangeSearchText}
            placeholder="Cari proofing / invoice / customer / item..."
            placeholderTextColor="#73839d"
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

          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.th, styles.colOrder]}>Order ID</Text>
              <Text style={[styles.th, styles.colInvoice]}>Invoice</Text>
              <Text style={[styles.th, styles.colCustomer]}>Customer</Text>
              <Text style={[styles.th, styles.colItem]}>Item</Text>
              <Text style={[styles.th, styles.colSize]}>Ukuran</Text>
              <Text style={[styles.th, styles.colPic]}>PIC</Text>
              <Text style={[styles.th, styles.colStatus]}>Proofing</Text>
              <Text style={[styles.th, styles.colPay]}>Payment</Text>
            </View>

            {items.length === 0 ? (
              <Text style={styles.emptyText}>
                {isLoading ? 'Memuat data proofing...' : 'Belum ada task proofing.'}
              </Text>
            ) : (
              <ScrollView style={styles.tableScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                {items.map((row, index) => {
                  const proofingId = Number(row?.id || 0);
                  const isSelected = Number(selectedRow?.id || 0) === proofingId;
                  const releaseState = resolveProofingReleaseState(row);

                  return (
                    <Pressable
                      key={String(proofingId || `proofing-${index}`)}
                      style={[
                        styles.tableRow,
                        index % 2 === 0 ? styles.tableRowEven : null,
                        isSelected ? styles.tableRowSelected : null,
                      ]}
                      onPress={() => setSelectedProofingId(proofingId)}
                    >
                      <Text style={[styles.td, styles.colOrder]}>ORD-{toNumber(row?.order?.id).toString().padStart(5, '0')}</Text>
                      <Text style={[styles.td, styles.colInvoice]}>{toText(row?.order?.invoice?.invoice_no)}</Text>
                      <Text style={[styles.td, styles.colCustomer]}>{toText(row?.customer?.name, 'Pelanggan umum')}</Text>
                      <Text style={[styles.td, styles.colItem]}>{toText(row?.item?.name, 'Item desain')}</Text>
                      <Text style={[styles.td, styles.colSize]}>{sizeLabel(row)}</Text>
                      <Text style={[styles.td, styles.colPic]}>
                        {toText(routingLabel(row), row?.designer?.name || '-')}
                      </Text>
                      <View style={[styles.tableBadge, statusBadgeStyle(row?.status), styles.colStatus]}>
                        <Text style={styles.tableBadgeText}>{toStatusLabel(row?.status)}</Text>
                      </View>
                      <View style={[styles.tableBadge, paymentBadgeStyle(releaseState.paymentStatusLabel), styles.colPay]}>
                        <Text style={styles.tableBadgeText}>{toText(releaseState.paymentStatusLabel, '-')}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <View style={styles.tableFooter}>
            <Text style={styles.tableFooterText}>Menampilkan {items.length} task</Text>
            <Text style={styles.tableFooterText}>Klik baris untuk membuka detail</Text>
          </View>
        </View>

        <View style={[styles.panelCard, styles.detailCard]}>
          <View style={styles.panelHeaderCompact}>
            <Text style={styles.panelTitle}>Detail Task Proofing</Text>
            <View style={[styles.badge, statusBadgeStyle(selectedRow?.status)]}>
              <Text style={styles.badgeText}>{toStatusLabel(selectedRow?.status)}</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Informasi Order</Text>
          <DetailRow label="Order ID" value={selectedRow ? `ORD-${toNumber(selectedRow?.order?.id).toString().padStart(5, '0')}` : '-'} strong />
          <DetailRow label="Invoice" value={selectedRow?.order?.invoice?.invoice_no} strong />
          <DetailRow label="Customer" value={selectedRow?.customer?.name || selectedRow?.order?.customer?.name} />
          <DetailRow label="Item" value={selectedRow?.item?.name} />
          <DetailRow label="Ukuran Order" value={selectedRow ? sizeLabel(selectedRow) : '-'} />
          <DetailRow label="Ukuran Produksi" value={selectedRow ? sizeLabel(selectedRow, 'production') : '-'} />
          <DetailRow label="PIC Designer" value={selectedRow?.designer?.name} />
          <DetailRow label="Dikirim Ke" value={routingLabel(selectedRow)} />
          <DetailRow label="Status Pembayaran" value={paymentLabel} />
          <DetailRow label="Catatan Order" value={selectedRow?.order?.notes} />

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Detail Proofing</Text>
          <DetailRow label="Proofing ID" value={selectedRow?.proofing_code || selectedRow?.id} strong />
          <DetailRow label="Dibuat" value={formatDateTime(selectedRow?.created_at)} />
          <DetailRow label="Dikirim" value={formatDateTime(selectedRow?.whatsapp_sent_at)} />
          <DetailRow label="Flow" value={toFlowLabel(selectedRow?.item?.proofing_flow)} />
          <DetailRow label="Catatan Customer" value={selectedRow?.revision_note_from_customer || selectedRow?.notes_from_designer} />
          {selectedRevisionHistory.length > 0 ? (
            <View style={styles.revisionHistoryBox}>
              <Text style={styles.revisionHistoryTitle}>Riwayat Revisi Customer</Text>
              {selectedRevisionHistory.map((revision) => (
                <View key={`revision-${revision?.log_id || revision?.revision_no}`} style={styles.revisionHistoryRow}>
                  <Text style={styles.revisionHistoryMeta}>
                    Revisi {Number(revision?.revision_no || 0) || '-'} | {formatDateTime(revision?.created_at)}
                  </Text>
                  <Text style={styles.revisionHistoryNote}>{toText(revision?.note, 'Tidak ada catatan.')}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.panelCard, styles.previewCard]}>
          <Text style={styles.panelTitle}>Preview Desain / Proofing</Text>
          <View style={styles.previewFrame}>
            {previewUrl && previewIsImage ? (
              <Image
                source={{ uri: previewUrl }}
                style={[styles.previewImage, { transform: [{ scale: previewZoom }] }]}
                resizeMode="contain"
              />
            ) : previewUrl ? (
              <View style={styles.uploadedFilePreview}>
                <Text style={styles.uploadedFileKicker}>{toText(uploadedFile?.label, 'File Upload')}</Text>
                <Text style={styles.uploadedFileTitle} numberOfLines={2}>
                  {toText(uploadedFile?.originalName, selectedRow?.item?.name || 'Design proofing sudah diupload')}
                </Text>
                <Text style={styles.uploadedFileMeta}>{fileTypeLabel(uploadedFile)}</Text>
                <Text style={styles.uploadedFileNote}>
                  File ini sudah tersimpan di sistem. Format ini dibuka lewat tombol file karena bukan gambar preview langsung.
                </Text>
              </View>
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.previewBrand}>SIDOMULYO POS</Text>
                <Text style={styles.previewHeadline}>BELUM ADA FILE UPLOAD</Text>
                <Text style={styles.previewSubline}>{toText(selectedRow?.item?.name, 'Preview belum tersedia')}</Text>
                <Text style={styles.previewMini}>Upload / Buat Proofing untuk menampilkan design di sini</Text>
              </View>
            )}
            {previewUrl ? (
              <View style={styles.previewMetaStrip}>
                <Text style={styles.previewMetaText} numberOfLines={1}>
                  {`${toText(uploadedFile?.label, 'File Upload')} - ${toText(uploadedFile?.originalName, fileTypeLabel(uploadedFile))}`}
                </Text>
              </View>
            ) : null}
            <View style={styles.previewToolbar}>
              <Pressable
                style={[styles.zoomButton, !canZoomOut ? styles.zoomControlDisabled : null]}
                disabled={!canZoomOut}
                onPress={() => adjustPreviewZoom(-1)}
              >
                <Text style={[styles.zoomButtonText, !canZoomOut ? styles.zoomControlDisabledText : null]}>-</Text>
              </Pressable>
              <Pressable
                style={[styles.zoomValue, !canZoomPreview ? styles.zoomControlDisabled : null]}
                disabled={!canZoomPreview}
                onPress={() => setPreviewZoom(1)}
              >
                <Text style={[styles.zoomValueText, !canZoomPreview ? styles.zoomControlDisabledText : null]}>{zoomPercent}%</Text>
              </Pressable>
              <Pressable
                style={[styles.zoomButton, !canZoomIn ? styles.zoomControlDisabled : null]}
                disabled={!canZoomIn}
                onPress={() => adjustPreviewZoom(1)}
              >
                <Text style={[styles.zoomButtonText, !canZoomIn ? styles.zoomControlDisabledText : null]}>+</Text>
              </Pressable>
              <Pressable onPress={() => onOpenPreviewFile?.(selectedRow, uploadedFile?.source || 'preview')} disabled={!previewUrl}>
                <Text style={[styles.downloadButton, !previewUrl ? styles.downloadButtonDisabled : null]}>Buka File</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Aksi Proofing</Text>
          <View style={styles.actionGrid}>
            <ActionButton
              label="Download File Asli Pembeli"
              variant="ghost"
              disabled={!selectedRow || selectedBusy || !buyerOriginalUrl}
              onPress={() => onOpenPreviewFile?.(selectedRow, 'original')}
            />
            <ActionButton
              label="Upload Gambar Proofing"
              variant="blue"
              disabled={!selectedRow || selectedBusy}
              onPress={() => onUploadPreview?.(selectedRow)}
            />
            <ActionButton
              label="Kirim Gambar Proofing WA"
              variant="green"
              disabled={!selectedRow || selectedBusy || !String(selectedRow?.preview_url || '').trim()}
              onPress={() => onSendWhatsapp?.(selectedRow)}
            />
          </View>
          <Text style={styles.sectionTitle}>Status Customer</Text>
          <View style={styles.actionGrid}>
            <ActionButton
              label={selectedRevisionLabel}
              variant="ghost"
              disabled
            />
            {selectedStatus === 'revision' ? (
              <ActionButton
                label="Masuk WA Pembeli"
                variant="green"
                disabled={!selectedRow || selectedBusy}
                onPress={() => onOpenCustomerWhatsapp?.(selectedRow)}
              />
            ) : null}
            <ActionButton
              label={selectedStatus === 'revision'
                ? `Upload Revisi ${Math.max(1, selectedRevisionCount + 1)}`
                : `Upload Revisi ${selectedCurrentRound}`}
              variant="orange"
              disabled={!selectedRow || selectedBusy || selectedStatus !== 'revision'}
              onPress={() => onUploadPreview?.(selectedRow)}
            />
          </View>
          {selectedStatus === 'revision' && String(selectedRevisionSummary?.latest_revision_note || '').trim() ? (
            <Text style={styles.revisionNoteText}>
              Catatan revisi {Math.max(1, selectedRevisionCount)}: {String(selectedRevisionSummary.latest_revision_note).trim()}
            </Text>
          ) : null}
          {selectedStatus === 'sent' ? (
            <Text style={styles.gateHint}>
              {selectedRevisionCount > 0
                ? `Menunggu respon pembeli untuk revisi ${selectedCurrentRound}. Jika sudah lebih dari 1 jam, gunakan daftar push ulang untuk reminder WhatsApp.`
                : 'Menunggu respon pembeli. Jika sudah lebih dari 1 jam, gunakan daftar push ulang untuk mengirim reminder WhatsApp.'}
            </Text>
          ) : null}
          {showPostApprovalActions ? (
            <View style={styles.postApprovalBox}>
              <Text style={styles.sectionTitle}>Setelah Customer Approve</Text>
              <Text style={styles.postApprovalHint}>
                Status pembayaran: {paymentLabel}. Item approved berpindah ke menu Layout untuk upload file produksi dan naik cetak.
              </Text>
              {canSendProduction ? <Text style={styles.postApprovalHint}>Buka tab Layout untuk menggabungkan item ini dengan invoice lain.</Text> : null}
              {shouldReturnCashier ? (
                <ActionButton
                  label="Kirim Kembali ke Kasir"
                  variant="orange"
                  disabled={!selectedRow || selectedBusy}
                  onPress={() => onReturnToCashier?.(selectedRow)}
                />
              ) : null}
              {shouldReturnCashierWithReminder ? (
                <ActionButton
                  label="Kirim Kembali ke Kasir + Reminder Kepala Ops/Kepala Toko"
                  variant="orange"
                  disabled={!selectedRow || selectedBusy}
                  onPress={() => onReturnToCashierReminder?.(selectedRow)}
                />
              ) : null}
              {selectedReleaseState.releasedToProduction ? (
                <Text style={styles.postApprovalHint}>{selectedReleaseState.releasedLabel}</Text>
              ) : null}
            </View>
          ) : null}
          {!selectedReleaseState.precheckReady && !selectedReleaseState.releasedToProduction ? (
            <Text style={styles.gateHint}>{toText(selectedReleaseState.blockingHint, 'Backend gate akan memutuskan apakah item boleh masuk produksi.')}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.secondaryGrid}>
        <View style={[styles.panelCard, styles.smallCard]}>
          <View style={styles.panelHeaderCompact}>
            <Text style={styles.panelTitle}>Log Aktivitas</Text>
          </View>
          {timelineRows.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada log aktivitas untuk task ini.</Text>
          ) : (
            <ScrollView
              style={styles.timelineScroll}
              contentContainerStyle={styles.timelineScrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {timelineRows.map((log, index) => (
                <View key={`${log.key || log.label}-${index}`} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <Text style={styles.timelineTime}>{formatDateTime(log.time)}</Text>
                  <Text style={styles.timelineText}>{log.text}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={[styles.panelCard, styles.smallCard]}>
          <Text style={styles.panelTitle}>Data Terhubung</Text>
          <DetailRow label="order_id" value={selectedRow?.order?.id} strong />
          <DetailRow label="item_id" value={selectedRow?.item?.id} strong />
          <DetailRow label="proofing_id" value={selectedRow?.id} strong />
          <DetailRow label="design_task_id" value={selectedRow?.item?.design_task_id || '-'} />
          <DetailRow label="tagihan_id / nota_id" value={selectedRow?.order?.invoice?.invoice_no} />
          <View style={styles.connectorGraphic}>
            <Text style={styles.connectorNode}>DB</Text>
            <Text style={styles.connectorLine}>-- linked --</Text>
            <Text style={styles.connectorNode}>POS</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    gap: 10,
    paddingBottom: 12,
  },
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
  heroBrand: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  heroTitle: {
    flex: 1,
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroMeta: {
    color: '#d9e7ff',
    fontSize: 11,
    fontWeight: '700',
  },
  topGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  panelCard: {
    borderWidth: 1,
    borderColor: '#d4dcea',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    padding: 12,
    shadowColor: '#0f2c5c',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  queueCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 670,
  },
  detailCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 310,
  },
  previewCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 450,
  },
  smallCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 330,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  panelHeaderCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#182b4d',
  },
  panelSubtitle: {
    marginTop: 3,
    fontSize: 10,
    color: '#667897',
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: 4,
    marginBottom: 6,
    color: SIDOMULYO_BLUE_DARK,
    fontSize: 12,
    fontWeight: '900',
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#b9c8e1',
    borderRadius: 8,
    backgroundColor: '#f5f9ff',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  refreshButtonText: {
    color: SIDOMULYO_BLUE,
    fontWeight: '900',
    fontSize: 11,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  metricCard: {
    minWidth: 132,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 9,
    padding: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  metricBlue: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfd5ff',
  },
  metricGold: {
    backgroundColor: '#fff8e6',
    borderColor: '#f6dd8c',
  },
  metricGreen: {
    backgroundColor: '#ecfdf3',
    borderColor: '#bde7ce',
  },
  metricRed: {
    backgroundColor: '#fff1f2',
    borderColor: '#f8c8cf',
  },
  metricLabel: {
    color: '#29436e',
    fontSize: 11,
    fontWeight: '800',
  },
  metricValue: {
    marginTop: 6,
    color: SIDOMULYO_BLUE,
    fontSize: 27,
    fontWeight: '900',
  },
  metricIcon: {
    position: 'absolute',
    right: 12,
    top: 18,
    color: '#7393c3',
    fontSize: 12,
    fontWeight: '900',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d4dcea',
    borderRadius: 8,
    backgroundColor: '#fbfdff',
    color: '#14233d',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: '#d4dcea',
    borderRadius: 7,
    backgroundColor: '#f7f9fd',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  filterButtonActive: {
    borderColor: SIDOMULYO_BLUE,
    backgroundColor: SIDOMULYO_BLUE,
  },
  filterButtonText: {
    fontSize: 11,
    color: '#445878',
    fontWeight: '800',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  table: {
    borderWidth: 1,
    borderColor: '#e1e7f2',
    borderRadius: 9,
    overflow: 'hidden',
  },
  tableRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tableHeader: {
    backgroundColor: '#f1f6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#dce5f4',
  },
  tableScroll: {
    maxHeight: 420,
  },
  tableRowEven: {
    backgroundColor: '#fbfdff',
  },
  tableRowSelected: {
    backgroundColor: '#eaf3ff',
  },
  th: {
    color: '#435674',
    fontSize: 10,
    fontWeight: '900',
  },
  td: {
    color: '#1d2b44',
    fontSize: 10,
    fontWeight: '700',
  },
  colOrder: { flex: 1.05 },
  colInvoice: { flex: 1.05 },
  colCustomer: { flex: 1.25 },
  colItem: { flex: 1.1 },
  colSize: { flex: 0.95 },
  colPic: { flex: 0.85 },
  colStatus: { flex: 0.8 },
  colPay: { flex: 0.85 },
  tableBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
    alignItems: 'center',
  },
  tableBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1f2937',
  },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  tableFooterText: {
    fontSize: 10,
    color: '#6b7890',
    fontWeight: '700',
  },
  emptyText: {
    color: '#667897',
    fontSize: 12,
    fontWeight: '700',
    padding: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeDraft: {
    backgroundColor: '#eef2f7',
  },
  badgeSent: {
    backgroundColor: '#fff5d6',
  },
  badgeApproved: {
    backgroundColor: '#daf8e6',
  },
  badgeRevision: {
    backgroundColor: '#ffe3e3',
  },
  badgeCancelled: {
    backgroundColor: '#e5e7eb',
  },
  badgeText: {
    color: '#172033',
    fontSize: 10,
    fontWeight: '900',
  },
  paymentOk: {
    backgroundColor: '#daf8e6',
  },
  paymentWarn: {
    backgroundColor: '#fff5d6',
  },
  paymentBad: {
    backgroundColor: '#ffe3e3',
  },
  detailRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 3,
  },
  detailLabel: {
    width: 112,
    color: '#536680',
    fontSize: 11,
    fontWeight: '800',
  },
  detailValue: {
    flex: 1,
    color: '#1d2b44',
    fontSize: 11,
    fontWeight: '700',
  },
  detailValueStrong: {
    fontWeight: '900',
    color: '#071d3f',
  },
  divider: {
    marginVertical: 10,
    height: 1,
    backgroundColor: '#e2e8f4',
  },
  previewFrame: {
    marginTop: 10,
    marginBottom: 12,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f8fbff',
    minHeight: 188,
    borderWidth: 1,
    borderColor: '#bed0eb',
  },
  previewImage: {
    width: '100%',
    height: 188,
    backgroundColor: '#f8fbff',
  },
  previewPlaceholder: {
    minHeight: 188,
    padding: 18,
    justifyContent: 'center',
    backgroundColor: '#092452',
  },
  previewBrand: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  previewHeadline: {
    marginTop: 10,
    color: '#ffd21a',
    fontSize: 29,
    lineHeight: 33,
    fontWeight: '900',
  },
  previewSubline: {
    marginTop: 6,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  previewMini: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#ffca18',
    color: '#13294b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: '900',
  },
  uploadedFilePreview: {
    minHeight: 188,
    padding: 18,
    justifyContent: 'center',
    backgroundColor: '#f8fbff',
  },
  uploadedFileKicker: {
    color: SIDOMULYO_BLUE,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  uploadedFileTitle: {
    marginTop: 8,
    color: '#12213a',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  uploadedFileMeta: {
    marginTop: 7,
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    color: '#174a9f',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: '900',
  },
  uploadedFileNote: {
    marginTop: 10,
    color: '#54637c',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  previewMetaStrip: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(7, 24, 55, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  previewMetaText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  previewToolbar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoomButton: {
    width: 24,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonText: {
    color: '#143056',
    fontWeight: '900',
    fontSize: 13,
  },
  zoomValue: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    height: 22,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomValueText: {
    color: '#143056',
    fontSize: 10,
    fontWeight: '900',
  },
  zoomControlDisabled: {
    backgroundColor: '#eef2f7',
  },
  zoomControlDisabledText: {
    color: '#9aa5b8',
  },
  downloadButton: {
    marginLeft: 'auto',
    backgroundColor: '#ffffff',
    color: SIDOMULYO_BLUE,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    fontSize: 10,
    fontWeight: '900',
  },
  downloadButtonDisabled: {
    color: '#8b95a7',
    backgroundColor: '#eef2f7',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: 132,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: SIDOMULYO_BLUE,
    borderWidth: 1,
    borderColor: SIDOMULYO_BLUE,
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionGreen: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  actionOrange: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  actionPurple: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  actionGhost: {
    flexBasis: 110,
    minHeight: 32,
    backgroundColor: '#ffffff',
    borderColor: '#bdd0ec',
  },
  actionDisabled: {
    opacity: 0.55,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  actionGhostText: {
    color: SIDOMULYO_BLUE,
  },
  gateHint: {
    marginTop: 8,
    color: '#8a4b00',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
  },
  postApprovalBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 9,
    gap: 8,
  },
  postApprovalHint: {
    color: '#1e3a8a',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
  },
  layoutPathLabel: {
    color: '#1f365e',
    fontSize: 11,
    fontWeight: '900',
  },
  layoutPathInput: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#bdd0ec',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#12243f',
    fontSize: 11,
    fontWeight: '800',
  },
  revisionNoteText: {
    marginTop: 8,
    color: '#9a3412',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
  },
  revisionHistoryBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    padding: 9,
    gap: 6,
  },
  revisionHistoryTitle: {
    color: '#9a3412',
    fontSize: 11,
    fontWeight: '900',
  },
  revisionHistoryRow: {
    borderTopWidth: 1,
    borderTopColor: '#fed7aa',
    paddingTop: 6,
    gap: 2,
  },
  revisionHistoryMeta: {
    color: '#9a3412',
    fontSize: 10,
    fontWeight: '900',
  },
  revisionHistoryNote: {
    color: '#431407',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  timelineScroll: {
    maxHeight: 230,
    width: '100%',
  },
  timelineScrollContent: {
    paddingBottom: 4,
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: SIDOMULYO_BLUE,
  },
  timelineTime: {
    width: 105,
    color: '#50627c',
    fontSize: 10,
    fontWeight: '800',
  },
  timelineText: {
    flex: 1,
    color: '#1f2c44',
    fontSize: 11,
    fontWeight: '700',
  },
  connectorGraphic: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f4',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  connectorNode: {
    borderWidth: 1,
    borderColor: '#9bb9e5',
    color: SIDOMULYO_BLUE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '900',
  },
  connectorLine: {
    color: '#6980a3',
    fontSize: 10,
    fontWeight: '900',
  },
});

export default ProofingPanel;
