import { Text, View } from 'react-native';

const FixedSizeInlineFields = ({
  styles,
  fixedSizeLabel,
}) => (
  <>
    <View style={styles.sizeCol}>
      <View style={[styles.readOnlyBox, styles.fixedSizeBox]}>
        <Text style={[styles.readOnlyText, styles.fixedSizeValueText]}>{fixedSizeLabel || 'A3+'}</Text>
      </View>
    </View>

    <View style={styles.sizeCol}>
      <View style={[styles.readOnlyBox, styles.fixedSizeBox]}>
        <Text style={[styles.readOnlyText, styles.fixedSizeMetaText]}>Ukuran Tetap</Text>
      </View>
    </View>
  </>
);

export default FixedSizeInlineFields;
