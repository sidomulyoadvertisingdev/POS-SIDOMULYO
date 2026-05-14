import FinishingField from './FinishingField';
import MaterialSummaryField from './MaterialSummaryField';
import ProductModeInlineFields from './ProductModeInlineFields';

const MeasuredProductFields = ({
  styles,
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
  materialDisplay,
  materialError,
  materialWarning,
}) => (
  <>
    <ProductModeInlineFields
      styles={styles}
      showBookPrintRuleSection={false}
      bookDisplayPrimary=""
      bookDisplaySecondary=""
      isFixedSizeProduct={false}
      fixedSizeLabel=""
      isQtyOnlyProduct={false}
      qtyOnlyInputText=""
      qtyOnlyStatusText=""
      sizeWidthMeter={sizeWidthMeter}
      onChangeSizeWidthMeter={onChangeSizeWidthMeter}
      sizeLengthMeter={sizeLengthMeter}
      onChangeSizeLengthMeter={onChangeSizeLengthMeter}
    />
    <FinishingField
      styles={styles}
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
    />
    <MaterialSummaryField
      styles={styles}
      hideFinishingField={false}
      isQtyOnlyProduct={false}
      materialDisplay={materialDisplay}
      qtyOnlyMaterialText=""
      materialError={materialError}
      materialWarning={materialWarning}
    />
  </>
);

export default MeasuredProductFields;
