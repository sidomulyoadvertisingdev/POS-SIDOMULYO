import { appEnv } from '../config/appEnv';

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const toPositiveInt = (value) => {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const parseSizeText = (sizeText) => {
  const text = String(sizeText || '').replace(',', '.');
  const matches = text.match(/(\d+(\.\d+)?)\s*x\s*(\d+(\.\d+)?)/i);
  if (!matches) {
    return {
      widthCm: 0,
      heightCm: 0,
      widthMm: 0,
      heightMm: 0,
      areaM2: 0,
    };
  }

  const widthCm = Math.max(Number(matches[1]) || 0, 0);
  const heightCm = Math.max(Number(matches[3]) || 0, 0);
  const widthMm = Math.round(widthCm * 10);
  const heightMm = Math.round(heightCm * 10);
  const areaM2 = widthCm > 0 && heightCm > 0 ? (widthCm / 100) * (heightCm / 100) : 0;

  return {
    widthCm,
    heightCm,
    widthMm,
    heightMm,
    areaM2: Number(areaM2.toFixed(4)),
  };
};

export const mapPaymentStatusToTransactionType = (paymentStatus) => {
  const text = normalizeText(paymentStatus);
  if (['lunas', 'full', 'paid'].includes(text)) {
    return 'full';
  }
  if (['dp', 'partial', 'partially paid'].includes(text)) {
    return 'dp';
  }
  return 'unpaid';
};

export const mapPaymentMethodToBackend = (paymentMethod) => {
  const text = normalizeText(paymentMethod);
  if (['cash', 'tunai'].includes(text)) {
    return 'cash';
  }
  if (['transfer', 'bank transfer'].includes(text)) {
    return 'transfer';
  }
  if (['qris', 'qr', 'qris payment'].includes(text)) {
    return 'qris';
  }
  if (['card', 'kartu', 'debit', 'credit card'].includes(text)) {
    return 'card';
  }
  return 'cash';
};

export const mapPaymentMethodToBankAccountId = (paymentMethod) => {
  const method = mapPaymentMethodToBackend(paymentMethod);
  const byMethod = {
    cash: toPositiveInt(appEnv.bankAccountCashId),
    transfer: toPositiveInt(appEnv.bankAccountTransferId),
    qris: toPositiveInt(appEnv.bankAccountQrisId),
    card: toPositiveInt(appEnv.bankAccountCardId),
  };
  const fallback = toPositiveInt(appEnv.bankAccountDefaultId);
  return byMethod[method] || fallback || 0;
};

export const findByName = (rows, name) =>
  rows.find((row) => normalizeText(row.name) === normalizeText(name));
