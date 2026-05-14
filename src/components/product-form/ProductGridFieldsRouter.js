import BookProductFields from './BookProductFields';
import FixedSizeProductFields from './FixedSizeProductFields';
import MmtProductFields from './MmtProductFields';
import QtyOnlyProductFields from './QtyOnlyProductFields';
import StickerProductFields from './StickerProductFields';

const ProductGridFieldsRouter = ({
  variant,
  ...props
}) => {
  if (variant === 'book') {
    return <BookProductFields {...props} />;
  }

  if (variant === 'sticker') {
    return <StickerProductFields {...props} />;
  }

  if (variant === 'qty_only') {
    return <QtyOnlyProductFields {...props} />;
  }

  if (variant === 'a3_fixed') {
    return <FixedSizeProductFields {...props} />;
  }

  return <MmtProductFields {...props} />;
};

export default ProductGridFieldsRouter;
