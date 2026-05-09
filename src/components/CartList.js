import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

const asCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

const CartRow = ({ item, index, onDeleteItem }) => {
  const pricingSummary = item?.pricingSummary && typeof item.pricingSummary === 'object' ? item.pricingSummary : null;
  return (
    <View style={styles.row}>
      <View style={styles.codeCell}>
        <Text style={[styles.cell, styles.codeCellText]}>{item.product}</Text>
        {pricingSummary?.isNegotiated ? (
          <Text style={styles.negotiationText} numberOfLines={2}>
            Nego {asCurrency(pricingSummary.negotiatedSubtotal || 0)}
          </Text>
        ) : null}
        {pricingSummary?.billingGroup ? (
          <Text style={styles.metaText} numberOfLines={2}>
            Rule {pricingSummary.billingGroup}{Number(pricingSummary.rollWidth || 0) > 0 ? ` | Roll ${pricingSummary.rollWidth} m` : ''}
          </Text>
        ) : null}
        {item?.isGroupProduct ? (
          <Text style={styles.bundleMetaText} numberOfLines={2}>
            Paket{item?.groupSummary ? ` | ${item.groupSummary}` : ''}
          </Text>
        ) : null}
        {pricingSummary?.stickerNotice ? (
          <Text style={styles.warningText} numberOfLines={3}>
            {pricingSummary.stickerNotice}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.cell, styles.qtyCell]}>{item.qty}</Text>
      <Text style={[styles.cell, styles.nameCell]} numberOfLines={1}>
        {item.size}
      </Text>
      <View style={styles.priceCell}>
        <Text style={[styles.cell, styles.priceCellText]}>{item.finishing}</Text>
        {pricingSummary?.bundleActive ? (
          <Text style={styles.bundleDiscountText} numberOfLines={4}>
            Finishing: {asCurrency(pricingSummary.finishingBeforeDiscount || 0)}{'\n'}
            Diskon Bundle: {asCurrency(pricingSummary.bundleDiscount || 0)}{'\n'}
            Finishing Final: {asCurrency(pricingSummary.finishingFinal || 0)}{'\n'}
            Total Final: {asCurrency(pricingSummary.printSubtotal || 0)} + {asCurrency(pricingSummary.finishingBeforeDiscount || 0)} - {asCurrency(pricingSummary.bundleDiscount || 0)} = {asCurrency(item.total || pricingSummary.grandTotal || 0)}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.cell, styles.lbMaxCell]}>{item.lbMax || '-'}</Text>
      <Text style={[styles.cell, styles.totalCell]}>{item.material}</Text>
      <Text style={[styles.cell, styles.subtotalCell]}>{asCurrency(item.total)}</Text>
      <Pressable onPress={() => onDeleteItem?.(item, index)} style={styles.deleteButton} hitSlop={6}>
        <Text style={styles.deleteText}>Hapus</Text>
      </Pressable>
    </View>
  );
};

const CartList = ({ cartItems, onDeleteItem }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Barang yang dijual</Text>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.codeCell]}>Produk</Text>
        <Text style={[styles.headerCell, styles.qtyCell]}>Qty</Text>
        <Text style={[styles.headerCell, styles.nameCell]}>Ukuran</Text>
        <Text style={[styles.headerCell, styles.priceCell]}>Finishing</Text>
        <Text style={[styles.headerCell, styles.lbMaxCell]}>LB Max</Text>
        <Text style={[styles.headerCell, styles.totalCell]}>Bahan</Text>
        <Text style={[styles.headerCell, styles.subtotalCell]}>Total Item</Text>
        <Text style={[styles.headerCell, styles.actionCell]}>Opsi</Text>
      </View>

      <FlatList
        data={cartItems}
        keyExtractor={(item, index) => String(item?.id ?? `row-${index}`)}
        renderItem={({ item, index }) => <CartRow item={item} index={index} onDeleteItem={onDeleteItem} />}
        ListEmptyComponent={<Text style={styles.emptyText}>Belum ada item di keranjang.</Text>}
        contentContainerStyle={cartItems.length === 0 ? styles.emptyContainer : null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#aaaaaa',
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    color: '#1d1d1d',
    fontWeight: '700',
    marginBottom: 5,
  },
  headerRow: {
    backgroundColor: '#2f64ef',
    borderWidth: 1,
    borderColor: '#2250c9',
    paddingVertical: 5,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    backgroundColor: '#f8f8df',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#84a6ea',
    paddingVertical: 5,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  cell: {
    fontSize: 12,
    color: '#1f1f1f',
    textAlign: 'center',
  },
  codeCell: {
    width: 130,
  },
  codeCellText: {
    textAlign: 'left',
  },
  qtyCell: {
    width: 85,
    textAlign: 'center',
  },
  nameCell: {
    width: 170,
    textAlign: 'center',
  },
  priceCell: {
    width: 220,
  },
  priceCellText: {
    textAlign: 'left',
  },
  lbMaxCell: {
    width: 140,
    textAlign: 'center',
  },
  totalCell: {
    flex: 1,
    minWidth: 120,
    textAlign: 'center',
  },
  subtotalCell: {
    width: 170,
    textAlign: 'center',
  },
  actionCell: {
    width: 95,
  },
  deleteButton: {
    width: 82,
    marginLeft: 6,
    backgroundColor: '#982222',
    borderBottomWidth: 1,
    borderColor: '#982222',
    paddingVertical: 3,
    alignItems: 'center',
  },
  deleteText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  metaText: {
    marginTop: 2,
    fontSize: 10,
    color: '#36506f',
    textAlign: 'left',
  },
  bundleMetaText: {
    marginTop: 2,
    fontSize: 10,
    color: '#0b4f8a',
    textAlign: 'left',
    fontWeight: '700',
  },
  bundleDiscountText: {
    marginTop: 2,
    fontSize: 10,
    color: '#8f1f1f',
    textAlign: 'left',
    fontWeight: '700',
  },
  negotiationText: {
    marginTop: 2,
    fontSize: 10,
    color: '#0f6b42',
    textAlign: 'left',
    fontWeight: '700',
  },
  warningText: {
    marginTop: 2,
    fontSize: 10,
    color: '#8a6512',
    textAlign: 'left',
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: 14,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#84a6ea',
  },
  emptyText: {
    textAlign: 'center',
    color: '#555555',
    fontSize: 12,
  },
});

export default CartList;



