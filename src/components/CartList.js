import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

const asCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

const CartRow = ({ item, index, onDeleteItem }) => {
  return (
    <View style={styles.row}>
      <Text style={[styles.cell, styles.codeCell]}>{item.product}</Text>
      <Text style={[styles.cell, styles.qtyCell]}>{item.qty}</Text>
      <Text style={[styles.cell, styles.nameCell]} numberOfLines={1}>
        {item.size}
      </Text>
      <Text style={[styles.cell, styles.priceCell]}>{item.finishing}</Text>
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
