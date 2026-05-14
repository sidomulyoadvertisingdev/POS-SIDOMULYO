import { Pressable, Text, View } from 'react-native';

const FinishingField = ({
  styles,
  onOpenFinishingPicker,
  finishingDisabled,
  finishingSummary,
  finishingFallbackText,
  finishingAvailabilityMessage,
  showMataAyamIssue,
  mataAyamIssueMessage,
  isPrintingFinishingMode,
  onOpenLbMaxPicker,
  lbMaxDisabled,
  lbMaxSummary,
  lbMaxFallbackText,
  showClearLbMax,
  onClearLbMax,
}) => (
  <View style={styles.priceCol}>
    <Pressable style={styles.selector} onPress={onOpenFinishingPicker} disabled={finishingDisabled}>
      <Text style={styles.selectorText} numberOfLines={1} ellipsizeMode="tail">
        {finishingSummary || finishingFallbackText}
      </Text>
    </Pressable>
    {!finishingSummary && finishingAvailabilityMessage ? (
      <View style={styles.finishingHelpBadge}>
        <Text style={styles.finishingHelpBadgeText}>
          {String(finishingAvailabilityMessage)}
        </Text>
      </View>
    ) : null}
    {showMataAyamIssue ? (
      <View style={styles.mataAyamBadge}>
        <Text style={styles.mataAyamBadgeText}>
          {String(mataAyamIssueMessage || 'Mata ayam bermasalah')}
        </Text>
      </View>
    ) : null}
    {isPrintingFinishingMode ? (
      <View style={styles.lbMaxRow}>
        <Pressable
          style={[styles.selector, styles.lbMaxSelector]}
          onPress={onOpenLbMaxPicker}
          disabled={lbMaxDisabled}
        >
          <Text style={styles.selectorText} numberOfLines={1} ellipsizeMode="tail">
            {lbMaxSummary || lbMaxFallbackText}
          </Text>
        </Pressable>
        {showClearLbMax ? (
          <Pressable style={styles.clearLbMaxButton} onPress={onClearLbMax}>
            <Text style={styles.clearLbMaxText}>Hapus LB</Text>
          </Pressable>
        ) : null}
      </View>
    ) : null}
  </View>
);

export default FinishingField;
