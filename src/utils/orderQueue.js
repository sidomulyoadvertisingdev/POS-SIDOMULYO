const STORAGE_KEY = 'pos_order_queue_v1';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

let memoryQueue = [];

const canUseLocalStorage = () => {
  return typeof globalThis !== 'undefined' && typeof globalThis.localStorage !== 'undefined';
};

const filterExpiredQueue = (queue) => {
  const now = Date.now();
  return (Array.isArray(queue) ? queue : []).filter((item) => {
    const createdAt = new Date(item?.created_at || 0).getTime();
    if (!Number.isFinite(createdAt) || createdAt <= 0) {
      return true;
    }
    return now - createdAt < DRAFT_TTL_MS;
  });
};

export const loadOrderQueue = () => {
  if (canUseLocalStorage()) {
    try {
      const raw = globalThis.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      const cleaned = filterExpiredQueue(parsed);
      if (cleaned.length !== (Array.isArray(parsed) ? parsed.length : 0)) {
        persistQueue(cleaned);
      }
      return cleaned;
    } catch (error) {
      return [];
    }
  }
  memoryQueue = filterExpiredQueue(memoryQueue);
  return memoryQueue;
};

const persistQueue = (queue) => {
  if (canUseLocalStorage()) {
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      // ignore storage full issues
    }
    return;
  }
  memoryQueue = queue;
};

export const enqueueOrderPayload = (payload) => {
  const queue = loadOrderQueue();
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    payload,
    created_at: new Date().toISOString(),
  };
  const updated = [...queue, item];
  persistQueue(updated);
  return item;
};

export const shiftOrderQueue = () => {
  const queue = loadOrderQueue();
  if (queue.length === 0) {
    return null;
  }
  const [first, ...rest] = queue;
  persistQueue(rest);
  return first;
};

export const setOrderQueue = (queue) => {
  persistQueue(filterExpiredQueue(queue));
};
