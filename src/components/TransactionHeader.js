import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const TransactionHeader = ({
  noteNumber,
  transactionDate,
  customers,
  selectedCustomerId,
  onSelectCustomerId,
  customerTypes,
  onCreateCustomer,
  backendReady,
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
    () => (customers || []).find((row) => Number(row.id) === Number(selectedCustomerId)) || null,
    [customers, selectedCustomerId],
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
    const keyword = normalizeText(customerSearch);
    return source.filter((row) => normalizeText(row.name).includes(keyword));
  }, [customers, customerSearch]);

  const filteredTypes = useMemo(
    () => (Array.isArray(customerTypes) ? customerTypes : []),
    [customerTypes],
  );

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
      setIsSavingCustomer(true);
      setCreateError('');
      await onCreateCustomer?.({
        name: formName.trim(),
        phone: formPhone.trim(),
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
          <Pressable
            style={[styles.selector, !backendReady ? styles.selectorDisabled : null]}
            onPress={() => setIsCustomerModalOpen(true)}
            disabled={!backendReady}
          >
            <Text style={styles.selectorText}>
              {selectedCustomer?.name || 'Pilih customer'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.addButton, !backendReady ? styles.selectorDisabled : null]}
            onPress={() => setIsCreateModalOpen(true)}
            disabled={!backendReady}
          >
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
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
              placeholder="Cari nama customer..."
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
                  <ActivityIndicator size="small" color="#ffffff" />
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
    alignItems: 'center',
    gap: 8,
  },
  label: {
    width: 88,
    fontSize: 12,
    color: '#2b2b2b',
    fontWeight: '600',
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
