import { Pressable, Text, TextInput, View } from 'react-native';
import ProductGridFieldsRouter from './ProductGridFieldsRouter';
import resolveProductGridVariant from './resolveProductGridVariant';

const ProductInputGrid = ({
  styles,
  productName,
  onOpenProductPicker,
  qty,
  onChangeQty,
  primaryInputLabel,
  secondaryInputLabel,
  summaryColumnLabel,
  hideFinishingField,
  showPagesInput,
  pageInputLabel,
  showBookPrintRuleSection,
  bookDisplayPrimary,
  bookDisplaySecondary,
  isFixedSizeProduct,
  fixedSizeLabel,
  isQtyOnlyProduct,
  isStrictStickerFinishingMode,
  qtyOnlyInputText,
  qtyOnlyStatusText,
  sizeWidthMeter,
  onChangeSizeWidthMeter,
  sizeLengthMeter,
  onChangeSizeLengthMeter,
  onOpenFinishingPicker,
  finishingDisabled,
  finishingSummary,
  finishingFallbackText,
  finishingAvailabilityMessage,
  showMataAyamIssue,
  mataAyamIssueMessage,
  isPrintingFinishingMode,
  onOpenLbMaxPicker,
  lbMaxDisabled,
  lbMaxSummary,
  lbMaxFallbackText,
  showClearLbMax,
  onClearLbMax,
  pages,
  onChangePages,
  materialDisplay,
  qtyOnlyMaterialText,
  materialError,
  materialWarning,
}) => {
  const productFormVariant = resolveProductGridVariant({
    showBookPrintRuleSection,
    isFixedSizeProduct,
    isQtyOnlyProduct,
    isStrictStickerFinishingMode,
  });

  return (
    <>
    <View style={styles.labelsRow}>
      <Text style={[styles.label, styles.codeCol, styles.leftLabel]}>Produk</Text>
      <Text style={[styles.label, styles.stockCol]}>Qty</Text>
      <Text style={[styles.label, styles.sizeCol]}>{primaryInputLabel}</Text>
      <Text style={[styles.label, styles.sizeCol]}>{secondaryInputLabel}</Text>
      {!hideFinishingField ? <Text style={[styles.label, styles.priceCol]}>Finishing</Text> : null}
      {showPagesInput ? <Text style={[styles.label, styles.qtyCol]}>{pageInputLabel}</Text> : null}
      <Text style={[styles.label, styles.totalCol, hideFinishingField ? styles.totalColWide : null]}>
        {summaryColumnLabel}
      </Text>
    </View>

    <View style={styles.inputsRow}>
      <View style={styles.codeCol}>
        <Pressable style={styles.selector} onPress={onOpenProductPicker}>
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

      <ProductGridFieldsRouter
        variant={productFormVariant}
        styles={styles}
        hideFinishingField={hideFinishingField}
        showBookPrintRuleSection={showBookPrintRuleSection}
        bookDisplayPrimary={bookDisplayPrimary}
        bookDisplaySecondary={bookDisplaySecondary}
        isFixedSizeProduct={isFixedSizeProduct}
        fixedSizeLabel={fixedSizeLabel}
        isQtyOnlyProduct={isQtyOnlyProduct}
        qtyOnlyInputText={qtyOnlyInputText}
        qtyOnlyStatusText={qtyOnlyStatusText}
        sizeWidthMeter={sizeWidthMeter}
        onChangeSizeWidthMeter={onChangeSizeWidthMeter}
        sizeLengthMeter={sizeLengthMeter}
        onChangeSizeLengthMeter={onChangeSizeLengthMeter}
        onOpenFinishingPicker={onOpenFinishingPicker}
        finishingDisabled={finishingDisabled}
        finishingSummary={finishingSummary}
        finishingFallbackText={finishingFallbackText}
        finishingAvailabilityMessage={finishingAvailabilityMessage}
        showMataAyamIssue={showMataAyamIssue}
        mataAyamIssueMessage={mataAyamIssueMessage}
        isPrintingFinishingMode={isPrintingFinishingMode}
        onOpenLbMaxPicker={onOpenLbMaxPicker}
        lbMaxDisabled={lbMaxDisabled}
        lbMaxSummary={lbMaxSummary}
        lbMaxFallbackText={lbMaxFallbackText}
        showClearLbMax={showClearLbMax}
        onClearLbMax={onClearLbMax}
        pages={pages}
        onChangePages={onChangePages}
        materialDisplay={materialDisplay}
        qtyOnlyMaterialText={qtyOnlyMaterialText}
        materialError={materialError}
        materialWarning={materialWarning}
        isStrictStickerFinishingMode={isStrictStickerFinishingMode}
      />
    </View>
  </>
  );
};

export default ProductInputGrid;
