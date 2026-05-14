import { Text, View } from 'react-native';

const QtyOnlyInlineFields = ({
  styles,
  qtyOnlyInputText,
  qtyOnlyStatusText,
}) => (
  <>
    <View style={styles.sizeCol}>
      <View style={[styles.readOnlyBox, styles.fixedSizeBox]}>
        <Text style={[styles.readOnlyText, styles.fixedSizeValueText]}>{qtyOnlyInputText}</Text>
      </View>
    </View>

    <View style={styles.sizeCol}>
      <View style={[styles.readOnlyBox, styles.fixedSizeBox]}>
        <Text style={[styles.readOnlyText, styles.fixedSizeMetaText]}>{qtyOnlyStatusText}</Text>
      </View>
    </View>
  </>
);

export default QtyOnlyInlineFields;
