import MaterialSummaryField from './MaterialSummaryField';
import ProductModeInlineFields from './ProductModeInlineFields';

const QtyOnlyProductFields = ({
  styles,
  qtyOnlyInputText,
  qtyOnlyStatusText,
  materialDisplay,
  qtyOnlyMaterialText,
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
      isQtyOnlyProduct
      qtyOnlyInputText={qtyOnlyInputText}
      qtyOnlyStatusText={qtyOnlyStatusText}
      sizeWidthMeter=""
      onChangeSizeWidthMeter={undefined}
      sizeLengthMeter=""
      onChangeSizeLengthMeter={undefined}
    />
    <MaterialSummaryField
      styles={styles}
      hideFinishingField
      isQtyOnlyProduct
      materialDisplay={materialDisplay}
      qtyOnlyMaterialText={qtyOnlyMaterialText}
      materialError={materialError}
      materialWarning={materialWarning}
    />
  </>
);

export default QtyOnlyProductFields;
