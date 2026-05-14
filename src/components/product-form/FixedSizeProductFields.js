import MaterialSummaryField from './MaterialSummaryField';
import ProductModeInlineFields from './ProductModeInlineFields';

const FixedSizeProductFields = ({
  styles,
  fixedSizeLabel,
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
      isFixedSizeProduct
      fixedSizeLabel={fixedSizeLabel}
      isQtyOnlyProduct={false}
      qtyOnlyInputText=""
      qtyOnlyStatusText=""
      sizeWidthMeter=""
      onChangeSizeWidthMeter={undefined}
      sizeLengthMeter=""
      onChangeSizeLengthMeter={undefined}
    />
    <MaterialSummaryField
      styles={styles}
      hideFinishingField
      isQtyOnlyProduct={false}
      materialDisplay={materialDisplay}
      qtyOnlyMaterialText=""
      materialError={materialError}
      materialWarning={materialWarning}
    />
  </>
);

export default FixedSizeProductFields;
