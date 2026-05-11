import React from 'react';
import AppLoadingAnimation from './AppLoadingAnimation';

export default function SyncLoadingAnimation({ size = 112, variant = 'prepare' }) {
  const fallbackColor = variant === 'sync' ? '#1d6a3c' : '#2f64ef';
  return <AppLoadingAnimation size={size} fallbackColor={fallbackColor} />;
}
