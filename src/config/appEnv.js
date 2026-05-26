import Constants from 'expo-constants';

const DEFAULT_ERP_API_BASE_URL = 'https://dashboard.sidomulyoproject.com/api';
const PRODUCTION_ERP_HOSTNAME = 'dashboard.sidomulyoproject.com';
const trimString = (value) => String(value || '').trim();
const extra = Constants.expoConfig?.extra || {};
const resolvePublicEnv = (key, fallback = '') => {
  const runtimeValue = trimString(process.env?.[key]);
  if (runtimeValue) {
    return runtimeValue;
  }

  return trimString(fallback);
};
const toBooleanFlag = (value) => ['1', 'true', 'yes'].includes(String(value || '').trim().toLowerCase());
const normalizeConfiguredApiBaseUrl = (url) => {
  const normalizedUrl = trimString(url).replace(/\/+$/, '');
  if (!normalizedUrl) {
    return '';
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    if (String(parsedUrl.hostname || '').trim().toLowerCase() === PRODUCTION_ERP_HOSTNAME) {
      parsedUrl.protocol = 'https:';
      return String(parsedUrl.toString() || '').replace(/\/+$/, '');
    }
  } catch (_error) {
    return normalizedUrl;
  }

  return normalizedUrl;
};
const forceOnlineErpApi = toBooleanFlag(
  resolvePublicEnv('EXPO_PUBLIC_FORCE_ONLINE_ERP_API', extra.forceOnlineErpApi),
);

export const appEnv = {
  appVersion: resolvePublicEnv('EXPO_PUBLIC_APP_VERSION', extra.appVersion),
  erpApiBaseUrl: forceOnlineErpApi
    ? DEFAULT_ERP_API_BASE_URL
    : normalizeConfiguredApiBaseUrl(resolvePublicEnv('EXPO_PUBLIC_ERP_API_BASE_URL', extra.erpApiBaseUrl)),
  forceOnlineErpApi: forceOnlineErpApi ? '1' : '',
  allowLocalErpApi: forceOnlineErpApi
    ? ''
    : resolvePublicEnv('EXPO_PUBLIC_ALLOW_LOCAL_ERP_API', extra.allowLocalErpApi),
  preferLocalErpApi: forceOnlineErpApi
    ? ''
    : resolvePublicEnv('EXPO_PUBLIC_PREFER_LOCAL_ERP_API', extra.preferLocalErpApi),
  bankAccountCashId: resolvePublicEnv('EXPO_PUBLIC_BANK_ACCOUNT_CASH_ID', extra.bankAccountCashId),
  bankAccountTransferId: resolvePublicEnv('EXPO_PUBLIC_BANK_ACCOUNT_TRANSFER_ID', extra.bankAccountTransferId),
  bankAccountQrisId: resolvePublicEnv('EXPO_PUBLIC_BANK_ACCOUNT_QRIS_ID', extra.bankAccountQrisId),
  bankAccountCardId: resolvePublicEnv('EXPO_PUBLIC_BANK_ACCOUNT_CARD_ID', extra.bankAccountCardId),
  bankAccountDefaultId: resolvePublicEnv('EXPO_PUBLIC_BANK_ACCOUNT_DEFAULT_ID', extra.bankAccountDefaultId),
  reverbAppKey: resolvePublicEnv('EXPO_PUBLIC_REVERB_APP_KEY', extra.reverbAppKey),
  reverbHost: resolvePublicEnv('EXPO_PUBLIC_REVERB_HOST', extra.reverbHost),
  reverbPort: resolvePublicEnv('EXPO_PUBLIC_REVERB_PORT', extra.reverbPort),
  reverbScheme: resolvePublicEnv('EXPO_PUBLIC_REVERB_SCHEME', extra.reverbScheme),
};
