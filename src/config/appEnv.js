import Constants from 'expo-constants';

const FORCE_ONLINE_ERP_API_BASE_URL = 'https://dashboard.sidomulyoproject.com/api';
const FORCE_ONLINE_ERP_API = true;
const trimString = (value) => String(value || '').trim();
const extra = Constants.expoConfig?.extra || {};
const resolvePublicEnv = (key, fallback = '') => {
  const runtimeValue = trimString(process.env?.[key]);
  if (runtimeValue) {
    return runtimeValue;
  }

  return trimString(fallback);
};

export const appEnv = {
  appVersion: resolvePublicEnv('EXPO_PUBLIC_APP_VERSION', extra.appVersion),
  erpApiBaseUrl: FORCE_ONLINE_ERP_API
    ? FORCE_ONLINE_ERP_API_BASE_URL
    : resolvePublicEnv('EXPO_PUBLIC_ERP_API_BASE_URL', extra.erpApiBaseUrl),
  allowLocalErpApi: FORCE_ONLINE_ERP_API
    ? ''
    : resolvePublicEnv('EXPO_PUBLIC_ALLOW_LOCAL_ERP_API', extra.allowLocalErpApi),
  bankAccountCashId: resolvePublicEnv('EXPO_PUBLIC_BANK_ACCOUNT_CASH_ID', extra.bankAccountCashId),
  bankAccountTransferId: resolvePublicEnv('EXPO_PUBLIC_BANK_ACCOUNT_TRANSFER_ID', extra.bankAccountTransferId),
  bankAccountQrisId: resolvePublicEnv('EXPO_PUBLIC_BANK_ACCOUNT_QRIS_ID', extra.bankAccountQrisId),
  bankAccountCardId: resolvePublicEnv('EXPO_PUBLIC_BANK_ACCOUNT_CARD_ID', extra.bankAccountCardId),
  bankAccountDefaultId: resolvePublicEnv('EXPO_PUBLIC_BANK_ACCOUNT_DEFAULT_ID', extra.bankAccountDefaultId),
};
