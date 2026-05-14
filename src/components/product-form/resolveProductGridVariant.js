const resolveProductGridVariant = ({
  showBookPrintRuleSection,
  isFixedSizeProduct,
  isQtyOnlyProduct,
  isStrictStickerFinishingMode,
}) => {
  if (showBookPrintRuleSection) {
    return 'book';
  }

  if (isFixedSizeProduct) {
    return 'a3_fixed';
  }

  if (isQtyOnlyProduct) {
    return 'qty_only';
  }

  if (isStrictStickerFinishingMode) {
    return 'sticker';
  }

  return 'mmt';
};

export default resolveProductGridVariant;
