const appJson = require('./app.json');

const trimString = (value) => String(value || '').trim();

module.exports = () => ({
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo?.extra,
      erpApiBaseUrl: trimString(process.env.EXPO_PUBLIC_ERP_API_BASE_URL),
      erpEmail: trimString(process.env.EXPO_PUBLIC_ERP_EMAIL),
      erpPassword: String(process.env.EXPO_PUBLIC_ERP_PASSWORD || ''),
      erpToken: trimString(process.env.EXPO_PUBLIC_ERP_TOKEN),
      appVersion: trimString(process.env.EXPO_PUBLIC_APP_VERSION),
      bankAccountCashId: trimString(process.env.EXPO_PUBLIC_BANK_ACCOUNT_CASH_ID),
      bankAccountTransferId: trimString(process.env.EXPO_PUBLIC_BANK_ACCOUNT_TRANSFER_ID),
      bankAccountQrisId: trimString(process.env.EXPO_PUBLIC_BANK_ACCOUNT_QRIS_ID),
      bankAccountCardId: trimString(process.env.EXPO_PUBLIC_BANK_ACCOUNT_CARD_ID),
      bankAccountDefaultId: trimString(process.env.EXPO_PUBLIC_BANK_ACCOUNT_DEFAULT_ID),
    },
  },
});
