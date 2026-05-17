const appJson = require('./app.json');
const packageJson = require('./package.json');

const trimString = (value) => String(value || '').trim();
const DEFAULT_ERP_API_BASE_URL = 'https://dashboard.sidomulyoproject.com/api';
const LOCAL_ERP_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const resolveAppVersion = () => trimString(process.env.EXPO_PUBLIC_APP_VERSION) || trimString(packageJson.version);
const shouldAllowLocalApiUrl = () => ['1', 'true', 'yes'].includes(trimString(process.env.EXPO_PUBLIC_ALLOW_LOCAL_ERP_API).toLowerCase());
const isLocalApiBaseUrl = (url) => {
  const normalized = trimString(url);
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    return LOCAL_ERP_HOSTNAMES.has(String(parsed.hostname || '').trim().toLowerCase());
  } catch (_error) {
    return false;
  }
};
const resolveApiBaseUrl = () => {
  const configuredUrl = trimString(process.env.EXPO_PUBLIC_ERP_API_BASE_URL);
  if (!configuredUrl) {
    return DEFAULT_ERP_API_BASE_URL;
  }

  if (!shouldAllowLocalApiUrl() && isLocalApiBaseUrl(configuredUrl)) {
    return DEFAULT_ERP_API_BASE_URL;
  }

  return configuredUrl;
};

module.exports = () => ({
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo?.extra,
      erpApiBaseUrl: resolveApiBaseUrl(),
      erpEmail: trimString(process.env.EXPO_PUBLIC_ERP_EMAIL),
      erpPassword: String(process.env.EXPO_PUBLIC_ERP_PASSWORD || ''),
      erpToken: trimString(process.env.EXPO_PUBLIC_ERP_TOKEN),
      allowLocalErpApi: trimString(process.env.EXPO_PUBLIC_ALLOW_LOCAL_ERP_API),
      appVersion: resolveAppVersion(),
      bankAccountCashId: trimString(process.env.EXPO_PUBLIC_BANK_ACCOUNT_CASH_ID),
      bankAccountTransferId: trimString(process.env.EXPO_PUBLIC_BANK_ACCOUNT_TRANSFER_ID),
      bankAccountQrisId: trimString(process.env.EXPO_PUBLIC_BANK_ACCOUNT_QRIS_ID),
      bankAccountCardId: trimString(process.env.EXPO_PUBLIC_BANK_ACCOUNT_CARD_ID),
      bankAccountDefaultId: trimString(process.env.EXPO_PUBLIC_BANK_ACCOUNT_DEFAULT_ID),
    },
  },
});
