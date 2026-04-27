const STORAGE_KEY = 'pos_order_queue_v1';

let memoryQueue = [];

const canUseLocalStorage = () => {
  return typeof globalThis !== 'undefined' && typeof globalThis.localStorage !== 'undefined';
};

export const loadOrderQueue = () => {
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
  persistQueue(Array.isArray(queue) ? queue : []);
};
