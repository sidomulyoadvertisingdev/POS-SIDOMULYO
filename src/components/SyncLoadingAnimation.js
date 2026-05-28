import React from 'react';
import AppLoadingAnimation from './AppLoadingAnimation';

export default function SyncLoadingAnimation({ size = 112, variant = 'prepare' }) {
  const fallbackColor = variant === 'sync' ? '#1d6a3c' : '#0755b8';
  return <AppLoadingAnimation size={size} fallbackColor={fallbackColor} />;
}
