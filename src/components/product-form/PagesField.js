import { TextInput, View } from 'react-native';

const PagesField = ({
  styles,
  pages,
  onChangePages,
}) => (
  <View style={styles.qtyCol}>
    <TextInput
      value={pages}
      onChangeText={onChangePages}
      placeholder="1"
      keyboardType="numeric"
      style={[styles.input, styles.alignCenter]}
    />
  </View>
);

export default PagesField;
