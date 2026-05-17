import Constants from 'expo-constants';

const DEFAULT_ERP_API_BASE_URL = 'https://dashboard.sidomulyoproject.com/api';

const resolveDefaultApiBaseUrl = () => {
  return DEFAULT_ERP_API_BASE_URL;
};

const normalizeApiBaseUrl = (url) => String(url || '').trim().replace(/\/+$/, '');

const isSupportedApiUrl = (url) => {
  const normalizedUrl = normalizeApiBaseUrl(url);
  if (!normalizedUrl) {
    return false;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    return ['http:', 'https:'].includes(parsedUrl.protocol) && Boolean(String(parsedUrl.hostname || '').trim());
  } catch (_error) {
    return false;
  }
};

const resolveRuntimeApiBaseUrl = (configuredUrl) => {
  const normalizedConfiguredUrl = normalizeApiBaseUrl(configuredUrl);
  if (!normalizedConfiguredUrl) {
    return resolveDefaultApiBaseUrl();
  }

  if (isSupportedApiUrl(normalizedConfiguredUrl)) {
    return normalizedConfiguredUrl;
  }

  throw new Error(
    `Base URL backend tidak valid: ${normalizedConfiguredUrl}. Gunakan URL absolut seperti https://dashboard.sidomulyoproject.com/api`,
  );
};

const extra = Constants.expoConfig?.extra || {};

const API_BASE_URL = resolveRuntimeApiBaseUrl(extra.erpApiBaseUrl);
const API_EMAIL = String(extra.erpEmail || '').trim();
const API_PASSWORD = String(extra.erpPassword || '');
const API_TOKEN = String(extra.erpToken || '').trim();
const REQUEST_TIMEOUT_MS = 20000;

let authToken = String(API_TOKEN || '').trim();
let sessionEmail = '';
let sessionPassword = '';
let refreshInProgress = null;

if (!isSupportedApiUrl(API_BASE_URL)) {
  throw new Error(`Base URL backend tidak valid atau belum terisi. Nilai saat ini: ${API_BASE_URL}`);
}

const createTimeoutError = (url) => {
  const error = new Error(`Request timeout setelah ${Math.round(REQUEST_TIMEOUT_MS / 1000)} detik. Cek koneksi ke backend: ${url}`);
  error.status = 0;
  error.code = 'REQUEST_TIMEOUT';
  return error;
};

const fetchWithTimeout = async (url, options = {}) => {
  let timeoutId = null;

  try {
    return await Promise.race([
      fetch(url, options),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(createTimeoutError(url));
        }, REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const buildHeaders = (extra = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
};

const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
};

const extractAuthToken = (body) => {
  if (!body) {
    return '';
  }

  if (typeof body === 'string') {
    return '';
  }

  return (
    body?.access_token ||
    body?.token ||
    body?.data?.access_token ||
    body?.data?.token ||
    body?.data?.accessToken ||
    body?.accessToken ||
    ''
  );
};

const authenticateWithCredentials = async (email, password) => {
  const resolvedEmail = String(email || '').trim();
  const resolvedPassword = String(password || '');

  if (!resolvedEmail || !resolvedPassword) {
    throw new Error('Email dan password backend wajib diisi.');
  }

  const loginUrl = `${API_BASE_URL}/auth/login`;
  const login = await fetchWithTimeout(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: resolvedEmail, password: resolvedPassword }),
  });
  const body = await parseJsonSafe(login);

  if (!login.ok) {
    throw new Error(body?.message || 'Login backend gagal.');
  }

  const token = extractAuthToken(body);
  if (!token) {
    throw new Error('Token backend tidak ditemukan dari response login.');
  }

  authToken = token;
  sessionEmail = resolvedEmail;
  sessionPassword = resolvedPassword;
  return body;
};

const request = async (path, options = {}, retryOnAuth = true) => {
  const requestUrl = `${API_BASE_URL}${path}`;
  const response = await fetchWithTimeout(requestUrl, {
    ...options,
    headers: buildHeaders(options.headers || {}),
  });

  if (response.redirected && typeof response.url === 'string') {
    const redirectedUrl = String(response.url || '');
    const redirectedToFrontend =
      typeof globalThis !== 'undefined'
      && globalThis.location
      && redirectedUrl.startsWith(globalThis.location.origin);
    if (redirectedToFrontend) {
      const error = new Error('Request API ter-redirect ke halaman frontend. Periksa CORS backend dan sesi login API.');
      error.status = response.status || 0;
      error.body = { redirected_from: requestUrl, redirected_to: redirectedUrl };
      throw error;
    }
  }

  const body = await parseJsonSafe(response);

  if (response.status === 401 && retryOnAuth && sessionEmail && sessionPassword) {
    if (!refreshInProgress) {
      refreshInProgress = authenticateWithCredentials(sessionEmail, sessionPassword)
        .catch((error) => {
          authToken = '';
          sessionEmail = '';
          sessionPassword = '';
          throw error;
        })
        .finally(() => {
          refreshInProgress = null;
        });
    }

    await refreshInProgress;
    return request(path, options, false);
  }

  if (!response.ok) {
    const message =
      body?.message ||
      body?.error ||
      (typeof body === 'string' ? body : 'Request API gagal.');
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
};

const toDataList = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
};

const toPaginatedDataList = (payload) => {
  const data = toDataList(payload);
  const currentPage = Number(payload?.current_page || 1) || 1;
  const lastPage = Number(payload?.last_page || currentPage) || currentPage;
  const perPage = Number(payload?.per_page || data.length || 0) || data.length;
  const total = Number(payload?.total || data.length || 0) || data.length;

  return {
    data,
    meta: {
      currentPage,
      lastPage,
      perPage,
      total,
      hasMore: currentPage < lastPage,
      nextPage: currentPage < lastPage ? currentPage + 1 : null,
    },
  };
};

const toDataItem = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data;
  }
  return payload;
};

const requestWithEndpointCandidates = async (paths, options = {}) => {
  const errors = [];
  for (const path of paths) {
    try {
      return await request(path, options);
    } catch (error) {
      const status = Number(error?.status || 0);
      if ([404, 405].includes(status)) {
        errors.push({ path, status });
        continue;
      }
      throw error;
    }
  }

  const endpoints = paths.join(', ');
  const details = errors.map((item) => `${item.path} (${item.status})`).join(', ');
  throw new Error(`Endpoint tidak ditemukan untuk request: ${endpoints}${details ? ` | ${details}` : ''}`);
};

const requestOptionalEndpointCandidates = async (paths, options = {}) => {
  for (const path of paths) {
    try {
      return await request(path, options);
    } catch (error) {
      const status = Number(error?.status || 0);
      if ([404, 405].includes(status)) {
        continue;
      }
      throw error;
    }
  }

  return null;
};

export const ensureAuthenticated = async () => {
  if (authToken) {
    return authToken;
  }

  throw new Error('Sesi login tidak ditemukan. Silakan login terlebih dahulu.');
};

export const loginPosUser = async (email, password) => {
  return authenticateWithCredentials(email, password);
};

export const logoutPosUser = async () => {
  const token = authToken;
  authToken = '';
  sessionEmail = '';
  sessionPassword = '';
  refreshInProgress = null;

  if (!token) {
    return;
  }

  try {
    await fetchWithTimeout(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    // no-op: local session tetap dibersihkan.
  }
};

export const hasActiveSession = () => Boolean(authToken);

export const getDefaultLoginEmail = () => API_EMAIL;

export const hasDefaultLoginPassword = () => Boolean(API_PASSWORD);

export const useDefaultLoginCredentials = async () => {
  if (authToken) {
    return { access_token: authToken };
  }
  if (!API_EMAIL || !API_PASSWORD) {
    throw new Error('Default kredensial belum diisi pada file .env');
  }
  return authenticateWithCredentials(API_EMAIL, API_PASSWORD);
};

export const fetchPosProducts = async () => {
  await ensureAuthenticated();
  const payload = await request('/pos/products?per_page=500');
  return toDataList(payload);
};

export const fetchPosProductDetail = async (productId) => {
  await ensureAuthenticated();
  return request(`/pos/products/${productId}`);
};

export const fetchPosFinishings = async () => {
  await ensureAuthenticated();
  const payload = await request('/pos/finishings?per_page=500');
  return toDataList(payload);
};

export const fetchPosMaterials = async () => {
  await ensureAuthenticated();
  const payload = await request('/pos/materials?per_page=500');
  return toDataList(payload);
};

export const fetchPosCustomersPage = async (search = '', options = {}) => {
  await ensureAuthenticated();
  const requestedPerPage = Number(options?.perPage || 0);
  const perPage = Number.isFinite(requestedPerPage) && requestedPerPage > 0
    ? Math.min(Math.max(Math.trunc(requestedPerPage), 1), 500)
    : 500;
  const requestedPage = Number(options?.page || 0);
  const page = Number.isFinite(requestedPage) && requestedPage > 0
    ? Math.trunc(requestedPage)
    : 1;
  const query = new URLSearchParams();
  query.set('per_page', String(perPage));
  query.set('page', String(page));
  if (search) {
    query.set('search', String(search));
  }
  const suffix = `?${query.toString()}`;
  const payload = await request(`/pos/customers${suffix}`);
  return toPaginatedDataList(payload);
};

export const fetchPosCustomers = async (search = '', options = {}) => {
  const payload = await fetchPosCustomersPage(search, options);
  return payload.data;
};

export const fetchAllPosCustomers = async (search = '', options = {}) => {
  const requestedPerPage = Number(options?.perPage || 0);
  const perPage = Number.isFinite(requestedPerPage) && requestedPerPage > 0
    ? Math.min(Math.max(Math.trunc(requestedPerPage), 1), 500)
    : 500;
  const requestedMaxPages = Number(options?.maxPages || 0);
  const maxPages = Number.isFinite(requestedMaxPages) && requestedMaxPages > 0
    ? Math.max(Math.trunc(requestedMaxPages), 1)
    : 100;

  const rowsById = new Map();
  let page = 1;

  while (page <= maxPages) {
    const response = await fetchPosCustomersPage(search, { perPage, page });
    response.data.forEach((row) => {
      const key = Number(row?.id || 0);
      if (key > 0) {
        rowsById.set(key, row);
        return;
      }
      rowsById.set(`${page}-${rowsById.size}`, row);
    });

    if (!response.meta?.hasMore) {
      break;
    }

    page += 1;
  }

  return Array.from(rowsById.values());
};

export const getCustomerReceivableSummary = async (customerId) => {
  await ensureAuthenticated();
  return request(`/pos/customers/${customerId}/receivable-summary`);
};

export const fetchPosSettings = async () => {
  await ensureAuthenticated();
  return request('/pos/settings');
};

export const fetchPosSyncStatus = async () => {
  await ensureAuthenticated();
  return requestOptionalEndpointCandidates([
    '/sync/status',
    '/pos/sync/status',
  ]);
};

export const fetchPosSyncChanges = async (since = '') => {
  await ensureAuthenticated();
  const query = new URLSearchParams();
  if (since) {
    query.set('since', String(since));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';

  return requestOptionalEndpointCandidates([
    `/sync/changes${suffix}`,
    `/pos/sync/changes${suffix}`,
  ]);
};

export const fetchPosCustomerTypes = async () => {
  await ensureAuthenticated();
  const payload = await requestWithEndpointCandidates([
    '/pos/customer-types',
    '/pos/customer_types',
  ]);
  return toDataList(payload);
};

export const fetchPosBankAccounts = async () => {
  await ensureAuthenticated();
  const payload = await requestWithEndpointCandidates([
    '/pos/payment-accounts',
    '/pos/bank-accounts?per_page=500',
    '/pos/bank-accounts',
    '/pos/accounts/bank?per_page=500',
    '/pos/accounts/bank',
    '/bank-accounts?per_page=500',
    '/bank-accounts',
    '/accounts/bank?per_page=500',
    '/accounts/bank',
  ]);
  return toDataList(payload);
};

export const getCustomerDepositBalance = async (customerId) => {
  await ensureAuthenticated();
  const body = await requestWithEndpointCandidates([
    `/finance/customers/${customerId}/deposit`,
    `/pos/customers/${customerId}/deposit`,
  ]);
  return toDataItem(body);
};

export const topUpCustomerDeposit = async (customerId, payload) => {
  await ensureAuthenticated();
  const body = await requestWithEndpointCandidates([
    `/pos/customers/${customerId}/deposit/top-up`,
  ], {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return toDataItem(body);
};

export const getCustomerDepositMutations = async (customerId) => {
  await ensureAuthenticated();
  const body = await requestOptionalEndpointCandidates([
    `/finance/customers/${customerId}/deposit-mutations`,
  ]);
  return body ? toDataList(body) : [];
};

export const createPosInvoicePayment = async (invoiceId, payload) => {
  await ensureAuthenticated();
  return request(`/pos/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const createPosCustomer = async (payload) => {
  await ensureAuthenticated();
  const body = await requestWithEndpointCandidates(
    ['/pos/customers', '/customers'],
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return toDataItem(body);
};

export const fetchPosProductionMaterials = async () => {
  await ensureAuthenticated();
  try {
    const payload = await request('/pos/production/materials');
    if (Array.isArray(payload?.materials)) {
      return payload.materials;
    }
    return [];
  } catch (_error) {
    // jangan blokir bootstrap POS ketika endpoint produksi belum siap.
    return [];
  }
};

export const fetchPosProductionBatches = async (status = 'all') => {
  await ensureAuthenticated();
  const query = new URLSearchParams();
  if (status && status !== 'all') {
    query.set('status', String(status));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const payload = await request(`/pos/production/batches${suffix}`);
  return toDataList(payload);
};

export const fetchPosProductionItems = async (params = {}) => {
  await ensureAuthenticated();
  const query = new URLSearchParams();
  if (params?.status) {
    query.set('status', String(params.status));
  }
  if (params?.search) {
    query.set('search', String(params.search));
  }
  if (params?.scope) {
    query.set('scope', String(params.scope));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/pos/production/items${suffix}`);
};

export const updatePosProductionItemStatus = async (itemId, productionStatus) => {
  await ensureAuthenticated();
  return request(`/pos/production/items/${itemId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ production_status: productionStatus }),
  });
};

export const previewPosPricing = async (productId, payload) => {
  await ensureAuthenticated();
  return request(`/pos/products/${productId}/price`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const createPosOrder = async (payload) => {
  await ensureAuthenticated();
  return request('/pos/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updatePosOrderStatus = async (orderId, status) => {
  await ensureAuthenticated();
  return request(`/pos/orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
};

export const pickupPosOrder = async (orderId, payload = {}) => {
  await ensureAuthenticated();
  return request(`/pos/orders/${orderId}/pickup`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const deletePosOrder = async (orderId) => {
  await ensureAuthenticated();
  return requestWithEndpointCandidates(
    [`/pos/orders/${orderId}`, `/orders/${orderId}`],
    { method: 'DELETE' },
  );
};

export const fetchPosOrderTransactions = async (params = {}) => {
  await ensureAuthenticated();
  const query = new URLSearchParams();
  if (params?.status) {
    query.set('status', String(params.status));
  }
  if (params?.search) {
    query.set('search', String(params.search));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/pos/orders/transactions${suffix}`);
};

export const fetchPosOrders = async () => {
  await ensureAuthenticated();
  return request('/pos/orders');
};

export const fetchPosReceivableApprovals = async (params = {}) => {
  await ensureAuthenticated();
  const query = new URLSearchParams();
  if (params?.status) {
    query.set('status', String(params.status));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const payload = await request(`/pos/receivable-approvals${suffix}`);
  return toDataList(payload);
};

export const fetchPosManualApprovals = async (params = {}) => {
  await ensureAuthenticated();
  const query = new URLSearchParams();
  if (params?.status) {
    query.set('status', String(params.status));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const payload = await request(`/pos/approvals${suffix}`);
  return toDataList(payload);
};

export const createPosManualApproval = async (payload) => {
  await ensureAuthenticated();
  const body = await request('/pos/approvals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return toDataItem(body);
};

export const approvePosManualApproval = async (approvalId, payload = {}) => {
  await ensureAuthenticated();
  const body = await request(`/pos/approvals/${approvalId}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return toDataItem(body);
};

export const rejectPosManualApproval = async (approvalId, payload) => {
  await ensureAuthenticated();
  const body = await request(`/pos/approvals/${approvalId}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return toDataItem(body);
};

export const resolvePosManualApproval = async (approvalId, payload = {}) => {
  await ensureAuthenticated();
  const body = await request(`/pos/approvals/${approvalId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return toDataItem(body);
};

export const fetchPosClosingSummary = async (params = {}) => {
  await ensureAuthenticated();
  const query = new URLSearchParams();
  if (params?.date) {
    query.set('date', String(params.date));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/pos/reports/closing-summary${suffix}`);
};

export const fetchUserDirectory = async () => {
  await ensureAuthenticated();
  const payload = await request('/users');
  return toDataList(payload);
};

export const fetchPosFinanceRecipients = async () => {
  await ensureAuthenticated();
  const payload = await request('/pos/reports/finance-recipients');
  return toDataList(payload);
};

export const fetchPosCloserOrder = async (params = {}) => {
  await ensureAuthenticated();
  const query = new URLSearchParams();
  if (params?.date) {
    query.set('date', String(params.date));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const payload = await request(`/pos/reports/closer-order${suffix}`);
  return payload?.data ?? null;
};

export const submitPosCloserOrder = async (payload) => {
  await ensureAuthenticated();
  const body = await request('/pos/reports/closer-order', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return toDataItem(body);
};

export const fetchPosCashFlowTypes = async (params = {}) => {
  await ensureAuthenticated();
  const query = new URLSearchParams();
  if (params?.type) {
    query.set('type', String(params.type));
  }
  if (params?.active_only !== undefined) {
    query.set('active_only', params.active_only ? '1' : '0');
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/pos/cash-flow-types${suffix}`);
};

export const fetchPosCashFlows = async (params = {}) => {
  await ensureAuthenticated();
  const query = new URLSearchParams();
  if (params?.type) {
    query.set('type', String(params.type));
  }
  if (params?.search) {
    query.set('search', String(params.search));
  }
  if (params?.date_from) {
    query.set('date_from', String(params.date_from));
  }
  if (params?.date_to) {
    query.set('date_to', String(params.date_to));
  }
  if (params?.per_page) {
    query.set('per_page', String(params.per_page));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/pos/cash-flows${suffix}`);
};

export const createPosCashFlow = async (payload) => {
  await ensureAuthenticated();
  return request('/pos/cash-flows', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const fetchPosOrderDetail = async (orderId) => {
  await ensureAuthenticated();
  return request(`/pos/orders/${orderId}`);
};

export const fetchAuthMe = async () => {
  await ensureAuthenticated();
  return request('/auth/me');
};

export const getApiBaseUrl = () => API_BASE_URL;
