const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const parseLooseMoneyValue = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? roundMoney(value) : 0;
  }
  const text = String(value || '').trim();
  if (!text) {
    return 0;
  }
  const normalized = text
    .replace(/rp/gi, '')
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
};

const extractOrderDiscountAmount = (sourceRow) => {
  const explicitCandidates = [
    sourceRow?.invoice?.discount,
    sourceRow?.invoice?.discount_total,
    sourceRow?.invoice?.discount_amount,
    sourceRow?.discount,
    sourceRow?.discount_total,
    sourceRow?.discount_amount,
    sourceRow?.order_discount,
    sourceRow?.order_discount_amount,
  ];
  const explicitMatch = explicitCandidates.find((value) => Number(parseLooseMoneyValue(value)) > 0);
  if (explicitMatch !== undefined) {
    return parseLooseMoneyValue(explicitMatch);
  }

  const noteSources = [
    sourceRow?.notes,
    sourceRow?.note,
    sourceRow?.payment?.note,
    sourceRow?.invoice?.note,
  ];
  for (const source of noteSources) {
    const text = String(source || '');
    if (!text.trim()) {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const match = String(line || '').match(/^diskon order\s*:\s*(.+)$/i);
      if (!match) {
        continue;
      }
      const amount = parseLooseMoneyValue(match[1]);
      if (amount > 0) {
        return amount;
      }
    }
  }

  return 0;
};

module.exports = {
  parseLooseMoneyValue,
  extractOrderDiscountAmount,
};
