import BookInlineFields from './BookInlineFields';
import CustomSizeInlineFields from './CustomSizeInlineFields';
import FixedSizeInlineFields from './FixedSizeInlineFields';
import QtyOnlyInlineFields from './QtyOnlyInlineFields';

const ProductModeInlineFields = ({
  styles,
  showBookPrintRuleSection,
  bookDisplayPrimary,
  bookDisplaySecondary,
  isFixedSizeProduct,
  fixedSizeLabel,
  isQtyOnlyProduct,
  qtyOnlyInputText,
  qtyOnlyStatusText,
  sizeWidthMeter,
  onChangeSizeWidthMeter,
  sizeLengthMeter,
  onChangeSizeLengthMeter,
}) => {
  if (showBookPrintRuleSection) {
    return (
      <BookInlineFields
        styles={styles}
        bookDisplayPrimary={bookDisplayPrimary}
        bookDisplaySecondary={bookDisplaySecondary}
      />
    );
  }

  if (isFixedSizeProduct) {
    return (
      <FixedSizeInlineFields
        styles={styles}
        fixedSizeLabel={fixedSizeLabel}
      />
    );
  }

  if (isQtyOnlyProduct) {
    return (
      <QtyOnlyInlineFields
        styles={styles}
        qtyOnlyInputText={qtyOnlyInputText}
        qtyOnlyStatusText={qtyOnlyStatusText}
      />
    );
  }

  return (
    <CustomSizeInlineFields
      styles={styles}
      sizeWidthMeter={sizeWidthMeter}
      onChangeSizeWidthMeter={onChangeSizeWidthMeter}
      sizeLengthMeter={sizeLengthMeter}
      onChangeSizeLengthMeter={onChangeSizeLengthMeter}
    />
  );
};

export default ProductModeInlineFields;
