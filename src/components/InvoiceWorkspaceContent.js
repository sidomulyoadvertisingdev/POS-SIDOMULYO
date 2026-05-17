import { StyleSheet, Text, View } from 'react-native';
import { formatRupiah } from '../utils/currency';

const InvoiceWorkspaceContent = ({
  customerSummary = null,
  portfolioSummary = null,
  approvalSummary = null,
  emptyMessage = '',
  hasRows = false,
  formatDateText,
  children,
}) => (
  <>
    {customerSummary ? (
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Ringkasan Piutang Pelanggan</Text>
        <Text style={styles.summaryName}>
          {customerSummary.customerName}
          {customerSummary.customerPhone ? ` | ${customerSummary.customerPhone}` : ''}
        </Text>
        {customerSummary.customerCount > 1 ? (
          <Text style={styles.summaryWarning}>
            Hasil pencarian mencakup {customerSummary.customerCount} pelanggan. Persempit nama / nomor HP agar tracking lebih spesifik.
          </Text>
        ) : null}
        <Text style={styles.summaryMeta}>
          Total invoice piutang: {customerSummary.totalInvoice}
        </Text>
        <Text style={styles.summaryMeta}>
          Total nilai invoice: {formatRupiah(customerSummary.totalAmount)}
        </Text>
        <Text style={styles.summaryMeta}>
          Invoice tertua: {customerSummary.oldestInvoiceNo} | {formatDateText(customerSummary.oldestInvoiceDate)}
        </Text>
        <Text style={styles.summaryMeta}>
          Umur piutang tertua: {customerSummary.oldestInvoiceAgeDays} hari
        </Text>
        <Text style={styles.summaryAmount}>
          Total piutang: {formatRupiah(customerSummary.totalDue)}
        </Text>
      </View>
    ) : null}

    {portfolioSummary ? (
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Portofolio Piutang Tampil</Text>
        <Text style={styles.summaryMeta}>
          Total invoice piutang: {portfolioSummary.totalInvoices}
        </Text>
        <Text style={styles.summaryMeta}>
          Bisa dibayar: {portfolioSummary.totalPayable} | Belum bisa dibayar: {portfolioSummary.totalBlocked}
        </Text>
        <Text style={styles.summaryMeta}>
          Total sudah dibayar: {formatRupiah(portfolioSummary.totalPaid)}
        </Text>
        <Text style={styles.summaryAmount}>
          Total outstanding: {formatRupiah(portfolioSummary.totalDue)}
        </Text>
      </View>
    ) : null}

    {approvalSummary ? (
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Ringkasan Approval Tampil</Text>
        <Text style={styles.summaryMeta}>
          Total request: {approvalSummary.totalRequests}
        </Text>
        <Text style={styles.summaryMeta}>
          Menunggu: {approvalSummary.pending} | Disetujui: {approvalSummary.approved} | Ditolak: {approvalSummary.rejected} | Selesai: {approvalSummary.resolved}
        </Text>
        <Text style={styles.summaryMeta}>
          Plafon customer: {approvalSummary.receivableLimit} | Approval nota/manual: {approvalSummary.manualApproval}
        </Text>
        <Text style={styles.summaryMeta}>
          Plafon baru: {approvalSummary.newLimit} | Kenaikan plafon: {approvalSummary.increaseLimit} | Penyesuaian/review: {approvalSummary.adjustLimit}
        </Text>
      </View>
    ) : null}

    {!hasRows ? (
      <Text style={styles.emptyText}>{emptyMessage}</Text>
    ) : (
      <View style={styles.list}>
        {children}
      </View>
    )}
  </>
);

const styles = StyleSheet.create({
  summaryCard: {
    borderWidth: 1,
    borderColor: '#c7d7ef',
    backgroundColor: '#f7fbff',
    padding: 10,
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#24426f',
    textTransform: 'uppercase',
  },
  summaryName: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#1e2d45',
  },
  summaryMeta: {
    marginTop: 3,
    fontSize: 11,
    color: '#5c6780',
  },
  summaryWarning: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 15,
    color: '#8a5d00',
    fontWeight: '700',
  },
  summaryAmount: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '800',
    color: '#1d6a3c',
  },
  emptyText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#3a3a3a',
  },
  list: {
    gap: 8,
  },
});

export default InvoiceWorkspaceContent;
