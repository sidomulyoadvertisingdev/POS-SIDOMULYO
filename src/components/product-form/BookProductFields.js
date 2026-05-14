import MaterialSummaryField from './MaterialSummaryField';
import PagesField from './PagesField';
import ProductModeInlineFields from './ProductModeInlineFields';

const BookProductFields = ({
  styles,
  bookDisplayPrimary,
  bookDisplaySecondary,
  pages,
  onChangePages,
  materialDisplay,
  materialError,
  materialWarning,
}) => (
  <>
    <ProductModeInlineFields
      styles={styles}
      showBookPrintRuleSection
      bookDisplayPrimary={bookDisplayPrimary}
      bookDisplaySecondary={bookDisplaySecondary}
      isFixedSizeProduct={false}
      fixedSizeLabel=""
      isQtyOnlyProduct={false}
      qtyOnlyInputText=""
      qtyOnlyStatusText=""
      sizeWidthMeter=""
      onChangeSizeWidthMeter={undefined}
      sizeLengthMeter=""
      onChangeSizeLengthMeter={undefined}
    />
    <PagesField
      styles={styles}
      pages={pages}
      onChangePages={onChangePages}
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

export default BookProductFields;
