import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

const ProductFinishingModal = ({
  styles,
  visible,
  onClose,
  isStrictStickerFinishingMode,
  stickerFinishingRows,
  onToggleStickerFinishing,
  finishingDraftIds,
  setFinishingDraftMataAyamQtyById,
  groupOrder,
  groupedFinishings,
  groupTitleMap,
  groupNoteMap,
  collapsedGroups,
  onToggleGroupCollapse,
  onTogglePrintingFinishing,
  finishings,
  selectedMataAyamRows,
  finishingDraftMataAyamQtyById,
  onChangeMataAyamQty,
  autoApplyFinishingSelection,
  onClearAll,
  showClearAction,
  onConfirm,
  formatFinishingLabel,
  getFinishingPrice,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={styles.modalBackdrop}>
      <View style={[styles.modalCard, styles.finishingModalCard]}>
        <Text style={styles.modalTitle}>Pilih Finishing</Text>
        <Text style={styles.modalSubTitle}>
          {isStrictStickerFinishingMode
            ? 'Produk sticker bisa memilih beberapa finishing aktif sekaligus.'
            : 'List finishing sesuai aturan backend produk terpilih'}
        </Text>
        <ScrollView style={styles.listWrap}>
          {isStrictStickerFinishingMode ? (
            <View style={styles.finishingGroupCard}>
              <View style={styles.finishingGroupHeader}>
                <Text style={styles.finishingGroupTitle}>Finishing Sticker Aktif</Text>
              </View>
              <View style={styles.finishingGroupBody}>
                <Text style={styles.finishingGroupNote}>
                  Pilih satu atau beberapa finishing sticker yang aktif sesuai kebutuhan pelanggan.
                </Text>
                {stickerFinishingRows.map((item) => (
                  <Pressable
                    key={String(item.id || item.name)}
                    style={styles.finishingItemRow}
                    onPress={() => onToggleStickerFinishing?.(item)}
                  >
                    <View style={styles.finishingItemLeft}>
                      <Text style={styles.checkboxText}>
                        {finishingDraftIds.some((rowId) => Number(rowId) === Number(item.id || 0)) ? '[x]' : '[ ]'}
                      </Text>
                      <Text style={styles.finishingItemText}>{formatFinishingLabel?.(item)}</Text>
                    </View>
                    <View style={styles.finishingItemRight}>
                      <Text style={styles.finishingPriceText}>{getFinishingPrice?.(item)}</Text>
                      <Text style={styles.finishingTagText}>/STICKER</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : groupOrder.map((groupKey) => {
            const rows = groupedFinishings[groupKey] || [];
            if (rows.length === 0) {
              return null;
            }
            const isCollapsed = Boolean(collapsedGroups[groupKey]);
            return (
              <View key={groupKey} style={styles.finishingGroupCard}>
                <View style={styles.finishingGroupHeader}>
                  <Text style={styles.finishingGroupTitle}>{groupTitleMap[groupKey]}</Text>
                  <Pressable
                    style={styles.toggleButton}
                    onPress={() => onToggleGroupCollapse?.(groupKey)}
                  >
                    <Text style={styles.toggleButtonText}>{isCollapsed ? 'Buka' : 'Tutup'}</Text>
                  </Pressable>
                </View>
                {!isCollapsed ? (
                  <View style={styles.finishingGroupBody}>
                    <Text style={styles.finishingGroupNote}>{groupNoteMap[groupKey]}</Text>
                    {rows.map((item) => (
                      <Pressable
                        key={String(item.id || item.name)}
                        style={styles.finishingItemRow}
                        onPress={() => onTogglePrintingFinishing?.(item, groupKey)}
                      >
                        <View style={styles.finishingItemLeft}>
                          <Text style={styles.checkboxText}>
                            {finishingDraftIds.some((rowId) => Number(rowId) === Number(item.id || 0)) ? '[x]' : '[ ]'}
                          </Text>
                          <Text style={styles.finishingItemText}>{formatFinishingLabel?.(item)}</Text>
                        </View>
                        <View style={styles.finishingItemRight}>
                          <Text style={styles.finishingPriceText}>{getFinishingPrice?.(item)}</Text>
                          <Text style={styles.finishingTagText}>/{String(groupTitleMap[groupKey] || '').toUpperCase()}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
          {finishings.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada finishing untuk produk ini.</Text>
          ) : null}
        </ScrollView>
        {selectedMataAyamRows.length > 0 ? (
          <View style={styles.addonSection}>
            <Text style={styles.addonTitle}>Add-on Mata Ayam</Text>
            <Text style={styles.addonNote}>Isi jumlah mata ayam untuk finishing yang mengaktifkan add-on ini.</Text>
            {selectedMataAyamRows.map((item) => {
              const id = Number(item?.id || 0);
              return (
                <View key={`mata-ayam-${id}`} style={styles.addonRow}>
                  <Text style={styles.addonLabel}>{String(item?.name || 'Finishing')}</Text>
                  <TextInput
                    value={String(finishingDraftMataAyamQtyById?.[id] ?? '0')}
                    onChangeText={(value) => onChangeMataAyamQty?.(id, value, autoApplyFinishingSelection)}
                    keyboardType="numeric"
                    placeholder="0"
                    style={[styles.input, styles.addonInput]}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
        <View style={styles.modalActions}>
          {showClearAction ? (
            <Pressable style={styles.secondaryButton} onPress={onClearAll}>
              <Text style={styles.secondaryButtonText}>Tanpa Finishing</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.primaryButton} onPress={onConfirm}>
            <Text style={styles.primaryButtonText}>Pilih Finishing</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Tutup</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
);

export default ProductFinishingModal;
