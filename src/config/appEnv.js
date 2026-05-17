import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

const trimString = (value) => String(value || '').trim();

export const appEnv = {
  appVersion: trimString(extra.appVersion),
  erpApiBaseUrl: trimString(extra.erpApiBaseUrl),
  allowLocalErpApi: trimString(extra.allowLocalErpApi),
  bankAccountCashId: trimString(extra.bankAccountCashId),
  bankAccountTransferId: trimString(extra.bankAccountTransferId),
  bankAccountQrisId: trimString(extra.bankAccountQrisId),
  bankAccountCardId: trimString(extra.bankAccountCardId),
  bankAccountDefaultId: trimString(extra.bankAccountDefaultId),
};
