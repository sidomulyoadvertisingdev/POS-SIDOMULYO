import { Pressable, Text, TextInput, View } from 'react-native';
import { formatRupiah } from '../../utils/currency';

const ProductPricingPanel = ({
  styles,
  negotiationNotice,
  negotiatedPriceInput,
  onChangeNegotiatedPrice,
  onValidateProduct,
  onAddToCart,
  onCancelItem,
  onClearCart,
  itemFinalPrice,
  pricingSummary,
}) => (
  <>
    {negotiationNotice?.visible ? (
      <View
        style={[
          styles.negotiationCard,
          negotiationNotice?.tone === 'error' ? styles.negotiationCardError : null,
          negotiationNotice?.tone === 'warning' ? styles.negotiationCardWarning : null,
          negotiationNotice?.tone === 'success' ? styles.negotiationCardSuccess : null,
        ]}
      >
        <Text style={styles.negotiationTitle}>Negosiasi A3+</Text>
        <TextInput
          value={String(negotiatedPriceInput || '')}
          onChangeText={onChangeNegotiatedPrice}
          placeholder="Isi harga negosiasi"
          keyboardType="numeric"
          style={styles.negotiationInput}
        />
        <Text style={styles.negotiationMessage}>{String(negotiationNotice?.message || '')}</Text>
      </View>
    ) : null}

    <View style={styles.actionRow}>
      <Pressable onPress={onValidateProduct} style={[styles.button, styles.searchButton]}>
        <Text style={styles.buttonText}>Cek Produk</Text>
      </Pressable>

      <View style={styles.rightActions}>
        <Pressable onPress={onAddToCart} style={[styles.button, styles.addButton]}>
          <Text style={styles.buttonText}>Simpan Item</Text>
        </Pressable>
        <Pressable onPress={onCancelItem} style={[styles.button, styles.addButton]}>
          <Text style={styles.buttonText}>Batal Item</Text>
        </Pressable>
        <Pressable onPress={onClearCart} style={[styles.button, styles.deleteButton]}>
          <Text style={styles.buttonText}>Hapus Semua Item</Text>
        </Pressable>
      </View>
    </View>

    <Text style={styles.previewText}>Estimasi Total Item: {formatRupiah(itemFinalPrice)}</Text>
    {pricingSummary ? (
      <View style={styles.previewSummaryCard}>
        <Text style={styles.previewSummaryLine}>Cetak: {formatRupiah(pricingSummary.subtotal || 0)}</Text>
        {pricingSummary?.isNegotiated ? (
          <Text style={styles.previewSummaryLine}>
            Cetak Nego: {formatRupiah(pricingSummary.negotiatedSubtotal || 0)}
          </Text>
        ) : null}
        {pricingSummary?.bundleActive ? (
          <>
            <Text style={styles.previewSummaryLine}>
              Finishing: {formatRupiah(pricingSummary.finishingBeforeDiscount || 0)}
            </Text>
            <Text style={styles.previewSummaryLine}>
              Diskon Bundle: {formatRupiah(pricingSummary.bundleDiscount || 0)}
            </Text>
            <Text style={styles.previewSummaryLine}>
              Finishing Final: {formatRupiah(pricingSummary.finishingFinal || 0)}
            </Text>
            <Text style={styles.previewSummaryLine}>
              Total Final: {formatRupiah(pricingSummary.printSubtotal || 0)} + {formatRupiah(pricingSummary.finishingBeforeDiscount || 0)} - {formatRupiah(pricingSummary.bundleDiscount || 0)} = {formatRupiah(pricingSummary.grandTotal || 0)}
            </Text>
          </>
        ) : (
          <Text style={styles.previewSummaryLine}>
            Finishing Final: {formatRupiah(pricingSummary.finishingFinal || 0)}
          </Text>
        )}
        {pricingSummary.billingGroup ? (
          <Text style={styles.previewSummaryLine}>
            Rule Sticker: {pricingSummary.billingGroup}
            {Number(pricingSummary.rollWidth || 0) > 0 ? ` | Lebar Roll ${pricingSummary.rollWidth} m` : ''}
          </Text>
        ) : null}
        {pricingSummary?.stickerNotice ? (
          <Text style={styles.previewWarningLine}>{pricingSummary.stickerNotice}</Text>
        ) : null}
      </View>
    ) : null}
  </>
);

export default ProductPricingPanel;
