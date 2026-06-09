import { Pressable, Text, View } from 'react-native';
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
  auditSummaryLines,
  snapshotState,
  invoiceStatusLabel,
  invoiceStatusColor,
  isDraftRow,
  paymentLifecycle,
  providerPaymentSummary,
  providerPaymentCountdownLabel,
  approvalInfo,
  approvalLabelPrefix,
  approvalStatusText,
  approvalStatusColor,
  productionLifecycle,
  productionLabel,
  productionColor,
  productionStageCount,
  proofingSummarySectionLabel,
  proofingSummaryLabel,
  proofingSummaryColor,
  proofingSummaryNote,
  paymentMethodLabel,
  paymentTargetLabel,
  paymentBadgeVariant,
  itemCount,
  total,
  dueTotal,
  paidTotal,
  receivableDueMeta,
  createdAtText,
  draftExpiryLabel,
  draftExpired,
  draftStockState,
  isDeleting,
  isApprovalRow,
  canCreateManualApproval,
  canApproveManualApprovalRow,
  canResolveManualApprovalRow,
  canContinueDraft,
  canDeleteDraft,
  canPayReceivable,
  canRemindReceivable,
  canOpenProviderPayment,
  canPrintBillingNote,
  onContinueDraft,
  onDeleteDraft,
  onViewDetail,
  onOpenProviderPayment,
  onCreateManualApproval,
  onApproveManualApproval,
  onRejectManualApproval,
  onResolveManualApproval,
  onOpenReceivablePayment,
  onRemindReceivable,
  onReprintInvoice,
  onPrintBillingNote,
  onShareBillingNote,
}) => {
  const paymentStatusLabel = dueTotal > 0
    ? (paidTotal > 0 ? 'DP / Belum Lunas' : 'Belum Lunas')
    : 'Lunas';
  const paymentStatusColor = dueTotal > 0
    ? (paidTotal > 0 ? '#b54708' : '#b42318')
    : '#067647';
  const compactStatusLabel = isDraftRow
    ? (invoiceStatusLabel || 'Draft')
    : paymentStatusLabel;
  const compactStatusColor = isDraftRow
    ? (invoiceStatusColor || '#b54708')
    : paymentStatusColor;
  const compactStatusBackground = isDraftRow
    ? '#fff7ed'
    : (dueTotal > 0 ? '#fff7ed' : '#ecfdf3');
  const agendaLabel = dueTotal > 0
    ? (receivableDueMeta?.label || 'Agenda belum diisi')
    : '-';
  const agendaStatusLabel = dueTotal > 0 ? String(receivableDueMeta?.statusLabel || '').trim() : '';

  return (
    <View style={styles.invoiceTableRow}>
      <View style={styles.invoiceTableColInvoice}>
        <Text style={styles.invoiceTableInvoiceTitle}>#{displayId} | {invoiceNo}</Text>
        <Text style={styles.invoiceTableCustomerName} numberOfLines={1}>{customerName}</Text>
      </View>
      <View style={styles.invoiceTableColStatus}>
        <View style={[styles.invoiceTableStatusBadge, { borderColor: compactStatusColor, backgroundColor: compactStatusBackground }]}>
          <Text style={[styles.invoiceTableStatusText, { color: compactStatusColor }]}>{compactStatusLabel}</Text>
        </View>
      </View>
      <View style={styles.invoiceTableColMethod}>
        <View style={resolvePaymentBadgeStyle(styles, paymentBadgeVariant)}>
          <Text style={resolvePaymentBadgeTextStyle(styles, paymentBadgeVariant)} numberOfLines={1}>
            {paymentMethodLabel || '-'}
          </Text>
        </View>
        {paymentTargetLabel ? (
          <Text style={styles.invoiceTableSubText} numberOfLines={1}>{paymentTargetLabel}</Text>
        ) : null}
      </View>
      <View style={styles.invoiceTableColDue}>
        <Text style={[
          styles.invoiceTableDueAmount,
          dueTotal > 0 ? styles.invoiceTableDueAmountActive : null,
        ]}>
          {dueTotal > 0 ? formatRupiah(dueTotal) : '-'}
        </Text>
        {dueTotal > 0 ? (
          <Text style={styles.invoiceTableSubText}>Terbayar {formatRupiah(paidTotal)}</Text>
        ) : null}
      </View>
      <View style={styles.invoiceTableColAgenda}>
        <Text style={[
          styles.invoiceTableAgendaText,
          receivableDueMeta?.isOverdue ? styles.invoiceTableAgendaOverdue : null,
        ]}>
          {agendaLabel}
        </Text>
        {agendaStatusLabel ? (
          <Text style={[
            styles.invoiceTableSubText,
            receivableDueMeta?.isOverdue ? styles.invoiceTableAgendaOverdue : null,
          ]}>{agendaStatusLabel}</Text>
        ) : null}
      </View>
      <View style={styles.invoiceTableColAction}>
        {isDraftRow && canContinueDraft ? (
          <Pressable
            style={[
              styles.invoiceTableDetailButton,
              isDeleting ? styles.draftActionDisabled : null,
            ]}
            disabled={isDeleting}
            onPress={onContinueDraft}
          >
            <Text style={styles.invoiceTableDetailButtonText}>Lanjutkan</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.invoiceTableDetailButton} onPress={onViewDetail}>
            <Text style={styles.invoiceTableDetailButtonText}>Detail</Text>
          </Pressable>
        )}
        {isDraftRow && canDeleteDraft ? (
          <Pressable
            style={[
              styles.invoiceTableTagihButton,
              isDeleting ? styles.draftActionDisabled : null,
            ]}
            disabled={isDeleting}
            onPress={onDeleteDraft}
          >
            <Text style={styles.invoiceTableTagihButtonText}>
              {isDeleting ? 'Hapus...' : 'Hapus'}
            </Text>
          </Pressable>
        ) : null}
        {!isDraftRow && dueTotal > 0 && canRemindReceivable ? (
          <Pressable style={styles.invoiceTableTagihButton} onPress={onRemindReceivable}>
            <Text style={styles.invoiceTableTagihButtonText}>Tagih</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

export default InvoiceWorkspaceRowCard;
