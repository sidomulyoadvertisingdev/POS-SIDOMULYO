import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

const ProductPickerModal = ({
  styles,
  visible,
  onClose,
  title,
  subtitle,
  searchValue,
  onChangeSearch,
  searchPlaceholder,
  onClearSearch,
  pickerStep,
  filteredCategories,
  filteredSubcategories,
  filteredProducts,
  filteredVariants,
  selectedCategoryKey,
  selectedSubCategoryKey,
  selectedProductKey,
  selectedVariantKey,
  onChooseCategory,
  onChooseSubCategory,
  onChooseProduct,
  onChooseVariant,
  categories,
  onBack,
  confirmVisible,
  confirmDisabled,
  onConfirm,
  formatProductOptionLabel,
  formatVariantOptionLabel,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>{title}</Text>
        <Text style={styles.modalSubTitle}>{subtitle}</Text>
        <View style={styles.searchSection}>
          <Text style={styles.searchSectionLabel}>Pencarian</Text>
          <View style={styles.searchRow}>
            <TextInput
              value={searchValue}
              onChangeText={onChangeSearch}
              placeholder={searchPlaceholder}
              placeholderTextColor="#777777"
              style={[styles.modalInput, styles.searchInput]}
            />
            <Pressable
              style={[styles.searchClearButton, !searchValue.trim() ? styles.searchClearButtonDisabled : null]}
              onPress={onClearSearch}
              disabled={!searchValue.trim()}
            >
              <Text style={styles.searchClearButtonText}>Bersihkan</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView style={styles.listWrap}>
          {pickerStep === 'category' && filteredCategories.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.listItem, selectedCategoryKey === item.key ? styles.listItemActiveRed : null]}
              onPress={() => onChooseCategory?.(item)}
            >
              <Text style={[styles.listItemText, selectedCategoryKey === item.key ? styles.listItemTextActiveRed : null]}>
                {item.name}
              </Text>
            </Pressable>
          ))}

          {pickerStep === 'subcategory' && filteredSubcategories.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.listItem, selectedSubCategoryKey === item.key ? styles.listItemActiveRed : null]}
              onPress={() => onChooseSubCategory?.(item)}
            >
              <Text style={[styles.listItemText, selectedSubCategoryKey === item.key ? styles.listItemTextActiveRed : null]}>
                {item.name}
              </Text>
            </Pressable>
          ))}

          {pickerStep === 'product' && filteredProducts.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.listItem, selectedProductKey === item.key ? styles.listItemActiveRed : null]}
              onPress={() => onChooseProduct?.(item)}
            >
              <Text style={[styles.listItemText, selectedProductKey === item.key ? styles.listItemTextActiveRed : null]}>
                {formatProductOptionLabel?.(item)}
              </Text>
            </Pressable>
          ))}

          {pickerStep === 'variant' && filteredVariants.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.listItem, selectedVariantKey === item.key ? styles.listItemActiveRed : null]}
              onPress={() => onChooseVariant?.(item)}
            >
              <Text style={[styles.listItemText, selectedVariantKey === item.key ? styles.listItemTextActiveRed : null]}>
                {formatVariantOptionLabel?.(item)}
              </Text>
            </Pressable>
          ))}
          {pickerStep === 'category' && filteredCategories.length === 0 ? (
            <Text style={styles.emptyText}>Kategori tidak ditemukan.</Text>
          ) : null}
          {pickerStep === 'subcategory' && filteredSubcategories.length === 0 ? (
            <Text style={styles.emptyText}>Sub kategori tidak ditemukan.</Text>
          ) : null}
          {pickerStep === 'product' && filteredProducts.length === 0 ? (
            <Text style={styles.emptyText}>Produk tidak ditemukan.</Text>
          ) : null}
          {pickerStep === 'variant' && filteredVariants.length === 0 ? (
            <Text style={styles.emptyText}>Varian tidak ditemukan.</Text>
          ) : null}

          {categories.length === 0 ? (
            <Text style={styles.emptyText}>Data produk backend belum tersedia.</Text>
          ) : null}
        </ScrollView>

        <View style={styles.modalActions}>
          <Pressable style={styles.secondaryButton} onPress={onBack}>
            <Text style={styles.secondaryButtonText}>
              {pickerStep === 'category' ? 'Tutup' : 'Kembali'}
            </Text>
          </Pressable>
          {confirmVisible ? (
            <Pressable
              style={[styles.primaryButton, confirmDisabled ? styles.primaryButtonDisabled : null]}
              onPress={onConfirm}
              disabled={confirmDisabled}
            >
              <Text style={styles.primaryButtonText}>Pilih Produk</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  </Modal>
);

export default ProductPickerModal;
