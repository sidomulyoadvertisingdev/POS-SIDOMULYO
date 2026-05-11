import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export const APP_LOADING_ANIMATION_URL = 'https://lottie.host/33168019-ea65-4267-be34-234835c4324c/Z13BJwP3Mb.lottie';

export default function AppLoadingAnimation({
  size = 112,
  fallbackColor = '#2f64ef',
  style = null,
}) {
  const indicatorSize = size <= 28 ? 'small' : 'large';

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.wrapper, { width: size, height: size }, style]}>
        <ActivityIndicator size={indicatorSize} color={fallbackColor} />
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { width: size, height: size }, style]}>
      <DotLottieReact
        src={APP_LOADING_ANIMATION_URL}
        loop
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
