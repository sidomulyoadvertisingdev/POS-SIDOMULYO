import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const SUCCESS_ANIMATION_URL = 'https://lottie.host/5e9be1f3-264e-4c73-801b-433908fd4d8e/UxUAIw3R1f.lottie';

export default function SuccessAnimation({ size = 164 }) {
  if (Platform.OS !== 'web') {
    return <ActivityIndicator size="large" color="#2e9b58" />;
  }

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <DotLottieReact
        src={SUCCESS_ANIMATION_URL}
        autoplay
        style={styles.animation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: {
    width: '100%',
    height: '100%',
  },
});
