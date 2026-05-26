import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { appEnv } from '../config/appEnv';
import { getApiBaseUrl, getAuthToken } from './erpApi';

let echoInstance = null;

const trimString = (value) => String(value || '').trim();
const toPositivePort = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const resolveApiUrl = () => {
  try {
    return new URL(getApiBaseUrl());
  } catch (_error) {
    return null;
  }
};

export const getPosRealtimeConfig = () => {
  const apiUrl = resolveApiUrl();
  const scheme = trimString(appEnv.reverbScheme)
    || (apiUrl?.protocol === 'https:' ? 'https' : 'http');
  const host = trimString(appEnv.reverbHost)
    || trimString(apiUrl?.hostname)
    || '127.0.0.1';
  const fallbackPort = scheme === 'https' ? 443 : 8080;
  const port = toPositivePort(appEnv.reverbPort, fallbackPort);
  const appKey = trimString(appEnv.reverbAppKey);

  return {
    enabled: Boolean(appKey),
    appKey,
    host,
    port,
    scheme,
    authEndpoint: `${getApiBaseUrl()}/broadcasting/auth`,
  };
};

export const disconnectPosRealtime = () => {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
  }
};

export const getPosRealtime = () => {
  const config = getPosRealtimeConfig();
  if (!config.enabled) {
    return null;
  }

  const token = trimString(getAuthToken());
  if (!echoInstance) {
    globalThis.Pusher = Pusher;
    echoInstance = new Echo({
      broadcaster: 'reverb',
      key: config.appKey,
      wsHost: config.host,
      wsPort: config.port,
      wssPort: config.port,
      forceTLS: config.scheme === 'https',
      enabledTransports: ['ws', 'wss'],
      authEndpoint: config.authEndpoint,
      auth: {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    });
  }

  return echoInstance;
};

export const subscribeToInvoicePaymentUpdates = (invoiceId, handlers = {}) => {
  const normalizedInvoiceId = Number(invoiceId || 0);
  if (!(normalizedInvoiceId > 0)) {
    return () => {};
  }

  const echo = getPosRealtime();
  if (!echo) {
    handlers.onUnavailable?.(getPosRealtimeConfig());
    return () => {};
  }

  const channelName = `pos.invoice.${normalizedInvoiceId}`;
  const channel = echo.private(channelName);
  const eventName = '.pos.payment-transaction.updated';

  channel.listen(eventName, (payload) => {
    handlers.onUpdated?.(payload);
  });

  if (typeof channel.error === 'function') {
    channel.error((error) => {
      handlers.onError?.(error);
    });
  }

  return () => {
    try {
      channel.stopListening(eventName);
      echo.leave(channelName);
    } catch (_error) {
      // Ignore cleanup errors from transient websocket reconnects.
    }
  };
};
