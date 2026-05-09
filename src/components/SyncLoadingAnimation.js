import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const PREPARE_LOADING_ANIMATION_URL = 'https://lottie.host/18669ada-1f61-4c4c-8a10-9524a347097c/RDeQWFRAU5.lottie';
const SYNC_LOADING_ANIMATION_URL = 'https://lottie.host/761dcf49-9308-4722-9b01-4f97b4b9f4ff/hnT1TEAzcL.lottie';

export default function SyncLoadingAnimation({ size = 112, variant = 'prepare' }) {
  if (Platform.OS !== 'web') {
    return <ActivityIndicator size="large" color="#2f64ef" />;
  }

  const source = variant === 'sync'
    ? SYNC_LOADING_ANIMATION_URL
    : PREPARE_LOADING_ANIMATION_URL;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <DotLottieReact
        src={source}
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
