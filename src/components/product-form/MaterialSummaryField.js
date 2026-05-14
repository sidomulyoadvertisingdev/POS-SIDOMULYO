import { Text, View } from 'react-native';

const MaterialSummaryField = ({
  styles,
  hideFinishingField,
  isQtyOnlyProduct,
  materialDisplay,
  qtyOnlyMaterialText,
  materialError,
  materialWarning,
}) => (
  <View style={[styles.totalCol, hideFinishingField ? styles.totalColWide : null]}>
    <View style={styles.readOnlyBox}>
      <Text style={styles.readOnlyText}>
        {isQtyOnlyProduct ? (materialDisplay || qtyOnlyMaterialText) : (materialDisplay || '-')}
      </Text>
    </View>
    {materialError ? (
      <View style={styles.materialErrorBadge}>
        <Text style={styles.materialErrorBadgeText}>{String(materialError)}</Text>
      </View>
    ) : null}
    {!materialError && materialWarning ? (
      <View style={styles.materialWarningBadge}>
        <Text style={styles.materialWarningBadgeText}>{String(materialWarning)}</Text>
      </View>
    ) : null}
  </View>
);

export default MaterialSummaryField;
