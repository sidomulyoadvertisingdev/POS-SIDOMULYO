import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import ProductInputGrid from './product-form/ProductInputGrid';
import ProductFinishingModal from './product-form/ProductFinishingModal';
import ProductLbMaxModal from './product-form/ProductLbMaxModal';
import ProductModePanel from './product-form/ProductModePanel';
import ProductPickerModal from './product-form/ProductPickerModal';
import ProductPricingPanel from './product-form/ProductPricingPanel';
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
  pagesLabel,
  pages,
  onChangePages,
  materialDisplay,
  materialError,
  materialWarning,
  showBookPrintRuleSection,
  bookProductLabel,
  bookDisplayPrimary,
  bookDisplaySecondary,
  bookType,
  bookTypeOptions,
  bookWizardSteps,
  onChangeBookType,
  bookSegment,
  bookCashierNote,
  bookFinishedSize,
  bookFinishedSizeOptions,
  onChangeBookFinishedSize,
  bookMaterialInsideProductId,
  bookMaterialInsideOptions,
  onChangeBookMaterialInside,
  bookMaterialCoverProductId,
  bookMaterialCoverOptions,
  onChangeBookMaterialCover,
  bookPrintModel,
  bookPrintModelOptions,
  onChangeBookPrintModel,
  bookPrintSide,
  bookPrintSideOptions,
  onChangeBookPrintSide,
  bookInsidePrint,
  bookInsidePrintOptions,
  onChangeBookInsidePrint,
  bookCoverPrint,
  bookCoverPrintOptions,
  onChangeBookCoverPrint,
  bookBindingType,
  bookBindingTypeOptions,
  onChangeBookBindingType,
  bookExtraFinishingValues,
  bookExtraFinishingOptions,
  onToggleBookExtraFinishing,
  bookPrintRulePreview,
  bookPageValidation,
  pages: bookPages,
  onChangePages: onChangeBookPages,
  bookPrintRulePrompt,
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
  const pageInputLabel = String(pagesLabel || '').trim() || 'Halaman';
  const summaryColumnLabel = showBookPrintRuleSection
    ? 'Ringkasan Book'
    : (isQtyOnlyProduct ? 'Ringkasan' : 'Bahan / Material');
  const primaryInputLabel = showBookPrintRuleSection
    ? 'Ukuran Book'
    : (isFixedSizeProduct ? 'Mode' : (isQtyOnlyProduct ? 'Input' : 'L Mater (m)'));
  const secondaryInputLabel = showBookPrintRuleSection
    ? 'Rule Book'
    : (isFixedSizeProduct ? 'Ukuran' : (isQtyOnlyProduct ? 'Status' : 'P Mater (m)'));

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

  const openFinishingPicker = () => {
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
  };

  const openLbMaxPicker = () => {
    setLbMaxDraftProductId(Number(selectedLbMaxProductId || 0) || null);
    setIsLbMaxPickerOpen(true);
  };

  const handleChooseCategory = (item) => {
    setSelectedCategoryKey(item.key);
    setSelectedSubCategoryKey('');
    setSelectedProductKey('');
    setSelectedVariantKey('');
    setPickerSearch('');
    setSelectedVariantRow(null);
  };

  const handleChooseSubCategory = (item) => {
    setSelectedSubCategoryKey(item.key);
    setSelectedProductKey('');
    setSelectedVariantKey('');
    setPickerSearch('');
    setSelectedVariantRow(null);
  };

  const handleChooseProduct = (item) => {
    setSelectedProductKey(item.key);
    setSelectedVariantKey('');
    setPickerSearch('');
    setSelectedVariantRow(
      hasVariantOptions(item)
        ? null
        : (item?.variants?.[0]?.row || null),
    );
  };

  const handleChooseVariant = (item) => {
    setSelectedVariantKey(item.key);
    setSelectedVariantRow(item.row);
  };

  const handleConfirmPickerSelection = () => {
    if (!selectedVariantRow) {
      return;
    }
    onSelectProductVariant?.(selectedVariantRow);
    setIsPickerOpen(false);
  };

  const showPickerConfirmButton = pickerStep === 'variant' || (pickerStep === 'product' && selectedProduct && !selectedProductHasVariants);

  const handleToggleLbMaxItem = (item) => {
    const id = Number(item.id || 0);
    const isSelected = Number(lbMaxDraftProductId || 0) === id;
    const nextId = isSelected ? null : id;
    setLbMaxDraftProductId(nextId);
    onSaveSelectedLbMax?.(nextId);
  };

  const handleClearLbMax = () => {
    onSaveSelectedLbMax?.(null);
    setIsLbMaxPickerOpen(false);
  };

  const handleConfirmLbMax = () => {
    onSaveSelectedLbMax?.(Number(lbMaxDraftProductId || 0) || null);
    setIsLbMaxPickerOpen(false);
  };

  const handleToggleStickerFinishing = (item) => {
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
  };

  const handleToggleGroupCollapse = (groupKey) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleChangeMataAyamQty = (id, value, shouldAutoApply) => {
    const sanitized = String(value || '').replace(/[^0-9]/g, '');
    const nextMap = {
      ...(finishingDraftMataAyamQtyById || {}),
      [id]: sanitized,
    };
    setFinishingDraftMataAyamQtyById(nextMap);
    if (shouldAutoApply) {
      commitFinishingSelection(finishingDraftIds, nextMap);
    }
  };

  const handleClearFinishingSelection = () => {
    onSaveSelectedFinishings?.([]);
    onSaveSelectedFinishingMataAyamQtyById?.({});
    setIsFinishingPickerOpen(false);
  };

  const handleConfirmFinishingSelection = () => {
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
  };

  return (
    <View style={styles.panel}>
      <ProductInputGrid
        styles={styles}
        productName={productName}
        onOpenProductPicker={openPicker}
        qty={qty}
        onChangeQty={onChangeQty}
        primaryInputLabel={primaryInputLabel}
        secondaryInputLabel={secondaryInputLabel}
        summaryColumnLabel={summaryColumnLabel}
        hideFinishingField={hideFinishingField}
        showPagesInput={showPagesInput}
        pageInputLabel={pageInputLabel}
        showBookPrintRuleSection={showBookPrintRuleSection}
        bookDisplayPrimary={bookDisplayPrimary}
        bookDisplaySecondary={bookDisplaySecondary}
        isFixedSizeProduct={isFixedSizeProduct}
        fixedSizeLabel={fixedSizeLabel}
        isQtyOnlyProduct={isQtyOnlyProduct}
        isStrictStickerFinishingMode={isStrictStickerFinishingMode}
        qtyOnlyInputText={qtyOnlyInputText}
        qtyOnlyStatusText={qtyOnlyStatusText}
        sizeWidthMeter={sizeWidthMeter}
        onChangeSizeWidthMeter={onChangeSizeWidthMeter}
        sizeLengthMeter={sizeLengthMeter}
        onChangeSizeLengthMeter={onChangeSizeLengthMeter}
        onOpenFinishingPicker={openFinishingPicker}
        finishingDisabled={finishings.length === 0}
        finishingSummary={finishingSummary}
        finishingFallbackText={finishings.length > 0 ? 'Pilih finishing...' : 'Finishing belum siap'}
        finishingAvailabilityMessage={!finishingSummary && finishings.length === 0 ? finishingAvailabilityMessage : ''}
        showMataAyamIssue={Boolean(mataAyamIssueBadge?.visible)}
        mataAyamIssueMessage={mataAyamIssueBadge?.message}
        isPrintingFinishingMode={isPrintingFinishingMode}
        onOpenLbMaxPicker={openLbMaxPicker}
        lbMaxDisabled={lbMaxFinishings.length === 0}
        lbMaxSummary={lbMaxSummary}
        lbMaxFallbackText={lbMaxFinishings.length > 0 ? 'Pilih LB Max...' : 'LB Max tidak tersedia'}
        showClearLbMax={Boolean(selectedLbMaxProductId)}
        onClearLbMax={() => onSaveSelectedLbMax?.(null)}
        pages={pages}
        onChangePages={onChangePages}
        materialDisplay={materialDisplay}
        qtyOnlyMaterialText={qtyOnlyMaterialText}
        materialError={materialError}
        materialWarning={materialWarning}
      />

      <ProductModePanel
        styles={styles}
        isFixedSizeProduct={isFixedSizeProduct}
        fixedSizeHint={fixedSizeHint}
        showBookPrintRuleSection={showBookPrintRuleSection}
        bookProductLabel={bookProductLabel}
        bookType={bookType}
        bookTypeOptions={bookTypeOptions}
        bookWizardSteps={bookWizardSteps}
        onChangeBookType={onChangeBookType}
        bookSegment={bookSegment}
        bookCashierNote={bookCashierNote}
        bookFinishedSize={bookFinishedSize}
        bookFinishedSizeOptions={bookFinishedSizeOptions}
        onChangeBookFinishedSize={onChangeBookFinishedSize}
        bookMaterialInsideProductId={bookMaterialInsideProductId}
        bookMaterialInsideOptions={bookMaterialInsideOptions}
        onChangeBookMaterialInside={onChangeBookMaterialInside}
        bookMaterialCoverProductId={bookMaterialCoverProductId}
        bookMaterialCoverOptions={bookMaterialCoverOptions}
        onChangeBookMaterialCover={onChangeBookMaterialCover}
        bookPrintModel={bookPrintModel}
        bookPrintModelOptions={bookPrintModelOptions}
        onChangeBookPrintModel={onChangeBookPrintModel}
        bookPrintSide={bookPrintSide}
        bookPrintSideOptions={bookPrintSideOptions}
        onChangeBookPrintSide={onChangeBookPrintSide}
        bookInsidePrint={bookInsidePrint}
        bookInsidePrintOptions={bookInsidePrintOptions}
        onChangeBookInsidePrint={onChangeBookInsidePrint}
        bookCoverPrint={bookCoverPrint}
        bookCoverPrintOptions={bookCoverPrintOptions}
        onChangeBookCoverPrint={onChangeBookCoverPrint}
        bookBindingType={bookBindingType}
        bookBindingTypeOptions={bookBindingTypeOptions}
        onChangeBookBindingType={onChangeBookBindingType}
        bookExtraFinishingValues={bookExtraFinishingValues}
        bookExtraFinishingOptions={bookExtraFinishingOptions}
        onToggleBookExtraFinishing={onToggleBookExtraFinishing}
        bookPrintRulePreview={bookPrintRulePreview}
        bookPageValidation={bookPageValidation}
        pages={bookPages}
        onChangePages={onChangeBookPages}
        bookPrintRulePrompt={bookPrintRulePrompt}
        isQtyOnlyProduct={isQtyOnlyProduct}
        qtyOnlyHelperText={qtyOnlyHelperText}
      />

      <ProductPricingPanel
        styles={styles}
        negotiationNotice={negotiationNotice}
        negotiatedPriceInput={negotiatedPriceInput}
        onChangeNegotiatedPrice={onChangeNegotiatedPrice}
        onValidateProduct={onValidateProduct}
        onAddToCart={onAddToCart}
        onCancelItem={onCancelItem}
        onClearCart={onClearCart}
        itemFinalPrice={itemFinalPrice}
        pricingSummary={pricingSummary}
      />

      <ProductPickerModal
        styles={styles}
        visible={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        title={pickerTitle}
        subtitle={pickerSubtitle}
        searchValue={pickerSearch}
        onChangeSearch={setPickerSearch}
        searchPlaceholder={pickerSearchPlaceholder}
        onClearSearch={() => setPickerSearch('')}
        pickerStep={pickerStep}
        filteredCategories={filteredCategories}
        filteredSubcategories={filteredSubcategories}
        filteredProducts={filteredProducts}
        filteredVariants={filteredVariants}
        selectedCategoryKey={selectedCategoryKey}
        selectedSubCategoryKey={selectedSubCategoryKey}
        selectedProductKey={selectedProductKey}
        selectedVariantKey={selectedVariantKey}
        onChooseCategory={handleChooseCategory}
        onChooseSubCategory={handleChooseSubCategory}
        onChooseProduct={handleChooseProduct}
        onChooseVariant={handleChooseVariant}
        categories={categories}
        onBack={goBack}
        confirmVisible={showPickerConfirmButton}
        confirmDisabled={!selectedVariantRow}
        onConfirm={handleConfirmPickerSelection}
        formatProductOptionLabel={formatProductOptionLabel}
        formatVariantOptionLabel={formatVariantOptionLabel}
      />

      <ProductLbMaxModal
        styles={styles}
        visible={isLbMaxPickerOpen}
        onClose={() => setIsLbMaxPickerOpen(false)}
        rows={lbMaxFinishings}
        selectedId={lbMaxDraftProductId}
        onToggleItem={handleToggleLbMaxItem}
        onClear={handleClearLbMax}
        onConfirm={handleConfirmLbMax}
      />

      <ProductFinishingModal
        styles={styles}
        visible={isFinishingPickerOpen}
        onClose={() => setIsFinishingPickerOpen(false)}
        isStrictStickerFinishingMode={isStrictStickerFinishingMode}
        stickerFinishingRows={stickerFinishingRows}
        onToggleStickerFinishing={handleToggleStickerFinishing}
        finishingDraftIds={finishingDraftIds}
        setFinishingDraftMataAyamQtyById={setFinishingDraftMataAyamQtyById}
        groupOrder={groupOrder}
        groupedFinishings={groupedFinishings}
        groupTitleMap={groupTitleMap}
        groupNoteMap={groupNoteMap}
        collapsedGroups={collapsedGroups}
        onToggleGroupCollapse={handleToggleGroupCollapse}
        onTogglePrintingFinishing={togglePrintingFinishingSelection}
        finishings={finishings}
        selectedMataAyamRows={selectedMataAyamRows}
        finishingDraftMataAyamQtyById={finishingDraftMataAyamQtyById}
        onChangeMataAyamQty={handleChangeMataAyamQty}
        autoApplyFinishingSelection={autoApplyFinishingSelection}
        onClearAll={handleClearFinishingSelection}
        showClearAction={Array.isArray(selectedFinishingIds) && selectedFinishingIds.length > 0}
        onConfirm={handleConfirmFinishingSelection}
        formatFinishingLabel={formatFinishingLabel}
        getFinishingPrice={getFinishingPrice}
      />
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
  bookRuleCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#c8d8f2',
    backgroundColor: '#f4f8ff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  bookRuleTitle: {
    fontSize: 12,
    color: '#174a8c',
    fontWeight: '800',
  },
  bookWizardStepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
    },
    bookWizardStepItem: {
      alignItems: 'center',
      gap: 3,
      minWidth: 54,
    },
    bookWizardStepDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
    borderColor: '#c1cce0',
    backgroundColor: '#eef2f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookWizardStepDotActive: {
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
  },
  bookWizardStepDotDone: {
    borderColor: '#1e8a4f',
    backgroundColor: '#22a35a',
  },
  bookWizardStepDotText: {
    fontSize: 11,
    color: '#51657f',
    fontWeight: '800',
  },
    bookWizardStepDotTextActive: {
      color: '#ffffff',
    },
    bookWizardStepLabel: {
      fontSize: 10,
      color: '#5e6f87',
      fontWeight: '700',
      textAlign: 'center',
    },
    bookWizardStepLabelActive: {
      color: '#15418d',
    },
    bookWizardHeaderCard: {
      borderWidth: 1,
      borderColor: '#c8d8f2',
      backgroundColor: '#f4f8ff',
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 6,
      marginBottom: 8,
    },
    bookWizardHeaderTitle: {
      fontSize: 12,
      color: '#15418d',
      fontWeight: '800',
    },
    bookWizardHeaderSubTitle: {
      fontSize: 11,
      color: '#4a607d',
      fontWeight: '600',
    },
    bookWizardSummaryGrid: {
      gap: 6,
    },
    bookReadOnlyRow: {
      borderWidth: 1,
      borderColor: '#d7e2f3',
      backgroundColor: '#ffffff',
      paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  bookReadOnlyLabel: {
    fontSize: 11,
    color: '#48607e',
    fontWeight: '700',
  },
  bookReadOnlyValue: {
    fontSize: 12,
    color: '#183b63',
    fontWeight: '700',
  },
  bookOptionGroup: {
    gap: 5,
  },
  bookOptionLabel: {
    fontSize: 11,
    color: '#35516f',
    fontWeight: '700',
  },
  bookOptionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bookOptionChip: {
    borderWidth: 1,
    borderColor: '#b9c8e6',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bookOptionChipBody: {
    gap: 2,
  },
  bookOptionChipActive: {
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
  },
  bookOptionChipText: {
    fontSize: 11,
    color: '#29405f',
    fontWeight: '700',
  },
  bookOptionChipPrice: {
    fontSize: 10,
    color: '#5f7390',
    fontWeight: '700',
  },
  bookOptionChipTextActive: {
    color: '#ffffff',
  },
  bookRuleResultCard: {
    borderWidth: 1,
    borderColor: '#d6deea',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  bookRuleResultLine: {
    fontSize: 11,
    color: '#29405f',
    fontWeight: '700',
  },
  bookRuleMessage: {
    fontSize: 11,
    color: '#4a607d',
    fontWeight: '600',
  },
  bookRuleHint: {
    fontSize: 11,
    color: '#4a607d',
    fontWeight: '600',
  },
  bookWarningBadge: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#d45d5d',
    backgroundColor: '#fff1f1',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  bookWarningText: {
    fontSize: 11,
    color: '#8d2222',
    fontWeight: '700',
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












