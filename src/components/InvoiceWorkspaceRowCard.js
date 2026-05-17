import { Pressable, Text, View } from 'react-native';
import SyncLoadingAnimation from './SyncLoadingAnimation';
import { formatRupiah } from '../utils/currency';

const resolvePaymentBadgeStyle = (styles, variant) => (
  [
    styles.invoicePaymentBadge,
    variant === 'cash'
      ? styles.invoicePaymentBadgeCash
      : variant === 'deposit'
        ? styles.invoicePaymentBadgeDeposit
        : styles.invoicePaymentBadgeNonCash,
  ]
);

const resolvePaymentBadgeTextStyle = (styles, variant) => (
  [
    styles.invoicePaymentBadgeText,
    variant === 'cash'
      ? styles.invoicePaymentBadgeTextCash
      : variant === 'deposit'
        ? styles.invoicePaymentBadgeTextDeposit
        : styles.invoicePaymentBadgeTextNonCash,
  ]
);

const InvoiceWorkspaceRowCard = ({
  styles,
  displayId,
  invoiceNo,
  customerName,
  snapshotState,
  invoiceStatusLabel,
  invoiceStatusColor,
  isDraftRow,
  paymentLifecycle,
  approvalInfo,
  approvalLabelPrefix,
  approvalStatusText,
  approvalStatusColor,
  productionLifecycle,
  productionLabel,
  productionColor,
  productionStageCount,
  paymentMethodLabel,
  paymentTargetLabel,
  paymentBadgeVariant,
  itemCount,
  total,
  dueTotal,
  paidTotal,
  createdAtText,
  draftExpiryLabel,
  draftExpired,
  isDeleting,
  isApprovalRow,
  canCreateManualApproval,
  canApproveManualApprovalRow,
  canResolveManualApprovalRow,
  canPayReceivable,
  onContinueDraft,
  onDeleteDraft,
  onViewDetail,
  onCreateManualApproval,
  onApproveManualApproval,
  onRejectManualApproval,
  onResolveManualApproval,
  onOpenReceivablePayment,
  onReprintInvoice,
}) => (
  <View style={styles.draftCard}>
    <View style={styles.draftInfo}>
      <Text style={styles.draftTitle}>#{displayId} | {invoiceNo}</Text>
      <Text style={styles.draftMeta}>{customerName}</Text>
      {snapshotState ? (
        <View
          style={[
            styles.draftSnapshotBadge,
            { backgroundColor: snapshotState.backgroundColor, borderColor: snapshotState.color },
          ]}
        >
          <Text style={[styles.draftSnapshotBadgeText, { color: snapshotState.color }]}>
            {snapshotState.label}
          </Text>
        </View>
      ) : null}
      <View style={styles.invoiceStatusRow}>
        <Text style={styles.draftMeta}>Status: </Text>
        <Text style={[styles.draftMeta, styles.invoiceStatusText, { color: invoiceStatusColor }]}>
          {invoiceStatusLabel}
        </Text>
      </View>
      {!isDraftRow && paymentLifecycle?.label !== '-' ? (
        <View style={styles.invoiceStatusRow}>
          <Text style={styles.draftMeta}>Pembayaran: </Text>
          <Text style={[styles.draftMeta, styles.invoiceStatusText, { color: paymentLifecycle.color }]}>
            {paymentLifecycle.label}
          </Text>
        </View>
      ) : null}
      {approvalInfo ? (
        <View style={styles.invoiceStatusRow}>
          <Text style={styles.draftMeta}>{approvalLabelPrefix}</Text>
          <Text style={[styles.draftMeta, styles.invoiceStatusText, { color: approvalStatusColor }]}>
            {approvalStatusText}
          </Text>
        </View>
      ) : null}
      <View style={styles.productionCurrentRow}>
        <Text style={styles.draftMeta}>Produksi: </Text>
        <Text style={[styles.draftMeta, styles.productionCurrentText, { color: productionLifecycle.color }]}>
          {productionLifecycle.label}
        </Text>
      </View>
      <View style={styles.productionCurrentRow}>
        <Text style={styles.draftMeta}>Tahap Produksi: </Text>
        <Text style={[styles.draftMeta, styles.productionCurrentText, { color: productionColor }]}>
          {productionLabel}
          {productionStageCount > 0 ? ` (${productionStageCount} item)` : ''}
        </Text>
      </View>
      <View style={styles.invoicePaymentBadgeRow}>
        <View style={resolvePaymentBadgeStyle(styles, paymentBadgeVariant)}>
          <Text style={resolvePaymentBadgeTextStyle(styles, paymentBadgeVariant)}>
            {paymentMethodLabel}
          </Text>
        </View>
        {paymentTargetLabel ? (
          <View style={styles.invoicePaymentTargetBadge}>
            <Text style={styles.invoicePaymentTargetBadgeText}>{paymentTargetLabel}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.draftMeta}>Item: {itemCount} | Total: {formatRupiah(total)}</Text>
      {approvalInfo?.contextLabel ? (
        <Text style={styles.draftMeta}>Konteks request: {approvalInfo.contextLabel}</Text>
      ) : null}
      {approvalInfo?.amount > 0 ? (
        <Text style={styles.draftMeta}>Nominal approval: {formatRupiah(approvalInfo.amount)}</Text>
      ) : null}
      {approvalInfo?.type === 'receivable_limit' && approvalInfo?.currentApprovedLimitAmount > 0 ? (
        <Text style={styles.draftMeta}>
          Plafon aktif saat request: {formatRupiah(approvalInfo.currentApprovedLimitAmount)}
        </Text>
      ) : null}
      {approvalInfo?.type === 'receivable_limit' && approvalInfo?.projectedOutstandingTotal > 0 ? (
        <Text style={styles.draftMeta}>
          Proyeksi piutang setelah order: {formatRupiah(approvalInfo.projectedOutstandingTotal)}
        </Text>
      ) : null}
      {approvalInfo?.outstandingTotal > 0 ? (
        <Text style={styles.receivableDueText}>
          Piutang sebelumnya: {formatRupiah(approvalInfo.outstandingTotal)}
          {approvalInfo?.approver?.name ? ` | Diproses oleh: ${approvalInfo.approver.name}` : ''}
        </Text>
      ) : null}
      {approvalInfo?.handledBy?.name ? (
        <Text style={styles.draftMeta}>
          Handled by: {approvalInfo.handledBy.name}
          {approvalInfo?.handledAt ? ` | ${approvalInfo.handledAt}` : ''}
        </Text>
      ) : null}
      {approvalInfo?.resolvedAt ? (
        <Text style={styles.draftMeta}>Selesai ditangani: {approvalInfo.resolvedAt}</Text>
      ) : null}
      {approvalInfo?.decisionNote ? (
        <Text style={styles.draftMeta}>Catatan approval: {approvalInfo.decisionNote}</Text>
      ) : null}
      {dueTotal > 0 ? (
        <Text style={styles.receivableDueText}>
          Piutang: {formatRupiah(dueTotal)} | Terbayar: {formatRupiah(paidTotal)}
        </Text>
      ) : null}
      <Text style={styles.draftMeta}>Tanggal: {createdAtText}</Text>
      {isDraftRow ? (
        <Text
          style={[
            styles.draftExpiryMeta,
            draftExpired ? styles.draftExpiryMetaExpired : null,
          ]}
        >
          {draftExpiryLabel}
        </Text>
      ) : null}
    </View>
    <View style={styles.draftActionColumn}>
      {isDraftRow ? (
        <>
          <Pressable
            style={[
              styles.continueDraftButton,
              isDeleting ? styles.draftActionDisabled : null,
            ]}
            disabled={isDeleting}
            onPress={onContinueDraft}
          >
            <Text style={styles.continueDraftButtonText}>Lanjutkan</Text>
          </Pressable>
          <Pressable
            style={[
              styles.deleteDraftButton,
              isDeleting ? styles.draftActionDisabled : null,
            ]}
            disabled={isDeleting}
            onPress={onDeleteDraft}
          >
            {isDeleting ? (
              <View style={styles.inlineLoadingButtonContent}>
                <SyncLoadingAnimation size={20} />
                <Text style={styles.deleteDraftButtonText}>Memproses...</Text>
              </View>
            ) : (
              <Text style={styles.deleteDraftButtonText}>Hapus</Text>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <Pressable style={styles.continueDraftButton} onPress={onViewDetail}>
            <Text style={styles.continueDraftButtonText}>Detail</Text>
          </Pressable>
          {canCreateManualApproval ? (
            <Pressable style={styles.approvalCreateButton} onPress={onCreateManualApproval}>
              <Text style={styles.approvalCreateButtonText}>Buat Approval</Text>
            </Pressable>
          ) : null}
          {canApproveManualApprovalRow ? (
            <Pressable style={styles.approvalResolveButton} onPress={onApproveManualApproval}>
              <Text style={styles.approvalResolveButtonText}>Setujui</Text>
            </Pressable>
          ) : null}
          {canApproveManualApprovalRow ? (
            <Pressable style={styles.deleteDraftButton} onPress={onRejectManualApproval}>
              <Text style={styles.deleteDraftButtonText}>Tolak</Text>
            </Pressable>
          ) : null}
          {canResolveManualApprovalRow ? (
            <Pressable style={styles.approvalResolveButton} onPress={onResolveManualApproval}>
              <Text style={styles.approvalResolveButtonText}>Selesai</Text>
            </Pressable>
          ) : null}
          {!isApprovalRow && dueTotal > 0 ? (
            <Pressable
              style={[
                styles.receivablePayButton,
                !canPayReceivable ? styles.draftActionDisabled : null,
              ]}
              disabled={!canPayReceivable}
              onPress={onOpenReceivablePayment}
            >
              <Text style={styles.receivablePayButtonText}>
                {canPayReceivable ? 'Bayar Piutang' : 'Belum Bisa Dibayar'}
              </Text>
            </Pressable>
          ) : null}
          {!isApprovalRow ? (
            <Pressable style={styles.refreshButton} onPress={onReprintInvoice}>
              <Text style={styles.refreshButtonText}>Cetak Ulang</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  </View>
);

export default InvoiceWorkspaceRowCard;
