const STORAGE_KEY = 'pos_order_audit_v1';
const MAX_LOGS = 20;

let memoryLogs = [];

const canUseLocalStorage = () => {
  return typeof globalThis !== 'undefined' && typeof globalThis.localStorage !== 'undefined';
};

export const loadOrderAuditLogs = () => {
  if (canUseLocalStorage()) {
    try {
      const raw = globalThis.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  return memoryLogs;
};

const persistLogs = (logs) => {
  const trimmed = logs.slice(0, MAX_LOGS);
  if (canUseLocalStorage()) {
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      // ignore storage errors
    }
    return;
  }
  memoryLogs = trimmed;
};

export const appendOrderAuditLog = (entry) => {
  const logs = loadOrderAuditLogs();
  const next = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      created_at: new Date().toISOString(),
      ...entry,
    },
    ...logs,
  ];
  persistLogs(next);
  return next.slice(0, MAX_LOGS);
};
