import BookRulePanel from './BookRulePanel';
import ModeHintCard from './ModeHintCard';

const ProductModePanel = ({
  styles,
  isFixedSizeProduct,
  fixedSizeHint,
  showBookPrintRuleSection,
  bookProductLabel,
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
  pages,
  onChangePages,
  bookPrintRulePrompt,
  isQtyOnlyProduct,
  qtyOnlyHelperText,
}) => {
  if (isFixedSizeProduct && fixedSizeHint) {
    return <ModeHintCard styles={styles} message={fixedSizeHint} />;
  }

  if (showBookPrintRuleSection) {
    return (
      <BookRulePanel
        styles={styles}
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
        pages={pages}
        onChangePages={onChangePages}
        bookPrintRulePrompt={bookPrintRulePrompt}
      />
    );
  }

  if (isQtyOnlyProduct) {
    return <ModeHintCard styles={styles} message={qtyOnlyHelperText} />;
  }

  return null;
};

export default ProductModePanel;
