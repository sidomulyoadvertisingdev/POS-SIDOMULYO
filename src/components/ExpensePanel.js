import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  createPosCashFlow,
  fetchPosBankAccounts,
  getPengeluaranCategoryOptions,
} from '../services/erpApi';
import { formatRupiah } from '../utils/currency';

const todayIso = () => new Date().toISOString().slice(0, 10);

const toSafeText = (value) => String(value || '').trim();

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toLabel = (...values) => {
  for (const value of values) {
    const text = toSafeText(value);
    if (text) {
      return text;
    }
  }
  return '';
};

const normalizeText = (value) => toSafeText(value).toLowerCase();

const sanitizeCurrencyInput = (value) => String(value || '').replace(/[^\d]/g, '');

const parseCurrencyInput = (value) => Number(sanitizeCurrencyInput(value) || 0);

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(toSafeText(value));

const resolveCategoryTypeLabel = (value = '') => {
  const normalized = normalizeText(value);
  if (normalized === 'pengeluaran') {
    return 'Pengeluaran';
  }
  return toSafeText(value) || 'Kategori Backend';
};

const normalizeSourceAccountRow = (row) => {
  const paymentAccountId = Number(row?.payment_account_id || 0) || 0;
  const id = Number(
    paymentAccountId
    || row?.id
    || row?.bank_account_id
    || row?.account_id
    || 0,
  ) || 0;
  const accountingAccountId = Number(
    row?.accounting_account_id
    || row?.bank_account_id
    || row?.account_id
    || (!paymentAccountId ? row?.id : 0)
    || 0,
  ) || 0;
  const label = toLabel(
    row?.label,
    row?.payment_label,
  );
  const code = toLabel(
    row?.code,
    row?.kode_akun,
  );
  const bankName = toLabel(
    row?.bank_name,
    row?.bank,
    row?.bank_label,
  );
  const accountName = toLabel(
    row?.name,
    row?.account_name,
    row?.holder_name,
    row?.account_holder,
    row?.label,
    row?.title,
  );
  const accountNumber = toLabel(
    row?.account_number,
    row?.no_rekening,
    row?.rekening,
    row?.number,
  );
  const detail = toLabel(
    row?.detail,
    row?.payment_detail,
    row?.description,
    row?.keterangan,
  );
  const displayTitle = [code, accountName].filter(Boolean).join(' - ')
    || accountName
    || bankName
    || label
    || `Akun #${id}`;
  const subtitleParts = [];
  if (bankName && !displayTitle.toLowerCase().includes(bankName.toLowerCase())) {
    subtitleParts.push(bankName);
  }
  if (accountNumber) {
    subtitleParts.push(`No Rek: ${accountNumber}`);
  }
  const displaySubtitle = subtitleParts.join(' | ');
  const displayDetail = detail && detail !== displaySubtitle ? detail : '';

  return {
    ...row,
    id,
    paymentAccountId,
    accountingAccountId,
    label,
    code,
    bankName,
    accountName,
    accountNumber,
    detail,
    displayTitle,
    displaySubtitle,
    displayDetail,
    displayName: label || displayTitle,
  };
};

const matchesCategorySearch = (row, keyword) => {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) {
    return true;
  }
  const haystacks = [
    row?.name,
    row?.code,
    row?.type,
    row?.description,
  ].map((value) => normalizeText(value));
  return haystacks.some((value) => value.includes(normalizedKeyword));
};

const ExpensePanel = ({ isActive, onNotify }) => {
  const [expenseDate, setExpenseDate] = useState(todayIso());
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedCategoryItemId, setSelectedCategoryItemId] = useState(null);
  const [selectedSourceAccountId, setSelectedSourceAccountId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [expenseCategories, setExpenseCategories] = useState([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [sourceAccounts, setSourceAccounts] = useState([]);
  const [isAccountsLoading, setIsAccountsLoading] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isCategoryItemModalVisible, setIsCategoryItemModalVisible] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryItemSearch, setCategoryItemSearch] = useState('');

  const selectedCategory = useMemo(() => (
    expenseCategories.find((row) => Number(row?.id || 0) === Number(selectedCategoryId || 0)) || null
  ), [expenseCategories, selectedCategoryId]);

  const categoryItemRows = useMemo(() => (
    (Array.isArray(selectedCategory?.items) ? selectedCategory.items : [])
      .filter((row) => row?.is_active !== false)
  ), [selectedCategory]);

  const selectedCategoryItem = useMemo(() => (
    categoryItemRows.find((row) => Number(row?.id || 0) === Number(selectedCategoryItemId || 0)) || null
  ), [categoryItemRows, selectedCategoryItemId]);

  const selectedSourceAccount = useMemo(() => (
    sourceAccounts.find((row) => {
      const rowId = Number(row?.id || 0) || 0;
      return rowId > 0 && rowId === Number(selectedSourceAccountId || 0);
    }) || null
  ), [selectedSourceAccountId, sourceAccounts]);

  const filteredExpenseCategories = useMemo(() => (
    expenseCategories.filter((row) => matchesCategorySearch(row, categorySearch))
  ), [categorySearch, expenseCategories]);

  const filteredCategoryItems = useMemo(() => (
    categoryItemRows.filter((row) => matchesCategorySearch(row, categoryItemSearch))
  ), [categoryItemRows, categoryItemSearch]);

  const amountValue = parseCurrencyInput(amountInput);

  const loadMasterData = async () => {
    setIsCategoriesLoading(true);
    setIsAccountsLoading(true);
    const [categoriesResult, accountsResult] = await Promise.allSettled([
      getPengeluaranCategoryOptions(),
      fetchPosBankAccounts({
        context: 'expense',
        allowedTypes: ['cash', 'bank_transfer', 'qris', 'e_wallet'],
      }),
    ]);

    if (categoriesResult.status === 'fulfilled') {
      const nextCategories = (Array.isArray(categoriesResult.value) ? categoriesResult.value : [])
        .filter((row) => row?.is_active !== false)
        .sort((left, right) => {
          const leftOrder = Number(left?.sort_order || 0) || 0;
          const rightOrder = Number(right?.sort_order || 0) || 0;
          if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
          }
          return String(left?.name || '').localeCompare(String(right?.name || ''), 'id');
        });
      setExpenseCategories(nextCategories);
      setSelectedCategoryId((currentId) => {
        const resolvedCurrentId = Number(currentId || 0) || 0;
        if (resolvedCurrentId > 0 && nextCategories.some((row) => Number(row?.id || 0) === resolvedCurrentId)) {
          return resolvedCurrentId;
        }
        return null;
      });
      setSelectedCategoryItemId((currentId) => {
        const resolvedCategoryId = Number(selectedCategoryId || 0) || 0;
        const resolvedItemId = Number(currentId || 0) || 0;
        if (!(resolvedCategoryId > 0) || !(resolvedItemId > 0)) {
          return null;
        }
        const matchedCategory = nextCategories.find((row) => Number(row?.id || 0) === resolvedCategoryId) || null;
        const matchedItem = (Array.isArray(matchedCategory?.items) ? matchedCategory.items : [])
          .find((row) => Number(row?.id || 0) === resolvedItemId) || null;
        return matchedItem ? resolvedItemId : null;
      });
    } else {
      setExpenseCategories([]);
      setSelectedCategoryId(null);
      setSelectedCategoryItemId(null);
      onNotify?.('Pengeluaran', `Gagal memuat kategori pengeluaran: ${categoriesResult.reason?.message || 'Terjadi kesalahan.'}`);
    }

    if (accountsResult.status === 'fulfilled') {
      const nextAccounts = (Array.isArray(accountsResult.value) ? accountsResult.value : [])
        .map((row) => normalizeSourceAccountRow(row))
        .filter((row) => Number(row?.accountingAccountId || row?.id || 0) > 0);
      setSourceAccounts(nextAccounts);
      setSelectedSourceAccountId((currentId) => {
        const resolvedCurrentId = Number(currentId || 0) || 0;
        if (resolvedCurrentId > 0 && nextAccounts.some((row) => Number(row?.id || 0) === resolvedCurrentId)) {
          return resolvedCurrentId;
        }
        return Number(nextAccounts[0]?.id || 0) || null;
      });
    } else {
      setSourceAccounts([]);
      setSelectedSourceAccountId(null);
      onNotify?.('Pengeluaran', `Gagal memuat akun kas / bank: ${accountsResult.reason?.message || 'Terjadi kesalahan.'}`);
    }

    setIsCategoriesLoading(false);
    setIsAccountsLoading(false);
  };

  const openCategoryModal = async () => {
    if (!expenseCategories.length && !isCategoriesLoading) {
      await loadMasterData();
    }
    setCategorySearch('');
    setIsCategoryModalVisible(true);
  };

  const closeCategoryModal = () => {
    setIsCategoryModalVisible(false);
    setCategorySearch('');
  };

  const openCategoryItemModal = () => {
    if (!selectedCategory) {
      openCategoryModal();
      return;
    }
    if (!categoryItemRows.length) {
      onNotify?.('Pengeluaran', 'Kategori ini belum punya daftar isi popup backend. Lengkapi dulu itemnya di backend bila ingin kasir memilih isi kategori dari popup.');
      return;
    }
    setCategoryItemSearch('');
    setIsCategoryItemModalVisible(true);
  };

  const closeCategoryItemModal = () => {
    setIsCategoryItemModalVisible(false);
    setCategoryItemSearch('');
  };

  const handleSelectCategory = (row) => {
    const nextId = Number(row?.id || 0) || null;
    if (!nextId) {
      return;
    }
    const nextItems = (Array.isArray(row?.items) ? row.items : []).filter((item) => item?.is_active !== false);
    setSelectedCategoryId(nextId);
    setSelectedCategoryItemId(null);
    closeCategoryModal();
    if (nextItems.length > 0) {
      setCategoryItemSearch('');
      setIsCategoryItemModalVisible(true);
    } else {
      closeCategoryItemModal();
    }
  };

  const handleSelectCategoryItem = (row) => {
    const nextId = Number(row?.id || 0) || null;
    if (!nextId) {
      return;
    }
    setSelectedCategoryItemId(nextId);
    closeCategoryItemModal();
  };

  const resetFormAfterSubmit = () => {
    setAmountInput('');
    setNoteInput('');
    setExpenseDate(todayIso());
  };

  const handleSubmitExpense = async () => {
    const occurredAt = toSafeText(expenseDate);
    if (!selectedCategory?.id) {
      onNotify?.('Pengeluaran', 'Pilih kategori pengeluaran dari popup backend terlebih dahulu.');
      return;
    }
    if (!selectedSourceAccount) {
      onNotify?.('Pengeluaran', 'Pilih akun kas / bank sumber pembayaran terlebih dahulu.');
      return;
    }
    if (!Number(selectedSourceAccount?.accountingAccountId || 0)) {
      onNotify?.('Pengeluaran', 'Akun sumber pembayaran belum terhubung ke akun accounting kas / bank / e-wallet.');
      return;
    }
    if (categoryItemRows.length > 0 && !selectedCategoryItem?.id) {
      onNotify?.('Pengeluaran', 'Pilih isi kategori pengeluaran dari popup backend terlebih dahulu.');
      return;
    }
    if (!isIsoDate(occurredAt)) {
      onNotify?.('Pengeluaran', 'Tanggal pengeluaran harus memakai format YYYY-MM-DD.');
      return;
    }
    if (!(amountValue > 0)) {
      onNotify?.('Pengeluaran', 'Nominal pengeluaran harus lebih besar dari 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        transaction_type: 'expense',
        occurred_at: occurredAt,
        amount: amountValue,
        note: toSafeText(noteInput) || null,
        purchase_category_id: Number(selectedCategory.id || 0) || null,
        purchase_category_code: toSafeText(selectedCategory.code) || null,
        purchase_category_item_id: Number(selectedCategoryItem?.id || 0) || null,
        payment_method_id: Number(selectedSourceAccount?.payment_method_id || 0) || null,
        payment_account_id: Number(selectedSourceAccount?.paymentAccountId || selectedSourceAccount?.payment_account_id || 0) || null,
        source_account_id: Number(selectedSourceAccount?.accountingAccountId || 0) || null,
      };
      await createPosCashFlow(payload);

      resetFormAfterSubmit();
      onNotify?.('Pengeluaran', 'Pengeluaran berhasil disimpan ke backend.');
    } catch (error) {
      onNotify?.('Pengeluaran', `Gagal menyimpan pengeluaran: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isActive) {
      return;
    }
    loadMasterData();
  }, [isActive]);

  useEffect(() => {
    if (!selectedCategoryItemId) {
      return;
    }
    const stillExists = categoryItemRows.some((row) => Number(row?.id || 0) === Number(selectedCategoryItemId || 0));
    if (!stillExists) {
      setSelectedCategoryItemId(null);
    }
  }, [categoryItemRows, selectedCategoryItemId]);

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Pengeluaran</Text>
          <Text style={styles.description}>
            Kasir mencatat pengeluaran langsung ke backend. Kategori wajib dipilih dari popup kategori backend, lalu jurnal akan mengikuti mapping yang sudah diatur admin.
          </Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={() => {
          loadMasterData();
        }}
        >
          <Text style={styles.refreshButtonText}>{isCategoriesLoading || isAccountsLoading ? 'Memuat...' : 'Refresh'}</Text>
        </Pressable>
      </View>

      <View style={styles.formCard}>
        <View style={styles.formHeaderRow}>
          <View style={styles.formHeaderInfo}>
            <Text style={styles.cardTitle}>Input Pengeluaran</Text>
            <Text style={styles.helperText}>
              Kasir tidak perlu mengisi kategori manual. Pilih kategori pengeluaran dari backend lalu simpan nominalnya.
            </Text>
          </View>
          <Pressable
            style={[styles.secondaryButton, isSubmitting ? styles.disabledButton : null]}
            onPress={() => {
              resetFormAfterSubmit();
              setSelectedCategoryId(null);
              setSelectedCategoryItemId(null);
              closeCategoryItemModal();
            }}
            disabled={isSubmitting}
          >
            <Text style={styles.secondaryButtonText}>Reset Form</Text>
          </Pressable>
        </View>

        <View style={styles.inlineRow}>
          <View style={styles.inlineField}>
            <Text style={styles.label}>Tanggal Pengeluaran</Text>
            <TextInput
              value={expenseDate}
              onChangeText={setExpenseDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#7a7a7a"
              style={styles.input}
              editable={!isSubmitting}
            />
          </View>
          <View style={styles.inlineField}>
            <Text style={styles.label}>Nominal</Text>
            <TextInput
              value={amountInput}
              onChangeText={(value) => setAmountInput(sanitizeCurrencyInput(value))}
              placeholder="0"
              placeholderTextColor="#7a7a7a"
              style={styles.input}
              keyboardType="numeric"
              editable={!isSubmitting}
            />
            <Text style={styles.amountPreviewText}>{amountValue > 0 ? formatRupiah(amountValue) : 'Nominal belum diisi'}</Text>
          </View>
        </View>

        <Text style={styles.label}>Kategori Pengeluaran Backend</Text>
        <Pressable
          style={[styles.selectorButton, isSubmitting ? styles.disabledButton : null]}
          onPress={openCategoryModal}
          disabled={isSubmitting}
        >
          <View style={styles.selectorInfo}>
            <Text style={styles.selectorLabel}>Pilih kategori dari backend</Text>
            <Text style={styles.selectorValue}>
              {selectedCategory?.name || 'Belum memilih kategori pengeluaran'}
            </Text>
          </View>
          <Text style={styles.selectorAction}>Buka Popup</Text>
        </Pressable>
        {isCategoriesLoading ? (
          <Text style={styles.helperText}>Sedang memuat kategori pengeluaran...</Text>
        ) : expenseCategories.length > 0 ? (
          <Text style={styles.helperText}>
            Kategori backend aktif: {expenseCategories.map((row) => String(row?.name || '').trim()).filter(Boolean).join(', ')}
          </Text>
        ) : (
          <Text style={styles.errorText}>Belum ada kategori pengeluaran aktif dari backend.</Text>
        )}

        <View style={styles.selectionInfoCard}>
          <Text style={styles.selectionInfoTitle}>{selectedCategory?.name || 'Belum memilih kategori'}</Text>
          <Text style={styles.selectionInfoMeta}>
            {selectedCategory
              ? `${resolveCategoryTypeLabel(selectedCategory?.type)} | ${selectedCategory?.code || '-'}`
              : 'Kasir hanya boleh memilih kategori yang dibuat admin di backend.'}
          </Text>
          {selectedCategory?.description ? (
            <Text style={styles.selectionInfoDescription}>{selectedCategory.description}</Text>
          ) : null}
        </View>

        {selectedCategory ? (
          <>
            <Text style={styles.label}>Isi Kategori Pengeluaran</Text>
            <Pressable
              style={[styles.selectorButton, isSubmitting ? styles.disabledButton : null]}
              onPress={openCategoryItemModal}
              disabled={isSubmitting}
            >
              <View style={styles.selectorInfo}>
                <Text style={styles.selectorLabel}>Pilih isi kategori dari backend</Text>
                <Text style={styles.selectorValue}>
                  {selectedCategoryItem?.name || (
                    categoryItemRows.length > 0
                      ? 'Belum memilih isi kategori pengeluaran'
                      : 'Kategori ini belum punya isi popup backend'
                  )}
                </Text>
              </View>
              <Text style={styles.selectorAction}>Buka Popup</Text>
            </Pressable>
            {categoryItemRows.length > 0 ? (
              <Text style={styles.helperText}>
                Isi kategori backend aktif: {categoryItemRows.map((row) => String(row?.name || '').trim()).filter(Boolean).join(', ')}
              </Text>
            ) : (
              <Text style={styles.helperText}>
                Kategori ini belum punya isi popup backend. Admin bisa menambahkannya di setting kategori backend.
              </Text>
            )}
            {selectedCategoryItem ? (
              <View style={styles.selectionInfoCard}>
                <Text style={styles.selectionInfoTitle}>{selectedCategoryItem.name}</Text>
                <Text style={styles.selectionInfoMeta}>{selectedCategoryItem.code || '-'}</Text>
                {selectedCategoryItem?.description ? (
                  <Text style={styles.selectionInfoDescription}>{selectedCategoryItem.description}</Text>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        <Text style={styles.label}>Akun Kas / Bank Sumber</Text>
        <View style={styles.accountChipWrap}>
          {isAccountsLoading ? (
            <Text style={styles.helperText}>Sedang memuat akun kas / bank...</Text>
          ) : sourceAccounts.length > 0 ? sourceAccounts.map((row) => {
            const accountKey = Number(row?.id || 0) || 0;
            const active = accountKey > 0 && accountKey === Number(selectedSourceAccountId || 0);
            return (
              <Pressable
                key={`expense-account-${accountKey}`}
                style={[styles.accountChip, active ? styles.accountChipActive : null]}
                onPress={() => setSelectedSourceAccountId(accountKey)}
                disabled={isSubmitting}
              >
                <Text style={[styles.accountChipTitle, active ? styles.accountChipTitleActive : null]}>
                  {String(row?.displayTitle || row?.displayName || row?.label || '-')}
                </Text>
                {row?.displaySubtitle ? (
                  <Text style={[styles.accountChipSubtitle, active ? styles.accountChipSubtitleActive : null]}>
                    {row.displaySubtitle}
                  </Text>
                ) : null}
              </Pressable>
            );
          }) : (
            <Text style={styles.errorText}>Belum ada akun kas / bank aktif yang bisa dipakai untuk pengeluaran.</Text>
          )}
        </View>

        <Text style={styles.label}>Catatan</Text>
        <TextInput
          value={noteInput}
          onChangeText={setNoteInput}
          placeholder="Opsional, misalnya keterangan pengeluaran"
          placeholderTextColor="#7a7a7a"
          style={[styles.input, styles.noteInput]}
          multiline
          numberOfLines={3}
          editable={!isSubmitting}
        />

        <Pressable
          style={[styles.primaryButton, isSubmitting ? styles.disabledButton : null]}
          onPress={handleSubmitExpense}
          disabled={isSubmitting}
        >
          <Text style={styles.primaryButtonText}>{isSubmitting ? 'Menyimpan...' : 'Simpan Pengeluaran ke Backend'}</Text>
        </Pressable>
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
              <Text style={styles.modalTitle}>Pilih Kategori Pengeluaran</Text>
              <Pressable style={styles.modalCloseButton} onPress={closeCategoryModal}>
                <Text style={styles.modalCloseButtonText}>Tutup</Text>
              </Pressable>
            </View>

            <Text style={styles.modalHelperText}>
              Kasir hanya boleh memilih kategori pengeluaran yang dibuat admin di backend.
            </Text>

            <TextInput
              value={categorySearch}
              onChangeText={setCategorySearch}
              placeholder="Cari kategori pengeluaran..."
              placeholderTextColor="#7a7a7a"
              style={styles.input}
            />

            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {isCategoriesLoading ? (
                <Text style={styles.helperText}>Sedang memuat kategori pengeluaran...</Text>
              ) : filteredExpenseCategories.length > 0 ? (
                filteredExpenseCategories.map((row) => {
                  const active = Number(row?.id || 0) === Number(selectedCategoryId || 0);
                  return (
                    <Pressable
                      key={`expense-category-${row?.id || row?.code}`}
                      style={[styles.modalOption, active ? styles.modalOptionActive : null]}
                      onPress={() => handleSelectCategory(row)}
                    >
                      <View style={styles.modalOptionHeader}>
                        <Text style={styles.modalOptionTitle}>{row?.name || '-'}</Text>
                        <Text style={[styles.modalOptionBadge, active ? styles.modalOptionBadgeActive : null]}>
                          {active ? 'Dipilih' : 'Backend'}
                        </Text>
                      </View>
                      <Text style={styles.modalOptionMeta}>
                        {resolveCategoryTypeLabel(row?.type)} | {row?.code || '-'}
                      </Text>
                      {row?.description ? (
                        <Text style={styles.modalOptionDescription}>{row.description}</Text>
                      ) : null}
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.helperText}>Kategori pengeluaran backend tidak ditemukan.</Text>
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
              <Text style={styles.modalTitle}>Pilih Isi Kategori Pengeluaran</Text>
              <Pressable style={styles.modalCloseButton} onPress={closeCategoryItemModal}>
                <Text style={styles.modalCloseButtonText}>Tutup</Text>
              </Pressable>
            </View>

            <Text style={styles.modalHelperText}>
              {selectedCategory?.name
                ? `Kasir memilih isi kategori ${selectedCategory.name} langsung dari backend.`
                : 'Pilih kategori pengeluaran terlebih dahulu.'}
            </Text>

            <TextInput
              value={categoryItemSearch}
              onChangeText={setCategoryItemSearch}
              placeholder="Cari isi kategori pengeluaran..."
              placeholderTextColor="#7a7a7a"
              style={styles.input}
            />

            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {filteredCategoryItems.length > 0 ? (
                filteredCategoryItems.map((row) => {
                  const active = Number(row?.id || 0) === Number(selectedCategoryItemId || 0);
                  return (
                    <Pressable
                      key={`expense-category-item-${row?.id || row?.code}`}
                      style={[styles.modalOption, active ? styles.modalOptionActive : null]}
                      onPress={() => handleSelectCategoryItem(row)}
                    >
                      <View style={styles.modalOptionHeader}>
                        <Text style={styles.modalOptionTitle}>{row?.name || '-'}</Text>
                        <Text style={[styles.modalOptionBadge, active ? styles.modalOptionBadgeActive : null]}>
                          {active ? 'Dipilih' : 'Backend'}
                        </Text>
                      </View>
                      <Text style={styles.modalOptionMeta}>{row?.code || '-'}</Text>
                      {row?.description ? (
                        <Text style={styles.modalOptionDescription}>{row.description}</Text>
                      ) : null}
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.helperText}>Isi kategori pengeluaran backend tidak ditemukan.</Text>
              )}
            </ScrollView>
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
    color: '#173c87',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    color: '#667897',
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#0755b8',
    backgroundColor: '#0755b8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  formCard: {
    borderWidth: 1,
    borderColor: '#c8d8f2',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  formHeaderInfo: {
    flex: 1,
    minWidth: 240,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#b9c8e1',
    backgroundColor: '#f5f9ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#174a8c',
    fontSize: 12,
    fontWeight: '800',
  },
  card: {
    borderWidth: 1,
    borderColor: '#c8d8f2',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#173c87',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4dcea',
    backgroundColor: '#fbfdff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: '#14233d',
    marginBottom: 10,
  },
  noteInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  inlineField: {
    flex: 1,
    minWidth: 160,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#435674',
    marginBottom: 5,
  },
  amountPreviewText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#35507a',
    marginTop: -4,
    marginBottom: 10,
  },
  selectorButton: {
    borderWidth: 1,
    borderColor: '#c1cadf',
    backgroundColor: '#f7f9fd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  selectorInfo: {
    flex: 1,
    minWidth: 220,
  },
  selectorLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5d6780',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  selectorValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d2433',
  },
  selectorAction: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0755b8',
  },
  selectionInfoCard: {
    borderWidth: 1,
    borderColor: '#d9e7ff',
    backgroundColor: '#f6f9ff',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  selectionInfoTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#173c87',
    marginBottom: 4,
  },
  selectionInfoMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667897',
    marginBottom: 4,
  },
  selectionInfoDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: '#52606d',
  },
  accountChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  accountChip: {
    minWidth: 220,
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#dce5f4',
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  accountChipActive: {
    borderColor: '#0755b8',
    backgroundColor: '#eef4ff',
  },
  accountChipTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#173c87',
  },
  accountChipTitleActive: {
    color: '#153e90',
  },
  accountChipSubtitle: {
    fontSize: 10,
    color: '#617d98',
  },
  accountChipSubtitleActive: {
    color: '#35507a',
  },
  primaryButton: {
    borderWidth: 1,
    borderColor: '#0755b8',
    backgroundColor: '#0755b8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#b42318',
    fontWeight: '700',
    marginBottom: 6,
  },
  helperText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#617d98',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBackdropDismiss: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '82%',
    borderWidth: 1,
    borderColor: '#c8d8f2',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    alignItems: 'stretch',
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
    color: '#173c87',
  },
  modalCloseButton: {
    borderWidth: 1,
    borderColor: '#c1cadf',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalCloseButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#174a8c',
  },
  modalHelperText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#52606d',
    marginBottom: 10,
  },
  modalList: {
    maxHeight: 360,
  },
  modalListContent: {
    gap: 8,
    paddingBottom: 8,
  },
  modalOption: {
    borderWidth: 1,
    borderColor: '#c7d2e6',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
  },
  modalOptionActive: {
    borderColor: '#0755b8',
    backgroundColor: '#eef4ff',
  },
  modalOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  modalOptionTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    color: '#173c87',
  },
  modalOptionBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#35507a',
    backgroundColor: '#e9efff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  modalOptionBadgeActive: {
    color: '#ffffff',
    backgroundColor: '#0755b8',
  },
  modalOptionMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667897',
    marginBottom: 4,
  },
  modalOptionDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: '#52606d',
  },
});

export default ExpensePanel;
