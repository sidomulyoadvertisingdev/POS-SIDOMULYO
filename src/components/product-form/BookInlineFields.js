import { Text, View } from 'react-native';

const BookInlineFields = ({
  styles,
  bookDisplayPrimary,
  bookDisplaySecondary,
}) => (
  <>
    <View style={styles.sizeCol}>
      <View style={[styles.readOnlyBox, styles.fixedSizeBox]}>
        <Text style={[styles.readOnlyText, styles.fixedSizeValueText]}>{bookDisplayPrimary || 'Book'}</Text>
      </View>
    </View>

    <View style={styles.sizeCol}>
      <View style={[styles.readOnlyBox, styles.fixedSizeBox]}>
        <Text style={[styles.readOnlyText, styles.fixedSizeMetaText]}>{bookDisplaySecondary || 'Atur di panel bawah'}</Text>
      </View>
    </View>
  </>
);

export default BookInlineFields;
