import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { formatRupiah } from '../utils/currency';

const AREA_CARDS = [
  {
    key: 'draft',
    menu: 'draft_orders',
    label: 'Ringkasan Operasional',
    meta: 'Ringkasan operasional, pengeluaran, pembelian, dan estimasi setoran',
  },
  {
    key: 'success',
    menu: 'invoice_success',
    label: 'Nota Penjualan Tercatat',
    meta: 'Nota resmi yang sudah masuk pencatatan penjualan',
  },
];

const DashboardIcon = ({ type = 'invoice', color = '#1f5fbf', size = 24 }) => {
  const stroke = color;
  const fill = 'none';
  const strokeWidth = 2.1;

  if (type === 'wallet') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
        <Path d="M4 7.5h14.5A2.5 2.5 0 0 1 21 10v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17V6.5A2.5 2.5 0 0 1 5.5 4H18" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M16 13h5" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
        <Circle cx="16" cy="13" r="1" fill={stroke} />
      </Svg>
    );
  }

  if (type === 'users') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
        <Circle cx="9" cy="8" r="3.2" stroke={stroke} strokeWidth={strokeWidth} />
        <Path d="M3.5 19c.8-3.5 3-5 5.5-5s4.7 1.5 5.5 5" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
        <Path d="M15.5 11.5A3 3 0 1 0 15 5.8" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
        <Path d="M16.5 14.2c2 .4 3.4 1.9 4 4.8" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      </Svg>
    );
  }

  if (type === 'cart') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
        <Path d="M4 5h2l2 10.5h9.5l2-7.5H7.2" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="10" cy="19" r="1.3" fill={stroke} />
        <Circle cx="17" cy="19" r="1.3" fill={stroke} />
      </Svg>
    );
  }

  if (type === 'bag') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
        <Path d="M7 9h10l1 11H6L7 9Z" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
        <Path d="M9 9V7a3 3 0 0 1 6 0v2" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      </Svg>
    );
  }

  if (type === 'clipboard') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
        <Rect x="6" y="4.5" width="12" height="16" rx="2" stroke={stroke} strokeWidth={strokeWidth} />
        <Path d="M9 4h6v3H9V4Z" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
        <Path d="M9 11h6M9 15h4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      </Svg>
    );
  }

  if (type === 'alert') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
        <Path d="M12 4 21 20H3L12 4Z" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
        <Path d="M12 9v5M12 17h.01" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      </Svg>
    );
  }

  if (type === 'card') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
        <Rect x="4" y="5" width="16" height="14" rx="2" stroke={stroke} strokeWidth={strokeWidth} />
        <Path d="M4 10h16M8 15h3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      </Svg>
    );
  }

  if (type === 'filter') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
        <Path d="M4 6h16M7 12h10M10 18h4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
      <Path d="M7 3.5h10v17l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V3.5Z" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M9.5 8h5M9.5 12h5M9.5 16h3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
};

const APPROVAL_FILTERS = [
  { key: 'all', label: 'Semua Approval' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
];

const INVOICE_STATUS_FILTER_OPTIONS = [
  { key: 'all', label: 'Semua Status' },
  { key: 'paid', label: 'Lunas' },
  { key: 'dp', label: 'DP / Belum Lunas' },
  { key: 'unpaid', label: 'Belum Lunas' },
];

const CUSTOMER_TYPE_FILTER_OPTIONS = [
  { key: 'all', label: 'Semua Pelanggan' },
  { key: 'reseller', label: 'Reseller' },
  { key: 'retail', label: 'Retail' },
];

const formatInvoicePaymentOptionLabel = (value = '') => {
  const text = String(value || '').trim();
  if (['cash', 'tunai'].includes(text.toLowerCase())) {
    return 'Tunai';
  }
  return text || 'Metode Pembayaran';
};

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
  if (key === 'success') return 'Total Penjualan';
  if (key === 'receivable') return 'Total Piutang';
  return '';
};

const resolveAreaAmountStyle = (styles, key = '') => {
  if (key === 'draft') return styles.areaAmountDraft;
  if (key === 'success') return styles.areaAmountSuccess;
  if (key === 'receivable') return styles.areaAmountReceivable;
  return null;
};

const buildSalesDashboardMetrics = (summary = {}) => ([
  {
    key: 'draft',
    label: 'Total Draft',
    subtitle: '(Perlu Proses)',
    count: Number(summary?.draftCount || 0) || 0,
    amount: Number(summary?.draftAmount || 0) || 0,
    tone: 'danger',
  },
  {
    key: 'management_pending',
    label: 'Beban Management',
    subtitle: '(Perlu Proses)',
    count: Number(summary?.managementBurdenUnprocessedCount ?? summary?.managementBurdenPendingCount ?? summary?.managementBurdenCount ?? 0) || 0,
    countSuffix: 'Total Nota',
    amount: Number(summary?.managementBurdenUnprocessedAmount ?? summary?.managementBurdenPendingAmount ?? summary?.managementBurdenAmount ?? 0) || 0,
    tone: 'danger',
  },
  {
    key: 'receivable',
    label: 'Total Piutang Belum Lunas',
    count: Number(summary?.receivableCount || 0) || 0,
    amount: Number(summary?.receivableDueTotal || 0) || 0,
  },
  {
    key: 'production_approved',
    label: 'Kesalahan Produksi',
    subtitle: '(Masuk Piutang)',
    count: Number(summary?.productionMistakeApprovedCount || 0) || 0,
    countSuffix: 'Total Nota',
    amount: Number(summary?.productionMistakeApprovedAmount || 0) || 0,
    tone: 'danger',
  },
  {
    key: 'due_today',
    label: 'Piutang Jatuh Tempo',
    subtitle: '(Wajib Lunas Hari Ini)',
    count: Number(summary?.dueTodayCount || 0) || 0,
    amount: Number(summary?.dueTodayAmount || 0) || 0,
  },
  {
    key: 'management_unprocessed',
    label: 'Beban Management',
    subtitle: '(Blm di Proses)',
    count: Number(summary?.managementBurdenUnprocessedCount ?? summary?.managementBurdenPendingCount ?? summary?.managementBurdenCount ?? 0) || 0,
    countSuffix: 'Total Nota',
    amount: Number(summary?.managementBurdenUnprocessedAmount ?? summary?.managementBurdenPendingAmount ?? summary?.managementBurdenAmount ?? 0) || 0,
    tone: 'danger',
  },
  {
    key: 'overdue',
    label: 'Piutang Keterlaluan',
    subtitle: '(Sudah Tidak Bisa Hutang)',
    count: Number(summary?.overdueReceivableCount || 0) || 0,
    amount: Number(summary?.overdueReceivableAmount || 0) || 0,
    tone: 'danger',
  },
  {
    key: 'production_unprocessed',
    label: 'Kesalahan Produksi',
    subtitle: '(Belum di Proses)',
    count: Number(summary?.productionMistakeUnprocessedCount ?? summary?.productionMistakePendingCount ?? summary?.productionMistakeCount ?? 0) || 0,
    countSuffix: 'Total Nota',
    amount: Number(summary?.productionMistakeUnprocessedAmount ?? summary?.productionMistakePendingAmount ?? summary?.productionMistakeAmount ?? 0) || 0,
    tone: 'danger',
  },
]);

const buildRecordedSalesPaymentMetrics = (summary = {}) => ([
  {
    key: 'sales_cash',
    label: 'Tunai',
    count: Number(summary?.salesCashCount || 0) || 0,
    amount: Number(summary?.salesCashAmount || 0) || 0,
    tone: 'success',
  },
  {
    key: 'sales_transfer',
    label: 'Transfer',
    count: Number(summary?.salesTransferCount || 0) || 0,
    amount: Number(summary?.salesTransferAmount || 0) || 0,
  },
  {
    key: 'sales_qris',
    label: 'QRIS',
    count: Number(summary?.salesQrisCount || 0) || 0,
    amount: Number(summary?.salesQrisAmount || 0) || 0,
  },
  {
    key: 'sales_deposit_agent',
    label: 'Deposit Agent',
    count: Number(summary?.salesDepositAgentCount || 0) || 0,
    amount: Number(summary?.salesDepositAgentAmount || 0) || 0,
  },
  {
    key: 'sales_split_payment',
    label: 'Bayar Terpisah',
    count: Number(summary?.salesSplitPaymentCount || 0) || 0,
    amount: Number(summary?.salesSplitPaymentAmount || 0) || 0,
  },
  {
    key: 'sales_dp',
    label: 'DP',
    count: Number(summary?.salesDpCount || 0) || 0,
    amount: Number(summary?.salesDpAmount || 0) || 0,
  },
  {
    key: 'sales_unpaid',
    label: 'Belum Lunas',
    count: Number(summary?.salesUnpaidCount || 0) || 0,
    amount: Number(summary?.salesUnpaidAmount || 0) || 0,
    tone: 'danger',
  },
]);

const resolveRecordedSalesTransactionCount = (summary = {}) => (
  Number(summary?.salesCashCount || 0)
  + Number(summary?.salesTransferCount || 0)
  + Number(summary?.salesQrisCount || 0)
  + Number(summary?.salesDepositAgentCount || 0)
  + Number(summary?.salesSplitPaymentCount || 0)
  + Number(summary?.salesDpCount || 0)
);

const buildDepositTopupMetrics = (summary = {}) => ([
  {
    key: 'deposit_cash',
    label: 'Tunai',
    count: Number(summary?.depositTopupCashCount || 0) || 0,
    amount: Number(summary?.depositTopupCashAmount || 0) || 0,
  },
  {
    key: 'deposit_transfer',
    label: 'Transfer',
    count: Number(summary?.depositTopupTransferCount || 0) || 0,
    amount: Number(summary?.depositTopupTransferAmount || 0) || 0,
  },
  {
    key: 'deposit_qris',
    label: 'QRIS',
    count: Number(summary?.depositTopupQrisCount || 0) || 0,
    amount: Number(summary?.depositTopupQrisAmount || 0) || 0,
  },
  {
    key: 'deposit_customer_overpay',
    label: 'Lebih Bayar Pelanggan',
    count: Number(summary?.depositTopupCustomerOverpayCount || 0) || 0,
    amount: Number(summary?.depositTopupCustomerOverpayAmount || 0) || 0,
  },
]);

const buildReceivableCollectionMetrics = (summary = {}) => ([
  {
    key: 'receivable_cash',
    label: 'Tunai',
    count: Number(summary?.receivableCollectionCashCount || 0) || 0,
    amount: Number(summary?.receivableCollectionCashAmount || 0) || 0,
  },
  {
    key: 'receivable_transfer',
    label: 'Transfer',
    count: Number(summary?.receivableCollectionTransferCount || 0) || 0,
    amount: Number(summary?.receivableCollectionTransferAmount || 0) || 0,
  },
  {
    key: 'receivable_qris',
    label: 'QRIS',
    count: Number(summary?.receivableCollectionQrisCount || 0) || 0,
    amount: Number(summary?.receivableCollectionQrisAmount || 0) || 0,
  },
  {
    key: 'receivable_deposit_agent',
    label: 'Deposit Agen',
    count: Number(summary?.receivableCollectionDepositAgentCount || 0) || 0,
    amount: Number(summary?.receivableCollectionDepositAgentAmount || 0) || 0,
  },
]);

const buildExpenseMetrics = (summary = {}) => ([
  {
    key: 'expense_cash',
    label: 'Tunai',
    count: Number(summary?.expenseCashCount || 0) || 0,
    amount: Number(summary?.expenseCashAmount || 0) || 0,
  },
  {
    key: 'expense_transfer',
    label: 'Transfer',
    count: Number(summary?.expenseTransferCount || 0) || 0,
    amount: Number(summary?.expenseTransferAmount || 0) || 0,
  },
  {
    key: 'expense_qris',
    label: 'QRIS',
    count: Number(summary?.expenseQrisCount || 0) || 0,
    amount: Number(summary?.expenseQrisAmount || 0) || 0,
  },
  {
    key: 'expense_unpaid',
    label: 'Hutang',
    count: Number(summary?.expenseUnpaidCount || 0) || 0,
    amount: Number(summary?.expenseUnpaidAmount || 0) || 0,
  },
]);

const buildPurchaseMetrics = (summary = {}) => ([
  {
    key: 'purchase_cash',
    label: 'Tunai',
    count: Number(summary?.purchaseCashCount || 0) || 0,
    amount: Number(summary?.purchaseCashAmount || 0) || 0,
  },
  {
    key: 'purchase_transfer',
    label: 'Transfer',
    count: Number(summary?.purchaseTransferCount || 0) || 0,
    amount: Number(summary?.purchaseTransferAmount || 0) || 0,
  },
  {
    key: 'purchase_qris',
    label: 'QRIS',
    count: Number(summary?.purchaseQrisCount || 0) || 0,
    amount: Number(summary?.purchaseQrisAmount || 0) || 0,
  },
  {
    key: 'purchase_unlinked',
    label: 'Belum Masuk Akun',
    count: Number(summary?.purchaseUnlinkedCount || summary?.purchaseUnpaidCount || 0) || 0,
    amount: Number(summary?.purchaseUnlinkedAmount || summary?.purchaseUnpaidAmount || 0) || 0,
  },
]);

const buildCashierRemittanceMetrics = (summary = {}) => ([
  {
    key: 'remittance_opening_cash',
    label: 'Modal Kasir',
    amount: Number(summary?.remittanceOpeningCashAmount || 0) || 0,
  },
  {
    key: 'remittance_cash',
    label: 'Tunai',
    amount: Number(summary?.remittanceCashNetAmount ?? summary?.remittanceCashReadyAmount ?? 0) || 0,
  },
  {
    key: 'remittance_transfer',
    label: 'Transfer',
    amount: Number(summary?.remittanceTransferReadyAmount || 0) || 0,
  },
  {
    key: 'remittance_qris',
    label: 'QRIS',
    amount: Number(summary?.remittanceQrisReadyAmount || 0) || 0,
  },
  {
    key: 'remittance_customer_deposit',
    label: 'Case',
    amount: Number(summary?.remittanceCustomerDepositSettlementAmount || 0) || 0,
    count: Number(summary?.remittanceCustomerDepositSettlementCount || 0) || 0,
    infoOnly: true,
  },
]);

const buildOperationalSummaryCards = (summary = {}) => ([
  {
    key: 'draft',
    title: 'Total Draft',
    value: Number(summary?.draftCount || 0) || 0,
    helper: 'Nota Draft',
    invoiceInfo: `${Number(summary?.draftCount || 0) || 0} invoice`,
    amount: Number(summary?.draftAmount || 0) || 0,
    tone: 'warning',
  },
  {
    key: 'receivable',
    title: 'Piutang Belum Lunas',
    value: formatRupiah(summary?.receivableDueTotal || 0),
    helper: 'Total Piutang Aktif',
    invoiceInfo: `${Number(summary?.receivableCount || 0) || 0} invoice`,
    amount: Number(summary?.receivableDueTotal || 0) || 0,
    tone: 'danger',
  },
  {
    key: 'due_today',
    title: 'Piutang Jatuh Tempo',
    value: formatRupiah(summary?.dueTodayAmount || 0),
    helper: 'Perlu Segera Ditagih',
    invoiceInfo: `${Number(summary?.dueTodayCount || 0) || 0} invoice`,
    amount: Number(summary?.dueTodayAmount || 0) || 0,
    tone: 'warning',
  },
  {
    key: 'overdue',
    title: 'Piutang Keterlaluan',
    value: formatRupiah(summary?.overdueReceivableAmount || 0),
    helper: 'Lewat Batas Toleransi',
    invoiceInfo: `${Number(summary?.overdueReceivableCount || 0) || 0} invoice`,
    amount: Number(summary?.overdueReceivableAmount || 0) || 0,
    tone: 'danger',
  },
  {
    key: 'management',
    title: 'Beban Management',
    value: formatRupiah(summary?.managementBurdenUnprocessedAmount || summary?.managementBurdenAmount || 0),
    helper: 'Total Beban',
    invoiceInfo: `${Number(summary?.managementBurdenUnprocessedCount || summary?.managementBurdenCount || 0) || 0} invoice`,
    todayInfo: `${Number(summary?.managementBurdenTodayCount || 0) || 0} invoice | ${formatRupiah(summary?.managementBurdenTodayAmount || 0)}`,
    amount: Number(summary?.managementBurdenUnprocessedAmount || summary?.managementBurdenAmount || 0) || 0,
    tone: 'neutral',
  },
  {
    key: 'production',
    title: 'Kesalahan Produksi',
    value: `${Number(summary?.productionMistakeUnprocessedCount || summary?.productionMistakeCount || 0) || 0} Kasus`,
    helper: formatRupiah(summary?.productionMistakeUnprocessedAmount || summary?.productionMistakeAmount || 0),
    invoiceInfo: `${Number(summary?.productionMistakeUnprocessedCount || summary?.productionMistakeCount || 0) || 0} invoice`,
    todayInfo: `${Number(summary?.productionMistakeTodayCount || 0) || 0} invoice | ${formatRupiah(summary?.productionMistakeTodayAmount || 0)}`,
    amount: Number(summary?.productionMistakeUnprocessedAmount || summary?.productionMistakeAmount || 0) || 0,
    tone: 'danger',
  },
]);

const renderDashboardAccountRows = (accounts = [], styles, prefix = 'account') => (
  Array.isArray(accounts) ? accounts.slice(0, 4).map((account, index) => {
    const accountName = String(account?.accountName || account?.accountCode || 'Akun belum dipilih').trim();
    return (
      <View key={`${prefix}-${account?.bankAccountId || 'account'}-${index}`} style={styles.dashboardAccountRow}>
        <Text style={styles.dashboardAccountName} numberOfLines={1}>{accountName}</Text>
        <Text style={styles.dashboardAccountAmount}>{formatRupiah(account?.amount || 0)}</Text>
        <View style={styles.dashboardAccountBadge}>
          <Text style={styles.dashboardAccountCount}>{Number(account?.count || 0) || 0}</Text>
          <Text style={styles.dashboardAccountText}>trx</Text>
        </View>
      </View>
    );
  }) : null
);

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
  onOpenClosingStore,
  closingStoreActionLabel = 'Closing Toko',
  closingStoreActionTone = 'default',
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
  invoiceCashierId,
  cashierOptions,
  isCashierLoading,
  onChangeInvoiceCashierId,
  onLoadCashiers,
  invoiceStatusFilter = 'all',
  onChangeInvoiceStatusFilter,
  invoicePaymentMethodFilter = 'all',
  onChangeInvoicePaymentMethodFilter,
  invoiceCustomerTypeFilter = 'all',
  onChangeInvoiceCustomerTypeFilter,
  paymentMethodOptions,
  activeOperationalSummaryKey = '',
  onSelectOperationalSummary,
}) => {
  const [isDateModalVisible, setIsDateModalVisible] = useState(false);
  const [activeFilterPicker, setActiveFilterPicker] = useState('');
  const [activeDateField, setActiveDateField] = useState('from');
  const [draftDateFrom, setDraftDateFrom] = useState(String(invoiceDateFrom || '').trim());
  const [draftDateTo, setDraftDateTo] = useState(String(invoiceDateTo || '').trim());
  const [calendarCursor, setCalendarCursor] = useState(() => resolveInitialCalendarCursor(invoiceDateFrom, invoiceDateTo));
  const calendarCells = useMemo(() => buildCalendarCells(calendarCursor), [calendarCursor]);
  const pendingRealtimeCount = Math.max(Number(invoiceRealtimeState?.pendingCount || 0) || 0, 0);
  const shouldShowInvoiceSuccessFilters = String(invoiceFilter || '').trim() === 'success';
  const shouldShowDateFilter = true;
  const cacheSource = String(invoiceListMeta?.source || '').trim();
  const realtimeMessage = cacheSource === 'local_success_cache'
    ? 'Invoice sukses tampil dari cache lokal. Search/Refresh tetap ambil server.'
    : cacheSource === 'local_success_cache_date_filter'
      ? 'Invoice sukses sesuai tanggal tampil dari cache lokal. Sinkron server tetap berjalan.'
      : String(invoiceRealtimeState?.message || '').trim();
  const hasServerDashboardSummary = String(invoiceAreaSummary?.source || '').trim() === 'server_dashboard_summary';
  const invoicePaymentMethodOptions = useMemo(() => {
    const configured = Array.isArray(paymentMethodOptions) ? paymentMethodOptions : [];
    const normalized = configured
      .map((option) => String(option || '').trim())
      .filter(Boolean);
    const fallback = ['Cash', 'Transfer Bank', 'QRIS', 'Deposit Customer'];
    return Array.from(new Set([...normalized, ...fallback]));
  }, [paymentMethodOptions]);
  const cashierDropdownOptions = useMemo(() => ([
    { key: '', label: 'Semua Kasir' },
    ...(Array.isArray(cashierOptions) ? cashierOptions : [])
      .map((cashier) => {
        const id = String(cashier?.id || cashier?.user_id || '').trim();
        if (!id) {
          return null;
        }
        return {
          key: id,
          label: String(cashier?.name || cashier?.full_name || cashier?.email || `Kasir #${id}`).trim(),
        };
      })
      .filter(Boolean),
  ]), [cashierOptions]);
  const paymentDropdownOptions = useMemo(() => ([
    { key: 'all', label: 'Semua Metode' },
    ...invoicePaymentMethodOptions.map((label) => ({ key: label, label: formatInvoicePaymentOptionLabel(label) })),
  ]), [invoicePaymentMethodOptions]);
  const statusFilterLabel = INVOICE_STATUS_FILTER_OPTIONS.find((row) => row.key === invoiceStatusFilter)?.label || 'Semua Status';
  const paymentFilterLabel = paymentDropdownOptions.find((row) => row.key === invoicePaymentMethodFilter)?.label || 'Semua Metode';
  const cashierFilterLabel = cashierDropdownOptions.find((row) => row.key === String(invoiceCashierId || ''))?.label || 'Semua Kasir';
  const customerTypeFilterLabel = CUSTOMER_TYPE_FILTER_OPTIONS.find((row) => row.key === invoiceCustomerTypeFilter)?.label || 'Semua Pelanggan';
  const dashboardDateFilterLabel = invoiceDateFrom || invoiceDateTo
    ? `${invoiceDateFrom || 'awal'} s/d ${invoiceDateTo || 'akhir'}`
    : 'Default dashboard';

  const openFilterPicker = (type) => {
    if (type === 'cashier') {
      onLoadCashiers?.();
    }
    setActiveFilterPicker(type);
  };

  const closeFilterPicker = () => {
    setActiveFilterPicker('');
  };

  const resolveActiveFilterPickerTitle = () => {
    if (activeFilterPicker === 'status') return 'Pilih Status Invoice';
    if (activeFilterPicker === 'method') return 'Pilih Metode Pembayaran';
    if (activeFilterPicker === 'cashier') return 'Pilih Kasir';
    if (activeFilterPicker === 'customer_type') return 'Pilih Tipe Pelanggan';
    return 'Pilih Filter';
  };

  const resolveActiveFilterPickerOptions = () => {
    if (activeFilterPicker === 'status') return INVOICE_STATUS_FILTER_OPTIONS;
    if (activeFilterPicker === 'method') return paymentDropdownOptions;
    if (activeFilterPicker === 'cashier') return cashierDropdownOptions;
    if (activeFilterPicker === 'customer_type') return CUSTOMER_TYPE_FILTER_OPTIONS;
    return [];
  };

  const resolveActiveFilterPickerValue = () => {
    if (activeFilterPicker === 'status') return invoiceStatusFilter;
    if (activeFilterPicker === 'method') return invoicePaymentMethodFilter;
    if (activeFilterPicker === 'cashier') return String(invoiceCashierId || '');
    if (activeFilterPicker === 'customer_type') return invoiceCustomerTypeFilter;
    return '';
  };

  const handleSelectFilterOption = (value) => {
    if (activeFilterPicker === 'status') {
      onChangeInvoiceStatusFilter?.(value);
    } else if (activeFilterPicker === 'method') {
      onChangeInvoicePaymentMethodFilter?.(value);
    } else if (activeFilterPicker === 'cashier') {
      onChangeInvoiceCashierId?.(value);
    } else if (activeFilterPicker === 'customer_type') {
      onChangeInvoiceCustomerTypeFilter?.(value);
    }
    closeFilterPicker();
  };

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
    const today = toIsoDate(new Date());
    setDraftDateFrom(today);
    setDraftDateTo(today);
    setActiveDateField('from');
    setCalendarCursor(startOfLocalMonth(today));
    onClearInvoiceDateFilter?.();
  };

  return (
    <>
    <View style={styles.headerRow}>
      <View style={styles.headerInfo}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>{sectionMeta?.title || 'Pusat Invoice'}</Text>
          {shouldShowDateFilter ? (
            <View style={styles.headerDateFilterPill}>
              <Text style={styles.headerDateFilterValue} numberOfLines={1}>{dashboardDateFilterLabel}</Text>
              <Pressable style={styles.headerDateFilterButton} onPress={openDateModal}>
                <Text style={styles.headerDateFilterButtonText}>Filter Tanggal</Text>
              </Pressable>
              <Pressable style={styles.headerDateResetButton} onPress={handleClearDateFilter}>
                <Text style={styles.headerDateResetButtonText}>Reset</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
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
        <Pressable
          style={[
            styles.refreshButton,
            closingStoreActionTone === 'review' ? styles.closingReviewButton : null,
            closingStoreActionTone === 'ready' ? styles.closingReadyButton : null,
            closingStoreActionTone === 'locked' ? styles.closingLockedButton : null,
          ]}
          onPress={onOpenClosingStore}
        >
          <Text
            style={[
              styles.refreshButtonText,
              closingStoreActionTone === 'review' ? styles.closingReviewButtonText : null,
              closingStoreActionTone === 'ready' ? styles.closingReadyButtonText : null,
              closingStoreActionTone === 'locked' ? styles.closingLockedButtonText : null,
            ]}
          >
            {closingStoreActionLabel}
          </Text>
        </Pressable>
        <Pressable style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>{isLoading ? 'Memuat...' : 'Refresh'}</Text>
        </Pressable>
      </View>
    </View>

    {hasServerDashboardSummary ? (
      <View style={styles.proDashboard}>
        <View style={styles.proTopRow}>
          <Pressable style={[styles.proMainCard, styles.proMainCardSales]} onPress={() => onSelectAreaMenu('invoice_success')}>
            <View style={styles.proMainHeader}>
              <View style={styles.proIconCircle}>
                <DashboardIcon type="invoice" color="#ffffff" size={24} />
              </View>
              <Text style={styles.proMainTitle}>Nota Penjualan Tercatat</Text>
            </View>
            <View style={styles.proMetricRow}>
              <View style={styles.proMetricBlock}>
                <Text style={styles.proMetricLabel}>Total Nota</Text>
                <Text style={styles.proMetricValue}>{resolveAreaCount(invoiceAreaSummary, 'success')}</Text>
              </View>
              <View style={styles.proVerticalDivider} />
              <View style={styles.proMetricBlock}>
                <Text style={styles.proMetricLabel}>Total Nilai Penjualan</Text>
                <Text style={styles.proMetricValueGreen}>{formatRupiah(invoiceAreaSummary?.successAmount || 0)}</Text>
              </View>
            </View>
            <View style={styles.proDivider} />
            <View style={styles.proLineGrid}>
              {buildRecordedSalesPaymentMetrics(invoiceAreaSummary).map((metric) => (
                <View key={metric.key} style={styles.proLineItem}>
                  <Text style={styles.proLineLabel}>{metric.label}</Text>
                  <Text style={styles.proLineAmount}>{formatRupiah(metric.amount)}</Text>
                </View>
              ))}
            </View>
          </Pressable>

          <View style={[styles.proMainCard, styles.proMainCardRemittance]}>
            <View style={styles.proMainHeader}>
              <View style={styles.proIconCircle}>
                <DashboardIcon type="wallet" color="#ffffff" size={24} />
              </View>
              <View style={styles.proTitleBlock}>
                <Text style={styles.proMainTitle}>Setoran Kasir Hari Ini</Text>
                <Text style={styles.proMetricLabel}>Total Setoran Bersih</Text>
              </View>
            </View>
            <View style={styles.proRemittanceSummaryRow}>
              <Text style={styles.proRemittanceTotal}>{formatRupiah(invoiceAreaSummary?.remittanceTotalReadyAmount || 0)}</Text>
              <View style={styles.proInfoBadge}>
                <Text style={styles.proInfoBadgeText}>Termasuk modal kasir, sudah dikurangi pengeluaran</Text>
              </View>
            </View>
            <View style={styles.proDivider} />
            <View style={styles.proRemittanceGrid}>
              {buildCashierRemittanceMetrics(invoiceAreaSummary).map((metric) => (
                <View key={metric.key} style={styles.proRemittanceTile}>
                  <Text style={styles.proRemittanceLabel}>{metric.label}</Text>
                  <Text style={styles.proRemittanceAmount}>{formatRupiah(metric.amount)}</Text>
                  {metric.infoOnly ? (
                    <Text style={styles.proRemittanceMeta}>{metric.count || 0} transaksi, tidak tambah kas/bank</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.proSmallRow}>
          <View style={[styles.proSmallCard, styles.proSmallCardBlue]}>
            <View style={styles.proSmallHeader}>
              <View style={styles.proSmallIconCircle}>
                <DashboardIcon type="users" color="#1f5fbf" size={20} />
              </View>
              <Text style={styles.proSmallTitle}>Top Up Deposit Agen</Text>
            </View>
            <View style={styles.proSmallMetrics}>
              <View>
                <Text style={styles.proMetricLabel}>Total Pelanggan</Text>
                <Text style={styles.proSmallCount}>{Number(invoiceAreaSummary?.depositTopupCount || 0) || 0}</Text>
              </View>
              <View>
                <Text style={styles.proMetricLabel}>Total Nominal</Text>
                <Text style={styles.proSmallAmountGreen}>{formatRupiah(invoiceAreaSummary?.depositTopupAmount || 0)}</Text>
              </View>
            </View>
            <View style={styles.proDivider} />
            {buildDepositTopupMetrics(invoiceAreaSummary).map((metric) => (
              <View key={metric.key} style={styles.proSimpleLine}>
                <Text style={styles.proSimpleLabel}>{metric.label}</Text>
                <Text style={styles.proSimpleAmount}>{formatRupiah(metric.amount)}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.proSmallCard, styles.proSmallCardBlue]}>
            <View style={styles.proSmallHeader}>
              <View style={styles.proSmallIconCircle}>
                <DashboardIcon type="card" color="#1f5fbf" size={20} />
              </View>
              <Text style={styles.proSmallTitle}>Pelunasan Piutang Pelanggan</Text>
            </View>
            <View style={styles.proSmallMetrics}>
              <View>
                <Text style={styles.proMetricLabel}>Total Pelanggan</Text>
                <Text style={styles.proSmallCount}>{Number(invoiceAreaSummary?.receivableCollectionCount || 0) || 0}</Text>
              </View>
              <View>
                <Text style={styles.proMetricLabel}>Total Nominal</Text>
                <Text style={styles.proSmallAmountGreen}>{formatRupiah(invoiceAreaSummary?.receivableCollectionAmount || 0)}</Text>
              </View>
            </View>
            <View style={styles.proDivider} />
            {buildReceivableCollectionMetrics(invoiceAreaSummary).map((metric) => (
              <View key={metric.key} style={styles.proSimpleLine}>
                <Text style={styles.proSimpleLabel}>{metric.label}</Text>
                <Text style={styles.proSimpleAmount}>{formatRupiah(metric.amount)}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.proSmallCard, styles.proSmallCardRed]}>
            <View style={styles.proSmallHeader}>
              <View style={[styles.proSmallIconCircle, styles.proSmallIconDanger]}>
                <DashboardIcon type="cart" color="#d63d31" size={20} />
              </View>
              <Text style={styles.proSmallTitle}>Total Pengeluaran</Text>
            </View>
            <View style={styles.proSmallMetrics}>
              <View>
                <Text style={styles.proMetricLabel}>Total Transaksi</Text>
                <Text style={styles.proSmallCount}>{Number(invoiceAreaSummary?.expenseCount || 0) || 0}</Text>
              </View>
              <View>
                <Text style={styles.proMetricLabel}>Total Nominal</Text>
                <Text style={styles.proSmallAmountRed}>{formatRupiah(invoiceAreaSummary?.expenseAmount || 0)}</Text>
              </View>
            </View>
            <View style={styles.proDivider} />
            {buildExpenseMetrics(invoiceAreaSummary).map((metric) => (
              <View key={metric.key} style={styles.proSimpleLine}>
                <Text style={styles.proSimpleLabel}>{metric.label}</Text>
                <Text style={styles.proSimpleAmount}>{formatRupiah(metric.amount)}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.proSmallCard, styles.proSmallCardRed]}>
            <View style={styles.proSmallHeader}>
              <View style={[styles.proSmallIconCircle, styles.proSmallIconDanger]}>
                <DashboardIcon type="bag" color="#d63d31" size={20} />
              </View>
              <Text style={styles.proSmallTitle}>Total Pembelian</Text>
            </View>
            <View style={styles.proSmallMetrics}>
              <View>
                <Text style={styles.proMetricLabel}>Total Transaksi</Text>
                <Text style={styles.proSmallCount}>{Number(invoiceAreaSummary?.purchaseCount || 0) || 0}</Text>
              </View>
              <View>
                <Text style={styles.proMetricLabel}>Total Nominal</Text>
                <Text style={styles.proSmallAmountRed}>{formatRupiah(invoiceAreaSummary?.purchaseAmount || 0)}</Text>
              </View>
            </View>
            <View style={styles.proDivider} />
            {buildPurchaseMetrics(invoiceAreaSummary).map((metric) => (
              <View key={metric.key} style={styles.proSimpleLine}>
                <Text style={styles.proSimpleLabel}>{metric.label}</Text>
                <Text style={styles.proSimpleAmount}>{formatRupiah(metric.amount)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.proOperationalPanel}>
          <Text style={styles.proOperationalTitle}>Ringkasan Operasional</Text>
          <View style={styles.proOperationalGrid}>
            {buildOperationalSummaryCards(invoiceAreaSummary).map((metric) => (
              <Pressable key={metric.key} style={[
                styles.proOperationalCard,
                activeOperationalSummaryKey === metric.key ? styles.proOperationalCardActive : null,
                metric.tone === 'danger' ? styles.proOperationalDanger : null,
                metric.tone === 'warning' ? styles.proOperationalWarning : null,
              ]} onPress={() => onSelectOperationalSummary?.(metric.key)}>
                <View style={[
                  styles.proOperationalIcon,
                  metric.tone === 'danger' ? styles.proOperationalIconDanger : null,
                  metric.tone === 'warning' ? styles.proOperationalIconWarning : null,
                ]}>
                  <DashboardIcon
                    type={metric.key === 'draft' ? 'clipboard' : (metric.key === 'production' || metric.key === 'overdue' ? 'alert' : 'invoice')}
                    color={metric.tone === 'danger' ? '#b42318' : (metric.tone === 'warning' ? '#c56b12' : '#1f5fbf')}
                    size={18}
                  />
                </View>
                <Text style={styles.proOperationalCardTitle}>{metric.title}</Text>
                <Text style={[
                  styles.proOperationalValue,
                  metric.tone === 'danger' ? styles.proTextDanger : null,
                  metric.tone === 'warning' ? styles.proTextWarning : null,
                ]}>{metric.value}</Text>
                <Text style={styles.proOperationalInvoiceInfo}>{metric.invoiceInfo}</Text>
                <Text style={styles.proOperationalHelper}>{metric.helper}</Text>
                {metric.todayInfo ? (
                  <View style={styles.proOperationalTodayBox}>
                    <Text style={styles.proOperationalTodayLabel}>Input hari ini</Text>
                    <Text style={styles.proOperationalTodayAmount}>{metric.todayInfo}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    ) : null}

    <View style={styles.legacyAreaGridHidden}>
      {AREA_CARDS.map((card) => {
        const active = invoiceFilter === card.key;
        const amount = resolveAreaAmount(invoiceAreaSummary, card.key);
        const amountLabel = resolveAreaAmountLabel(card.key);
        const hasServerSummary = String(invoiceAreaSummary?.source || '').trim() === 'server_dashboard_summary';
        const isOperationalCard = card.key === 'draft' && hasServerSummary;
        const isRecordedSalesCard = card.key === 'success'
          && hasServerSummary;
        return (
          <Pressable
            key={card.key}
            style={[
              styles.areaCard,
              isOperationalCard ? styles.areaCardOperational : null,
              isRecordedSalesCard ? styles.areaCardRecordedSales : null,
              active ? styles.areaCardActive : null,
            ]}
            onPress={() => onSelectAreaMenu(card.menu)}
            >
            <Text style={[styles.areaCount, active ? styles.areaCountActive : null]}>
              {isRecordedSalesCard ? `${resolveAreaCount(invoiceAreaSummary, card.key)} Nota` : (isOperationalCard ? 'Ringkasan' : resolveAreaCount(invoiceAreaSummary, card.key))}
            </Text>
            <Text style={[styles.areaLabel, active ? styles.areaLabelActive : null]}>
              {isRecordedSalesCard ? 'Penjualan Tercatat' : card.label}
            </Text>
            {amount && !isOperationalCard ? (
              <View style={styles.areaAmountWrap}>
                <Text style={styles.areaAmountLabel}>{amountLabel}</Text>
                <Text style={[styles.areaAmount, resolveAreaAmountStyle(styles, card.key)]}>
                  {amount}
                  {isRecordedSalesCard ? (
                    <Text style={styles.recordedSalesMeta}> ({resolveRecordedSalesTransactionCount(invoiceAreaSummary)} Transaksi)</Text>
                  ) : null}
                </Text>
              </View>
            ) : null}
            {isRecordedSalesCard ? (
              <View style={styles.recordedSalesBreakdown}>
                {buildRecordedSalesPaymentMetrics(invoiceAreaSummary).map((metric) => (
                  <View key={metric.key} style={styles.recordedSalesRow}>
                    <Text style={styles.recordedSalesMethodLabel}>{metric.label}</Text>
                    <Text style={styles.recordedSalesMethodAmount}>{formatRupiah(metric.amount)}</Text>
                    <View style={styles.recordedSalesInvoiceBadge}>
                      <Text style={styles.recordedSalesInvoiceCount}>{metric.count}</Text>
                      <Text style={styles.recordedSalesInvoiceText}>invoice</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : isOperationalCard ? (
              <View style={styles.operationalBreakdown}>
                {buildSalesDashboardMetrics(invoiceAreaSummary).map((metric) => (
                  <View key={metric.key} style={styles.operationalMiniCard}>
                    <View style={styles.operationalMiniHeader}>
                      <Text style={styles.operationalMiniCount}>{metric.count}</Text>
                      {metric.countSuffix ? (
                        <Text style={styles.operationalMiniCountSuffix}>{metric.countSuffix}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.operationalMiniLabel}>
                      {metric.label}
                      {metric.subtitle ? (
                        <Text style={[
                          styles.operationalMiniSubtitle,
                          metric.tone === 'danger' ? styles.operationalMiniSubtitleDanger : null,
                        ]}> {metric.subtitle}</Text>
                      ) : null}
                    </Text>
                    <Text style={[
                      styles.operationalMiniAmount,
                      metric.tone === 'success' ? styles.metricAmountSuccess : null,
                      metric.tone === 'danger' ? styles.metricAmountDanger : null,
                    ]}>
                      {formatRupiah(metric.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.areaMeta, active ? styles.areaMetaActive : null]}>
                {resolveAreaMeta(invoiceAreaSummary, card.key, card.meta)}
              </Text>
            )}
          </Pressable>
        );
      })}
      {String(invoiceAreaSummary?.source || '').trim() === 'server_dashboard_summary' ? (
        <View style={styles.dashboardStack}>
      {String(invoiceAreaSummary?.source || '').trim() === 'server_dashboard_summary' ? (
        <View style={[styles.depositTopupCard, styles.dashboardStackCard]}>
          <View style={styles.depositTopupHeader}>
            <View style={styles.depositTopupCountRow}>
              <Text style={styles.depositTopupCount}>{Number(invoiceAreaSummary?.depositTopupCount || 0) || 0}</Text>
              <Text style={styles.depositTopupCountSuffix}>Pelanggan</Text>
            </View>
            <Text style={styles.depositTopupTitle}>Top Up Deposit Agen</Text>
            <Text style={styles.depositTopupAmount}>{formatRupiah(invoiceAreaSummary?.depositTopupAmount || 0)}</Text>
          </View>
          <View style={styles.depositTopupBreakdown}>
            {buildDepositTopupMetrics(invoiceAreaSummary).map((metric) => (
              <View key={metric.key} style={styles.depositTopupRow}>
                <Text style={styles.depositTopupMethodLabel}>{metric.label}</Text>
                <Text style={styles.depositTopupMethodAmount}>{formatRupiah(metric.amount)}</Text>
                <View style={styles.depositTopupCustomerBadge}>
                  <Text style={styles.depositTopupCustomerCount}>{metric.count}</Text>
                  <Text style={styles.depositTopupCustomerText}>customer</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {String(invoiceAreaSummary?.source || '').trim() === 'server_dashboard_summary' ? (
        <View style={[styles.depositTopupCard, styles.dashboardStackCard]}>
          <View style={styles.depositTopupHeader}>
            <View style={styles.depositTopupCountRow}>
              <Text style={styles.depositTopupCount}>{Number(invoiceAreaSummary?.receivableCollectionCount || 0) || 0}</Text>
              <Text style={styles.depositTopupCountSuffix}>Pelanggan</Text>
            </View>
            <Text style={styles.depositTopupTitle}>Pelunasan Piutang Pelanggan</Text>
            <Text style={styles.depositTopupAmount}>{formatRupiah(invoiceAreaSummary?.receivableCollectionAmount || 0)}</Text>
          </View>
          <View style={styles.depositTopupBreakdown}>
            {buildReceivableCollectionMetrics(invoiceAreaSummary).map((metric) => (
              <View key={metric.key} style={styles.depositTopupRow}>
                <Text style={styles.depositTopupMethodLabel}>{metric.label}</Text>
                <Text style={styles.depositTopupMethodAmount}>{formatRupiah(metric.amount)}</Text>
                <View style={styles.depositTopupCustomerBadge}>
                  <Text style={styles.depositTopupCustomerCount}>{metric.count}</Text>
                  <Text style={styles.depositTopupCustomerText}>customer</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
        </View>
      ) : null}
      {String(invoiceAreaSummary?.source || '').trim() === 'server_dashboard_summary' ? (
        <View style={styles.dashboardStack}>
      {String(invoiceAreaSummary?.source || '').trim() === 'server_dashboard_summary' ? (
        <View style={[styles.depositTopupCard, styles.dashboardStackCard]}>
          <View style={styles.depositTopupHeader}>
            <View style={styles.depositTopupCountRow}>
              <Text style={styles.depositTopupCount}>{Number(invoiceAreaSummary?.expenseCount || 0) || 0}</Text>
              <Text style={styles.depositTopupCountSuffix}>Transaksi</Text>
            </View>
            <Text style={styles.depositTopupTitle}>Total Pengeluaran</Text>
            <Text style={[styles.depositTopupAmount, styles.dashboardAmountDanger]}>{formatRupiah(invoiceAreaSummary?.expenseAmount || 0)}</Text>
          </View>
          <View style={styles.depositTopupBreakdown}>
            {buildExpenseMetrics(invoiceAreaSummary).map((metric) => (
              <View key={metric.key} style={styles.depositTopupRow}>
                <Text style={styles.depositTopupMethodLabel}>{metric.label}</Text>
                <Text style={styles.depositTopupMethodAmount}>{formatRupiah(metric.amount)}</Text>
                <View style={styles.depositTopupCustomerBadge}>
                  <Text style={styles.depositTopupCustomerCount}>{metric.count}</Text>
                  <Text style={styles.depositTopupCustomerText}>trx</Text>
                </View>
              </View>
            ))}
            {Array.isArray(invoiceAreaSummary?.expenseAccountBreakdown)
              && invoiceAreaSummary.expenseAccountBreakdown.length > 0 ? (
                <View style={styles.dashboardAccountBreakdown}>
                  {renderDashboardAccountRows(invoiceAreaSummary.expenseAccountBreakdown, styles, 'expense-account')}
                </View>
              ) : null}
          </View>
        </View>
      ) : null}
      {String(invoiceAreaSummary?.source || '').trim() === 'server_dashboard_summary' ? (
        <View style={[styles.depositTopupCard, styles.dashboardStackCard]}>
          <View style={styles.depositTopupHeader}>
            <View style={styles.depositTopupCountRow}>
              <Text style={styles.depositTopupCount}>{Number(invoiceAreaSummary?.purchaseCount || 0) || 0}</Text>
              <Text style={styles.depositTopupCountSuffix}>Transaksi</Text>
            </View>
            <Text style={styles.depositTopupTitle}>Total Pembelian</Text>
            <Text style={styles.depositTopupAmount}>{formatRupiah(invoiceAreaSummary?.purchaseAmount || 0)}</Text>
          </View>
          <View style={styles.depositTopupBreakdown}>
            {buildPurchaseMetrics(invoiceAreaSummary).map((metric) => (
              <View key={metric.key} style={styles.depositTopupRow}>
                <Text style={styles.depositTopupMethodLabel}>{metric.label}</Text>
                <Text style={styles.depositTopupMethodAmount}>{formatRupiah(metric.amount)}</Text>
                <View style={styles.depositTopupCustomerBadge}>
                  <Text style={styles.depositTopupCustomerCount}>{metric.count}</Text>
                  <Text style={styles.depositTopupCustomerText}>trx</Text>
                </View>
              </View>
            ))}
            {Array.isArray(invoiceAreaSummary?.purchaseAccountBreakdown)
              && invoiceAreaSummary.purchaseAccountBreakdown.length > 0 ? (
                <View style={styles.dashboardAccountBreakdown}>
                  {renderDashboardAccountRows(invoiceAreaSummary.purchaseAccountBreakdown, styles, 'purchase-account')}
                </View>
              ) : null}
          </View>
        </View>
      ) : null}
        </View>
      ) : null}
      {String(invoiceAreaSummary?.source || '').trim() === 'server_dashboard_summary' ? (
        <View style={[styles.depositTopupCard, styles.cashierRemittanceCard]}>
          <View style={styles.cashierRemittanceHeader}>
            <Text style={styles.cashierRemittanceTitle}>Setoran Kasir Hari Ini</Text>
            <Text style={styles.cashierRemittanceAmount}>{formatRupiah(invoiceAreaSummary?.remittanceTotalReadyAmount || 0)}</Text>
          </View>
          <View style={styles.cashierRemittanceBreakdown}>
            {buildCashierRemittanceMetrics(invoiceAreaSummary).map((metric) => (
              <View key={metric.key} style={styles.cashierRemittanceRow}>
                <Text style={styles.cashierRemittanceMethod}>
                  {metric.label}{metric.infoOnly ? ` · ${metric.count || 0} trx` : ''}
                </Text>
                <Text style={styles.cashierRemittanceMethodAmount}>{formatRupiah(metric.amount)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
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

    {shouldShowInvoiceSuccessFilters ? (
      <View style={styles.invoiceFilterToolbar}>
        <Pressable style={styles.invoiceFilterSelect} onPress={() => openFilterPicker('status')}>
          <Text style={styles.invoiceFilterLabel}>Status</Text>
          <Text style={styles.invoiceFilterValue} numberOfLines={1}>{statusFilterLabel}</Text>
        </Pressable>
        <Pressable style={styles.invoiceFilterSelect} onPress={() => openFilterPicker('method')}>
          <Text style={styles.invoiceFilterLabel}>Metode</Text>
          <Text style={styles.invoiceFilterValue} numberOfLines={1}>{paymentFilterLabel}</Text>
        </Pressable>
        <Pressable style={styles.invoiceFilterSelect} onPress={() => openFilterPicker('cashier')}>
          <Text style={styles.invoiceFilterLabel}>Kasir</Text>
          <Text style={styles.invoiceFilterValue} numberOfLines={1}>
            {isCashierLoading ? 'Memuat...' : cashierFilterLabel}
          </Text>
        </Pressable>
        <TextInput
          value={invoiceSearch}
          onChangeText={onChangeInvoiceSearch}
          placeholder="Cari invoice / customer / no HP..."
          placeholderTextColor="#8a96aa"
          style={styles.invoiceFilterSearchInput}
        />
        <Pressable
          style={[
            styles.invoiceCustomerTypeFilterButton,
            invoiceCustomerTypeFilter !== 'all' ? styles.invoiceCustomerTypeFilterButtonActive : null,
          ]}
          onPress={() => openFilterPicker('customer_type')}
        >
          <DashboardIcon
            type="filter"
            color={invoiceCustomerTypeFilter !== 'all' ? '#ffffff' : '#1f5fbf'}
            size={20}
          />
          <Text
            style={[
              styles.invoiceCustomerTypeFilterText,
              invoiceCustomerTypeFilter !== 'all' ? styles.invoiceCustomerTypeFilterTextActive : null,
            ]}
            numberOfLines={1}
          >
            {customerTypeFilterLabel}
          </Text>
        </Pressable>
      </View>
    ) : null}

    <Modal
      visible={Boolean(activeFilterPicker)}
      transparent
      animationType="fade"
      onRequestClose={closeFilterPicker}
    >
      <View style={styles.filterModalBackdrop}>
        <Pressable style={styles.filterModalBackdropDismiss} onPress={closeFilterPicker} />
        <View style={styles.filterModalCard}>
          <View style={styles.filterModalHeader}>
            <Text style={styles.filterModalTitle}>{resolveActiveFilterPickerTitle()}</Text>
            <Pressable style={styles.filterModalCloseButton} onPress={closeFilterPicker}>
              <Text style={styles.filterModalCloseText}>Tutup</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.filterModalOptionList}>
            {resolveActiveFilterPickerOptions().map((option) => {
              const active = String(resolveActiveFilterPickerValue()) === String(option.key);
              return (
                <Pressable
                  key={`${activeFilterPicker}-${option.key}`}
                  style={[styles.filterModalOption, active ? styles.filterModalOptionActive : null]}
                  onPress={() => handleSelectFilterOption(option.key)}
                >
                  <Text style={[styles.filterModalOptionText, active ? styles.filterModalOptionTextActive : null]} numberOfLines={1}>
                    {option.label}
                  </Text>
                  {active ? <Text style={styles.filterModalCheck}>OK</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>

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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#173c87',
  },
  headerDateFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#b8cff7',
    backgroundColor: '#eef5ff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerDateFilterValue: {
    maxWidth: 170,
    color: '#34405f',
    fontSize: 10,
    fontWeight: '800',
  },
  headerDateFilterButton: {
    borderWidth: 1,
    borderColor: '#0755b8',
    backgroundColor: '#0755b8',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  headerDateFilterButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  headerDateResetButton: {
    borderWidth: 1,
    borderColor: '#b8cff7',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  headerDateResetButtonText: {
    color: '#1f5fbf',
    fontSize: 10,
    fontWeight: '900',
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
  closingReviewButton: {
    borderColor: '#b45309',
    backgroundColor: '#b45309',
  },
  closingReviewButtonText: {
    color: '#ffffff',
  },
  closingReadyButton: {
    borderColor: '#166534',
    backgroundColor: '#166534',
  },
  closingReadyButtonText: {
    color: '#ffffff',
  },
  closingLockedButton: {
    borderColor: '#9bd2a8',
    backgroundColor: '#f4fbf6',
  },
  closingLockedButtonText: {
    color: '#166534',
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
  proDashboard: {
    gap: 10,
    marginBottom: 12,
  },
  proTopRow: {
    flexDirection: 'row',
    gap: 10,
  },
  proMainCard: {
    flex: 1,
    borderWidth: 1.2,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  proMainCardSales: {
    borderColor: '#8fb5f4',
  },
  proMainCardRemittance: {
    borderColor: '#8fb5f4',
  },
  proMainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  proIconCircle: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 14,
    backgroundColor: '#1f5fbf',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1f5fbf',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  proTitleBlock: {
    flex: 1,
  },
  proMainTitle: {
    flex: 1,
    minWidth: 180,
    color: '#101c3d',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  proDateFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#b8cff7',
    backgroundColor: '#eef5ff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    maxWidth: 380,
  },
  proDateFilterTextBlock: {
    minWidth: 120,
    maxWidth: 180,
  },
  proDateFilterLabel: {
    color: '#1f5fbf',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  proDateFilterValue: {
    color: '#101c3d',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  proDateFilterButton: {
    borderWidth: 1,
    borderColor: '#0755b8',
    backgroundColor: '#0755b8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  proDateFilterButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  proDateResetButton: {
    borderWidth: 1,
    borderColor: '#b8cff7',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  proDateResetButtonText: {
    color: '#1f5fbf',
    fontSize: 10,
    fontWeight: '900',
  },
  proMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 14,
  },
  proMetricBlock: {
    flex: 1,
  },
  proMetricLabel: {
    color: '#34405f',
    fontSize: 11,
    fontWeight: '700',
  },
  proMetricValue: {
    color: '#1f5fbf',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 5,
  },
  proMetricValueGreen: {
    color: '#1f5fbf',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 5,
  },
  proVerticalDivider: {
    width: 1,
    height: 46,
    backgroundColor: '#d7dde8',
  },
  proDivider: {
    height: 1,
    backgroundColor: '#dfe5ee',
    marginVertical: 12,
  },
  proLineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 28,
    rowGap: 12,
  },
  proLineItem: {
    width: '46%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  proLineLabel: {
    flex: 1,
    color: '#1f2a44',
    fontSize: 12,
    fontWeight: '700',
  },
  proLineAmount: {
    color: '#101c3d',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  proRemittanceSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  proRemittanceTotal: {
    flex: 1,
    color: '#1f5fbf',
    fontSize: 28,
    fontWeight: '900',
  },
  proInfoBadge: {
    width: 170,
    borderRadius: 10,
    backgroundColor: '#eef5ff',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  proInfoBadgeText: {
    color: '#26344d',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  proRemittanceGrid: {
    flexDirection: 'row',
    gap: 14,
  },
  proRemittanceTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#b8cff7',
    borderRadius: 10,
    backgroundColor: '#fbfdff',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  proRemittanceLabel: {
    color: '#101c3d',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
  },
  proRemittanceAmount: {
    color: '#1f5fbf',
    fontSize: 14,
    fontWeight: '900',
  },
  proRemittanceMeta: {
    marginTop: 6,
    color: '#667897',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
  },
  proSmallRow: {
    flexDirection: 'row',
    gap: 10,
  },
  proSmallCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  proSmallCardBlue: {
    borderColor: '#9bbdf3',
  },
  proSmallCardRed: {
    borderColor: '#f1aaa4',
  },
  proSmallTitle: {
    color: '#101c3d',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    flex: 1,
  },
  proSmallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 14,
  },
  proSmallIconCircle: {
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: 11,
    backgroundColor: '#eef5ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cfe0fb',
  },
  proSmallIconDanger: {
    backgroundColor: '#fff0ee',
    borderColor: '#f6c8c2',
  },
  proSmallMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  proSmallCount: {
    color: '#101c3d',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  proSmallAmountGreen: {
    color: '#1f5fbf',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  proSmallAmountRed: {
    color: '#d63d31',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  proSimpleLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 9,
  },
  proSimpleLabel: {
    flex: 1,
    color: '#26344d',
    fontSize: 11,
    fontWeight: '700',
  },
  proSimpleAmount: {
    color: '#101c3d',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  proOperationalPanel: {
    borderWidth: 1,
    borderColor: '#d6e0ef',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  proOperationalTitle: {
    color: '#173c87',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  proOperationalGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  proOperationalCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d7dfeb',
    borderRadius: 9,
    backgroundColor: '#fbfdff',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  proOperationalCardActive: {
    borderColor: '#1f5fbf',
    backgroundColor: '#eef5ff',
  },
  proOperationalIcon: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 10,
    backgroundColor: '#eef5ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#cfe0fb',
  },
  proOperationalIconDanger: {
    backgroundColor: '#fff0ee',
    borderColor: '#f6c8c2',
  },
  proOperationalIconWarning: {
    backgroundColor: '#fff7e8',
    borderColor: '#f4d39a',
  },
  proOperationalDanger: {
    borderColor: '#f1b2ac',
    backgroundColor: '#fffafa',
  },
  proOperationalWarning: {
    borderColor: '#f4d39a',
    backgroundColor: '#fffdf7',
  },
  proOperationalCardTitle: {
    color: '#26344d',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  proOperationalValue: {
    color: '#101c3d',
    fontSize: 14,
    fontWeight: '900',
  },
  proOperationalInvoiceInfo: {
    color: '#34405f',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  proTextDanger: {
    color: '#b42318',
  },
  proTextWarning: {
    color: '#c56b12',
  },
  proOperationalHelper: {
    color: '#5b6780',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  proOperationalTodayBox: {
    marginTop: 8,
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4eaf4',
  },
  proOperationalTodayLabel: {
    color: '#667085',
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  proOperationalTodayAmount: {
    color: '#101828',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
  },
  legacyAreaGridHidden: {
    display: 'none',
  },
  areaGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
    alignItems: 'stretch',
    width: '100%',
    marginBottom: 10,
  },
  dashboardStack: {
    flexGrow: 0.95,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: 5,
  },
  areaCard: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 124,
    borderWidth: 1,
    borderColor: '#c7d7ef',
    backgroundColor: '#f7fbff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  areaCardActive: {
    borderColor: '#0755b8',
    backgroundColor: '#eef4ff',
  },
  areaCardOperational: {
    flexGrow: 1.75,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 470,
    borderWidth: 1.5,
    borderColor: '#c7d7ef',
    backgroundColor: '#f7fbff',
  },
  areaCardRecordedSales: {
    flexGrow: 1.05,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 470,
    borderWidth: 1.5,
    borderColor: '#0755b8',
    backgroundColor: '#dbeafe',
  },
  areaCount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#163a85',
  },
  areaCountActive: {
    color: '#11469f',
  },
  areaLabel: {
    marginTop: 2,
    fontSize: 9,
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
    fontSize: 8,
    fontWeight: '700',
    color: '#667085',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  areaAmount: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
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
  recordedSalesMeta: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475467',
  },
  recordedSalesBreakdown: {
    marginTop: 4,
  },
  recordedSalesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  recordedSalesMethodLabel: {
    flex: 0.9,
    minWidth: 0,
    minHeight: 24,
    borderRadius: 8,
    backgroundColor: '#f8fbff',
    color: '#173c87',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 5,
    textAlign: 'center',
  },
  recordedSalesMethodAmount: {
    flex: 1,
    minWidth: 0,
    minHeight: 24,
    borderRadius: 8,
    backgroundColor: '#f8fbff',
    color: '#173c87',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 5,
    textAlign: 'center',
  },
  recordedSalesInvoiceBadge: {
    flex: 0.55,
    minWidth: 0,
    minHeight: 24,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  recordedSalesInvoiceCount: {
    color: '#b42318',
    fontSize: 10,
    fontWeight: '900',
  },
  recordedSalesInvoiceText: {
    color: '#667085',
    fontSize: 6,
    fontWeight: '800',
  },
  depositTopupCard: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 250,
    borderWidth: 1.5,
    borderColor: '#0755b8',
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  dashboardStackCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    width: '100%',
    minHeight: 232,
  },
  depositTopupHeader: {
    marginBottom: 7,
  },
  depositTopupCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  depositTopupCount: {
    color: '#163a85',
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '900',
  },
  depositTopupCountSuffix: {
    color: '#173c87',
    fontSize: 8,
    fontWeight: '900',
  },
  depositTopupTitle: {
    color: '#24426f',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
  },
  depositTopupAmount: {
    color: '#067647',
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '900',
    marginTop: 2,
  },
  dashboardAmountDanger: {
    color: '#b42318',
  },
  depositTopupBreakdown: {
    marginTop: 1,
  },
  depositTopupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  depositTopupMethodLabel: {
    flex: 0.9,
    minWidth: 0,
    minHeight: 24,
    borderRadius: 9,
    backgroundColor: '#f8fbff',
    color: '#173c87',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 5,
    textAlign: 'center',
  },
  depositTopupMethodAmount: {
    flex: 1,
    minWidth: 0,
    minHeight: 24,
    borderRadius: 9,
    backgroundColor: '#f8fbff',
    color: '#173c87',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 5,
    textAlign: 'center',
  },
  depositTopupCustomerBadge: {
    flex: 0.65,
    minWidth: 0,
    minHeight: 24,
    borderRadius: 9,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  depositTopupCustomerCount: {
    color: '#b42318',
    fontSize: 9,
    fontWeight: '900',
  },
  depositTopupCustomerText: {
    color: '#667085',
    fontSize: 5,
    fontWeight: '800',
  },
  dashboardAccountBreakdown: {
    borderTopWidth: 1,
    borderTopColor: '#b7cff8',
    marginTop: 6,
    paddingTop: 5,
    gap: 4,
  },
  dashboardAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dashboardAccountName: {
    flex: 1,
    minHeight: 24,
    borderRadius: 8,
    backgroundColor: '#f8fbff',
    color: '#173c87',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  dashboardAccountAmount: {
    flex: 1,
    minHeight: 24,
    borderRadius: 8,
    backgroundColor: '#f8fbff',
    color: '#173c87',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 5,
    textAlign: 'center',
  },
  dashboardAccountBadge: {
    width: 48,
    minHeight: 24,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  dashboardAccountCount: {
    color: '#b42318',
    fontSize: 9,
    fontWeight: '900',
  },
  dashboardAccountText: {
    color: '#667085',
    fontSize: 6,
    fontWeight: '800',
  },
  cashierRemittanceCard: {
    flexGrow: 0.95,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 470,
    justifyContent: 'space-between',
  },
  cashierRemittanceHeader: {
    marginBottom: 12,
  },
  cashierRemittanceTitle: {
    color: '#173c87',
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  cashierRemittanceAmount: {
    color: '#067647',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    marginTop: 6,
  },
  cashierRemittanceBreakdown: {
    gap: 14,
    marginTop: 6,
  },
  cashierRemittanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cashierRemittanceMethod: {
    flex: 0.8,
    minWidth: 0,
    minHeight: 32,
    borderRadius: 12,
    backgroundColor: '#f8fbff',
    color: '#173c87',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: 'center',
  },
  cashierRemittanceMethodAmount: {
    flex: 1,
    minWidth: 0,
    minHeight: 32,
    borderRadius: 12,
    backgroundColor: '#f8fbff',
    color: '#173c87',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 6,
    textAlign: 'center',
  },
  operationalBreakdown: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  operationalMiniCard: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 0,
    minHeight: 68,
    borderWidth: 1,
    borderColor: '#c7d7ef',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 7,
    justifyContent: 'space-between',
  },
  operationalMiniHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  operationalMiniCount: {
    color: '#0f4592',
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '900',
  },
  operationalMiniCountSuffix: {
    color: '#173c87',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
  },
  operationalMiniLabel: {
    color: '#24426f',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  operationalMiniSubtitle: {
    color: '#667085',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'none',
  },
  operationalMiniSubtitleDanger: {
    color: '#b42318',
  },
  operationalMiniAmount: {
    color: '#101828',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
  },
  metricAmountSuccess: {
    color: '#067647',
  },
  metricAmountDanger: {
    color: '#b42318',
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
  invoiceFilterToolbar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    borderWidth: 1,
    borderColor: '#c7d7ef',
    backgroundColor: '#f7fbff',
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
  },
  invoiceFilterSelect: {
    minWidth: 145,
    maxWidth: 190,
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#c7d7ef',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  invoiceFilterLabel: {
    color: '#5c6780',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  invoiceFilterValue: {
    color: '#101c3d',
    fontSize: 12,
    fontWeight: '900',
  },
  invoiceFilterSearchInput: {
    flex: 1,
    minWidth: 220,
    borderWidth: 1,
    borderColor: '#c7d7ef',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    color: '#14233d',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  invoiceCustomerTypeFilterButton: {
    minWidth: 142,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#b8cff7',
    backgroundColor: '#eef5ff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  invoiceCustomerTypeFilterButtonActive: {
    borderColor: '#1f5fbf',
    backgroundColor: '#1f5fbf',
  },
  invoiceCustomerTypeFilterText: {
    color: '#1f5fbf',
    fontSize: 11,
    fontWeight: '900',
  },
  invoiceCustomerTypeFilterTextActive: {
    color: '#ffffff',
  },
  filterModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  filterModalBackdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  filterModalCard: {
    width: '100%',
    maxWidth: 430,
    maxHeight: 520,
    borderWidth: 1,
    borderColor: '#c7d7ef',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  filterModalTitle: {
    flex: 1,
    color: '#101c3d',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  filterModalCloseButton: {
    borderWidth: 1,
    borderColor: '#c7d7ef',
    backgroundColor: '#f7fbff',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterModalCloseText: {
    color: '#1f5fbf',
    fontSize: 11,
    fontWeight: '900',
  },
  filterModalOptionList: {
    gap: 7,
  },
  filterModalOption: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: '#d8e2f0',
    backgroundColor: '#fbfdff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  filterModalOptionActive: {
    borderColor: '#1f5fbf',
    backgroundColor: '#eef5ff',
  },
  filterModalOptionText: {
    flex: 1,
    color: '#24324a',
    fontSize: 12,
    fontWeight: '800',
  },
  filterModalOptionTextActive: {
    color: '#1f5fbf',
  },
  filterModalCheck: {
    color: '#1f5fbf',
    fontSize: 10,
    fontWeight: '900',
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
  cashierFilterCard: {
    borderWidth: 1,
    borderColor: '#d4dcea',
    backgroundColor: '#fbfdff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  cashierFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  cashierFilterInfo: {
    flex: 1,
  },
  cashierFilterTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#24426f',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  cashierFilterMeta: {
    fontSize: 10,
    color: '#5c6780',
  },
  cashierReloadButton: {
    borderWidth: 1,
    borderColor: '#c7d2e5',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cashierReloadButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#344054',
  },
  cashierChipRow: {
    gap: 6,
    paddingRight: 2,
  },
  cashierChip: {
    maxWidth: 170,
    borderWidth: 1,
    borderColor: '#d4dcea',
    backgroundColor: '#f7f9fd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cashierChipActive: {
    borderColor: '#0755b8',
    backgroundColor: '#0755b8',
  },
  cashierChipText: {
    fontSize: 11,
    color: '#445878',
    fontWeight: '800',
  },
  cashierChipTextActive: {
    color: '#ffffff',
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
