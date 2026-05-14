import { Text, View } from 'react-native';

const ModeHintCard = ({
  styles,
  message,
}) => (
  <View style={styles.fixedSizeHintCard}>
    <Text style={styles.fixedSizeHintText}>{String(message || '')}</Text>
  </View>
);

export default ModeHintCard;
