import Constants from 'expo-constants';
import {
  getStoredPengeluaranRow,
  listStoredPengeluaranRows,
  saveStoredPembelianBahanRow,
  saveStoredPengeluaranRow,
} from '../utils/purchaseExpenseStore';

const DEFAULT_ERP_API_BASE_URL = 'https://dashboard.sidomulyoproject.com/api';
const LOCAL_DEV_ERP_API_BASE_URL = 'http://127.0.0.1:8000/api';
const LOCAL_ERP_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const PRODUCTION_ERP_HOSTNAME = 'dashboard.sidomulyoproject.com';
const trimString = (value) => String(value || '').trim();
const extra = Constants.expoConfig?.extra || {};
const resolvePublicEnv = (key, fallback = '') => {
  const runtimeValue = trimString(process.env?.[key]);
  if (runtimeValue) {
    return runtimeValue;
  }

  return trimString(fallback);
};

const normalizeApiBaseUrl = (url) => trimString(url).replace(/\/+$/, '');
const normalizeConfiguredApiBaseUrl = (url) => {
  const normalizedUrl = normalizeApiBaseUrl(url);
  if (!normalizedUrl) {
    return '';
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    if (String(parsedUrl.hostname || '').trim().toLowerCase() === PRODUCTION_ERP_HOSTNAME) {
      parsedUrl.protocol = 'https:';
      return String(parsedUrl.toString() || '').replace(/\/+$/, '');
    }
  } catch (_error) {
    return normalizedUrl;
  }

  return normalizedUrl;
};

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

const isLocalApiUrl = (url) => {
  const normalizedUrl = normalizeApiBaseUrl(url);
  if (!normalizedUrl || !isSupportedApiUrl(normalizedUrl)) {
    return false;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    return LOCAL_ERP_HOSTNAMES.has(String(parsedUrl.hostname || '').trim().toLowerCase());
  } catch (_error) {
    return false;
  }
};

const isLocalRuntimeHost = () => {
  if (typeof globalThis === 'undefined' || !globalThis.location) {
    return false;
  }

  const hostname = String(globalThis.location.hostname || '').trim().toLowerCase();
  return LOCAL_ERP_HOSTNAMES.has(hostname);
};

const toBooleanFlag = (value) => ['1', 'true', 'yes'].includes(String(value || '').trim().toLowerCase());
const forceOnlineApiUrl = toBooleanFlag(
  resolvePublicEnv('EXPO_PUBLIC_FORCE_ONLINE_ERP_API', extra.forceOnlineErpApi),
);

const resolveDefaultApiBaseUrl = (preferLocalApiUrl = false) => (
  preferLocalApiUrl ? LOCAL_DEV_ERP_API_BASE_URL : DEFAULT_ERP_API_BASE_URL
);

const resolveRuntimeApiBaseUrl = (configuredUrl, allowLocalApiUrl = false, preferLocalApiUrl = false) => {
  if (forceOnlineApiUrl) {
    return DEFAULT_ERP_API_BASE_URL;
  }

  const normalizedConfiguredUrl = normalizeConfiguredApiBaseUrl(configuredUrl);
  const normalizedDefaultUrl = normalizeApiBaseUrl(resolveDefaultApiBaseUrl(preferLocalApiUrl));
  const normalizedProductionUrl = normalizeApiBaseUrl(DEFAULT_ERP_API_BASE_URL);

  if (
    preferLocalApiUrl
    && (
      !normalizedConfiguredUrl
      || normalizedConfiguredUrl === normalizedDefaultUrl
      || normalizedConfiguredUrl === normalizedProductionUrl
      || (!allowLocalApiUrl && isLocalApiUrl(normalizedConfiguredUrl))
    )
  ) {
    return LOCAL_DEV_ERP_API_BASE_URL;
  }

  if (!normalizedConfiguredUrl) {
    return resolveDefaultApiBaseUrl(preferLocalApiUrl);
  }

  if (!allowLocalApiUrl && isLocalApiUrl(normalizedConfiguredUrl)) {
    return resolveDefaultApiBaseUrl(preferLocalApiUrl);
  }

  if (isSupportedApiUrl(normalizedConfiguredUrl)) {
    return normalizedConfiguredUrl;
  }

  throw new Error(
    `Base URL backend tidak valid: ${normalizedConfiguredUrl}. Gunakan URL absolut seperti https://dashboard.sidomulyoproject.com/api`,
  );
};

const preferLocalApiUrl = isLocalRuntimeHost()
  && toBooleanFlag(resolvePublicEnv('EXPO_PUBLIC_PREFER_LOCAL_ERP_API', extra.preferLocalErpApi));
const allowLocalApiUrl = preferLocalApiUrl
  || toBooleanFlag(resolvePublicEnv('EXPO_PUBLIC_ALLOW_LOCAL_ERP_API', extra.allowLocalErpApi));

const API_BASE_URL = resolveRuntimeApiBaseUrl(
  resolvePublicEnv('EXPO_PUBLIC_ERP_API_BASE_URL', extra.erpApiBaseUrl),
  allowLocalApiUrl,
  preferLocalApiUrl,
);
const API_EMAIL = resolvePublicEnv('EXPO_PUBLIC_ERP_EMAIL', extra.erpEmail);
const API_PASSWORD = String(process.env?.EXPO_PUBLIC_ERP_PASSWORD || extra.erpPassword || '');
const API_TOKEN = resolvePublicEnv('EXPO_PUBLIC_ERP_TOKEN', extra.erpToken);
const REQUEST_TIMEOUT_MS = 20000;
const PRODUCTS_REQUEST_TIMEOUT_MS = 45000;
const PRODUCTS_REQUEST_PER_PAGE = 100;
const INVOICE_REQUEST_TIMEOUT_MS = 45000;
const INVOICE_REQUEST_PER_PAGE = 100;
const SYNC_CHANGES_REQUEST_LIMIT = 200;
const SYNC_CHANGES_MAX_PAGES = 20;
const PEMBELIAN_BAHAN_MARKER = '[PURCHASE-WH]';
const DEFAULT_PURCHASE_CATEGORIES = [
  {
    type: 'material',
    code: 'material',
    name: 'Request Bahan Gudang',
    description: 'Flow sistem untuk request bahan dari toko/POS ke gudang. Harga bahan mengikuti histori pembelian gudang.',
    flow: 'stock_request',
    journal_trigger: 'material_purchase',
  },
  {
    type: 'consumable',
    code: 'consumable',
    name: 'Pembelian Consumable',
    description: 'Entry manual untuk pembelian consumable operasional.',
    flow: 'manual_entry',
    journal_trigger: 'consumable_expense',
  },
  {
    type: 'aset_ekonomis',
    code: 'asset_ekonomis',
    name: 'Pembelian Aset ekonomis',
    description: 'Entry manual untuk pembelian aset ekonomis.',
    flow: 'manual_entry',
    journal_trigger: 'asset_capitalization',
  },
];

let authToken = String(API_TOKEN || '').trim();
let sessionEmail = '';
let sessionPassword = '';
let refreshInProgress = null;

if (!isSupportedApiUrl(API_BASE_URL)) {
  throw new Error(`Base URL backend tidak valid atau belum terisi. Nilai saat ini: ${API_BASE_URL}`);
}

const createTimeoutError = (url, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const error = new Error(`Request timeout setelah ${Math.round(timeoutMs / 1000)} detik. Cek koneksi ke backend: ${url}`);
  error.status = 0;
  error.code = 'REQUEST_TIMEOUT';
  return error;
};

const fetchWithTimeout = async (url, options = {}) => {
  const {
    timeoutMs: requestedTimeoutMs,
    ...fetchOptions
  } = options || {};
  const timeoutMs = Number.isFinite(Number(requestedTimeoutMs)) && Number(requestedTimeoutMs) > 0
    ? Number(requestedTimeoutMs)
    : REQUEST_TIMEOUT_MS;
  let timeoutId = null;

  try {
    return await Promise.race([
      fetch(url, fetchOptions),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(createTimeoutError(url, timeoutMs));
        }, timeoutMs);
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

const buildAuthHeaders = (extra = {}) => {
  const headers = {
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
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email: resolvedEmail, password: resolvedPassword }),
  });
  const body = await parseJsonSafe(login);
  const responseContentType = String(login.headers?.get?.('content-type') || '').toLowerCase();

  if (login.redirected || (responseContentType && !responseContentType.includes('application/json'))) {
    throw new Error('Login backend tidak mengembalikan JSON API. Pastikan frontend terhubung ke backend online yang benar.');
  }

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
  const {
    headers: extraHeaders = {},
    timeoutMs,
    isFormData = false,
    ...requestOptions
  } = options || {};
  const requestUrl = `${API_BASE_URL}${path}`;
  const response = await fetchWithTimeout(requestUrl, {
    ...requestOptions,
    timeoutMs,
    headers: isFormData ? buildAuthHeaders(extraHeaders) : buildHeaders(extraHeaders),
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

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toSafeArray = (value) => (Array.isArray(value) ? value : []);

const toSafeText = (value) => String(value || '').trim();

const normalizeExpenseStatusLabel = (value) => {
  const status = toSafeText(value).toLowerCase();
  if (status === 'posted') return 'Tercatat';
  if (status === 'linked_request') return 'Terkait Request';
  if (status === 'draft_local') return 'Draft Lokal';
  if (status === 'pending') return 'Menunggu';
  if (status === 'approved') return 'Disetujui';
  if (status === 'rejected') return 'Ditolak';
  return status ? status.replace(/_/g, ' ') : 'Draft';
};

const normalizePembelianBahanStatusLabel = (value) => {
  const status = toSafeText(value).toLowerCase();
  if (status === 'pending') return 'Menunggu';
  if (status === 'approved') return 'Disetujui';
  if (status === 'rejected') return 'Ditolak';
  if (status === 'draft_local') return 'Draft Lokal';
  if (status === 'linked_request') return 'Terkait Request';
  return status ? status.replace(/_/g, ' ') : 'Draft';
};

const normalizePurchaseCategoryCode = (value) => {
  const normalized = toSafeText(value).toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'asset_economis') {
    return 'asset_ekonomis';
  }
  return normalized || 'material';
};

const normalizePurchaseCategoryItemRow = (row, index = 0) => ({
  id: Number(row?.id || 0) || null,
  code: toSafeText(row?.code || `item-${index + 1}`),
  name: toSafeText(row?.name),
  description: toSafeText(row?.description),
  default_uom: toSafeText(row?.default_uom || row?.uom || 'unit').toLowerCase() || 'unit',
  sort_order: Number(row?.sort_order || 0) || 0,
  is_active: row?.is_active !== false && String(row?.status || '').trim().toLowerCase() !== 'inactive',
  status: toSafeText(row?.status || (row?.is_active === false ? 'inactive' : 'active')) || 'active',
});

const normalizePurchaseCategoryRow = (row) => {
  const fallback = DEFAULT_PURCHASE_CATEGORIES[0];
  const code = normalizePurchaseCategoryCode(row?.code || fallback.code);
  const matched = DEFAULT_PURCHASE_CATEGORIES.find((item) => normalizePurchaseCategoryCode(item.code) === code) || fallback;
  return {
    ...matched,
    id: Number(row?.id || matched.id || 0) || null,
    code,
    type: toSafeText(row?.type || matched.type) || matched.type,
    name: toSafeText(row?.name || matched.name),
    description: toSafeText(row?.description || matched.description),
    flow: toSafeText(row?.flow || matched.flow) || matched.flow,
    journal_trigger: toSafeText(row?.journal_trigger || matched.journal_trigger) || matched.journal_trigger,
    sort_order: Number(row?.sort_order || 0) || 0,
    is_active: row?.is_active !== false && String(row?.status || '').trim().toLowerCase() !== 'inactive',
    status: toSafeText(row?.status || (row?.is_active === false ? 'inactive' : 'active')) || 'active',
    items: toSafeArray(row?.items).map((item, index) => normalizePurchaseCategoryItemRow(item, index)),
  };
};

const resolvePurchaseCategoryMeta = (category, availableRows = DEFAULT_PURCHASE_CATEGORIES) => {
  const normalizedRows = (Array.isArray(availableRows) && availableRows.length > 0 ? availableRows : DEFAULT_PURCHASE_CATEGORIES)
    .map((row) => normalizePurchaseCategoryRow(row));
  const code = normalizePurchaseCategoryCode(category?.code || category);
  return normalizedRows.find((row) => row.code === code) || normalizedRows[0];
};

const parsePurchaseManualNote = (note) => {
  const rawNote = toSafeText(note);
  const isPurchase = rawNote.includes(PEMBELIAN_BAHAN_MARKER);
  const manualSegmentMarker = '|| Catatan:';
  const manualSegmentIndex = rawNote.indexOf(manualSegmentMarker);
  const manualSegment = manualSegmentIndex >= 0
    ? rawNote.slice(manualSegmentIndex + manualSegmentMarker.length).trim()
    : rawNote;
  const totalMatch = manualSegment.match(/\[TOTAL=([0-9.]+)\]/i);
  const categoryMatch = manualSegment.match(/\[CATEGORY=([A-Z0-9_-]+)\]/i);
  const totalAmount = totalMatch ? toPositiveNumber(totalMatch[1]) : 0;
  const purchaseCategoryCode = normalizePurchaseCategoryCode(categoryMatch?.[1] || 'material');
  const cleanNote = manualSegment
    .replace(PEMBELIAN_BAHAN_MARKER, '')
    .replace(/\[CATEGORY=([A-Z0-9_-]+)\]/gi, '')
    .replace(/\[TOTAL=([0-9.]+)\]/gi, '')
    .trim();

  return {
    isPurchase,
    totalAmount,
    purchaseCategoryCode,
    note: cleanNote,
    rawNote,
  };
};

const shouldUseLocalFallback = (error) => {
  const status = Number(error?.status || 0);
  return [404, 405, 501, 503].includes(status);
};

const buildPembelianBahanRequestNote = (note, totalAmount, purchaseCategoryCode = 'material') => {
  const cleanNote = toSafeText(note);
  const totalLabel = Math.max(0, Math.round(toPositiveNumber(totalAmount)));
  const categoryCode = normalizePurchaseCategoryCode(purchaseCategoryCode);
  return `${PEMBELIAN_BAHAN_MARKER}[CATEGORY=${categoryCode}][TOTAL=${totalLabel}]${cleanNote ? ` ${cleanNote}` : ''}`.trim();
};

const normalizePembelianBahanItem = (item, index = 0) => {
  const materialId = Number(item?.warehouse_product_id || item?.material_id || item?.id || 0) || 0;
  const purchaseCategoryItemId = Number(item?.purchase_category_item_id || 0) || 0;
  const qty = Math.max(0, toPositiveNumber(item?.qty ?? item?.request_qty));
  const unitPrice = Math.max(0, toPositiveNumber(item?.unit_price));
  const subtotal = Math.max(0, toPositiveNumber(item?.subtotal || (qty * unitPrice)));
  const uom = toSafeText(item?.uom || item?.satuan || item?.mode || 'unit').toLowerCase() || 'unit';
  const materialName = toSafeText(item?.material_name || item?.product_name || item?.name);
  const itemCode = materialId > 0
    ? materialId
    : (materialName || 'manual-item');

  return {
    id: toSafeText(item?.id || `${itemCode}-${index + 1}`),
    material_id: materialId,
    warehouse_product_id: Number(item?.warehouse_product_id || materialId || 0) || 0,
    purchase_category_item_id: purchaseCategoryItemId || null,
    material_name: materialName,
    qty,
    satuan: uom,
    uom,
    harga_satuan: unitPrice,
    unit_price: unitPrice,
    subtotal,
    sku: toSafeText(item?.sku),
    specification: toSafeText(item?.specification),
    is_manual: item?.is_manual === true || (materialId <= 0 && purchaseCategoryItemId <= 0),
    is_name_locked: materialId > 0 || purchaseCategoryItemId > 0,
    price_source: toSafeText(item?.price_source),
    price_missing: Boolean(item?.price_missing),
    is_price_locked: item?.is_price_locked !== false && materialId > 0,
  };
};

const buildPembelianBahanLocalRecord = (payload = {}) => {
  const items = toSafeArray(payload?.items).map((item, index) => normalizePembelianBahanItem(item, index));
  const totalAmount = Math.max(
    0,
    toPositiveNumber(payload?.total_amount || items.reduce((sum, item) => sum + toPositiveNumber(item.subtotal), 0)),
  );
  const createdAt = toSafeText(payload?.created_at || new Date().toISOString());
  const status = toSafeText(payload?.status || 'draft_local').toLowerCase() || 'draft_local';
  const purchaseCategory = resolvePurchaseCategoryMeta(
    payload?.purchase_category
      || payload?.purchase_category_code
      || payload?.purchaseCategoryCode
      || 'material',
    payload?.purchase_categories,
  );

  return {
    id: toSafeText(payload?.id || `local-purchase-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    request_no: toSafeText(payload?.request_no || `PB-LOCAL-${Date.now()}`),
    status,
    status_label: normalizePembelianBahanStatusLabel(status),
    created_at: createdAt,
    tanggal: createdAt,
    note: toSafeText(payload?.note),
    requester: payload?.requester && typeof payload.requester === 'object'
      ? {
        id: Number(payload.requester?.id || 0) || null,
        name: toSafeText(payload.requester?.name || 'User POS'),
      }
      : null,
    warehouse: payload?.warehouse && typeof payload.warehouse === 'object'
      ? {
        id: Number(payload.warehouse?.id || 0) || null,
        code: toSafeText(payload.warehouse?.code),
        name: toSafeText(payload.warehouse?.name),
      }
      : null,
    items,
    total_amount: totalAmount,
    purchase_category_code: purchaseCategory.code,
    purchase_category_name: toSafeText(payload?.purchase_category_name || payload?.purchase_category?.name || purchaseCategory.name),
    purchase_category_flow: toSafeText(payload?.purchase_category_flow || payload?.purchase_category?.flow || purchaseCategory.flow) || purchaseCategory.flow,
    purchase_category: {
      ...purchaseCategory,
      name: toSafeText(payload?.purchase_category_name || payload?.purchase_category?.name || purchaseCategory.name),
      description: toSafeText(payload?.purchase_category?.description || purchaseCategory.description),
    },
    requester_name: toSafeText(payload?.requester?.name),
    source: toSafeText(payload?.source || 'local'),
    backend_request_id: payload?.backend_request_id ?? null,
    linked_stock_request_id: payload?.linked_stock_request_id ?? null,
    linked_expense_transaction_id: payload?.linked_expense_transaction_id ?? null,
    backend_detail_todo: payload?.backend_detail_todo !== false,
    backend_update_todo: payload?.backend_update_todo !== false,
  };
};

const normalizePembelianBahanBackendRow = (row, localRecord = null) => {
  const parsedNote = parsePurchaseManualNote(row?.note);
  const purchaseCategory = resolvePurchaseCategoryMeta(
    localRecord?.purchase_category
      || localRecord?.purchase_category_code
      || parsedNote.purchaseCategoryCode
      || 'material',
  );
  const backendItems = toSafeArray(row?.items).map((item, index) => ({
    ...normalizePembelianBahanItem(item, index),
    harga_satuan: 0,
    unit_price: 0,
    subtotal: 0,
  }));
  const items = toSafeArray(localRecord?.items).length > 0 ? localRecord.items : backendItems;
  const totalAmount = Math.max(
    0,
    toPositiveNumber(localRecord?.total_amount || parsedNote.totalAmount || items.reduce((sum, item) => sum + toPositiveNumber(item.subtotal), 0)),
  );
  const status = toSafeText(row?.status || localRecord?.status || 'pending').toLowerCase() || 'pending';

  return {
    id: toSafeText(row?.id || localRecord?.id),
    request_no: toSafeText(row?.request_no || localRecord?.request_no || `SR-${row?.id || ''}`),
    status,
    status_label: normalizePembelianBahanStatusLabel(status),
    created_at: toSafeText(row?.created_at || localRecord?.created_at || new Date().toISOString()),
    tanggal: toSafeText(row?.created_at || localRecord?.created_at || new Date().toISOString()),
    note: toSafeText(localRecord?.note || parsedNote.note),
    requester: row?.requester || localRecord?.requester || null,
    warehouse: row?.warehouse || localRecord?.warehouse || null,
    items,
    total_amount: totalAmount,
    purchase_category_code: purchaseCategory.code,
    purchase_category_name: toSafeText(localRecord?.purchase_category_name || purchaseCategory.name),
    purchase_category_flow: toSafeText(localRecord?.purchase_category_flow || purchaseCategory.flow) || purchaseCategory.flow,
    purchase_category: {
      ...purchaseCategory,
      name: toSafeText(localRecord?.purchase_category_name || purchaseCategory.name),
    },
    requester_name: toSafeText(row?.requester?.name || localRecord?.requester?.name),
    source: 'backend',
    backend_request_id: Number(row?.id || 0) || null,
    backend_note: toSafeText(row?.note),
    backend_detail_todo: true,
    backend_update_todo: true,
  };
};

const matchesPembelianBahanSearch = (row, search = '') => {
  const keyword = toSafeText(search).toLowerCase();
  if (!keyword) {
    return true;
  }

  const haystacks = [
    row?.request_no,
    row?.note,
    row?.purchase_category_name,
    row?.requester?.name,
    ...(toSafeArray(row?.items).map((item) => item?.material_name)),
  ].map((value) => toSafeText(value).toLowerCase());

  return haystacks.some((value) => value.includes(keyword));
};

const filterRowsByDateRange = (rows, dateFrom, dateTo, fieldName = 'created_at') => {
  const startText = toSafeText(dateFrom);
  const endText = toSafeText(dateTo);
  return toSafeArray(rows).filter((row) => {
    const rowText = toSafeText(row?.[fieldName] || row?.tanggal || row?.occurred_at).slice(0, 10);
    if (!rowText) {
      return !startText && !endText;
    }
    if (startText && rowText < startText) {
      return false;
    }
    if (endText && rowText > endText) {
      return false;
    }
    return true;
  });
};

const sortRowsByNewestDate = (rows, fieldName = 'created_at') => (
  [...toSafeArray(rows)].sort((left, right) => {
    const leftDate = new Date(left?.[fieldName] || left?.tanggal || left?.occurred_at || 0).getTime();
    const rightDate = new Date(right?.[fieldName] || right?.tanggal || right?.occurred_at || 0).getTime();
    return rightDate - leftDate;
  })
);

const syncPengeluaranFromPembelian = (purchaseRow) => {
  const normalizedPurchase = buildPembelianBahanLocalRecord(purchaseRow);
  if (toSafeText(normalizedPurchase.purchase_category_flow) === 'stock_request') {
    return null;
  }
  const categoryLabel = toSafeText(normalizedPurchase.purchase_category_name || 'Belanja Toko');
  const linkedExpense = {
    id: `expense-purchase-${normalizedPurchase.id}`,
    transaction_no: normalizedPurchase.source === 'backend'
      ? `EXP-${normalizedPurchase.request_no}`
      : `EXP-LOCAL-${String(normalizedPurchase.id).replace(/[^a-z0-9-]/gi, '').slice(-10)}`,
    transaction_type: 'expense',
    transaction_type_label: 'Pengeluaran',
    occurred_at: toSafeText(normalizedPurchase.created_at).slice(0, 10) || new Date().toISOString().slice(0, 10),
    amount: Math.max(0, toPositiveNumber(normalizedPurchase.total_amount)),
    signed_amount: Math.max(0, toPositiveNumber(normalizedPurchase.total_amount)) * -1,
    category: categoryLabel,
    note: toSafeText(normalizedPurchase.note),
    status: normalizedPurchase.source === 'backend' ? 'linked_request' : 'draft_local',
    status_label: normalizeExpenseStatusLabel(normalizedPurchase.source === 'backend' ? 'linked_request' : 'draft_local'),
    requester: normalizedPurchase.requester || null,
    reference: {
      type: 'pembelian_bahan',
      label: categoryLabel,
      id: normalizedPurchase.id,
      request_no: normalizedPurchase.request_no,
      status: normalizedPurchase.status,
    },
    source: 'local',
    backend_detail_todo: true,
  };
  saveStoredPengeluaranRow(linkedExpense);
  return linkedExpense;
};

const normalizeBackendPembelianRow = (row) => buildPembelianBahanLocalRecord({
  ...row,
  source: 'backend',
  backend_detail_todo: false,
  backend_update_todo: false,
});

const normalizeBackendPengeluaranRow = (row) => {
  const amount = Math.max(0, toPositiveNumber(row?.amount));
  return {
    id: toSafeText(row?.id),
    transaction_no: toSafeText(row?.transaction_no || `EXP-${row?.id || ''}`),
    transaction_type: 'expense',
    transaction_type_label: toSafeText(row?.transaction_type_label || 'Pengeluaran'),
    occurred_at: toSafeText(row?.occurred_at),
    amount,
    signed_amount: amount * -1,
    category: toSafeText(row?.category || row?.type?.name || 'Pengeluaran'),
    note: toSafeText(row?.note),
    status: 'posted',
    status_label: normalizeExpenseStatusLabel('posted'),
    requester: row?.staff || null,
    purchase_category_id: Number(row?.purchase_category_id || row?.purchase_category?.id || 0) || null,
    purchase_category_code: toSafeText(row?.purchase_category_code || row?.purchase_category?.code),
    purchase_category: row?.purchase_category && typeof row.purchase_category === 'object'
      ? {
        id: Number(row.purchase_category?.id || 0) || null,
        code: toSafeText(row.purchase_category?.code),
        name: toSafeText(row.purchase_category?.name),
        type: toSafeText(row.purchase_category?.type),
      }
      : null,
    purchase_category_item_id: Number(row?.purchase_category_item_id || row?.purchase_category_item?.id || 0) || null,
    purchase_category_item: row?.purchase_category_item && typeof row.purchase_category_item === 'object'
      ? {
        id: Number(row.purchase_category_item?.id || 0) || null,
        code: toSafeText(row.purchase_category_item?.code),
        name: toSafeText(row.purchase_category_item?.name),
      }
      : null,
    category_item_name: toSafeText(row?.category_item_name || row?.purchase_category_item?.name),
    source_account_id: Number(row?.source_account_id || 0) || null,
    accounting_journal_id: Number(row?.accounting_journal_id || 0) || null,
    reference: row?.reference && typeof row.reference === 'object'
      ? {
        type: toSafeText(row.reference.type),
        label: toSafeText(row.reference.label),
        id: toSafeText(row.reference.id),
        request_no: toSafeText(row.reference.request_no),
        status: toSafeText(row.reference.status),
        purchase_category_code: toSafeText(row.reference.purchase_category_code),
      }
      : null,
    source: 'backend',
    type: row?.type || null,
    backend_detail_todo: false,
  };
};

const matchesPengeluaranSearch = (row, search = '') => {
  const keyword = toSafeText(search).toLowerCase();
  if (!keyword) {
    return true;
  }
  const haystacks = [
    row?.transaction_no,
    row?.category,
    row?.note,
    row?.reference?.request_no,
    row?.requester?.name,
  ].map((value) => toSafeText(value).toLowerCase());

  return haystacks.some((value) => value.includes(keyword));
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

export const fetchPosProductsPage = async (params = {}) => {
  await ensureAuthenticated();
  const requestedPerPage = Number(params?.perPage || 0);
  const perPage = Number.isFinite(requestedPerPage) && requestedPerPage > 0
    ? Math.min(Math.max(Math.trunc(requestedPerPage), 1), 500)
    : PRODUCTS_REQUEST_PER_PAGE;
  const requestedPage = Number(params?.page || 0);
  const page = Number.isFinite(requestedPage) && requestedPage > 0
    ? Math.trunc(requestedPage)
    : 1;
  const requestedTimeoutMs = Number(params?.timeoutMs || 0);
  const timeoutMs = Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
    ? requestedTimeoutMs
    : PRODUCTS_REQUEST_TIMEOUT_MS;
  const query = new URLSearchParams();
  query.set('per_page', String(perPage));
  query.set('page', String(page));
  if (params?.search) {
    query.set('search', String(params.search));
  }
  const payload = await request(`/pos/products?${query.toString()}`, { timeoutMs });
  return toPaginatedDataList(payload);
};

export const fetchPosProducts = async (params = {}) => {
  const requestedPerPage = Number(params?.perPage || 0);
  const perPage = Number.isFinite(requestedPerPage) && requestedPerPage > 0
    ? Math.min(Math.max(Math.trunc(requestedPerPage), 1), 500)
    : PRODUCTS_REQUEST_PER_PAGE;
  const requestedMaxPages = Number(params?.maxPages || 0);
  const maxPages = Number.isFinite(requestedMaxPages) && requestedMaxPages > 0
    ? Math.max(Math.trunc(requestedMaxPages), 1)
    : 100;

  const rowsById = new Map();
  let page = 1;

  while (page <= maxPages) {
    const response = await fetchPosProductsPage({ ...params, perPage, page });
    response.data.forEach((row) => {
      const key = Number(row?.id || 0);
      if (key > 0) {
        rowsById.set(key, row);
        return;
      }
      rowsById.set(`product-${page}-${rowsById.size}`, row);
    });

    if (!response.meta?.hasMore) {
      break;
    }

    page += 1;
  }

  return Array.from(rowsById.values());
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

export const getPembelianCategoryOptions = async () => {
  await ensureAuthenticated();
  const payload = await request('/pos/purchase-categories');
  return toDataList(payload).map((row) => normalizePurchaseCategoryRow(row));
};

export const getPengeluaranCategoryOptions = async () => {
  await ensureAuthenticated();
  const payload = await request('/pos/purchase-categories?type=pengeluaran');
  return toDataList(payload).map((row) => normalizePurchaseCategoryRow(row));
};

export const getPembelianBahanMaterialOptions = async (search = '') => {
  await ensureAuthenticated();
  const payload = await request('/pos/inventory/stock-requests/materials');
  const rows = toDataList(payload).map((row, index) => {
    const unitPrice = toPositiveNumber(row?.unit_price || row?.harga_satuan);
    const materialRow = normalizePembelianBahanItem({
      ...row,
      warehouse_product_id: row?.id,
      material_name: row?.name,
      uom: row?.mode,
      unit_price: unitPrice,
      subtotal: unitPrice,
      qty: 0,
      is_price_locked: true,
    }, index);

    return {
      ...materialRow,
      specification: toSafeText(row?.specification),
      available_main: toPositiveNumber(row?.available_main),
      available_decimal: toPositiveNumber(row?.available_decimal),
      available_main_label: toSafeText(row?.available_main_label),
      available_decimal_label: toSafeText(row?.available_decimal_label),
      sku: toSafeText(row?.sku),
      unit_price: unitPrice,
      harga_satuan: unitPrice,
      price_source: toSafeText(row?.price_source || materialRow.price_source),
      price_missing: Boolean(row?.price_missing),
    };
  });

  const keyword = toSafeText(search).toLowerCase();
  if (!keyword) {
    return rows;
  }

  return rows.filter((row) => (
    toSafeText(row?.material_name).toLowerCase().includes(keyword)
    || toSafeText(row?.sku).toLowerCase().includes(keyword)
    || toSafeText(row?.specification).toLowerCase().includes(keyword)
  ));
};

export const getPembelianBahanList = async (params = {}) => {
  await ensureAuthenticated();
  const perPage = Math.max(1, Math.min(100, Number(params?.per_page || 50) || 50));
  const search = toSafeText(params?.search);
  const dateFrom = toSafeText(params?.date_from);
  const dateTo = toSafeText(params?.date_to);
  const purchaseCategoryCode = normalizePurchaseCategoryCode(params?.purchase_category_code || '');
  const query = new URLSearchParams();
  query.set('per_page', String(perPage));
  if (search) query.set('search', search);
  if (dateFrom) query.set('date_from', dateFrom);
  if (dateTo) query.set('date_to', dateTo);
  if (purchaseCategoryCode) query.set('purchase_category_code', purchaseCategoryCode);

  const payload = await request(`/pos/purchases?${query.toString()}`);
  const paginated = toPaginatedDataList(payload);
  const rows = paginated.data.map((row) => normalizeBackendPembelianRow(row));

  rows.forEach((row) => {
    saveStoredPembelianBahanRow(row);
  });

  return {
    data: rows,
    meta: paginated.meta,
    todo: {
      backendDetailEndpointRequired: false,
      backendUpdateEndpointRequired: false,
      backendUnavailableFallbackUsed: false,
    },
  };
};

export const getPembelianBahanDetail = async (id) => {
  const key = String(id || '').trim();
  if (!key) {
    throw new Error('ID pembelian bahan tidak valid.');
  }

  const payload = await request(`/pos/purchases/${key}`);
  const normalized = normalizeBackendPembelianRow(toDataItem(payload));
  saveStoredPembelianBahanRow(normalized);
  return normalized;
};

export const createPembelianBahanRequest = async (payload = {}) => {
  await ensureAuthenticated();
  const normalizedItems = toSafeArray(payload?.items).map((item, index) => normalizePembelianBahanItem(item, index))
    .filter((item) => (item.material_id > 0 || toSafeText(item.material_name) !== '') && item.qty > 0);
  const purchaseCategory = resolvePurchaseCategoryMeta(
    payload?.purchase_category
      || payload?.purchase_category_code
      || 'material',
    payload?.purchase_categories,
  );
  const body = await request('/pos/purchases', {
    method: 'POST',
    body: JSON.stringify({
      purchase_category_id: purchaseCategory.id || null,
      purchase_category_code: purchaseCategory.code,
      warehouse_id: payload?.warehouse_id ?? null,
      request_date: payload?.request_date ?? new Date().toISOString().slice(0, 10),
      note: payload?.note ?? '',
      payment_status: payload?.payment_status,
      payment_method_id: payload?.payment_method_id ?? null,
      payment_account_id: payload?.payment_account_id ?? null,
      source_account_id: payload?.source_account_id ?? null,
      items: normalizedItems.map((item) => ({
        warehouse_product_id: item.warehouse_product_id || null,
        purchase_category_item_id: item.purchase_category_item_id || null,
        material_name: item.material_name,
        qty: item.qty,
        uom: item.uom,
        unit_price: item.unit_price,
        sku: item.sku,
        specification: item.specification,
      })),
    }),
  });
  const normalized = normalizeBackendPembelianRow(toDataItem(body));
  saveStoredPembelianBahanRow(normalized);
  if (normalized?.purchase_category_flow !== 'stock_request' && !normalized?.linked_expense_transaction_id) {
    syncPengeluaranFromPembelian(normalized);
  }
  return normalized;
};

export const updatePembelianBahanRequest = async (id, payload = {}) => {
  const key = String(id || '').trim();
  if (!key) {
    throw new Error('ID pembelian bahan tidak valid.');
  }

  const existing = await getPembelianBahanDetail(key);
  const nextItems = payload?.items
    ? toSafeArray(payload.items).map((item, index) => normalizePembelianBahanItem(item, index))
    : toSafeArray(existing?.items).map((item, index) => normalizePembelianBahanItem(item, index));
  const updated = buildPembelianBahanLocalRecord({
    ...existing,
    ...payload,
    id: existing.id,
    request_no: existing.request_no,
    status: existing.status,
    created_at: existing.created_at,
    requester: payload?.requester || existing.requester,
    warehouse: payload?.warehouse || existing.warehouse,
    note: payload?.note !== undefined ? payload.note : existing.note,
    items: nextItems,
    total_amount: nextItems.reduce((sum, item) => sum + toPositiveNumber(item.subtotal), 0),
    purchase_category: payload?.purchase_category || existing.purchase_category,
    purchase_category_name: payload?.purchase_category_name || existing.purchase_category_name,
    purchase_category_code: payload?.purchase_category_code || existing.purchase_category_code,
    purchase_category_flow: payload?.purchase_category_flow || existing.purchase_category_flow,
    source: existing.source || 'local',
    backend_detail_todo: true,
    backend_update_todo: true,
  });

  const body = await request(`/pos/purchases/${key}`, {
    method: 'PUT',
    body: JSON.stringify({
      purchase_category_id: payload?.purchase_category?.id || existing.purchase_category?.id || existing.purchase_category_id || null,
      purchase_category_code: payload?.purchase_category_code || existing.purchase_category_code,
      warehouse_id: payload?.warehouse?.id || existing.warehouse?.id || null,
      request_date: payload?.tanggal || existing.tanggal || existing.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      note: payload?.note !== undefined ? payload.note : existing.note,
      items: nextItems.map((item) => ({
        warehouse_product_id: item.warehouse_product_id || null,
        purchase_category_item_id: item.purchase_category_item_id || null,
        material_name: item.material_name,
        qty: item.qty,
        uom: item.uom,
        unit_price: item.unit_price,
        sku: item.sku,
        specification: item.specification,
      })),
    }),
  });
  const normalized = normalizeBackendPembelianRow(toDataItem(body));
  saveStoredPembelianBahanRow(normalized);
  if (normalized?.purchase_category_flow !== 'stock_request' && !normalized?.linked_expense_transaction_id) {
    syncPengeluaranFromPembelian(normalized);
  }
  return {
    ...normalized,
    todo: {
      backendUpdateEndpointRequired: false,
    },
  };
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

const extractSyncChangesSource = (payload) => (
  payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? payload.data
    : payload
);

const extractSyncChangesPagination = (payload) => {
  const source = extractSyncChangesSource(payload);
  return source?.pagination && typeof source.pagination === 'object' && !Array.isArray(source.pagination)
    ? source.pagination
    : null;
};

const mergeSyncRowsById = (target, rows = [], fallbackPrefix = 'row') => {
  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const id = Number(row?.id || 0);
    const key = id > 0 ? `id:${id}` : `${fallbackPrefix}:${target.size}:${index}`;
    target.set(key, row);
  });
};

const mergeSyncIds = (target, rows = []) => {
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const id = Number(row || 0);
    if (id > 0) {
      target.add(id);
    }
  });
};

const buildSyncChangesMergedPayload = ({
  productsById,
  customersById,
  deletedProductIds,
  deletedCustomerIds,
  serverTime,
  pagination,
}) => ({
  products: Array.from(productsById.values()),
  customers: Array.from(customersById.values()),
  deletedProductIds: Array.from(deletedProductIds.values()),
  deletedCustomerIds: Array.from(deletedCustomerIds.values()),
  serverTime: String(serverTime || '').trim(),
  pagination: pagination || null,
});

export const fetchPosSyncChanges = async (since = '', options = {}) => {
  await ensureAuthenticated();
  const requestedLimit = Number(options?.limit || 0);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 500)
    : SYNC_CHANGES_REQUEST_LIMIT;
  const requestedMaxPages = Number(options?.maxPages || 0);
  const maxPages = Number.isFinite(requestedMaxPages) && requestedMaxPages > 0
    ? Math.max(Math.trunc(requestedMaxPages), 1)
    : SYNC_CHANGES_MAX_PAGES;

  const productsById = new Map();
  const customersById = new Map();
  const deletedProductIds = new Set();
  const deletedCustomerIds = new Set();
  let serverTime = '';
  let pagination = null;
  let cursors = {
    products: '',
    customers: '',
    deleted_products: '',
    deleted_customers: '',
  };
  let page = 0;

  while (page < maxPages) {
    const query = new URLSearchParams();
    if (since) {
      query.set('since', String(since));
    }
    query.set('limit', String(limit));
    if (cursors.products) query.set('products_cursor', String(cursors.products));
    if (cursors.customers) query.set('customers_cursor', String(cursors.customers));
    if (cursors.deleted_products) query.set('deleted_products_cursor', String(cursors.deleted_products));
    if (cursors.deleted_customers) query.set('deleted_customers_cursor', String(cursors.deleted_customers));

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const payload = await requestOptionalEndpointCandidates([
      `/sync/changes${suffix}`,
      `/pos/sync/changes${suffix}`,
    ]);
    const source = extractSyncChangesSource(payload);
    const nextPagination = extractSyncChangesPagination(payload);

    if (!nextPagination) {
      return payload;
    }

    mergeSyncRowsById(productsById, source?.products, 'product');
    mergeSyncRowsById(customersById, source?.customers, 'customer');
    mergeSyncIds(deletedProductIds, source?.deletedProductIds ?? source?.deleted_product_ids);
    mergeSyncIds(deletedCustomerIds, source?.deletedCustomerIds ?? source?.deleted_customer_ids);

    serverTime = String(source?.serverTime ?? source?.server_time ?? serverTime ?? '').trim();
    pagination = nextPagination;
    page += 1;

    const nextCursors = {
      products: String(nextPagination?.products_next_cursor || ''),
      customers: String(nextPagination?.customers_next_cursor || ''),
      deleted_products: String(nextPagination?.deleted_products_next_cursor || ''),
      deleted_customers: String(nextPagination?.deleted_customers_next_cursor || ''),
    };

    const hasNextCursor = Object.values(nextCursors).some((value) => String(value || '').trim() !== '');
    if (!Boolean(nextPagination?.has_more) || !hasNextCursor) {
      break;
    }

    cursors = nextCursors;
  }

  return buildSyncChangesMergedPayload({
    productsById,
    customersById,
    deletedProductIds,
    deletedCustomerIds,
    serverTime,
    pagination,
  });
};

export const fetchPosCustomerTypes = async () => {
  await ensureAuthenticated();
  const payload = await requestWithEndpointCandidates([
    '/pos/customer-types',
    '/pos/customer_types',
  ]);
  return toDataList(payload);
};

export const fetchPosBankAccounts = async (options = {}) => {
  await ensureAuthenticated();
  const context = toSafeText(options?.context).toLowerCase();
  const allowedTypes = Array.isArray(options?.allowedTypes)
    ? options.allowedTypes.map((value) => toSafeText(value).toLowerCase()).filter(Boolean)
    : [];
  const contextQuery = context ? `?context=${encodeURIComponent(context)}` : '';
  const payload = await requestWithEndpointCandidates([
    `/pos/payment-accounts${contextQuery}`,
    '/pos/bank-accounts?per_page=500',
    '/pos/bank-accounts',
    '/pos/accounts/bank?per_page=500',
    '/pos/accounts/bank',
    '/bank-accounts?per_page=500',
    '/bank-accounts',
    '/accounts/bank?per_page=500',
    '/accounts/bank',
  ]);
  const rows = toDataList(payload);
  if (!allowedTypes.length) {
    return rows;
  }

  return rows.filter((row) => {
    const type = toSafeText(
      row?.payment_type
      || row?.type
      || row?.payment_method_code
      || row?.paymentMethodCode,
    ).toLowerCase();

    return allowedTypes.includes(type);
  });
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

export const createDanaQrisPayment = async (invoiceId, payload = {}) => {
  await ensureAuthenticated();
  return request(`/pos/invoices/${invoiceId}/payments/qris/dana`, {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 45000,
  });
};

export const createDanaGatewayPayment = async (invoiceId, payload = {}) => {
  await ensureAuthenticated();
  return request(`/pos/invoices/${invoiceId}/payments/gateway/dana`, {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 45000,
  });
};

export const fetchDanaQrisPaymentStatus = async (paymentTransactionId, options = {}) => {
  await ensureAuthenticated();
  const params = new URLSearchParams();
  if (options?.syncProvider === true) {
    params.set('sync_provider', '1');
  }
  const query = params.toString();
  return request(`/pos/payment-transactions/${paymentTransactionId}/status${query ? `?${query}` : ''}`, {
    timeoutMs: 30000,
  });
};

export const cancelDanaQrisPayment = async (paymentTransactionId, payload = {}) => {
  await ensureAuthenticated();
  return request(`/pos/payment-transactions/${paymentTransactionId}/cancel`, {
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

export const fetchPosProofings = async (params = {}) => {
  await ensureAuthenticated();
  const query = new URLSearchParams();
  if (params?.status) {
    query.set('status', String(params.status));
  }
  if (params?.search) {
    query.set('search', String(params.search));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/pos/proofings${suffix}`);
};

export const fetchPosProofingDetail = async (proofingId) => {
  await ensureAuthenticated();
  return request(`/pos/proofings/${proofingId}`);
};

export const fetchPosProofingHistory = async (proofingId) => {
  await ensureAuthenticated();
  return request(`/pos/proofings/${proofingId}/history`);
};

export const createPosProofing = async (payload) => {
  await ensureAuthenticated();
  return request('/pos/proofings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const uploadPosProofingPreview = async (proofingId, file, payload = {}) => {
  await ensureAuthenticated();
  const formData = new FormData();
  formData.append('preview_file', file);
  if (payload?.notes_from_designer) {
    formData.append('notes_from_designer', String(payload.notes_from_designer));
  }
  if (payload?.designer_id) {
    formData.append('designer_id', String(payload.designer_id));
  }
  return request(`/pos/proofings/${proofingId}/preview`, {
    method: 'POST',
    body: formData,
    isFormData: true,
    timeoutMs: 45000,
  });
};

export const uploadPosProofingFinalFile = async (proofingId, file, payload = {}) => {
  await ensureAuthenticated();
  const formData = new FormData();
  formData.append('final_file', file);
  if (payload?.notes_from_designer) {
    formData.append('notes_from_designer', String(payload.notes_from_designer));
  }
  if (payload?.designer_id) {
    formData.append('designer_id', String(payload.designer_id));
  }
  return request(`/pos/proofings/${proofingId}/final-file`, {
    method: 'POST',
    body: formData,
    isFormData: true,
    timeoutMs: 45000,
  });
};

export const sendPosProofingWhatsapp = async (proofingId, payload = {}) => {
  await ensureAuthenticated();
  return request(`/pos/proofings/${proofingId}/send-whatsapp`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const releasePosProofingToProduction = async (proofingId) => {
  await ensureAuthenticated();
  return request(`/pos/proofings/${proofingId}/release-production`, {
    method: 'POST',
    body: JSON.stringify({}),
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

export const fetchPosOrderTransactionsPage = async (params = {}) => {
  await ensureAuthenticated();
  const requestedPerPage = Number(params?.perPage || 0);
  const perPage = Number.isFinite(requestedPerPage) && requestedPerPage > 0
    ? Math.min(Math.max(Math.trunc(requestedPerPage), 1), 500)
    : INVOICE_REQUEST_PER_PAGE;
  const requestedPage = Number(params?.page || 0);
  const page = Number.isFinite(requestedPage) && requestedPage > 0
    ? Math.trunc(requestedPage)
    : 1;
  const requestedTimeoutMs = Number(params?.timeoutMs || 0);
  const timeoutMs = Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
    ? requestedTimeoutMs
    : INVOICE_REQUEST_TIMEOUT_MS;
  const query = new URLSearchParams();
  query.set('per_page', String(perPage));
  query.set('page', String(page));
  if (params?.status) {
    query.set('status', String(params.status));
  }
  if (params?.search) {
    query.set('search', String(params.search));
  }
  if (params?.view) {
    query.set('view', String(params.view));
  }
  const payload = await request(`/pos/orders/transactions?${query.toString()}`, { timeoutMs });
  return toPaginatedDataList(payload);
};

export const fetchPosOrderTransactions = async (params = {}) => {
  const payload = await fetchPosOrderTransactionsPage(params);
  return payload.data;
};

export const fetchAllPosOrderTransactions = async (params = {}) => {
  const requestedPerPage = Number(params?.perPage || 0);
  const perPage = Number.isFinite(requestedPerPage) && requestedPerPage > 0
    ? Math.min(Math.max(Math.trunc(requestedPerPage), 1), 500)
    : INVOICE_REQUEST_PER_PAGE;
  const requestedMaxPages = Number(params?.maxPages || 0);
  const maxPages = Number.isFinite(requestedMaxPages) && requestedMaxPages > 0
    ? Math.max(Math.trunc(requestedMaxPages), 1)
    : 100;

  const rowsById = new Map();
  let page = 1;

  while (page <= maxPages) {
    const response = await fetchPosOrderTransactionsPage({ ...params, perPage, page });
    response.data.forEach((row) => {
      const primaryId = Number(row?.id || row?.order?.id || row?.invoice?.id || 0);
      if (primaryId > 0) {
        rowsById.set(primaryId, row);
        return;
      }
      rowsById.set(`tx-${page}-${rowsById.size}`, row);
    });

    if (!response.meta?.hasMore) {
      break;
    }

    page += 1;
  }

  return Array.from(rowsById.values());
};

export const fetchPosOrdersPage = async (params = {}) => {
  await ensureAuthenticated();
  const requestedPerPage = Number(params?.perPage || 0);
  const perPage = Number.isFinite(requestedPerPage) && requestedPerPage > 0
    ? Math.min(Math.max(Math.trunc(requestedPerPage), 1), 500)
    : INVOICE_REQUEST_PER_PAGE;
  const requestedPage = Number(params?.page || 0);
  const page = Number.isFinite(requestedPage) && requestedPage > 0
    ? Math.trunc(requestedPage)
    : 1;
  const requestedTimeoutMs = Number(params?.timeoutMs || 0);
  const timeoutMs = Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
    ? requestedTimeoutMs
    : INVOICE_REQUEST_TIMEOUT_MS;
  const query = new URLSearchParams();
  query.set('per_page', String(perPage));
  query.set('page', String(page));
  if (params?.status) {
    query.set('status', String(params.status));
  }
  if (params?.search) {
    query.set('search', String(params.search));
  }
  if (params?.view) {
    query.set('view', String(params.view));
  }
  const payload = await request(`/pos/orders?${query.toString()}`, { timeoutMs });
  return toPaginatedDataList(payload);
};

export const fetchPosOrders = async (params = {}) => {
  const payload = await fetchPosOrdersPage(params);
  return payload.data;
};

export const fetchAllPosOrders = async (params = {}) => {
  const requestedPerPage = Number(params?.perPage || 0);
  const perPage = Number.isFinite(requestedPerPage) && requestedPerPage > 0
    ? Math.min(Math.max(Math.trunc(requestedPerPage), 1), 500)
    : INVOICE_REQUEST_PER_PAGE;
  const requestedMaxPages = Number(params?.maxPages || 0);
  const maxPages = Number.isFinite(requestedMaxPages) && requestedMaxPages > 0
    ? Math.max(Math.trunc(requestedMaxPages), 1)
    : 100;

  const rowsById = new Map();
  let page = 1;

  while (page <= maxPages) {
    const response = await fetchPosOrdersPage({ ...params, perPage, page });
    response.data.forEach((row) => {
      const primaryId = Number(row?.id || row?.order?.id || row?.invoice?.id || 0);
      if (primaryId > 0) {
        rowsById.set(primaryId, row);
        return;
      }
      rowsById.set(`order-${page}-${rowsById.size}`, row);
    });

    if (!response.meta?.hasMore) {
      break;
    }

    page += 1;
  }

  return Array.from(rowsById.values());
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

export const getPengeluaranList = async (params = {}) => {
  await ensureAuthenticated();
  const perPage = Math.max(1, Math.min(100, Number(params?.per_page || 50) || 50));
  const search = toSafeText(params?.search);
  const dateFrom = toSafeText(params?.date_from);
  const dateTo = toSafeText(params?.date_to);

  const payload = await fetchPosCashFlows({
    ...params,
    type: 'expense',
    per_page: perPage,
  });
  const paginated = toPaginatedDataList(payload);
  const backendRows = paginated.data.map((row) => normalizeBackendPengeluaranRow(row));
  const localRows = listStoredPengeluaranRows().map((row) => ({
    ...row,
    status_label: normalizeExpenseStatusLabel(row?.status),
  }));

  const backendLinkedKeys = new Set(
    localRows
      .filter((row) => toSafeText(row?.reference?.id))
      .map((row) => `purchase:${toSafeText(row.reference.id)}`),
  );
  const merged = sortRowsByNewestDate(
    filterRowsByDateRange(
      [
        ...localRows,
        ...backendRows.filter((row) => !backendLinkedKeys.has(`purchase:${toSafeText(row?.reference?.id)}`)),
      ].filter((row) => matchesPengeluaranSearch(row, search)),
      dateFrom,
      dateTo,
      'occurred_at',
    ),
    'occurred_at',
  );

  return {
    data: merged,
    meta: {
      ...paginated.meta,
      total: paginated.meta.total + localRows.length,
    },
    todo: {
      backendDetailEndpointRequired: false,
      backendReferenceFieldRequired: false,
    },
  };
};

export const getPengeluaranDetail = async (id) => {
  const key = toSafeText(id);
  if (!key) {
    throw new Error('ID pengeluaran tidak valid.');
  }

  const localRow = getStoredPengeluaranRow(key);
  if (localRow) {
    return {
      ...localRow,
      status_label: normalizeExpenseStatusLabel(localRow?.status),
    };
  }

  try {
    const detailPayload = await requestWithEndpointCandidates([
      `/pos/cash-flows/${key}`,
      `/pos/reports/cash-flows/${key}`,
    ]);
    const detailRow = toDataItem(detailPayload);
    return normalizeBackendPengeluaranRow(detailRow);
  } catch (_error) {
    const rows = await getPengeluaranList({ per_page: 100 });
    const matched = toSafeArray(rows?.data).find((row) => toSafeText(row?.id) === key) || null;
    if (!matched) {
      throw new Error('Detail pengeluaran tidak ditemukan.');
    }
    return matched;
  }
};

export const createPosCashFlow = async (payload) => {
  await ensureAuthenticated();
  return request('/pos/cash-flows', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const fetchStoreDailyClosing = async (date = '') => {
  await ensureAuthenticated();
  const query = new URLSearchParams();
  if (toSafeText(date)) {
    query.set('date', toSafeText(date));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/pos/store-closings/today${suffix}`);
};

export const evaluateStoreDailyClosing = async (closingId) => {
  await ensureAuthenticated();
  return request(`/pos/store-closings/${closingId}/evaluate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
};

export const saveStoreClosingChecklist = async (closingId, items) => {
  await ensureAuthenticated();
  return request(`/pos/store-closings/${closingId}/checklist`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
};

export const saveStoreClosingCashValidation = async (closingId, payload = {}) => {
  await ensureAuthenticated();
  if (payload?.evidence) {
    const formData = new FormData();
    formData.append('opening_cash', String(payload.opening_cash || 0));
    formData.append('physical_cash', String(payload.physical_cash || 0));
    if (payload.reason) formData.append('reason', String(payload.reason));
    if (payload.responsible_user_id) formData.append('responsible_user_id', String(payload.responsible_user_id));
    formData.append('evidence', payload.evidence);
    return request(`/pos/store-closings/${closingId}/cash-validation`, {
      method: 'POST',
      body: formData,
      isFormData: true,
      timeoutMs: 45000,
    });
  }
  return request(`/pos/store-closings/${closingId}/cash-validation`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const saveStoreClosingOrderIssue = async (closingId, issueId, payload = {}) => {
  await ensureAuthenticated();
  return request(`/pos/store-closings/${closingId}/open-orders/${issueId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const saveStoreClosingOrderIssuesBulk = async (closingId, payload = {}) => {
  await ensureAuthenticated();
  return request(`/pos/store-closings/${closingId}/open-orders/bulk`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

const uploadStoreClosingEvidence = async (path, file) => {
  await ensureAuthenticated();
  const formData = new FormData();
  formData.append('evidence', file);
  return request(path, {
    method: 'POST',
    body: formData,
    isFormData: true,
    timeoutMs: 45000,
  });
};

export const uploadStoreClosingExpenseEvidence = async (closingId, transactionId, file) => (
  uploadStoreClosingEvidence(`/pos/store-closings/${closingId}/expenses/${transactionId}/evidence`, file)
);

export const uploadStoreClosingPurchaseEvidence = async (closingId, purchaseId, file) => (
  uploadStoreClosingEvidence(`/pos/store-closings/${closingId}/purchases/${purchaseId}/evidence`, file)
);

export const finalizeStoreDailyClosing = async (closingId) => {
  await ensureAuthenticated();
  return request(`/pos/store-closings/${closingId}/finalize`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
};

export const fetchStoreClosingArchive = async ({ date_from = '', date_to = '', limit = 60 } = {}) => {
  await ensureAuthenticated();
  const query = new URLSearchParams();
  if (toSafeText(date_from)) query.set('date_from', toSafeText(date_from));
  if (toSafeText(date_to)) query.set('date_to', toSafeText(date_to));
  if (Number(limit) > 0) query.set('limit', String(Number(limit)));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/pos/store-closings/archive${suffix}`);
};

export const fetchStoreClosingReviewQueue = async (limit = 60) => {
  await ensureAuthenticated();
  return request(`/pos/store-closings/review-queue?limit=${Number(limit) || 60}`);
};

export const fetchStoreClosingDetail = async (closingId) => {
  await ensureAuthenticated();
  return request(`/pos/store-closings/${closingId}`);
};

export const decideStoreClosingCashDifference = async (closingId, payload = {}) => {
  await ensureAuthenticated();
  return request(`/pos/store-closings/${closingId}/cash-decision`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const createStoreClosingCorrection = async (closingId, payload = {}) => {
  await ensureAuthenticated();
  if (payload?.evidence) {
    const formData = new FormData();
    formData.append('issue_type', String(payload.issue_type || 'klarifikasi_lain'));
    formData.append('amount', String(payload.amount || 0));
    formData.append('description', String(payload.description || ''));
    if (payload.related_user_id) formData.append('related_user_id', String(payload.related_user_id));
    formData.append('evidence', payload.evidence);
    return request(`/pos/store-closings/${closingId}/corrections`, {
      method: 'POST',
      body: formData,
      isFormData: true,
      timeoutMs: 45000,
    });
  }
  return request(`/pos/store-closings/${closingId}/corrections`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const decideStoreClosingCorrection = async (closingId, correctionId, payload = {}) => {
  await ensureAuthenticated();
  return request(`/pos/store-closings/${closingId}/corrections/${correctionId}/decision`, {
    method: 'PUT',
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

export const getAuthToken = () => authToken;
