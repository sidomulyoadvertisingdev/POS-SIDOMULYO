import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

const ProductLbMaxModal = ({
  styles,
  visible,
  onClose,
  rows,
  selectedId,
  onToggleItem,
  onClear,
  onConfirm,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Pilih LB Max</Text>
        <Text style={styles.modalSubTitle}>LB Max hanya bisa dipilih 1 item per produk</Text>
        <ScrollView style={styles.listWrap}>
          {rows.map((item) => {
            const id = Number(item.id || 0);
            const isSelected = Number(selectedId || 0) === id;
            const extraWidthCm = Math.max(0, Number(item.lb_max_width_cm || 0) || 0);
            return (
              <Pressable
                key={String(id || item.name)}
                style={[styles.listItem, isSelected ? styles.listItemActiveRed : null]}
                onPress={() => onToggleItem?.(item)}
              >
                <Text style={[styles.listItemText, isSelected ? styles.listItemTextActiveRed : null]}>
                  {`${item.name || 'LB Max'}${extraWidthCm > 0 ? ` (+${extraWidthCm} cm)` : ''}`}
                </Text>
              </Pressable>
            );
          })}
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>Tidak ada opsi LB Max untuk produk ini.</Text>
          ) : null}
        </ScrollView>
        <View style={styles.modalActions}>
          <Pressable style={styles.secondaryButton} onPress={onClear}>
            <Text style={styles.secondaryButtonText}>Tanpa LB Max</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onConfirm}>
            <Text style={styles.primaryButtonText}>Pilih LB Max</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Tutup</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
);

export default ProductLbMaxModal;
