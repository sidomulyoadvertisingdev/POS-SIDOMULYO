import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AppLoadingAnimation from './AppLoadingAnimation';
const { matchesCustomerSearch, normalizeIndonesianPhone } = require('../utils/customerPhone');

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const isTruthyCustomerFlag = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const text = normalizeText(value);
  return ['1', 'true', 'yes', 'y', 'aktif', 'active'].includes(text);
};
const toCustomerTypeCode = (value) => {
  const text = normalizeText(value);
  if (['umum', 'retail', 'eceran'].includes(text)) return 'umum';
  if (['reseller', 'agen', 'member', 'wholesale', 'grosir'].includes(text)) return 'reseller';
  if (['corporate', 'perusahaan', 'company'].includes(text)) return 'corporate';
  return text;
};
const toCustomerTypeLabel = (value) => {
  const code = toCustomerTypeCode(value);
  if (code === 'umum') return 'Retail';
  if (code === 'reseller') return 'Reseller';
  if (code === 'corporate') return 'Corporate';
  return String(value || '').trim() || 'Tanpa Tipe';
};

const TransactionHeader = ({
  noteNumber,
  transactionDate,
  customers,
  selectedCustomerId,
  selectedCustomer: selectedCustomerProp,
  onSelectCustomerId,
  customerTypes,
  onCreateCustomer,
  backendReady,
  customerDepositBalance = 0,
  onPressDeposit,
  loadingDepositBalance = false,
  selectedCustomerReceivableSummary = null,
  onPressReceivableLimit,
}) => {
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [createError, setCreateError] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCustomerTypeId, setFormCustomerTypeId] = useState(null);

  const selectedCustomer = useMemo(
    () => selectedCustomerProp || (customers || []).find((row) => Number(row.id) === Number(selectedCustomerId)) || null,
    [customers, selectedCustomerId, selectedCustomerProp],
  );

  const selectedType = useMemo(
    () => (customerTypes || []).find((row) => Number(row.id) === Number(formCustomerTypeId)) || null,
    [customerTypes, formCustomerTypeId],
  );

  const filteredCustomers = useMemo(() => {
    const source = Array.isArray(customers) ? customers : [];
    if (!customerSearch.trim()) {
      return source;
    }
    return source.filter((row) => matchesCustomerSearch(row, customerSearch));
  }, [customers, customerSearch]);

  const filteredTypes = useMemo(
    () => (Array.isArray(customerTypes) ? customerTypes : []),
    [customerTypes],
  );
  const receivableLimitSummary = selectedCustomerReceivableSummary?.receivableLimit
    && typeof selectedCustomerReceivableSummary.receivableLimit === 'object'
    ? selectedCustomerReceivableSummary.receivableLimit
    : {};
  const approvedReceivableLimitAmount = Number(receivableLimitSummary?.approvedAmount || 0) || 0;
  const remainingReceivableLimitAmount = Number(receivableLimitSummary?.remainingAmount || 0) || 0;
  const pendingReceivableLimitAmount = Number(receivableLimitSummary?.pendingAmount || 0) || 0;
  const receivableLimitStatus = normalizeText(receivableLimitSummary?.status || '');
  const lastReceivableLimitRequest = receivableLimitSummary?.lastRequest
    && typeof receivableLimitSummary.lastRequest === 'object'
    ? receivableLimitSummary.lastRequest
    : null;
  const receivableLimitRejected = normalizeText(lastReceivableLimitRequest?.status || '') === 'rejected';
  const receivableLimitProfileCompleted = Boolean(receivableLimitSummary?.profileCompleted);
  const resolveCustomerTypeLabel = (customer) => {
    const directCandidates = [
      customer?.label,
      customer?.customer_label,
      customer?.customer_type,
      customer?.customer_type_name,
      customer?.customer_type_code,
      customer?.type_name,
      customer?.member_type,
      customer?.price_type,
      customer?.price_level,
      customer?.level,
    ];
    for (const candidate of directCandidates) {
      const direct = toCustomerTypeLabel(candidate);
      if (direct !== 'Tanpa Tipe') {
        return direct;
      }
    }
    if (
      isTruthyCustomerFlag(customer?.is_reseller)
      || isTruthyCustomerFlag(customer?.reseller)
      || isTruthyCustomerFlag(customer?.is_member_reseller)
    ) {
      return 'Reseller';
    }
    const selectedTypeId = Number(customer?.customer_type_id || customer?.type_id || 0);
    if (selectedTypeId > 0) {
      const matchedType = filteredTypes.find((row) => Number(row?.id || 0) === selectedTypeId);
      return toCustomerTypeLabel(matchedType?.code || matchedType?.name || '');
    }
    return 'Retail';
  };

  const handleSaveCustomer = async () => {
    if (isSavingCustomer) {
      return;
    }

    if (!formName.trim()) {
      setCreateError('Nama customer wajib diisi.');
      return;
    }
    if (!formPhone.trim()) {
      setCreateError('Nomor handphone wajib diisi.');
      return;
    }
    if (!formCustomerTypeId) {
      setCreateError('Tipe pelanggan wajib dipilih.');
      return;
    }

    try {
      const normalizedPhone = normalizeIndonesianPhone(formPhone, { allowEmpty: false });
      setIsSavingCustomer(true);
      setCreateError('');
      setFormPhone(normalizedPhone);
      await onCreateCustomer?.({
        name: formName.trim(),
        phone: normalizedPhone,
        address: formAddress.trim(),
        customer_type_id: Number(formCustomerTypeId),
      });

      setIsCreateModalOpen(false);
      setFormName('');
      setFormPhone('');
      setFormAddress('');
      setFormCustomerTypeId(null);
    } catch (error) {
      setCreateError(error?.message || 'Gagal menambahkan customer baru.');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Transaksi Kasir</Text>
      <Text style={styles.subtitle}>Digunakan untuk input pesanan/custom order</Text>
      <View style={styles.formBox}>
        <View style={styles.row}>
          <Text style={styles.label}>No Invoice</Text>
          <Text style={styles.value}>{String(noteNumber || '').trim() || 'Akan dibuat otomatis oleh backend'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Customer</Text>
          <View style={styles.customerField}>
            <View style={styles.customerActionRow}>
              <Pressable
                style={[styles.selector, !backendReady ? styles.selectorDisabled : null]}
                onPress={() => setIsCustomerModalOpen(true)}
                disabled={!backendReady}
              >
                <View>
                  <Text style={styles.selectorText}>
                    {selectedCustomer?.name || 'Pilih customer'}
                  </Text>
                  {selectedCustomer ? (
                    <Text style={styles.selectorHintText}>
                      {resolveCustomerTypeLabel(selectedCustomer)}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Pressable
                style={[styles.addButton, !backendReady ? styles.selectorDisabled : null]}
                onPress={() => setIsCreateModalOpen(true)}
                disabled={!backendReady}
              >
                <Text style={styles.addButtonText}>+</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.depositButton,
                  (!backendReady || !selectedCustomer) ? styles.depositButtonDisabled : null,
                ]}
                onPress={() => onPressDeposit?.()}
                disabled={!backendReady || !selectedCustomer}
              >
                <Text
                  style={[
                    styles.depositButtonText,
                    (!backendReady || !selectedCustomer) ? styles.depositButtonTextDisabled : null,
                  ]}
                >
                  Deposit
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.receivableLimitButton,
                  (!backendReady || !selectedCustomer) ? styles.depositButtonDisabled : null,
                ]}
                onPress={() => onPressReceivableLimit?.()}
                disabled={!backendReady || !selectedCustomer}
              >
                <Text
                  style={[
                    styles.receivableLimitButtonText,
                    (!backendReady || !selectedCustomer) ? styles.depositButtonTextDisabled : null,
                  ]}
                >
                  Plafon
                </Text>
              </Pressable>
            </View>

            {selectedCustomer ? (
              <View style={styles.depositMetaWrap}>
                <View style={styles.depositMetaRow}>
                  <View style={styles.depositBadge}>
                    {loadingDepositBalance ? (
                      <AppLoadingAnimation size={20} fallbackColor="#1d6a3c" />
                    ) : (
                      <Text style={styles.depositBadgeText}>
                        Saldo Customer: Rp {Number(customerDepositBalance || 0).toLocaleString('id-ID')}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={[styles.depositBadge, styles.receivableLimitBadge]}>
                  <Text style={styles.receivableLimitBadgeText}>
                    {pendingReceivableLimitAmount > 0 || receivableLimitStatus === 'pending'
                      ? `Plafon Piutang: Menunggu approval ${Number(pendingReceivableLimitAmount || 0).toLocaleString('id-ID')}`
                      : approvedReceivableLimitAmount > 0
                        ? `Plafon Piutang: Rp ${Number(approvedReceivableLimitAmount || 0).toLocaleString('id-ID')} | Sisa Rp ${Number(remainingReceivableLimitAmount || 0).toLocaleString('id-ID')}`
                        : receivableLimitRejected
                          ? 'Plafon Piutang: Pengajuan terakhir ditolak'
                        : 'Plafon Piutang: Belum disetujui'}
                  </Text>
                  {selectedCustomerReceivableSummary?.hasOutstanding ? (
                    <Text style={styles.receivableLimitHintText}>
                      Piutang aktif: Rp {Number(selectedCustomerReceivableSummary?.dueTotal || 0).toLocaleString('id-ID')}
                    </Text>
                  ) : pendingReceivableLimitAmount > 0 || receivableLimitStatus === 'pending' ? (
                    <Text style={styles.receivableLimitHintText}>
                      Admin akan menentukan plafon final saat menyetujui pengajuan ini.
                    </Text>
                  ) : approvedReceivableLimitAmount > 0 && receivableLimitRejected ? (
                    <Text style={styles.receivableLimitHintText}>
                      Pengajuan perubahan plafon terakhir ditolak. Batas aktif tetap Rp {Number(approvedReceivableLimitAmount || 0).toLocaleString('id-ID')}.
                    </Text>
                  ) : receivableLimitRejected ? (
                    <Text style={styles.receivableLimitHintText}>
                      Pengajuan plafon terakhir ditolak. Revisi formulir lalu ajukan ulang.
                    </Text>
                  ) : !receivableLimitProfileCompleted ? (
                    <Text style={styles.receivableLimitHintText}>
                      Lengkapi formulir plafon customer dulu sebelum transaksi piutang pertama.
                    </Text>
                  ) : (
                    <Text style={styles.receivableLimitHintText}>
                      Gunakan tombol Plafon untuk ajukan / ubah batas piutang customer. Nilai final plafon tetap ditentukan admin.
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <Text style={styles.helperText}>Pilih customer dulu untuk cek saldo, top up, dan plafon piutang</Text>
            )}
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Tgl Order</Text>
          <Text style={styles.value}>{transactionDate}</Text>
        </View>
      </View>

      <Modal
        visible={isCustomerModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCustomerModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Customer</Text>
            <TextInput
              value={customerSearch}
              onChangeText={setCustomerSearch}
              placeholder="Cari nama atau nomor HP..."
              placeholderTextColor="#777777"
              style={styles.modalInput}
            />
            <ScrollView style={styles.listWrap}>
              {filteredCustomers.map((item) => (
                <Pressable
                  key={String(item.id)}
                  style={styles.listItem}
                  onPress={() => {
                    onSelectCustomerId?.(Number(item.id));
                    setIsCustomerModalOpen(false);
                  }}
                >
                  <Text style={styles.listItemText}>{item.name || '-'}</Text>
                  <Text style={styles.listItemRole}>{resolveCustomerTypeLabel(item)}</Text>
                  {item.phone ? <Text style={styles.listItemMeta}>{item.phone}</Text> : null}
                </Pressable>
              ))}
              {filteredCustomers.length === 0 ? (
                <Text style={styles.emptyText}>Customer tidak ditemukan.</Text>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setIsCustomerModalOpen(false)}>
                <Text style={styles.secondaryButtonText}>Tutup</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tambah Customer Baru</Text>

            <Text style={styles.inputLabel}>Nama</Text>
            <TextInput
              value={formName}
              onChangeText={setFormName}
              placeholder="Nama customer"
              placeholderTextColor="#777777"
              style={styles.modalInput}
            />

            <Text style={styles.inputLabel}>Nomor Handphone</Text>
            <TextInput
              value={formPhone}
              onChangeText={setFormPhone}
              placeholder="08xxxxxxxxxx"
              placeholderTextColor="#777777"
              keyboardType="phone-pad"
              style={styles.modalInput}
            />

            <Text style={styles.inputLabel}>Tipe Pelanggan</Text>
            <Pressable style={styles.selector} onPress={() => setIsTypeModalOpen(true)}>
              <Text style={styles.selectorText}>
                {selectedType?.name || 'Pilih tipe pelanggan'}
              </Text>
            </Pressable>

            <Text style={styles.inputLabel}>Alamat</Text>
            <TextInput
              value={formAddress}
              onChangeText={setFormAddress}
              placeholder="Alamat customer"
              placeholderTextColor="#777777"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={[styles.modalInput, styles.multilineInput]}
            />

            {createError ? <Text style={styles.errorText}>{createError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setIsCreateModalOpen(false)}
                disabled={isSavingCustomer}
              >
                <Text style={styles.secondaryButtonText}>Batal</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={handleSaveCustomer}
                disabled={isSavingCustomer}
              >
                {isSavingCustomer ? (
                  <AppLoadingAnimation
                    size={20}
                    fallbackColor="#ffffff"
                    style={styles.buttonLoadingIndicator}
                  />
                ) : (
                  <Text style={styles.primaryButtonText}>Simpan</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isTypeModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTypeModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Tipe Pelanggan</Text>
            <ScrollView style={styles.listWrap}>
              {filteredTypes.map((item) => (
                <Pressable
                  key={String(item.id)}
                  style={styles.listItem}
                  onPress={() => {
                    setFormCustomerTypeId(Number(item.id));
                    setIsTypeModalOpen(false);
                  }}
                >
                  <Text style={styles.listItemText}>{item.name || '-'}</Text>
                </Pressable>
              ))}
              {filteredTypes.length === 0 ? (
                <Text style={styles.emptyText}>Belum ada data tipe pelanggan.</Text>
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setIsTypeModalOpen(false)}>
                <Text style={styles.secondaryButtonText}>Tutup</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    flex: 1.08,
    borderWidth: 1,
    borderColor: '#b3b3b3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  title: {
    color: '#1f1f1f',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#404040',
    marginBottom: 8,
  },
  formBox: {
    borderWidth: 1,
    borderColor: '#c9c9c9',
    backgroundColor: '#efefef',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  label: {
    width: 88,
    fontSize: 12,
    color: '#2b2b2b',
    fontWeight: '600',
    paddingTop: 6,
  },
  customerField: {
    flex: 1,
    gap: 6,
  },
  customerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  value: {
    flex: 1,
    fontSize: 12,
    color: '#1e1e1e',
    backgroundColor: '#f7f5eb',
    borderWidth: 1,
    borderColor: '#bdbdbd',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  selector: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#bdbdbd',
    backgroundColor: '#f7f5eb',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  selectorDisabled: {
    opacity: 0.6,
  },
  selectorText: {
    fontSize: 12,
    color: '#1e1e1e',
  },
  selectorHintText: {
    fontSize: 11,
    color: '#4d5b7c',
    marginTop: 2,
    fontWeight: '700',
  },
  addButton: {
    width: 28,
    height: 26,
    borderWidth: 1,
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '800',
  },
  depositButton: {
    borderWidth: 1,
    borderColor: '#1d7a45',
    backgroundColor: '#ecf8f0',
    minHeight: 26,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositButtonDisabled: {
    borderColor: '#c4cad5',
    backgroundColor: '#eef1f5',
  },
  depositButtonText: {
    color: '#1d6a3c',
    fontSize: 11,
    fontWeight: '800',
  },
  depositButtonTextDisabled: {
    color: '#7b8798',
  },
  receivableLimitButton: {
    borderWidth: 1,
    borderColor: '#9a6a12',
    backgroundColor: '#fff6df',
    minHeight: 26,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receivableLimitButtonText: {
    color: '#86560f',
    fontSize: 11,
    fontWeight: '800',
  },
  depositMetaWrap: {
    gap: 6,
  },
  depositMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  depositBadge: {
    borderWidth: 1,
    borderColor: '#b8dfc7',
    backgroundColor: '#f3fbf6',
    minHeight: 28,
    paddingHorizontal: 9,
    paddingVertical: 5,
    justifyContent: 'center',
  },
  receivableLimitBadge: {
    borderColor: '#e7c98a',
    backgroundColor: '#fff9ec',
  },
  depositBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d6a3c',
  },
  receivableLimitBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#86560f',
  },
  receivableLimitHintText: {
    fontSize: 10,
    color: '#6f582c',
    fontWeight: '700',
    marginTop: 3,
  },
  helperText: {
    fontSize: 10,
    color: '#6a7485',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderColor: '#a9a9a9',
    backgroundColor: '#e3e3e3',
    padding: 12,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#11469f',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#a9a9a9',
    backgroundColor: '#ffffff',
    color: '#1e1e1e',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  multilineInput: {
    minHeight: 72,
  },
  listWrap: {
    maxHeight: 260,
    borderWidth: 1,
    borderColor: '#bdbdbd',
    backgroundColor: '#ffffff',
  },
  listItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  listItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f1f1f',
  },
  listItemRole: {
    fontSize: 11,
    color: '#1846a3',
    marginTop: 2,
    fontWeight: '700',
  },
  listItemMeta: {
    fontSize: 11,
    color: '#525252',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 12,
    color: '#666666',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#9f9f9f',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2a2a2a',
  },
  primaryButton: {
    borderWidth: 1,
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  primaryButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  buttonLoadingIndicator: {
    marginVertical: -2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2b2b2b',
    marginBottom: 4,
  },
  errorText: {
    marginTop: 2,
    marginBottom: 4,
    color: '#a11616',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default TransactionHeader;
