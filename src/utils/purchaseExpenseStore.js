const STORAGE_KEY = 'pos_purchase_expense_store_v1';

let memoryStore = {
  purchases: [],
  expenses: [],
};

const canUseLocalStorage = () => (
  typeof globalThis !== 'undefined' && typeof globalThis.localStorage !== 'undefined'
);

const normalizeRows = (rows) => (Array.isArray(rows) ? rows : []);

const normalizeStore = (value) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    purchases: normalizeRows(source.purchases),
    expenses: normalizeRows(source.expenses),
  };
};

const loadStore = () => {
  if (canUseLocalStorage()) {
    try {
      const raw = globalThis.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return normalizeStore(memoryStore);
      }
      return normalizeStore(JSON.parse(raw));
    } catch (_error) {
      return normalizeStore(memoryStore);
    }
  }
  memoryStore = normalizeStore(memoryStore);
  return memoryStore;
};

const persistStore = (store) => {
  const normalized = normalizeStore(store);
  if (canUseLocalStorage()) {
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (_error) {
      // ignore localStorage quota issues
    }
  }
  memoryStore = normalized;
};

const upsertRow = (rows, nextRow) => {
  const key = String(nextRow?.id || '').trim();
  if (!key) {
    return normalizeRows(rows);
  }
  const draftRows = normalizeRows(rows);
  const index = draftRows.findIndex((row) => String(row?.id || '').trim() === key);
  if (index >= 0) {
    const updated = [...draftRows];
    updated[index] = {
      ...updated[index],
      ...nextRow,
    };
    return updated;
  }
  return [nextRow, ...draftRows];
};

export const listStoredPembelianBahanRows = () => loadStore().purchases;

export const getStoredPembelianBahanRow = (id) => {
  const key = String(id || '').trim();
  if (!key) {
    return null;
  }
  return listStoredPembelianBahanRows().find((row) => String(row?.id || '').trim() === key) || null;
};

export const saveStoredPembelianBahanRow = (row) => {
  const store = loadStore();
  store.purchases = upsertRow(store.purchases, row);
  persistStore(store);
  return row;
};

export const listStoredPengeluaranRows = () => loadStore().expenses;

export const getStoredPengeluaranRow = (id) => {
  const key = String(id || '').trim();
  if (!key) {
    return null;
  }
  return listStoredPengeluaranRows().find((row) => String(row?.id || '').trim() === key) || null;
};

export const saveStoredPengeluaranRow = (row) => {
  const store = loadStore();
  store.expenses = upsertRow(store.expenses, row);
  persistStore(store);
  return row;
};
