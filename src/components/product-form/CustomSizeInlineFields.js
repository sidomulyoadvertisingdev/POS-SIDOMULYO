import { TextInput, View } from 'react-native';

const CustomSizeInlineFields = ({
  styles,
  sizeWidthMeter,
  onChangeSizeWidthMeter,
  sizeLengthMeter,
  onChangeSizeLengthMeter,
}) => (
  <>
    <View style={styles.sizeCol}>
      <TextInput
        value={sizeWidthMeter}
        onChangeText={onChangeSizeWidthMeter}
        placeholder="0.00"
        keyboardType="decimal-pad"
        style={[styles.input, styles.alignCenter]}
      />
    </View>

    <View style={styles.sizeCol}>
      <TextInput
        value={sizeLengthMeter}
        onChangeText={onChangeSizeLengthMeter}
        placeholder="0.00"
        keyboardType="decimal-pad"
        style={[styles.input, styles.alignCenter]}
      />
    </View>
  </>
);

export default CustomSizeInlineFields;
