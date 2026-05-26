import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  createPembelianBahanRequest,
  getPembelianBahanDetail,
  getPembelianBahanList,
  getPembelianBahanMaterialOptions,
  getPembelianCategoryOptions,
  fetchPosBankAccounts,
} from '../services/erpApi';
import { formatRupiah } from '../utils/currency';

const formatDateLabel = (value) => {
  const parsed = new Date(value || '');
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }
  return parsed.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const sanitizeCurrencyInput = (value) => String(value || '').replace(/[^\d]/g, '');
const sanitizeQtyInput = (value) => String(value || '').replace(/[^\d.]/g, '');
const parseCurrencyInput = (value) => Number(String(value || '').replace(/[^\d]/g, '')) || 0;
const parseQtyInput = (value) => {
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveStatusTone = (status = '') => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'approved') return styles.statusSuccess;
  if (normalized === 'rejected') return styles.statusDanger;
  if (normalized === 'pending') return styles.statusWarning;
  return styles.statusMuted;
};

const resolveCategoryTypeLabel = (type = '') => {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === 'material') return 'Request Gudang';
  if (normalized === 'consumable') return 'Consumable';
  if (normalized === 'aset_ekonomis' || normalized === 'asset_ekonomis') return 'Aset Ekonomis';
  if (normalized === 'pengeluaran') return 'Pengeluaran';
  return normalized ? normalized.replace(/_/g, ' ') : 'Kategori';
};

const resolveCategoryFlowLabel = (flow = '') => (
  String(flow || '').trim().toLowerCase() === 'stock_request'
    ? 'Request Gudang'
    : 'Belanja Toko'
);

const buildDraftItemFromMaterial = (material) => {
  const materialId = Number(material?.material_id || material?.id || 0) || 0;
  const uom = String(material?.uom || material?.satuan || 'unit').trim() || 'unit';
  const unitPrice = Number(material?.unit_price || material?.harga_satuan || 0) || 0;
  return {
    id: `draft-${materialId}`,
    material_id: materialId,
    warehouse_product_id: Number(material?.warehouse_product_id || materialId || 0) || 0,
    material_name: String(material?.material_name || material?.name || '').trim(),
    sku: String(material?.sku || '').trim(),
    specification: String(material?.specification || '').trim(),
    qty: 1,
    uom,
    satuan: uom,
    unit_price: unitPrice,
    harga_satuan: unitPrice,
    subtotal: unitPrice,
    is_manual: false,
    price_source: String(material?.price_source || '').trim(),
    price_missing: Boolean(material?.price_missing || !(unitPrice > 0)),
    is_price_locked: true,
  };
};

const buildDraftItemFromCategoryItem = (categoryItem, categoryCode = 'manual') => {
  const categoryItemId = Number(categoryItem?.id || 0) || 0;
  const uom = String(categoryItem?.default_uom || categoryItem?.uom || 'unit').trim() || 'unit';
  return {
    id: `${String(categoryCode || 'manual')}-item-${categoryItemId || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    material_id: 0,
    warehouse_product_id: 0,
    purchase_category_item_id: categoryItemId || null,
    material_name: String(categoryItem?.name || '').trim(),
    sku: '',
    specification: String(categoryItem?.description || '').trim(),
    qty: 1,
    uom,
    satuan: uom,
    unit_price: 0,
    harga_satuan: 0,
    subtotal: 0,
    is_manual: false,
    is_name_locked: true,
  };
};

const buildManualDraftItem = (categoryCode = 'manual') => ({
  id: `${String(categoryCode || 'manual')}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  material_id: 0,
  warehouse_product_id: 0,
  purchase_category_item_id: null,
  material_name: '',
  sku: '',
  specification: '',
  qty: 1,
  uom: 'unit',
  satuan: 'unit',
  unit_price: 0,
  harga_satuan: 0,
  subtotal: 0,
  is_manual: true,
});

const normalizePaymentAccountRow = (row) => ({
  ...row,
  id: Number(row?.payment_account_id || row?.id || 0) || 0,
  payment_method_id: Number(row?.payment_method_id || 0) || null,
  accounting_account_id: Number(row?.accounting_account_id || row?.accountingAccountId || 0) || null,
  payment_method_code: String(row?.payment_method_code || row?.type || '').trim(),
  payment_method_name: String(row?.payment_method_name || row?.payment_method_code || row?.type || '').trim(),
  display_label: String(row?.label || row?.name || '').trim() || 'Akun pembayaran',
});

const PurchaseMaterialPanel = ({ currentUser, isActive, onNotify }) => {
  const [purchaseCategories, setPurchaseCategories] = useState([]);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState('');
  const [materialRows, setMaterialRows] = useState([]);
  const [requestRows, setRequestRows] = useState([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(false);
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isCategoryItemModalVisible, setIsCategoryItemModalVisible] = useState(false);
  const [isMaterialModalVisible, setIsMaterialModalVisible] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);
  const [categoryItemSearch, setCategoryItemSearch] = useState('');
  const [selectedCategoryItemIds, setSelectedCategoryItemIds] = useState([]);
  const [noteInput, setNoteInput] = useState('');
  const [draftItems, setDraftItems] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [selectedPaymentAccountId, setSelectedPaymentAccountId] = useState(null);
  const [isPaymentAccountsLoading, setIsPaymentAccountsLoading] = useState(false);

  const selectedCategory = useMemo(() => (
    purchaseCategories.find((row) => String(row?.code || '') === String(selectedCategoryCode || ''))
    || null
  ), [purchaseCategories, selectedCategoryCode]);

  const isMaterialFlow = String(selectedCategory?.flow || '') === 'stock_request';
  const categoryItemRows = useMemo(
    () => (Array.isArray(selectedCategory?.items) ? selectedCategory.items : []),
    [selectedCategory],
  );
  const hasCategoryItemOptions = !isMaterialFlow && categoryItemRows.length > 0;
  const selectedPaymentAccount = useMemo(() => (
    paymentAccounts.find((row) => Number(row?.id || 0) === Number(selectedPaymentAccountId || 0)) || null
  ), [paymentAccounts, selectedPaymentAccountId]);

  const filteredMaterials = useMemo(() => {
    const keyword = String(materialSearch || '').trim().toLowerCase();
    const rows = Array.isArray(materialRows) ? materialRows : [];
    if (!keyword) {
      return rows;
    }
    return rows.filter((row) => (
      String(row?.material_name || '').toLowerCase().includes(keyword)
      || String(row?.sku || '').toLowerCase().includes(keyword)
      || String(row?.specification || '').toLowerCase().includes(keyword)
    ));
  }, [materialRows, materialSearch]);

  const filteredCategoryItems = useMemo(() => {
    const keyword = String(categoryItemSearch || '').trim().toLowerCase();
    if (!keyword) {
      return categoryItemRows;
    }

    return categoryItemRows.filter((row) => (
      String(row?.name || '').toLowerCase().includes(keyword)
      || String(row?.description || '').toLowerCase().includes(keyword)
      || String(row?.code || '').toLowerCase().includes(keyword)
    ));
  }, [categoryItemRows, categoryItemSearch]);

  const draftTotalAmount = useMemo(
    () => (Array.isArray(draftItems) ? draftItems : []).reduce((sum, row) => sum + Number(row?.subtotal || 0), 0),
    [draftItems],
  );

  const hasInvalidDraft = useMemo(
    () => (Array.isArray(draftItems) ? draftItems : []).some((row) => (
      !String(row?.material_name || '').trim()
      || !(Number(row?.qty || 0) > 0)
      || Boolean(row?.price_missing)
      || !(Number(row?.unit_price || 0) > 0)
    )),
    [draftItems],
  );

  const selectedMaterialCount = selectedMaterialIds.length;
  const selectedCategoryItemCount = selectedCategoryItemIds.length;

  const loadCategories = async () => {
    try {
      setIsCategoriesLoading(true);
      const rows = await getPembelianCategoryOptions();
      const nextRows = Array.isArray(rows) ? rows : [];
      setPurchaseCategories(nextRows);
      if (nextRows.length === 0) {
        setSelectedCategoryCode('');
      } else if (!nextRows.some((row) => String(row?.code || '') === String(selectedCategoryCode || ''))) {
        setSelectedCategoryCode('');
      }
    } catch (error) {
      setPurchaseCategories([]);
      setSelectedCategoryCode('');
      onNotify?.('Belanja Toko', `Gagal memuat kategori pembelian: ${error.message}`);
    } finally {
      setIsCategoriesLoading(false);
    }
  };

  const loadMaterials = async () => {
    try {
      setIsMaterialsLoading(true);
      const rows = await getPembelianBahanMaterialOptions();
      setMaterialRows(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setMaterialRows([]);
      onNotify?.('Request Bahan Gudang', `Gagal memuat bahan gudang: ${error.message}`);
    } finally {
      setIsMaterialsLoading(false);
    }
  };

  const loadPaymentAccounts = async () => {
    try {
      setIsPaymentAccountsLoading(true);
      const rows = await fetchPosBankAccounts({
        context: 'expense',
        allowedTypes: ['cash', 'bank_transfer', 'qris', 'e_wallet'],
      });
      const nextRows = (Array.isArray(rows) ? rows : [])
        .map((row) => normalizePaymentAccountRow(row))
        .filter((row) => row.id > 0 && Number(row.accounting_account_id || 0) > 0);
      setPaymentAccounts(nextRows);
      setSelectedPaymentAccountId((currentId) => (
        nextRows.some((row) => Number(row.id) === Number(currentId || 0))
          ? currentId
          : (nextRows[0]?.id || null)
      ));
    } catch (error) {
      setPaymentAccounts([]);
      setSelectedPaymentAccountId(null);
      onNotify?.('Belanja Toko', `Gagal memuat akun pembayaran: ${error.message}`);
    } finally {
      setIsPaymentAccountsLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      setIsRequestsLoading(true);
      const response = await getPembelianBahanList({ per_page: 50 });
      setRequestRows(Array.isArray(response?.data) ? response.data : []);
      if (!selectedRequestId && Array.isArray(response?.data) && response.data[0]?.id) {
        setSelectedRequestId(String(response.data[0].id));
      }
    } catch (error) {
      setRequestRows([]);
      onNotify?.('Belanja Toko', `Gagal memuat daftar pembelian: ${error.message}`);
    } finally {
      setIsRequestsLoading(false);
    }
  };

  useEffect(() => {
    if (!isActive) {
      return;
    }
    loadCategories();
    loadMaterials();
    loadRequests();
    loadPaymentAccounts();
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !selectedRequestId) {
      return;
    }
    let cancelled = false;
    const loadDetail = async () => {
      try {
        setIsDetailLoading(true);
        const detail = await getPembelianBahanDetail(selectedRequestId);
        if (!cancelled) {
          setSelectedDetail(detail);
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedDetail(null);
          onNotify?.('Belanja Toko', `Gagal memuat detail pembelian: ${error.message}`);
        }
      } finally {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      }
    };
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [isActive, onNotify, selectedRequestId]);

  const openMaterialModal = async () => {
    if (!selectedCategory) {
      onNotify?.('Belanja Toko', 'Pilih kategori pembelian dari backend dulu sebelum memilih item.');
      setIsCategoryModalVisible(true);
      return;
    }
    if (!isMaterialFlow) {
      return;
    }
    if (!materialRows.length) {
      await loadMaterials();
    }
    setSelectedMaterialIds([]);
    setMaterialSearch('');
    setIsMaterialModalVisible(true);
  };

  const closeMaterialModal = () => {
    setIsMaterialModalVisible(false);
    setSelectedMaterialIds([]);
  };

  const openCategoryItemModal = () => {
    if (!selectedCategory) {
      onNotify?.('Belanja Toko', 'Pilih kategori pembelian dari backend dulu sebelum memilih item belanja.');
      setIsCategoryModalVisible(true);
      return;
    }
    if (!hasCategoryItemOptions) {
      onNotify?.('Belanja Toko', 'Kategori ini belum punya daftar item popup dari backend. Tambahkan dulu itemnya di admin backend atau pakai input manual sementara.');
      return;
    }
    setSelectedCategoryItemIds([]);
    setCategoryItemSearch('');
    setIsCategoryItemModalVisible(true);
  };

  const closeCategoryItemModal = () => {
    setIsCategoryItemModalVisible(false);
    setSelectedCategoryItemIds([]);
  };

  const openCategoryModal = async () => {
    if (!purchaseCategories.length) {
      await loadCategories();
    }
    setIsCategoryModalVisible(true);
  };

  const closeCategoryModal = () => {
    setIsCategoryModalVisible(false);
  };

  const toggleCategoryItemSelection = (itemId) => {
    const key = String(itemId || '').trim();
    if (!key) {
      return;
    }
    setSelectedCategoryItemIds((prev) => (
      prev.includes(key)
        ? prev.filter((value) => value !== key)
        : [...prev, key]
    ));
  };

  const toggleMaterialSelection = (materialId) => {
    const key = String(materialId || '').trim();
    if (!key) {
      return;
    }
    setSelectedMaterialIds((prev) => (
      prev.includes(key)
        ? prev.filter((value) => value !== key)
        : [...prev, key]
    ));
  };

  const handleApplySelectedMaterials = () => {
    const selectedRows = filteredMaterials.filter((row) => selectedMaterialIds.includes(String(row?.material_id || row?.id || '')));
    if (selectedRows.length === 0) {
      onNotify?.('Request Bahan Gudang', 'Pilih minimal satu bahan di popup sebelum ditambahkan ke draft.');
      return;
    }

    setDraftItems((prev) => {
      const nextRows = [...prev];
      selectedRows.forEach((row) => {
        const materialId = Number(row?.material_id || row?.id || 0) || 0;
        const existingIndex = nextRows.findIndex((item) => Number(item?.material_id || 0) === materialId);
        if (existingIndex >= 0) {
          return;
        }
        nextRows.push(buildDraftItemFromMaterial(row));
      });
      return nextRows;
    });

    closeMaterialModal();
  };

  const handleAddManualItem = () => {
    if (!selectedCategory) {
      onNotify?.('Belanja Toko', 'Pilih kategori pembelian dari backend dulu sebelum menambah item belanja.');
      setIsCategoryModalVisible(true);
      return;
    }
    if (hasCategoryItemOptions) {
      openCategoryItemModal();
      return;
    }
    setDraftItems((prev) => [...prev, buildManualDraftItem(selectedCategoryCode)]);
  };

  const handleApplySelectedCategoryItems = () => {
    const selectedRows = categoryItemRows.filter((row) => selectedCategoryItemIds.includes(String(row?.id || '')));
    if (selectedRows.length === 0) {
      onNotify?.('Belanja Toko', 'Pilih minimal satu item belanja dari popup backend sebelum ditambahkan ke draft.');
      return;
    }

    setDraftItems((prev) => {
      const nextRows = [...prev];
      selectedRows.forEach((row) => {
        const itemId = Number(row?.id || 0) || 0;
        const existingIndex = nextRows.findIndex((item) => Number(item?.purchase_category_item_id || 0) === itemId);
        if (existingIndex >= 0) {
          return;
        }
        nextRows.push(buildDraftItemFromCategoryItem(row, selectedCategoryCode));
      });
      return nextRows;
    });

    closeCategoryItemModal();
  };

  const handleCategoryChange = (code) => {
    const nextCode = String(code || '').trim();
    if (!nextCode) {
      return;
    }
    if (nextCode === selectedCategoryCode) {
      setIsCategoryModalVisible(false);
      return;
    }
    if (draftItems.length > 0) {
      setDraftItems([]);
    }
    const nextCategory = purchaseCategories.find((row) => String(row?.code || '') === nextCode) || null;
    const nextIsMaterialFlow = String(nextCategory?.flow || '') === 'stock_request';
    const nextCategoryItems = Array.isArray(nextCategory?.items) ? nextCategory.items : [];
    setSelectedCategoryCode(nextCode);
    setSelectedMaterialIds([]);
    setSelectedCategoryItemIds([]);
    setMaterialSearch('');
    setCategoryItemSearch('');
    setIsCategoryModalVisible(false);
    setIsCategoryItemModalVisible(false);
    setIsMaterialModalVisible(false);

    if (!nextIsMaterialFlow && nextCategoryItems.length > 0) {
      setIsCategoryItemModalVisible(true);
    }
  };

  const updateDraftItemField = (itemId, field, rawValue) => {
    setDraftItems((prev) => prev.map((row) => {
      if (String(row?.id || '') !== String(itemId || '')) {
        return row;
      }

      if (field === 'qty') {
        const qty = parseQtyInput(rawValue);
        const unitPrice = Number(row?.unit_price || 0) || 0;
        return {
          ...row,
          qty,
          subtotal: qty * unitPrice,
        };
      }

      if (field === 'unit_price') {
        const unitPrice = parseCurrencyInput(rawValue);
        const qty = Number(row?.qty || 0) || 0;
        return {
          ...row,
          unit_price: unitPrice,
          harga_satuan: unitPrice,
          subtotal: qty * unitPrice,
        };
      }

      if (field === 'material_name') {
        return {
          ...row,
          material_name: String(rawValue || '').trimStart(),
        };
      }

      if (field === 'uom') {
        const uom = String(rawValue || '').trimStart();
        return {
          ...row,
          uom,
          satuan: uom,
        };
      }

      return row;
    }));
  };

  const handleRemoveItem = (id) => {
    setDraftItems((prev) => prev.filter((row) => String(row?.id || '') !== String(id || '')));
  };

  const handleSubmit = async () => {
    if (!selectedCategory?.id && !selectedCategory?.code) {
      onNotify?.('Belanja Toko', 'Kategori pembelian dari backend belum tersedia. Refresh dulu atau lengkapi setting kategori di backend.');
      return;
    }

    if (draftItems.length === 0) {
      onNotify?.('Belanja Toko', isMaterialFlow
        ? 'Item pembelian masih kosong. Pilih beberapa bahan dari popup produk terlebih dahulu.'
        : 'Item pembelian masih kosong. Tambahkan item belanja terlebih dahulu.');
      return;
    }

    if (hasInvalidDraft) {
      onNotify?.('Belanja Toko', isMaterialFlow
        ? 'Masih ada bahan yang belum punya harga otomatis dari histori pembelian gudang atau qty belum valid.'
        : 'Masih ada item yang tidak valid. Periksa nama barang, qty, dan harga satuan.');
      return;
    }

    if (!isMaterialFlow && paymentStatus === 'paid' && !selectedPaymentAccount) {
      onNotify?.('Belanja Toko', 'Pilih akun pembayaran untuk belanja yang sudah dibayar.');
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await createPembelianBahanRequest({
        requester: currentUser ? { id: currentUser?.id, name: currentUser?.name } : null,
        note: noteInput,
        items: draftItems,
        purchase_category: selectedCategory,
        payment_status: isMaterialFlow ? undefined : paymentStatus,
        payment_method_id: !isMaterialFlow && paymentStatus === 'paid' ? selectedPaymentAccount?.payment_method_id : null,
        payment_account_id: !isMaterialFlow && paymentStatus === 'paid' ? selectedPaymentAccount?.id : null,
        source_account_id: !isMaterialFlow && paymentStatus === 'paid' ? selectedPaymentAccount?.accounting_account_id : null,
      });
      setDraftItems([]);
      setNoteInput('');
      await loadRequests();
      setSelectedRequestId(String(created?.id || ''));
      setSelectedDetail(created);
      onNotify?.(
        'Belanja Toko',
        created?.purchase_category_flow === 'stock_request'
          ? 'Request bahan gudang berhasil dibuat.'
          : 'Belanja toko berhasil dibuat.',
      );
    } catch (error) {
      onNotify?.('Belanja Toko', `Gagal membuat pembelian: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Belanja Toko & Request Bahan</Text>
          <Text style={styles.description}>
            Kategori `consumable` dan `aset ekonomis` adalah belanja toko yang mengikuti setting admin di backend. Untuk `material`, POS hanya membuat request bahan ke gudang
            dan harga bahan otomatis mengikuti histori pembelian gudang, bukan input manual dari POS.
          </Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={loadRequests}>
          <Text style={styles.refreshButtonText}>
            {isRequestsLoading ? 'Memuat...' : 'Refresh'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Form Belanja / Request</Text>
        <Text style={styles.metaText}>Tanggal: {formatDateLabel(new Date().toISOString())}</Text>
        <Text style={styles.metaText}>Requester: {String(currentUser?.name || 'User POS')}</Text>

        <View style={styles.categorySection}>
          <Text style={styles.sectionLabel}>Kategori Pembelian</Text>
          <Pressable
            style={styles.categorySelectButton}
            onPress={openCategoryModal}
          >
            <View style={styles.categorySelectButtonInfo}>
              <Text style={styles.categorySelectButtonLabel}>Pilih kategori dari backend</Text>
              <Text style={styles.categorySelectButtonValue}>
                {selectedCategory?.name || 'Belum memilih kategori'}
              </Text>
            </View>
            <Text style={styles.categorySelectButtonAction}>Buka Popup</Text>
          </Pressable>
          {isCategoriesLoading ? (
            <Text style={styles.helperText}>Sedang memuat kategori pembelian...</Text>
          ) : purchaseCategories.length === 0 ? (
            <Text style={styles.helperText}>Belum ada kategori pembelian aktif dari backend. Form belum bisa dipakai sebelum admin melengkapinya.</Text>
          ) : null}
          <View style={styles.categoryInfoCard}>
            <Text style={styles.categoryInfoTitle}>{selectedCategory?.name || 'Belum memilih kategori'}</Text>
            <Text style={styles.categoryInfoMeta}>
              {selectedCategory
                ? `${resolveCategoryTypeLabel(selectedCategory?.type)} - ${resolveCategoryFlowLabel(selectedCategory?.flow)}`
                : 'Kasir wajib memilih kategori yang dibuat admin di backend.'}
            </Text>
            <Text style={styles.categoryInfoText}>
              {selectedCategory?.description || 'Pilih kategori dari popup backend dulu. Setelah itu kasir baru bisa menambah item belanja atau request bahan.'}
            </Text>
            {isMaterialFlow ? (
              <Text style={styles.helperText}>
                Harga bahan di bawah akan diambil otomatis dari histori pembelian gudang dan tidak bisa diubah manual dari POS.
              </Text>
            ) : hasCategoryItemOptions ? (
              <Text style={styles.helperText}>
                Kategori ini punya {categoryItemRows.length} item popup dari backend. Setelah kategori dipilih, kasir tinggal memilih item dari popup tanpa mengetik nama barang manual.
              </Text>
            ) : null}
          </View>
        </View>

        {selectedCategory && !isMaterialFlow ? (
          <View style={styles.paymentCard}>
            <Text style={styles.sectionLabel}>Status & Sumber Pembayaran</Text>
            <View style={styles.paymentStatusRow}>
              <Pressable
                style={[styles.paymentStatusChip, paymentStatus === 'paid' ? styles.paymentStatusChipActive : null]}
                onPress={() => setPaymentStatus('paid')}
                disabled={isSubmitting}
              >
                <Text style={[styles.paymentStatusText, paymentStatus === 'paid' ? styles.paymentStatusTextActive : null]}>
                  Sudah Dibayar
                </Text>
              </Pressable>
              <Pressable
                style={[styles.paymentStatusChip, paymentStatus === 'unpaid' ? styles.paymentStatusChipActive : null]}
                onPress={() => setPaymentStatus('unpaid')}
                disabled={isSubmitting}
              >
                <Text style={[styles.paymentStatusText, paymentStatus === 'unpaid' ? styles.paymentStatusTextActive : null]}>
                  Tempo / Hutang
                </Text>
              </Pressable>
            </View>
            {paymentStatus === 'paid' ? (
              <>
                <Text style={styles.paymentHelper}>Pilih sumber pembayaran yang benar. Akun ini akan dikredit pada jurnal belanja.</Text>
                <View style={styles.paymentAccountWrap}>
                  {isPaymentAccountsLoading ? (
                    <Text style={styles.helperText}>Sedang memuat akun pembayaran...</Text>
                  ) : paymentAccounts.length > 0 ? paymentAccounts.map((row) => {
                    const active = Number(row.id) === Number(selectedPaymentAccountId || 0);
                    return (
                      <Pressable
                        key={`purchase-payment-${row.id}`}
                        style={[styles.paymentAccountChip, active ? styles.paymentAccountChipActive : null]}
                        onPress={() => setSelectedPaymentAccountId(row.id)}
                        disabled={isSubmitting}
                      >
                        <Text style={[styles.paymentAccountTitle, active ? styles.paymentAccountTitleActive : null]}>
                          {row.display_label}
                        </Text>
                        <Text style={[styles.paymentAccountMeta, active ? styles.paymentAccountMetaActive : null]}>
                          {row.payment_method_name || row.payment_method_code || 'Metode pembayaran'}
                        </Text>
                      </Pressable>
                    );
                  }) : (
                    <Text style={styles.helperText}>Belum ada akun pembayaran aktif yang terhubung ke accounting.</Text>
                  )}
                </View>
              </>
            ) : (
              <Text style={styles.paymentHelper}>Belanja akan dicatat sebagai hutang dan tidak mengurangi kas/bank saat ini.</Text>
            )}
          </View>
        ) : null}

        <View style={styles.selectorToolbar}>
          {isMaterialFlow ? (
            <Pressable
              style={[styles.productButton, !selectedCategory ? styles.submitButtonDisabled : null]}
              onPress={openMaterialModal}
              disabled={!selectedCategory}
            >
              <Text style={styles.productButtonText}>Pilih Produk / Bahan</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.productButton, !selectedCategory ? styles.submitButtonDisabled : null]}
              onPress={handleAddManualItem}
              disabled={!selectedCategory}
            >
              <Text style={styles.productButtonText}>
                {hasCategoryItemOptions ? 'Pilih Item Belanja' : 'Tambah Item Belanja Manual'}
              </Text>
            </Pressable>
          )}
          <View style={styles.selectorSummary}>
            <Text style={styles.selectorSummaryLabel}>Item Draft</Text>
            <Text style={styles.selectorSummaryValue}>{draftItems.length}</Text>
          </View>
        </View>

        <TextInput
          value={noteInput}
          onChangeText={setNoteInput}
          placeholder="Catatan pembelian jika ada..."
          placeholderTextColor="#7a7a7a"
          multiline
          style={[styles.input, styles.noteInput]}
        />

        {draftItems.length > 0 ? (
          <View style={styles.itemsTable}>
            {draftItems.map((row) => {
              const isTemplateRow = !isMaterialFlow && Number(row?.purchase_category_item_id || 0) > 0;
              const isWarehouseRow = isMaterialFlow && Number(row?.warehouse_product_id || 0) > 0;
              const isEditableName = !isWarehouseRow && !isTemplateRow;
              return (
                <View key={row.id} style={styles.itemCard}>
                  <View style={styles.itemCardHeader}>
                    <View style={styles.itemCardInfo}>
                      {isEditableName ? (
                        <>
                          <Text style={styles.label}>Nama Barang / Material</Text>
                          <TextInput
                            value={String(row?.material_name || '')}
                            onChangeText={(value) => updateDraftItemField(row.id, 'material_name', value)}
                            placeholder="Tulis nama item..."
                            placeholderTextColor="#7a7a7a"
                            style={styles.input}
                          />
                        </>
                      ) : (
                        <>
                          <Text style={styles.itemTitle}>{row.material_name || '-'}</Text>
                          <Text style={styles.itemMeta}>
                            {isWarehouseRow
                              ? `${row.sku ? `${row.sku} | ` : ''}${row.specification || row.uom || '-'}`
                              : `${row.specification || 'Item backend'}${row.uom ? ` | Satuan default: ${row.uom}` : ''}`}
                          </Text>
                        </>
                      )}
                    </View>
                    <Pressable style={styles.removeButton} onPress={() => handleRemoveItem(row.id)}>
                      <Text style={styles.removeButtonText}>Hapus</Text>
                    </Pressable>
                  </View>

                  <View style={styles.inlineRow}>
                    <View style={styles.inlineField}>
                      <Text style={styles.label}>Qty</Text>
                      <TextInput
                        value={String(row.qty || '')}
                        onChangeText={(value) => updateDraftItemField(row.id, 'qty', sanitizeQtyInput(value))}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#7a7a7a"
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.inlineField}>
                      <Text style={styles.label}>Satuan</Text>
                      {isWarehouseRow ? (
                        <View style={styles.readOnlyBox}>
                          <Text style={styles.readOnlyText}>{row.uom || '-'}</Text>
                        </View>
                      ) : (
                        <TextInput
                          value={String(row.uom || '')}
                          onChangeText={(value) => updateDraftItemField(row.id, 'uom', value)}
                          placeholder="unit"
                          placeholderTextColor="#7a7a7a"
                          style={styles.input}
                        />
                      )}
                    </View>
                    <View style={styles.inlineFieldWide}>
                      <Text style={styles.label}>{isWarehouseRow ? 'Harga Gudang' : 'Harga Satuan'}</Text>
                      {isWarehouseRow ? (
                        <View style={styles.readOnlyBox}>
                          <Text style={styles.readOnlyText}>
                            {row.price_missing ? 'Harga belum tersedia' : formatRupiah(row.unit_price || 0)}
                          </Text>
                        </View>
                      ) : (
                        <TextInput
                          value={String(row.unit_price ? row.unit_price : '')}
                          onChangeText={(value) => updateDraftItemField(row.id, 'unit_price', sanitizeCurrencyInput(value))}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#7a7a7a"
                          style={styles.input}
                        />
                      )}
                    </View>
                  </View>

                  <Text style={styles.itemSubtotal}>Subtotal: {formatRupiah(row.subtotal)}</Text>
                  {isWarehouseRow && row.price_missing ? (
                    <Text style={styles.helperText}>
                      Harga bahan ini belum tersedia di histori pembelian gudang. Terima pembelian gudang dulu sebelum request bahan ini dibuat.
                    </Text>
                  ) : null}
                </View>
              );
            })}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Nominal Request</Text>
              <Text style={styles.totalValue}>{formatRupiah(draftTotalAmount)}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.helperText}>
            {!selectedCategory
              ? 'Pilih kategori dari backend dulu lewat popup di atas, baru tambahkan item pembelian.'
              : isMaterialFlow
              ? 'Belum ada bahan yang dipilih. Klik `Pilih Produk / Bahan` untuk membuka popup dan memilih beberapa bahan sekaligus.'
              : hasCategoryItemOptions
              ? 'Belum ada item belanja yang dipilih. Popup item backend akan muncul untuk kategori ini, lalu kasir tinggal pilih item yang dibutuhkan.'
              : 'Belum ada item belanja. Klik `Tambah Item Belanja Manual` bila kategori ini belum punya daftar item popup dari backend.'}
          </Text>
        )}

        <Pressable
          style={[styles.submitButton, (draftItems.length === 0 || hasInvalidDraft || isSubmitting) ? styles.submitButtonDisabled : null]}
          onPress={handleSubmit}
          disabled={draftItems.length === 0 || hasInvalidDraft || isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Menyimpan...' : 'Submit Pembelian'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.contentGrid}>
        <View style={styles.contentColumn}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>List Belanja / Request</Text>
            {isRequestsLoading ? (
              <Text style={styles.helperText}>Sedang memuat daftar pembelian...</Text>
            ) : requestRows.length > 0 ? (
              requestRows.map((row) => {
                const active = String(selectedRequestId || '') === String(row?.id || '');
                return (
                  <Pressable
                    key={`purchase-row-${row?.id || row?.request_no}`}
                    style={[styles.requestCard, active ? styles.requestCardActive : null]}
                    onPress={() => setSelectedRequestId(String(row?.id || ''))}
                  >
                    <View style={styles.requestCardHeader}>
                      <Text style={styles.requestTitle}>{row?.request_no || '-'}</Text>
                      <View style={[styles.statusBadge, resolveStatusTone(row?.status)]}>
                        <Text style={styles.statusBadgeText}>{row?.status_label || row?.status || '-'}</Text>
                      </View>
                    </View>
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryPillText}>{row?.purchase_category_name || '-'}</Text>
                    </View>
                    <Text style={styles.requestMeta}>{formatDateLabel(row?.created_at)}</Text>
                    <Text style={styles.requestMeta}>Requester: {row?.requester?.name || '-'}</Text>
                    <Text style={styles.requestTotal}>{formatRupiah(row?.total_amount || 0)}</Text>
                    {row?.note ? <Text style={styles.requestNote}>{row.note}</Text> : null}
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.helperText}>Belum ada belanja atau request bahan yang tercatat.</Text>
            )}
          </View>
        </View>

        <View style={styles.contentColumn}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Detail Belanja / Request</Text>
            {isDetailLoading ? (
              <Text style={styles.helperText}>Sedang memuat detail pembelian...</Text>
            ) : selectedDetail ? (
              <>
                <View style={styles.requestCardHeader}>
                  <Text style={styles.detailTitle}>{selectedDetail?.request_no || '-'}</Text>
                  <View style={[styles.statusBadge, resolveStatusTone(selectedDetail?.status)]}>
                    <Text style={styles.statusBadgeText}>{selectedDetail?.status_label || selectedDetail?.status || '-'}</Text>
                  </View>
                </View>
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>{selectedDetail?.purchase_category_name || '-'}</Text>
                </View>
                <Text style={styles.requestMeta}>Tanggal: {formatDateLabel(selectedDetail?.created_at)}</Text>
                <Text style={styles.requestMeta}>Requester: {selectedDetail?.requester?.name || '-'}</Text>
                <Text style={styles.requestMeta}>Gudang: {selectedDetail?.warehouse?.name || '-'}</Text>
                <Text style={styles.requestMeta}>Catatan: {selectedDetail?.note || '-'}</Text>
                <View style={styles.detailDivider} />
                {Array.isArray(selectedDetail?.items) && selectedDetail.items.length > 0 ? selectedDetail.items.map((item) => (
                  <View key={`detail-item-${item?.id || item?.material_id}`} style={styles.detailItemRow}>
                    <View style={styles.detailItemInfo}>
                      <Text style={styles.itemTitle}>{item?.material_name || '-'}</Text>
                      <Text style={styles.itemMeta}>
                        {item?.qty || 0} {item?.uom || '-'} x {formatRupiah(item?.unit_price || 0)}
                      </Text>
                    </View>
                    <Text style={styles.itemSubtotal}>{formatRupiah(item?.subtotal || 0)}</Text>
                  </View>
                )) : (
                  <Text style={styles.helperText}>Belum ada item detail yang tersedia.</Text>
                )}
                <View style={styles.totalCard}>
                  <Text style={styles.totalLabel}>Total Nominal</Text>
                  <Text style={styles.totalValue}>{formatRupiah(selectedDetail?.total_amount || 0)}</Text>
                </View>
                {selectedDetail?.backend_detail_todo ? (
                  <Text style={styles.todoInlineText}>
                    TODO backend: endpoint detail nominal pembelian untuk semua kategori masih mengandalkan metadata lokal.
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.helperText}>Pilih salah satu belanja atau request dari list untuk melihat detailnya.</Text>
            )}
          </View>
        </View>
      </View>

      <Modal
        visible={isCategoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCategoryModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropDismiss} onPress={closeCategoryModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Pilih Kategori Backend</Text>
              <Pressable style={styles.modalCloseButton} onPress={closeCategoryModal}>
                <Text style={styles.modalCloseButtonText}>Tutup</Text>
              </Pressable>
            </View>

            <Text style={styles.modalHelperText}>
              Kasir hanya boleh memilih kategori pembelian yang dibuat admin di backend. Tidak ada input kategori manual di POS.
            </Text>

            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {isCategoriesLoading ? (
                <Text style={styles.helperText}>Sedang memuat kategori pembelian...</Text>
              ) : purchaseCategories.length > 0 ? (
                purchaseCategories.map((row) => {
                  const active = String(row?.code || '') === String(selectedCategoryCode || '');
                  return (
                    <Pressable
                      key={`modal-category-${row?.code}`}
                      style={[styles.modalOption, active ? styles.modalOptionActive : null]}
                      onPress={() => handleCategoryChange(row?.code)}
                    >
                      <View style={styles.modalOptionMain}>
                        <Text style={[styles.modalOptionTitle, active ? styles.modalOptionTitleActive : null]}>
                          {row?.name || '-'}
                        </Text>
                        <Text style={[styles.modalOptionMeta, active ? styles.modalOptionMetaActive : null]}>
                          {resolveCategoryTypeLabel(row?.type)} - {resolveCategoryFlowLabel(row?.flow)}
                        </Text>
                        <Text style={[styles.modalOptionMeta, active ? styles.modalOptionMetaActive : null]}>
                          {row?.description || '-'}
                        </Text>
                      </View>
                      <View style={[styles.checkBadge, active ? styles.checkBadgeActive : null]}>
                        <Text style={[styles.checkBadgeText, active ? styles.checkBadgeTextActive : null]}>
                          {active ? 'Terpilih' : 'Pilih'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.helperText}>Belum ada kategori pembelian aktif dari backend.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isCategoryItemModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCategoryItemModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropDismiss} onPress={closeCategoryItemModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Pilih Item Belanja Backend</Text>
              <Pressable style={styles.modalCloseButton} onPress={closeCategoryItemModal}>
                <Text style={styles.modalCloseButtonText}>Tutup</Text>
              </Pressable>
            </View>

            <Text style={styles.modalHelperText}>
              Kasir tinggal memilih item yang sudah dibuat admin di backend untuk kategori {selectedCategory?.name || 'ini'}.
            </Text>

            <TextInput
              value={categoryItemSearch}
              onChangeText={setCategoryItemSearch}
              placeholder="Cari item belanja..."
              placeholderTextColor="#7a7a7a"
              style={styles.input}
            />

            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {filteredCategoryItems.length > 0 ? (
                filteredCategoryItems.map((row) => {
                  const itemId = String(row?.id || '');
                  const active = selectedCategoryItemIds.includes(itemId);
                  return (
                    <Pressable
                      key={`modal-category-item-${itemId || row?.code}`}
                      style={[styles.modalOption, active ? styles.modalOptionActive : null]}
                      onPress={() => toggleCategoryItemSelection(itemId)}
                    >
                      <View style={styles.modalOptionMain}>
                        <Text style={[styles.modalOptionTitle, active ? styles.modalOptionTitleActive : null]}>
                          {row?.name || '-'}
                        </Text>
                        <Text style={[styles.modalOptionMeta, active ? styles.modalOptionMetaActive : null]}>
                          Satuan default: {row?.default_uom || 'unit'}
                        </Text>
                        <Text style={[styles.modalOptionMeta, active ? styles.modalOptionMetaActive : null]}>
                          {row?.description || 'Item popup dari backend'}
                        </Text>
                      </View>
                      <View style={[styles.checkBadge, active ? styles.checkBadgeActive : null]}>
                        <Text style={[styles.checkBadgeText, active ? styles.checkBadgeTextActive : null]}>
                          {active ? 'Terpilih' : 'Pilih'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.helperText}>Belum ada item backend yang cocok dengan pencarian.</Text>
              )}
            </ScrollView>

            <View style={styles.modalFooterRow}>
              <Pressable style={styles.modalSecondaryButton} onPress={closeCategoryItemModal}>
                <Text style={styles.modalSecondaryButtonText}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, selectedCategoryItemCount === 0 ? styles.submitButtonDisabled : null]}
                onPress={handleApplySelectedCategoryItems}
                disabled={selectedCategoryItemCount === 0}
              >
                <Text style={styles.modalPrimaryButtonText}>
                  Tambahkan {selectedCategoryItemCount > 0 ? `${selectedCategoryItemCount} Item` : 'Item'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isMaterialModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMaterialModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropDismiss} onPress={closeMaterialModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Pilih Bahan Gudang</Text>
              <Pressable style={styles.modalCloseButton} onPress={closeMaterialModal}>
                <Text style={styles.modalCloseButtonText}>Tutup</Text>
              </Pressable>
            </View>

            <Text style={styles.modalHelperText}>
              Pilih beberapa bahan sekaligus, lalu tambahkan ke draft pembelian/request gudang.
            </Text>

            <TextInput
              value={materialSearch}
              onChangeText={setMaterialSearch}
              placeholder="Cari bahan, SKU, atau spesifikasi..."
              placeholderTextColor="#7a7a7a"
              style={styles.input}
            />

            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {isMaterialsLoading ? (
                  <Text style={styles.helperText}>Sedang memuat daftar material gudang...</Text>
              ) : filteredMaterials.length > 0 ? (
                filteredMaterials.map((row) => {
                  const materialId = String(row?.material_id || row?.id || '');
                  const active = selectedMaterialIds.includes(materialId);
                  const canSelect = Number(row?.unit_price || 0) > 0 && !row?.price_missing;
                  return (
                    <Pressable
                      key={`modal-material-${materialId}`}
                      style={[
                        styles.modalOption,
                        active ? styles.modalOptionActive : null,
                        !canSelect ? styles.modalOptionDisabled : null,
                      ]}
                      onPress={() => {
                        if (canSelect) {
                          toggleMaterialSelection(materialId);
                        }
                      }}
                    >
                      <View style={styles.modalOptionMain}>
                        <Text style={[styles.modalOptionTitle, active ? styles.modalOptionTitleActive : null]}>
                          {row?.material_name || '-'}
                        </Text>
                        <Text style={[styles.modalOptionMeta, active ? styles.modalOptionMetaActive : null]}>
                          {row?.sku ? `${row.sku} | ` : ''}{row?.specification || row?.uom || '-'}
                        </Text>
                        <Text style={[styles.modalOptionMeta, active ? styles.modalOptionMetaActive : null]}>
                          {canSelect ? `Harga gudang: ${formatRupiah(row?.unit_price || 0)}` : 'Harga gudang belum tersedia'}
                        </Text>
                      </View>
                      <View style={[styles.checkBadge, active ? styles.checkBadgeActive : null, !canSelect ? styles.checkBadgeDisabled : null]}>
                        <Text style={[styles.checkBadgeText, active ? styles.checkBadgeTextActive : null]}>
                          {!canSelect ? 'Belum Ada Harga' : (active ? 'Terpilih' : 'Pilih')}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.helperText}>Belum ada material yang cocok dengan pencarian.</Text>
              )}
            </ScrollView>

            <View style={styles.modalFooterRow}>
              <Pressable style={styles.modalSecondaryButton} onPress={closeMaterialModal}>
                <Text style={styles.modalSecondaryButtonText}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, selectedMaterialCount === 0 ? styles.submitButtonDisabled : null]}
                onPress={handleApplySelectedMaterials}
                disabled={selectedMaterialCount === 0}
              >
                <Text style={styles.modalPrimaryButtonText}>
                  Tambahkan {selectedMaterialCount > 0 ? `${selectedMaterialCount} Bahan` : 'Bahan'}
                </Text>
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
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    flexWrap: 'wrap',
  },
  headerInfo: {
    flex: 1,
    minWidth: 260,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#102a43',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    color: '#486581',
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  todoCard: {
    borderWidth: 1,
    borderColor: '#f7b955',
    backgroundColor: '#fff7e6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  todoText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#8a5a00',
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#102a43',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 11,
    color: '#52606d',
    marginBottom: 4,
  },
  categorySection: {
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334e68',
  },
  categorySelectButton: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    backgroundColor: '#f8fbff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  categorySelectButtonInfo: {
    marginBottom: 8,
  },
  categorySelectButtonLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#627d98',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  categorySelectButtonValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#243b53',
  },
  categorySelectButtonAction: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '900',
    color: '#2250c9',
  },
  categoryInfoCard: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  categoryInfoTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#102a43',
    marginBottom: 4,
  },
  categoryInfoMeta: {
    fontSize: 10,
    fontWeight: '800',
    color: '#335c9b',
    marginBottom: 4,
  },
  categoryInfoText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#52606d',
  },
  paymentCard: {
    borderWidth: 1,
    borderColor: '#d6e3f7',
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  paymentStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  paymentStatusChip: {
    borderWidth: 1,
    borderColor: '#cbd2d9',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  paymentStatusChipActive: {
    borderColor: '#146c55',
    backgroundColor: '#def7ec',
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#52606d',
  },
  paymentStatusTextActive: {
    color: '#0f5132',
  },
  paymentHelper: {
    fontSize: 11,
    lineHeight: 16,
    color: '#52606d',
    marginBottom: 8,
  },
  paymentAccountWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentAccountChip: {
    minWidth: 180,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  paymentAccountChipActive: {
    borderColor: '#2250c9',
    backgroundColor: '#eef4ff',
  },
  paymentAccountTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#243b53',
  },
  paymentAccountTitleActive: {
    color: '#133ea3',
  },
  paymentAccountMeta: {
    fontSize: 10,
    color: '#627d98',
    marginTop: 2,
  },
  paymentAccountMetaActive: {
    color: '#335c9b',
  },
  selectorToolbar: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 10,
  },
  productButton: {
    flexGrow: 1,
    minWidth: 220,
    borderWidth: 1,
    borderColor: '#2250c9',
    backgroundColor: '#eef4ff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#133ea3',
  },
  selectorSummary: {
    minWidth: 110,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorSummaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#52606d',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  selectorSummaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#102a43',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd2d9',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: '#102a43',
    marginBottom: 10,
  },
  noteInput: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334e68',
    marginBottom: 5,
  },
  itemsTable: {
    gap: 10,
    marginBottom: 10,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#e4e7eb',
    backgroundColor: '#fbfdff',
    borderRadius: 12,
    padding: 12,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemCardInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#102a43',
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 11,
    color: '#52606d',
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  inlineField: {
    flex: 1,
    minWidth: 110,
  },
  inlineFieldWide: {
    flex: 1.4,
    minWidth: 160,
  },
  readOnlyBox: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  readOnlyText: {
    fontSize: 12,
    color: '#243b53',
    fontWeight: '700',
  },
  itemSubtotal: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '900',
    color: '#1f2933',
  },
  removeButton: {
    borderWidth: 1,
    borderColor: '#f4c1c1',
    backgroundColor: '#fff5f5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeButtonText: {
    color: '#c53030',
    fontSize: 11,
    fontWeight: '800',
  },
  totalCard: {
    borderWidth: 1,
    borderColor: '#bcd2ff',
    backgroundColor: '#eef4ff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#335c9b',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#133ea3',
  },
  helperText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#627d98',
  },
  submitButton: {
    borderRadius: 12,
    backgroundColor: '#1f6feb',
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  contentGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  contentColumn: {
    flex: 1,
    minWidth: 300,
  },
  requestCard: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  requestCardActive: {
    borderColor: '#2250c9',
    backgroundColor: '#f5f8ff',
  },
  requestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  requestTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#102a43',
  },
  requestMeta: {
    fontSize: 11,
    color: '#52606d',
    marginBottom: 4,
  },
  requestTotal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#133ea3',
    marginBottom: 4,
  },
  requestNote: {
    fontSize: 11,
    color: '#334e68',
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#102a43',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusSuccess: {
    backgroundColor: '#e6f6ec',
  },
  statusDanger: {
    backgroundColor: '#fde8e8',
  },
  statusWarning: {
    backgroundColor: '#fff4d9',
  },
  statusMuted: {
    backgroundColor: '#edf2f7',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#243b53',
  },
  categoryPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#ecfdf3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 6,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#12724f',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#e4e7eb',
    marginVertical: 10,
  },
  detailItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  detailItemInfo: {
    flex: 1,
  },
  todoInlineText: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: '#8a5a00',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalBackdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '82%',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#102a43',
  },
  modalCloseButton: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modalCloseButtonText: {
    color: '#243b53',
    fontSize: 11,
    fontWeight: '800',
  },
  modalHelperText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#627d98',
    marginBottom: 10,
  },
  modalList: {
    flexGrow: 0,
  },
  modalListContent: {
    gap: 8,
    paddingBottom: 10,
  },
  modalOption: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  modalOptionActive: {
    borderColor: '#2250c9',
    backgroundColor: '#eef4ff',
  },
  modalOptionDisabled: {
    opacity: 0.55,
    backgroundColor: '#f8fafc',
  },
  modalOptionMain: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#102a43',
    marginBottom: 2,
  },
  modalOptionTitleActive: {
    color: '#133ea3',
  },
  modalOptionMeta: {
    fontSize: 11,
    color: '#52606d',
  },
  modalOptionMetaActive: {
    color: '#335c9b',
  },
  checkBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  checkBadgeActive: {
    backgroundColor: '#2250c9',
    borderColor: '#2250c9',
  },
  checkBadgeDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#d9e2ec',
  },
  checkBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#243b53',
  },
  checkBadgeTextActive: {
    color: '#ffffff',
  },
  modalFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  modalSecondaryButton: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalSecondaryButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#243b53',
  },
  modalPrimaryButton: {
    borderRadius: 10,
    backgroundColor: '#1f6feb',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalPrimaryButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },
});

export default PurchaseMaterialPanel;
