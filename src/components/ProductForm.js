import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatRupiah } from '../utils/currency';

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const isGroupProductRow = (row) => Boolean(
  row?.is_group_product
  || row?.sourceProduct?.is_group_product
  || row?.source_product?.is_group_product
  || Number(row?.group_component_count || 0) > 0
  || Number(row?.sourceProduct?.group_component_count || 0) > 0
  || Number(row?.source_product?.group_component_count || 0) > 0,
);

const ProductForm = ({
  productName,
  productPickerTree,
  onSelectProductVariant,
  qty,
  onChangeQty,
  negotiatedPriceInput,
  onChangeNegotiatedPrice,
  sizeWidthMeter,
  onChangeSizeWidthMeter,
  sizeLengthMeter,
  onChangeSizeLengthMeter,
  isQtyOnlyProduct,
  qtyOnlyInputLabel,
  qtyOnlyStatusLabel,
  qtyOnlyMaterialFallbackLabel,
  qtyOnlyHintText,
  isFixedSizeProduct,
  fixedSizeLabel,
  fixedSizeHint,
  hideFinishingField,
  selectedFinishingIds,
  finishingSummary,
  finishingOptions,
  finishingAvailabilityMessage,
  isPrintingFinishingMode,
  isStrictStickerFinishingMode,
  autoApplyFinishingSelection,
  onSaveSelectedFinishings,
  selectedFinishingMataAyamQtyById,
  onSaveSelectedFinishingMataAyamQtyById,
  selectedLbMaxProductId,
  lbMaxSummary,
  lbMaxOptions,
  onSaveSelectedLbMax,
  showPagesInput,
  pages,
  onChangePages,
  materialDisplay,
  materialError,
  materialWarning,
  mataAyamIssueBadge,
  onValidateProduct,
  onAddToCart,
  itemFinalPrice,
  pricingSummary,
  negotiationNotice,
  onCancelItem,
  onClearCart,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState('');
  const [selectedSubCategoryKey, setSelectedSubCategoryKey] = useState('');
  const [selectedProductKey, setSelectedProductKey] = useState('');
  const [selectedVariantKey, setSelectedVariantKey] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedVariantRow, setSelectedVariantRow] = useState(null);
  const [isFinishingPickerOpen, setIsFinishingPickerOpen] = useState(false);
  const [finishingDraftIds, setFinishingDraftIds] = useState([]);
  const [finishingDraftMataAyamQtyById, setFinishingDraftMataAyamQtyById] = useState({});
  const [isLbMaxPickerOpen, setIsLbMaxPickerOpen] = useState(false);
  const [lbMaxDraftProductId, setLbMaxDraftProductId] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({
    right_left: false,
    top_bottom: true,
    all_sides: true,
    sambungan: true,
  });
  const qtyOnlyInputText = String(qtyOnlyInputLabel || '').trim() || 'Qty Only';
  const qtyOnlyStatusText = String(qtyOnlyStatusLabel || '').trim() || 'Tanpa Ukuran';
  const qtyOnlyMaterialText = String(qtyOnlyMaterialFallbackLabel || '').trim() || 'Tanpa Material';
  const qtyOnlyHelperText = String(qtyOnlyHintText || '').trim() || 'Produk qty-only memakai jumlah/satuan tanpa input ukuran.';

  const categories = useMemo(
    () => (Array.isArray(productPickerTree) ? productPickerTree : []),
    [productPickerTree],
  );
  const selectedCategory = useMemo(
    () => categories.find((item) => item.key === selectedCategoryKey) || null,
    [categories, selectedCategoryKey],
  );
  const selectedSubCategory = useMemo(
    () => selectedCategory?.subcategories?.find((item) => item.key === selectedSubCategoryKey) || null,
    [selectedCategory, selectedSubCategoryKey],
  );
  const selectedProduct = useMemo(
    () => selectedSubCategory?.products?.find((item) => item.key === selectedProductKey) || null,
    [selectedSubCategory, selectedProductKey],
  );
  const formatProductOptionLabel = (product) => {
    const name = String(product?.name || '').trim() || 'Produk';
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const uniqueNames = Array.from(
      new Set(
        variants
          .map((variant) => String(variant?.name || '').trim())
          .filter(Boolean),
      ),
    );
    const uniqueSkus = Array.from(
      new Set(
        variants
          .map((variant) => String(variant?.row?.sku || variant?.sku || '').trim())
          .filter(Boolean),
      ),
    );
    const skuLabel = uniqueSkus.length === 1 ? uniqueSkus[0] : '';
    if (uniqueNames.length > 1) {
      const baseLabel = skuLabel ? `${name} [${skuLabel}] (${uniqueNames.length} varian)` : `${name} (${uniqueNames.length} varian)`;
      return isGroupProductRow(product) ? `${baseLabel} [Paket]` : baseLabel;
    }
    const baseLabel = skuLabel ? `${name} [${skuLabel}]` : name;
    return isGroupProductRow(product) ? `${baseLabel} [Paket]` : baseLabel;
  };
  const formatVariantOptionLabel = (variant) => {
    const name = String(variant?.name || '').trim() || 'Varian';
    const sku = String(variant?.row?.sku || variant?.sku || '').trim();
    const baseLabel = sku ? `${name} [${sku}]` : name;
    if (isGroupProductRow(variant?.row || variant)) {
      return `${baseLabel} [Paket]`;
    }
    if (!selectedProduct || !selectedProductHasVariants) {
      return baseLabel;
    }
    return baseLabel;
  };
  const hasVariantOptions = (product) => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (variants.length <= 1) {
      return false;
    }
    const uniqueNames = Array.from(
      new Set(
        variants
          .map((variant) => String(variant?.name || '').trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    return uniqueNames.length > 1;
  };
  const selectedProductHasVariants = useMemo(
    () => hasVariantOptions(selectedProduct),
    [selectedProduct],
  );
  const finishings = useMemo(
    () => (Array.isArray(finishingOptions) ? finishingOptions : []),
    [finishingOptions],
  );
  const lbMaxFinishings = useMemo(
    () => (Array.isArray(lbMaxOptions) ? lbMaxOptions : []),
    [lbMaxOptions],
  );
  const finishingById = useMemo(
    () => new Map(finishings.map((item) => [Number(item?.id || 0), item])),
    [finishings],
  );
  const selectedMataAyamRows = useMemo(() => {
    return (Array.isArray(finishingDraftIds) ? finishingDraftIds : [])
      .map((id) => finishingById.get(Number(id)))
      .filter((item) => item && item.requires_mata_ayam === true);
  }, [finishingDraftIds, finishingById]);
  const groupedFinishings = useMemo(() => {
    const grouped = {
      right_left: [],
      top_bottom: [],
      all_sides: [],
      sambungan: [],
    };
    finishings.forEach((item) => {
      const key = ['right_left', 'top_bottom', 'all_sides', 'sambungan'].includes(String(item?.axis_group || ''))
        ? String(item.axis_group)
        : 'all_sides';
      grouped[key].push(item);
    });
    return grouped;
  }, [finishings]);
  const groupOrder = ['right_left', 'top_bottom', 'all_sides', 'sambungan'];
  const groupTitleMap = {
    right_left: 'Kanan Kiri',
    top_bottom: 'Atas Bawah',
    all_sides: 'Kanan Kiri Atas Bawah',
    sambungan: 'Sambungan',
  };
  const groupNoteMap = {
    right_left: 'Pilih salah satu finishing untuk sisi kanan kiri. Sistem tidak mengizinkan dobel finishing pada grup ini.',
    top_bottom: 'Pilih salah satu finishing untuk sisi atas bawah. Sistem tidak mengizinkan dobel finishing pada grup ini.',
    all_sides: 'Finishing pada grup ini memakai kombinasi sisi horizontal dan vertikal. Pilih salah satu saja.',
    sambungan: 'Pilih salah satu finishing khusus sambungan. Grup ini dipisahkan dari finishing sisi lainnya.',
  };
  const stickerFinishingRows = useMemo(
    () => finishings.filter((item) => Number(item?.id || 0) > 0),
    [finishings],
  );
  const getFinishingPrice = (item) => {
    const amount = Number(
      item?.price ||
      item?.unit_price ||
      item?.selling_price ||
      item?.harga ||
      item?.pivot?.price ||
      item?.pivot?.selling_price ||
      0,
    );
    return formatRupiah(amount);
  };
  const formatFinishingLabel = (item) => {
    const name = String(item?.name || '').trim();
    const unitHint = String(item?.unit_hint || '').trim().toUpperCase();
    if (!name) {
      return '-';
    }
    if (!unitHint) {
      return name;
    }
    const compactName = name.toUpperCase();
    if (compactName.includes(unitHint)) {
      return name;
    }
    return `${name} (${unitHint})`;
  };
  const commitFinishingSelection = (nextIds, nextMataAyamMap = finishingDraftMataAyamQtyById) => {
    const normalizedIds = Array.from(
      new Set((Array.isArray(nextIds) ? nextIds : [])
        .map((id) => Number(id))
        .filter((id) => id > 0)),
    );
    const normalizedMataAyam = {};
    normalizedIds.forEach((id) => {
      const option = finishingById.get(Number(id));
      if (!option || option.requires_mata_ayam !== true) {
        return;
      }
      const raw = String(nextMataAyamMap?.[id] ?? '0').replace(/[^0-9]/g, '');
      const parsed = Number.parseInt(raw || '0', 10);
      normalizedMataAyam[id] = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    });
    onSaveSelectedFinishings?.(normalizedIds);
    onSaveSelectedFinishingMataAyamQtyById?.(normalizedMataAyam);
  };
  const togglePrintingFinishingSelection = (item, groupKey) => {
    const id = Number(item?.id || 0);
    if (id <= 0) return;
    const currentIds = Array.isArray(finishingDraftIds) ? finishingDraftIds : [];
    const currentMap = finishingDraftMataAyamQtyById && typeof finishingDraftMataAyamQtyById === 'object'
      ? finishingDraftMataAyamQtyById
      : {};
    const isSelected = currentIds.some((rowId) => Number(rowId) === id);
    let nextIds = [];
    const nextMap = { ...currentMap };

    if (isSelected) {
      delete nextMap[id];
      nextIds = currentIds.filter((rowId) => Number(rowId) !== id);
    } else if (!isPrintingFinishingMode) {
      nextIds = [...currentIds, id];
      if (item?.requires_mata_ayam === true) {
        nextMap[id] = String(nextMap?.[id] ?? '0');
      }
    } else {
      const withoutGroup = currentIds.filter((rowId) => {
        const option = finishings.find((row) => Number(row.id) === Number(rowId));
        return String(option?.axis_group || 'all_sides') !== groupKey;
      });
      nextIds = [...withoutGroup, id];
      if (item?.requires_mata_ayam === true) {
        nextMap[id] = String(nextMap?.[id] ?? '0');
      }
    }

    setFinishingDraftIds(nextIds);
    setFinishingDraftMataAyamQtyById(nextMap);
    if (autoApplyFinishingSelection) {
      commitFinishingSelection(nextIds, nextMap);
    }
  };

  const pickerStep = useMemo(() => {
    if (!selectedCategoryKey) return 'category';
    if (!selectedSubCategoryKey) return 'subcategory';
    if (!selectedProductKey) return 'product';
    return selectedProductHasVariants ? 'variant' : 'product';
  }, [selectedCategoryKey, selectedSubCategoryKey, selectedProductKey, selectedProductHasVariants]);
  const pickerTitle = useMemo(() => {
    return 'Pilih Produk';
  }, []);
  const pickerSubtitle = useMemo(() => {
    if (pickerStep === 'category') {
      return '1. Pilih kategori utama';
    }
    if (pickerStep === 'subcategory') {
      return `2. Pilih sub kategori dari ${selectedCategory?.name || 'kategori terpilih'}`;
    }
    if (pickerStep === 'product') {
      return `3. Pilih produk dari ${selectedSubCategory?.name || 'sub kategori terpilih'}`;
    }
    return `4. Pilih varian dari ${selectedProduct?.name || 'produk terpilih'}`;
  }, [pickerStep, selectedCategory, selectedSubCategory, selectedProduct]);
  const pickerSearchPlaceholder = useMemo(() => {
    if (pickerStep === 'category') return 'Cari kategori...';
    if (pickerStep === 'subcategory') return 'Cari sub kategori...';
    if (pickerStep === 'product') return 'Cari produk...';
    return 'Cari varian...';
  }, [pickerStep]);
  const filteredCategories = useMemo(() => {
    if (!pickerSearch.trim()) {
      return categories;
    }
    const keyword = normalizeText(pickerSearch);
    return categories.filter((item) => normalizeText(item?.name).includes(keyword));
  }, [categories, pickerSearch]);
  const filteredSubcategories = useMemo(() => {
    const rows = Array.isArray(selectedCategory?.subcategories) ? selectedCategory.subcategories : [];
    if (!pickerSearch.trim()) {
      return rows;
    }
    const keyword = normalizeText(pickerSearch);
    return rows.filter((item) => normalizeText(item?.name).includes(keyword));
  }, [selectedCategory, pickerSearch]);
  const filteredProducts = useMemo(() => {
    const rows = Array.isArray(selectedSubCategory?.products) ? selectedSubCategory.products : [];
    if (!pickerSearch.trim()) {
      return rows;
    }
    const keyword = normalizeText(pickerSearch);
    return rows.filter((item) => normalizeText(formatProductOptionLabel(item)).includes(keyword));
  }, [selectedSubCategory, pickerSearch]);
  const filteredVariants = useMemo(() => {
    const rows = Array.isArray(selectedProduct?.variants) ? selectedProduct.variants : [];
    if (!pickerSearch.trim()) {
      return rows;
    }
    const keyword = normalizeText(pickerSearch);
    return rows.filter((item) => normalizeText(formatVariantOptionLabel(item)).includes(keyword));
  }, [selectedProduct, pickerSearch]);

  const openPicker = () => {
    setSelectedCategoryKey('');
    setSelectedSubCategoryKey('');
    setSelectedProductKey('');
    setSelectedVariantKey('');
    setPickerSearch('');
    setSelectedVariantRow(null);
    setIsPickerOpen(true);
  };

  const goBack = () => {
    if (pickerStep === 'variant') {
      setSelectedProductKey('');
      setSelectedVariantKey('');
      setPickerSearch('');
      setSelectedVariantRow(null);
      return;
    }
    if (pickerStep === 'product') {
      setSelectedSubCategoryKey('');
      setSelectedVariantKey('');
      setPickerSearch('');
      setSelectedVariantRow(null);
      return;
    }
    if (pickerStep === 'subcategory') {
      setSelectedCategoryKey('');
      setSelectedVariantKey('');
      setPickerSearch('');
      setSelectedVariantRow(null);
      return;
    }
    setPickerSearch('');
    setIsPickerOpen(false);
  };

  return (
    <View style={styles.panel}>
      <View style={styles.labelsRow}>
        <Text style={[styles.label, styles.codeCol, styles.leftLabel]}>Produk</Text>
        <Text style={[styles.label, styles.stockCol]}>Qty</Text>
        <Text style={[styles.label, styles.sizeCol]}>{isFixedSizeProduct ? 'Mode' : (isQtyOnlyProduct ? 'Input' : 'L Mater (m)')}</Text>
        <Text style={[styles.label, styles.sizeCol]}>{isFixedSizeProduct ? 'Ukuran' : (isQtyOnlyProduct ? 'Status' : 'P Mater (m)')}</Text>
        {!hideFinishingField ? <Text style={[styles.label, styles.priceCol]}>Finishing</Text> : null}
        {showPagesInput ? <Text style={[styles.label, styles.qtyCol]}>Halaman</Text> : null}
        <Text style={[styles.label, styles.totalCol, hideFinishingField ? styles.totalColWide : null]}>
          {isQtyOnlyProduct ? 'Ringkasan' : 'Bahan / Material'}
        </Text>
      </View>

      <View style={styles.inputsRow}>
        <View style={styles.codeCol}>
          <Pressable style={styles.selector} onPress={openPicker}>
            <Text style={styles.selectorText} numberOfLines={1} ellipsizeMode="tail">
              {productName || 'Pilih produk...'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.stockCol}>
          <TextInput
            value={qty}
            onChangeText={onChangeQty}
            placeholder="1"
            keyboardType="numeric"
            style={[styles.input, styles.alignCenter]}
          />
        </View>

        <View style={styles.sizeCol}>
          {isFixedSizeProduct ? (
            <View style={[styles.readOnlyBox, styles.fixedSizeBox]}>
              <Text style={[styles.readOnlyText, styles.fixedSizeValueText]}>{fixedSizeLabel || 'A3+'}</Text>
            </View>
          ) : isQtyOnlyProduct ? (
            <View style={[styles.readOnlyBox, styles.fixedSizeBox]}>
              <Text style={[styles.readOnlyText, styles.fixedSizeValueText]}>{qtyOnlyInputText}</Text>
            </View>
          ) : (
            <TextInput
              value={sizeWidthMeter}
              onChangeText={onChangeSizeWidthMeter}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={[styles.input, styles.alignCenter]}
            />
          )}
        </View>

        <View style={styles.sizeCol}>
          {isFixedSizeProduct ? (
            <View style={[styles.readOnlyBox, styles.fixedSizeBox]}>
              <Text style={[styles.readOnlyText, styles.fixedSizeMetaText]}>Ukuran Tetap</Text>
            </View>
          ) : isQtyOnlyProduct ? (
            <View style={[styles.readOnlyBox, styles.fixedSizeBox]}>
              <Text style={[styles.readOnlyText, styles.fixedSizeMetaText]}>{qtyOnlyStatusText}</Text>
            </View>
          ) : (
            <TextInput
              value={sizeLengthMeter}
              onChangeText={onChangeSizeLengthMeter}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={[styles.input, styles.alignCenter]}
            />
          )}
        </View>

        {!hideFinishingField ? (
          <View style={styles.priceCol}>
            <Pressable
              style={styles.selector}
              onPress={() => {
                setFinishingDraftIds(Array.isArray(selectedFinishingIds) ? selectedFinishingIds : []);
                setFinishingDraftMataAyamQtyById(
                  selectedFinishingMataAyamQtyById && typeof selectedFinishingMataAyamQtyById === 'object'
                    ? selectedFinishingMataAyamQtyById
                    : {},
                );
                setCollapsedGroups({
                  right_left: false,
                  top_bottom: true,
                  all_sides: true,
                  sambungan: true,
                });
                setIsFinishingPickerOpen(true);
              }}
              disabled={finishings.length === 0}
            >
              <Text style={styles.selectorText} numberOfLines={1} ellipsizeMode="tail">
                {finishingSummary || (finishings.length > 0 ? 'Pilih finishing...' : 'Finishing belum siap')}
              </Text>
            </Pressable>
            {!finishingSummary && finishings.length === 0 && finishingAvailabilityMessage ? (
              <View style={styles.finishingHelpBadge}>
                <Text style={styles.finishingHelpBadgeText}>
                  {String(finishingAvailabilityMessage)}
                </Text>
              </View>
            ) : null}
            {mataAyamIssueBadge?.visible ? (
              <View style={styles.mataAyamBadge}>
                <Text style={styles.mataAyamBadgeText}>
                  {String(mataAyamIssueBadge?.message || 'Mata ayam bermasalah')}
                </Text>
              </View>
            ) : null}
            {isPrintingFinishingMode ? (
              <View style={styles.lbMaxRow}>
                <Pressable
                  style={[styles.selector, styles.lbMaxSelector]}
                  onPress={() => {
                    setLbMaxDraftProductId(Number(selectedLbMaxProductId || 0) || null);
                    setIsLbMaxPickerOpen(true);
                  }}
                  disabled={lbMaxFinishings.length === 0}
                >
                  <Text style={styles.selectorText} numberOfLines={1} ellipsizeMode="tail">
                    {lbMaxSummary || (lbMaxFinishings.length > 0 ? 'Pilih LB Max...' : 'LB Max tidak tersedia')}
                  </Text>
                </Pressable>
                {selectedLbMaxProductId ? (
                  <Pressable
                    style={styles.clearLbMaxButton}
                    onPress={() => onSaveSelectedLbMax?.(null)}
                  >
                    <Text style={styles.clearLbMaxText}>Hapus LB</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {showPagesInput ? (
          <View style={styles.qtyCol}>
            <TextInput
              value={pages}
              onChangeText={onChangePages}
              placeholder="1"
              keyboardType="numeric"
              style={[styles.input, styles.alignCenter]}
            />
          </View>
        ) : null}

        <View style={[styles.totalCol, hideFinishingField ? styles.totalColWide : null]}>
          <View style={styles.readOnlyBox}>
            <Text style={styles.readOnlyText}>
              {isQtyOnlyProduct ? (materialDisplay || qtyOnlyMaterialText) : (materialDisplay || '-')}
            </Text>
          </View>
          {materialError ? (
            <View style={styles.materialErrorBadge}>
              <Text style={styles.materialErrorBadgeText}>{String(materialError)}</Text>
            </View>
          ) : null}
          {!materialError && materialWarning ? (
            <View style={styles.materialWarningBadge}>
              <Text style={styles.materialWarningBadgeText}>{String(materialWarning)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {isFixedSizeProduct && fixedSizeHint ? (
        <View style={styles.fixedSizeHintCard}>
          <Text style={styles.fixedSizeHintText}>{String(fixedSizeHint)}</Text>
        </View>
      ) : isQtyOnlyProduct ? (
        <View style={styles.fixedSizeHintCard}>
          <Text style={styles.fixedSizeHintText}>{qtyOnlyHelperText}</Text>
        </View>
      ) : null}

      {negotiationNotice?.visible ? (
        <View
          style={[
            styles.negotiationCard,
            negotiationNotice?.tone === 'error' ? styles.negotiationCardError : null,
            negotiationNotice?.tone === 'warning' ? styles.negotiationCardWarning : null,
            negotiationNotice?.tone === 'success' ? styles.negotiationCardSuccess : null,
          ]}
        >
          <Text style={styles.negotiationTitle}>Negosiasi A3+</Text>
          <TextInput
            value={String(negotiatedPriceInput || '')}
            onChangeText={onChangeNegotiatedPrice}
            placeholder="Isi harga negosiasi"
            keyboardType="numeric"
            style={styles.negotiationInput}
          />
          <Text style={styles.negotiationMessage}>{String(negotiationNotice?.message || '')}</Text>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable onPress={onValidateProduct} style={[styles.button, styles.searchButton]}>
          <Text style={styles.buttonText}>Cek Produk</Text>
        </Pressable>

        <View style={styles.rightActions}>
          <Pressable onPress={onAddToCart} style={[styles.button, styles.addButton]}>
            <Text style={styles.buttonText}>Simpan Item</Text>
          </Pressable>
          <Pressable onPress={onCancelItem} style={[styles.button, styles.addButton]}>
            <Text style={styles.buttonText}>Batal Item</Text>
          </Pressable>
          <Pressable onPress={onClearCart} style={[styles.button, styles.deleteButton]}>
            <Text style={styles.buttonText}>Hapus Semua Item</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.previewText}>Estimasi Total Item: {formatRupiah(itemFinalPrice)}</Text>
      {pricingSummary ? (
        <View style={styles.previewSummaryCard}>
          <Text style={styles.previewSummaryLine}>Cetak: {formatRupiah(pricingSummary.subtotal || 0)}</Text>
          {pricingSummary?.isNegotiated ? (
            <Text style={styles.previewSummaryLine}>
              Cetak Nego: {formatRupiah(pricingSummary.negotiatedSubtotal || 0)}
            </Text>
          ) : null}
          {pricingSummary?.bundleActive ? (
            <>
              <Text style={styles.previewSummaryLine}>
                Finishing: {formatRupiah(pricingSummary.finishingBeforeDiscount || 0)}
              </Text>
              <Text style={styles.previewSummaryLine}>
                Diskon Bundle: {formatRupiah(pricingSummary.bundleDiscount || 0)}
              </Text>
              <Text style={styles.previewSummaryLine}>
                Finishing Final: {formatRupiah(pricingSummary.finishingFinal || 0)}
              </Text>
              <Text style={styles.previewSummaryLine}>
                Total Final: {formatRupiah(pricingSummary.printSubtotal || 0)} + {formatRupiah(pricingSummary.finishingBeforeDiscount || 0)} - {formatRupiah(pricingSummary.bundleDiscount || 0)} = {formatRupiah(pricingSummary.grandTotal || 0)}
              </Text>
            </>
          ) : (
            <Text style={styles.previewSummaryLine}>
              Finishing Final: {formatRupiah(pricingSummary.finishingFinal || 0)}
            </Text>
          )}
          {pricingSummary.billingGroup ? (
            <Text style={styles.previewSummaryLine}>
              Rule Sticker: {pricingSummary.billingGroup}
              {Number(pricingSummary.rollWidth || 0) > 0 ? ` | Lebar Roll ${pricingSummary.rollWidth} m` : ''}
            </Text>
          ) : null}
          {pricingSummary?.stickerNotice ? (
            <Text style={styles.previewWarningLine}>{pricingSummary.stickerNotice}</Text>
          ) : null}
        </View>
      ) : null}

      <Modal
        visible={isPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{pickerTitle}</Text>
            <Text style={styles.modalSubTitle}>{pickerSubtitle}</Text>
            <View style={styles.searchSection}>
              <Text style={styles.searchSectionLabel}>Pencarian</Text>
              <View style={styles.searchRow}>
                <TextInput
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                  placeholder={pickerSearchPlaceholder}
                  placeholderTextColor="#777777"
                  style={[styles.modalInput, styles.searchInput]}
                />
                <Pressable
                  style={[styles.searchClearButton, !pickerSearch.trim() ? styles.searchClearButtonDisabled : null]}
                  onPress={() => setPickerSearch('')}
                  disabled={!pickerSearch.trim()}
                >
                  <Text style={styles.searchClearButtonText}>Bersihkan</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView style={styles.listWrap}>
              {pickerStep === 'category' && filteredCategories.map((item) => (
                <Pressable
                  key={item.key}
                  style={[styles.listItem, selectedCategoryKey === item.key ? styles.listItemActiveRed : null]}
                  onPress={() => {
                    setSelectedCategoryKey(item.key);
                    setSelectedSubCategoryKey('');
                    setSelectedProductKey('');
                    setSelectedVariantKey('');
                    setPickerSearch('');
                    setSelectedVariantRow(null);
                  }}
                >
                  <Text style={[styles.listItemText, selectedCategoryKey === item.key ? styles.listItemTextActiveRed : null]}>
                    {item.name}
                  </Text>
                </Pressable>
              ))}

              {pickerStep === 'subcategory' && filteredSubcategories.map((item) => (
                <Pressable
                  key={item.key}
                  style={[styles.listItem, selectedSubCategoryKey === item.key ? styles.listItemActiveRed : null]}
                  onPress={() => {
                    setSelectedSubCategoryKey(item.key);
                    setSelectedProductKey('');
                    setSelectedVariantKey('');
                    setPickerSearch('');
                    setSelectedVariantRow(null);
                  }}
                >
                  <Text style={[styles.listItemText, selectedSubCategoryKey === item.key ? styles.listItemTextActiveRed : null]}>
                    {item.name}
                  </Text>
                </Pressable>
              ))}

              {pickerStep === 'product' && filteredProducts.map((item) => (
                <Pressable
                  key={item.key}
                  style={[styles.listItem, selectedProductKey === item.key ? styles.listItemActiveRed : null]}
                  onPress={() => {
                    setSelectedProductKey(item.key);
                    setSelectedVariantKey('');
                    setPickerSearch('');
                    setSelectedVariantRow(
                      hasVariantOptions(item)
                        ? null
                        : (item?.variants?.[0]?.row || null),
                    );
                  }}
                >
                  <Text style={[styles.listItemText, selectedProductKey === item.key ? styles.listItemTextActiveRed : null]}>
                    {formatProductOptionLabel(item)}
                  </Text>
                </Pressable>
              ))}

              {pickerStep === 'variant' && filteredVariants.map((item) => (
                <Pressable
                  key={item.key}
                  style={[styles.listItem, selectedVariantKey === item.key ? styles.listItemActiveRed : null]}
                  onPress={() => {
                    setSelectedVariantKey(item.key);
                    setSelectedVariantRow(item.row);
                  }}
                >
                  <Text style={[styles.listItemText, selectedVariantKey === item.key ? styles.listItemTextActiveRed : null]}>
                    {formatVariantOptionLabel(item)}
                  </Text>
                </Pressable>
              ))}
              {pickerStep === 'category' && filteredCategories.length === 0 ? (
                <Text style={styles.emptyText}>Kategori tidak ditemukan.</Text>
              ) : null}
              {pickerStep === 'subcategory' && filteredSubcategories.length === 0 ? (
                <Text style={styles.emptyText}>Sub kategori tidak ditemukan.</Text>
              ) : null}
              {pickerStep === 'product' && filteredProducts.length === 0 ? (
                <Text style={styles.emptyText}>Produk tidak ditemukan.</Text>
              ) : null}
              {pickerStep === 'variant' && filteredVariants.length === 0 ? (
                <Text style={styles.emptyText}>Varian tidak ditemukan.</Text>
              ) : null}

              {categories.length === 0 ? (
                <Text style={styles.emptyText}>Data produk backend belum tersedia.</Text>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={goBack}>
                <Text style={styles.secondaryButtonText}>
                  {pickerStep === 'category' ? 'Tutup' : 'Kembali'}
                </Text>
              </Pressable>
              {pickerStep === 'variant' ? (
                <Pressable
                  style={[styles.primaryButton, !selectedVariantRow ? styles.primaryButtonDisabled : null]}
                  onPress={() => {
                    if (!selectedVariantRow) {
                      return;
                    }
                    onSelectProductVariant?.(selectedVariantRow);
                    setIsPickerOpen(false);
                  }}
                  disabled={!selectedVariantRow}
                >
                  <Text style={styles.primaryButtonText}>Pilih Produk</Text>
                </Pressable>
              ) : (pickerStep === 'product' && selectedProduct && !selectedProductHasVariants) ? (
                <Pressable
                  style={[styles.primaryButton, !selectedVariantRow ? styles.primaryButtonDisabled : null]}
                  onPress={() => {
                    if (!selectedVariantRow) {
                      return;
                    }
                    onSelectProductVariant?.(selectedVariantRow);
                    setIsPickerOpen(false);
                  }}
                  disabled={!selectedVariantRow}
                >
                  <Text style={styles.primaryButtonText}>Pilih Produk</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isLbMaxPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLbMaxPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih LB Max</Text>
            <Text style={styles.modalSubTitle}>LB Max hanya bisa dipilih 1 item per produk</Text>
            <ScrollView style={styles.listWrap}>
              {lbMaxFinishings.map((item) => {
                const id = Number(item.id || 0);
                const isSelected = Number(lbMaxDraftProductId || 0) === id;
                const extraWidthCm = Math.max(0, Number(item.lb_max_width_cm || 0) || 0);
                return (
                  <Pressable
                    key={String(id || item.name)}
                    style={[styles.listItem, isSelected ? styles.listItemActiveRed : null]}
                    onPress={() => {
                      const nextId = isSelected ? null : id;
                      setLbMaxDraftProductId(nextId);
                      onSaveSelectedLbMax?.(nextId);
                    }}
                  >
                    <Text style={[styles.listItemText, isSelected ? styles.listItemTextActiveRed : null]}>
                      {`${item.name || 'LB Max'}${extraWidthCm > 0 ? ` (+${extraWidthCm} cm)` : ''}`}
                    </Text>
                  </Pressable>
                );
              })}
              {lbMaxFinishings.length === 0 ? (
                <Text style={styles.emptyText}>Tidak ada opsi LB Max untuk produk ini.</Text>
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  onSaveSelectedLbMax?.(null);
                  setIsLbMaxPickerOpen(false);
                }}
              >
                <Text style={styles.secondaryButtonText}>Tanpa LB Max</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={() => {
                  onSaveSelectedLbMax?.(Number(lbMaxDraftProductId || 0) || null);
                  setIsLbMaxPickerOpen(false);
                }}
              >
                <Text style={styles.primaryButtonText}>Pilih LB Max</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => setIsLbMaxPickerOpen(false)}>
                <Text style={styles.secondaryButtonText}>Tutup</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isFinishingPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFinishingPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.finishingModalCard]}>
            <Text style={styles.modalTitle}>Pilih Finishing</Text>
            <Text style={styles.modalSubTitle}>
              {isStrictStickerFinishingMode
                ? 'Produk sticker bisa memilih beberapa finishing aktif sekaligus.'
                : 'List finishing sesuai aturan backend produk terpilih'}
            </Text>
            <ScrollView style={styles.listWrap}>
              {isStrictStickerFinishingMode ? (
                <View style={styles.finishingGroupCard}>
                  <View style={styles.finishingGroupHeader}>
                    <Text style={styles.finishingGroupTitle}>Finishing Sticker Aktif</Text>
                  </View>
                  <View style={styles.finishingGroupBody}>
                    <Text style={styles.finishingGroupNote}>
                      Pilih satu atau beberapa finishing sticker yang aktif sesuai kebutuhan pelanggan.
                    </Text>
                    {stickerFinishingRows.map((item) => (
                      <Pressable
                        key={String(item.id || item.name)}
                        style={styles.finishingItemRow}
                        onPress={() => {
                          const id = Number(item.id || 0);
                          if (id <= 0) return;
                          setFinishingDraftIds((prev) => {
                            const currentIds = Array.isArray(prev) ? prev : [];
                            const isSelected = currentIds.some((rowId) => Number(rowId) === id);
                            if (isSelected) {
                              setFinishingDraftMataAyamQtyById((prevMap) => {
                                const nextMap = { ...(prevMap || {}) };
                                delete nextMap[id];
                                return nextMap;
                              });
                              return currentIds.filter((rowId) => Number(rowId) !== id);
                            }
                            if (item?.requires_mata_ayam === true) {
                              setFinishingDraftMataAyamQtyById((prevMap) => ({
                                ...(prevMap || {}),
                                [id]: String(prevMap?.[id] ?? '0'),
                              }));
                            }
                            return [...currentIds, id];
                          });
                        }}
                      >
                        <View style={styles.finishingItemLeft}>
                          <Text style={styles.checkboxText}>
                            {finishingDraftIds.some((rowId) => Number(rowId) === Number(item.id || 0)) ? '[x]' : '[ ]'}
                          </Text>
                          <Text style={styles.finishingItemText}>{formatFinishingLabel(item)}</Text>
                        </View>
                        <View style={styles.finishingItemRight}>
                          <Text style={styles.finishingPriceText}>{getFinishingPrice(item)}</Text>
                          <Text style={styles.finishingTagText}>/STICKER</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : groupOrder.map((groupKey) => {
                const rows = groupedFinishings[groupKey] || [];
                if (rows.length === 0) {
                  return null;
                }
                const isCollapsed = Boolean(collapsedGroups[groupKey]);
                return (
                  <View key={groupKey} style={styles.finishingGroupCard}>
                    <View style={styles.finishingGroupHeader}>
                      <Text style={styles.finishingGroupTitle}>{groupTitleMap[groupKey]}</Text>
                      <Pressable
                        style={styles.toggleButton}
                        onPress={() =>
                          setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))
                        }
                      >
                        <Text style={styles.toggleButtonText}>{isCollapsed ? 'Buka' : 'Tutup'}</Text>
                      </Pressable>
                    </View>
                    {!isCollapsed ? (
                      <View style={styles.finishingGroupBody}>
                        <Text style={styles.finishingGroupNote}>{groupNoteMap[groupKey]}</Text>
                        {rows.map((item) => (
                          <Pressable
                            key={String(item.id || item.name)}
                            style={styles.finishingItemRow}
                            onPress={() => {
                              togglePrintingFinishingSelection(item, groupKey);
                            }}
                          >
                            <View style={styles.finishingItemLeft}>
                              <Text style={styles.checkboxText}>
                                {finishingDraftIds.some((rowId) => Number(rowId) === Number(item.id || 0)) ? '[x]' : '[ ]'}
                              </Text>
                              <Text style={styles.finishingItemText}>{formatFinishingLabel(item)}</Text>
                            </View>
                            <View style={styles.finishingItemRight}>
                              <Text style={styles.finishingPriceText}>{getFinishingPrice(item)}</Text>
                              <Text style={styles.finishingTagText}>/{String(groupTitleMap[groupKey] || '').toUpperCase()}</Text>
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {finishings.length === 0 ? (
                <Text style={styles.emptyText}>Belum ada finishing untuk produk ini.</Text>
              ) : null}
            </ScrollView>
            {selectedMataAyamRows.length > 0 ? (
              <View style={styles.addonSection}>
                <Text style={styles.addonTitle}>Add-on Mata Ayam</Text>
                <Text style={styles.addonNote}>Isi jumlah mata ayam untuk finishing yang mengaktifkan add-on ini.</Text>
                {selectedMataAyamRows.map((item) => {
                  const id = Number(item?.id || 0);
                  return (
                    <View key={`mata-ayam-${id}`} style={styles.addonRow}>
                      <Text style={styles.addonLabel}>{String(item?.name || 'Finishing')}</Text>
                      <TextInput
                        value={String(finishingDraftMataAyamQtyById?.[id] ?? '0')}
                        onChangeText={(value) => {
                          const sanitized = String(value || '').replace(/[^0-9]/g, '');
                          const nextMap = {
                            ...(finishingDraftMataAyamQtyById || {}),
                            [id]: sanitized,
                          };
                          setFinishingDraftMataAyamQtyById(nextMap);
                          if (autoApplyFinishingSelection) {
                            commitFinishingSelection(finishingDraftIds, nextMap);
                          }
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                        style={[styles.input, styles.addonInput]}
                      />
                    </View>
                  );
                })}
              </View>
            ) : null}
            <View style={styles.modalActions}>
              {Array.isArray(selectedFinishingIds) && selectedFinishingIds.length > 0 ? (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    onSaveSelectedFinishings?.([]);
                    onSaveSelectedFinishingMataAyamQtyById?.({});
                    setIsFinishingPickerOpen(false);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Tanpa Finishing</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.primaryButton}
                onPress={() => {
                  const normalizedIds = Array.from(
                    new Set((Array.isArray(finishingDraftIds) ? finishingDraftIds : [])
                      .map((id) => Number(id))
                      .filter((id) => id > 0)),
                  );
                  const normalizedMataAyam = {};
                  normalizedIds.forEach((id) => {
                    const option = finishingById.get(Number(id));
                    if (!option || option.requires_mata_ayam !== true) {
                      return;
                    }
                    const raw = String(finishingDraftMataAyamQtyById?.[id] ?? '0').replace(/[^0-9]/g, '');
                    const parsed = Number.parseInt(raw || '0', 10);
                    normalizedMataAyam[id] = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
                  });
                  onSaveSelectedFinishings?.(normalizedIds);
                  onSaveSelectedFinishingMataAyamQtyById?.(normalizedMataAyam);
                  setIsFinishingPickerOpen(false);
                }}
              >
                <Text style={styles.primaryButtonText}>Pilih Finishing</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => setIsFinishingPickerOpen(false)}>
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
    backgroundColor: 'transparent',
    marginTop: 8,
    marginBottom: 10,
  },
  labelsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    color: '#2f2f2f',
    fontWeight: '500',
    textAlign: 'center',
  },
  leftLabel: {
    textAlign: 'left',
  },
  codeCol: {
    flex: 1.15,
    minWidth: 120,
  },
  sizeCol: {
    flex: 0.95,
    minWidth: 95,
  },
  stockCol: {
    flex: 0.8,
    minWidth: 80,
  },
  priceCol: {
    flex: 1.35,
    minWidth: 130,
  },
  qtyCol: {
    flex: 0.9,
    minWidth: 95,
  },
  totalCol: {
    flex: 1.35,
    minWidth: 130,
  },
  totalColWide: {
    flex: 1.7,
    minWidth: 180,
  },
  selector: {
    borderWidth: 1,
    borderColor: '#b7b7b7',
    backgroundColor: '#f7f5eb',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  selectorText: {
    fontSize: 12,
    color: '#1f1f1f',
  },
  input: {
    borderWidth: 1,
    borderColor: '#b7b7b7',
    backgroundColor: '#f7f5eb',
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 12,
  },
  readOnlyBox: {
    borderWidth: 1,
    borderColor: '#b7b7b7',
    backgroundColor: '#ece9dd',
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 30,
    justifyContent: 'center',
  },
  readOnlyText: {
    fontSize: 12,
    color: '#3a3a3a',
    fontWeight: '600',
    flexShrink: 1,
  },
  fixedSizeBox: {
    backgroundColor: '#eef7ff',
    borderColor: '#9ec5f8',
  },
  fixedSizeValueText: {
    color: '#0b4f8a',
    textAlign: 'center',
  },
  fixedSizeMetaText: {
    color: '#14532d',
    textAlign: 'center',
  },
  lbMaxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  lbMaxSelector: {
    flex: 1,
  },
  finishingHelpBadge: {
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#d8a742',
    backgroundColor: '#fff8e6',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  finishingHelpBadgeText: {
    fontSize: 11,
    color: '#8a6512',
    fontWeight: '700',
  },
  mataAyamBadge: {
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#c53333',
    backgroundColor: '#fff0f0',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  mataAyamBadgeText: {
    fontSize: 11,
    color: '#8f1f1f',
    fontWeight: '700',
  },
  materialErrorBadge: {
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#d28b26',
    backgroundColor: '#fff4dd',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  materialErrorBadgeText: {
    fontSize: 11,
    color: '#8a5a12',
    fontWeight: '700',
  },
  materialWarningBadge: {
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#d8a742',
    backgroundColor: '#fff8e6',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  materialWarningBadgeText: {
    fontSize: 11,
    color: '#8a6512',
    fontWeight: '700',
  },
  clearLbMaxButton: {
    borderWidth: 1,
    borderColor: '#982222',
    backgroundColor: '#c53333',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  clearLbMaxText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '700',
  },
  alignCenter: { textAlign: 'center' },
  actionRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    gap: 6,
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#2250c9',
  },
  searchButton: {
    backgroundColor: '#2f64ef',
  },
  addButton: {
    backgroundColor: '#2f64ef',
  },
  deleteButton: {
    borderColor: '#982222',
    backgroundColor: '#c53333',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  fixedSizeHintCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#c9ddf7',
    backgroundColor: '#f4f9ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fixedSizeHintText: {
    fontSize: 12,
    color: '#24507a',
    fontWeight: '500',
  },
  negotiationCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#c9ddf7',
    backgroundColor: '#f4f9ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  negotiationCardError: {
    borderColor: '#d95c5c',
    backgroundColor: '#fff1f1',
  },
  negotiationCardWarning: {
    borderColor: '#d8a742',
    backgroundColor: '#fff8e6',
  },
  negotiationCardSuccess: {
    borderColor: '#79b38b',
    backgroundColor: '#eefaf1',
  },
  negotiationTitle: {
    fontSize: 12,
    color: '#184a7a',
    fontWeight: '800',
  },
  negotiationInput: {
    borderWidth: 1,
    borderColor: '#b7b7b7',
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    color: '#1f1f1f',
  },
  negotiationMessage: {
    fontSize: 11,
    color: '#324b68',
    fontWeight: '600',
  },
  previewText: {
    marginTop: 6,
    fontSize: 12,
    color: '#444444',
  },
  previewSummaryCard: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#d6deea',
    backgroundColor: '#f7faff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  previewSummaryLine: {
    fontSize: 11,
    color: '#29405f',
    fontWeight: '600',
  },
  previewWarningLine: {
    fontSize: 11,
    color: '#8a6512',
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
  finishingModalCard: {
    maxWidth: 760,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#11469f',
    marginBottom: 2,
  },
  modalSubTitle: {
    fontSize: 12,
    color: '#303030',
    marginBottom: 8,
  },
  searchSection: {
    marginBottom: 8,
    gap: 4,
  },
  searchSectionLabel: {
    fontSize: 11,
    color: '#36527d',
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  searchClearButton: {
    minWidth: 88,
    borderWidth: 1,
    borderColor: '#9ea9bc',
    backgroundColor: '#eef3fb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  searchClearButtonDisabled: {
    opacity: 0.55,
  },
  searchClearButtonText: {
    fontSize: 11,
    color: '#23426f',
    fontWeight: '700',
  },
  listWrap: {
    maxHeight: 300,
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
  groupWrap: {
    borderBottomWidth: 1,
    borderBottomColor: '#d7d7d7',
  },
  groupHeader: {
    backgroundColor: '#ececec',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  groupHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1f1f1f',
  },
  groupBody: {
    paddingBottom: 4,
  },
  groupNote: {
    fontSize: 11,
    color: '#666666',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  finishingGroupCard: {
    borderWidth: 1,
    borderColor: '#ccd2da',
    borderRadius: 8,
    backgroundColor: '#f6f8fb',
    marginHorizontal: 8,
    marginVertical: 6,
    overflow: 'hidden',
  },
  finishingGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#eef2f7',
  },
  finishingGroupTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#233244',
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: '#c7d0db',
    backgroundColor: '#f9fbfd',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  toggleButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  finishingGroupBody: {
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#dde4ee',
    paddingBottom: 8,
  },
  finishingGroupNote: {
    fontSize: 10,
    color: '#6b7a8d',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  finishingItemRow: {
    marginHorizontal: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#d2dae5',
    borderRadius: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  finishingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  checkboxText: {
    width: 24,
    fontSize: 12,
    color: '#2a3441',
    fontWeight: '700',
  },
  finishingItemText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    color: '#2b3a4b',
    fontWeight: '700',
  },
  finishingItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  finishingPriceText: {
    fontSize: 10,
    color: '#677589',
  },
  finishingTagText: {
    fontSize: 10,
    color: '#6a7b90',
    textTransform: 'uppercase',
  },
  listItemActiveRed: {
    backgroundColor: '#c53333',
  },
  listItemTextActiveRed: {
    color: '#ffffff',
  },
  listItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f1f1f',
  },
  emptyText: {
    fontSize: 12,
    color: '#666666',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  addonSection: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d2dae5',
    backgroundColor: '#f7f9fc',
    borderRadius: 6,
    padding: 8,
    gap: 6,
  },
  addonTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1f2f46',
  },
  addonNote: {
    fontSize: 10,
    color: '#5a6d84',
  },
  addonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  addonLabel: {
    flex: 1,
    fontSize: 11,
    color: '#2b3a4b',
    fontWeight: '700',
  },
  addonInput: {
    width: 96,
    textAlign: 'center',
    paddingVertical: 4,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
});

export default ProductForm;












