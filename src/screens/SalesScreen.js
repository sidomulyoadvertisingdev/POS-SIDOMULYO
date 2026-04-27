import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View, useWindowDimensions } from 'react-native';
import { Asset } from 'expo-asset';
import CartList from '../components/CartList';
import PaymentSummary from '../components/PaymentSummary';
import ProductForm from '../components/ProductForm';
import ProductionPanel from '../components/ProductionPanel';
import TransactionHeader from '../components/TransactionHeader';
import { formatRupiah } from '../utils/currency';
import {
  findByName,
  mapPaymentMethodToBankAccountId,
  mapPaymentMethodToBackend,
  mapPaymentStatusToTransactionType,
} from '../utils/orderPayload';
import {
  createPosCustomer,
  createPosOrder,
  deletePosOrder,
  fetchPosBankAccounts,
  fetchPosCustomers,
  fetchPosCustomerTypes,
  fetchPosFinishings,
  fetchPosMaterials,
  fetchPosOrderDetail,
  fetchPosOrders,
  fetchPosOrderTransactions,
  fetchPosProductionItems,
  fetchPosProductionMaterials,
  fetchPosProductDetail,
  fetchPosProducts,
  pickupPosOrder,
  fetchAuthMe,
  getApiBaseUrl,
  previewPosPricing,
  updatePosProductionItemStatus,
  updatePosOrderStatus,
} from '../services/erpApi';
import { enqueueOrderPayload, loadOrderQueue, setOrderQueue } from '../utils/orderQueue';
import { appendOrderAuditLog, loadOrderAuditLogs } from '../utils/orderAuditLog';

const formatDate = (date) => {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const sanitizeNumericInput = (value) => value.replace(/[^0-9]/g, '');
const sanitizeDecimalInput = (value) => String(value || '').replace(/[^0-9.,]/g, '');
const sanitizeQtyInput = (value) => {
  const digits = sanitizeNumericInput(String(value || ''));
  if (!digits) {
    return '1';
  }
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return '1';
  }
  return String(parsed);
};
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const parseMeterValue = (value) => {
  const normalized = String(value || '').trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};
const buildSizeFromMeters = (widthMeterInput, lengthMeterInput) => {
  const widthMeter = parseMeterValue(widthMeterInput);
  const lengthMeter = parseMeterValue(lengthMeterInput);
  return {
    widthMeter,
    lengthMeter,
    widthMm: widthMeter > 0 ? Math.round(widthMeter * 1000) : 0,
    heightMm: lengthMeter > 0 ? Math.round(lengthMeter * 1000) : 0,
    areaM2: widthMeter > 0 && lengthMeter > 0 ? Number((widthMeter * lengthMeter).toFixed(4)) : 0,
    displayText: `${String(widthMeterInput || '').trim()} x ${String(lengthMeterInput || '').trim()} m`,
  };
};
const toLabel = (...candidates) => {
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
};
const parseJsonObject = (value) => {
  let current = value;
  for (let depth = 0; depth < 3; depth += 1) {
    if (!current) return null;
    if (typeof current === 'object' && !Array.isArray(current)) {
      return current;
    }
    if (typeof current === 'string') {
      try {
        current = JSON.parse(current);
        continue;
      } catch (_error) {
        return null;
      }
    }
    return null;
  }
  return null;
};
const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'number') {
    return [value];
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed !== null && parsed !== undefined) {
        return [parsed];
      }
      return [];
    } catch (_error) {
      if (raw.includes(',')) {
        return raw.split(',').map((part) => part.trim()).filter(Boolean);
      }
      return [raw];
    }
  }
  return [];
};
const extractFirstTextByKeyHints = (source, hints = []) => {
  const words = Array.isArray(hints) ? hints.map((hint) => String(hint || '').toLowerCase()).filter(Boolean) : [];
  if (words.length === 0) return '';
  const queue = [{ key: '', value: source, depth: 0 }];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth > 5) {
      continue;
    }
    const { key, value, depth } = current;
    const lowerKey = String(key || '').toLowerCase();
    const keyMatch = words.some((word) => lowerKey.includes(word));

    if (typeof value === 'string') {
      const text = value.trim();
      if (!text) {
        continue;
      }
      const parsedObj = parseJsonObject(text);
      const parsedArr = parseJsonArray(text);
      if (parsedObj) {
        const sig = JSON.stringify(parsedObj);
        if (!visited.has(sig)) {
          visited.add(sig);
          queue.push({ key, value: parsedObj, depth: depth + 1 });
        }
        continue;
      }
      if (Array.isArray(parsedArr) && parsedArr.length > 1) {
        queue.push({ key, value: parsedArr, depth: depth + 1 });
        continue;
      }
      const looksLikeNumberOnly = /^[\d.,\s-]+$/.test(text);
      if (keyMatch && !looksLikeNumberOnly) {
        return text;
      }
      continue;
    }

    if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        queue.push({ key: `${key}[${index}]`, value: entry, depth: depth + 1 });
      });
      continue;
    }

    if (typeof value === 'object') {
      Object.entries(value).forEach(([childKey, childValue]) => {
        queue.push({ key: childKey, value: childValue, depth: depth + 1 });
      });
    }
  }

  return '';
};
const toPositiveNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
};
const firstPositiveNumber = (...values) => {
  for (const value of values) {
    const num = toPositiveNumber(value);
    if (num > 0) {
      return num;
    }
  }
  return 0;
};
const formatMeterNumber = (value) => {
  const num = toPositiveNumber(value);
  if (num <= 0) return '';
  return num.toFixed(4).replace(/\.?0+$/, '');
};
const isLbMaxBreakdown = (item) => {
  return (String(item?.source || '') === 'lb_max_width')
    || (String(item?.stock_usage_formula || '').toLowerCase() === 'lb_max_area')
    || Boolean(item?.meta?.lb_max);
};
const extractDisplayFromBreakdown = (breakdown = []) => {
  const finishingNames = breakdown
    .filter((row) => !isLbMaxBreakdown(row))
    .map((row) => String(row?.name || '').trim())
    .filter(Boolean);
  const lbMaxNames = breakdown
    .filter((row) => isLbMaxBreakdown(row))
    .map((row) => String(row?.name || 'LB Max').trim())
    .filter(Boolean);
  return {
    finishingText: finishingNames.length > 0 ? finishingNames.join(', ') : '-',
    lbMaxText: lbMaxNames.length > 0 ? lbMaxNames.join(', ') : '-',
  };
};
const extractNamesFromMixedList = (rows, nameMapById) => {
  const list = Array.isArray(rows) ? rows : [];
  const names = list
    .map((row) => {
      if (row && typeof row === 'object') {
        const byText = toLabel(row?.name, row?.label, row?.title, row?.sku_name);
        if (byText) {
          return byText;
        }
        const id = Number(row?.id || row?.product_id || row?.finishing_id || row?.source_product_id || 0);
        if (id > 0 && nameMapById.get(id)) {
          return nameMapById.get(id);
        }
        return '';
      }
      const asNumber = Number(row || 0);
      if (asNumber > 0 && nameMapById.get(asNumber)) {
        return nameMapById.get(asNumber);
      }
      return String(row || '').trim();
    })
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  return Array.from(new Set(names));
};
const buildMaterialDisplay = (backendItem, materialMapById) => {
  const primaryId = Number(
    backendItem?.material_product_id ||
    backendItem?.material_id ||
    backendItem?.material_product?.id ||
    backendItem?.material?.id ||
    0,
  );
  const candidateIds = Array.isArray(backendItem?.material_product_ids)
    ? backendItem.material_product_ids
    : Array.isArray(backendItem?.material_candidate_ids)
      ? backendItem.material_candidate_ids
      : [];
  const nameCandidates = [];
  if (primaryId > 0 && materialMapById.get(primaryId)) {
    nameCandidates.push(materialMapById.get(primaryId));
  }
  candidateIds
    .map((id) => Number(id))
    .filter((id) => id > 0)
    .forEach((id) => {
      const name = materialMapById.get(id);
      if (name) {
        nameCandidates.push(name);
      }
    });
  const uniq = Array.from(new Set(nameCandidates.map((name) => String(name || '').trim()).filter(Boolean)));
  if (uniq.length > 0) {
    return uniq.join(', ');
  }
  return toLabel(
    backendItem?.material_name,
    backendItem?.material_product_name,
    backendItem?.material?.name,
    backendItem?.material_product?.name,
    '-',
  );
};
const restoreDraftItemDisplay = (backendItem, materialMapById, finishingNameMapById) => {
  const snapshot = parseJsonObject(backendItem?.spec_snapshot) || {};
  const draftForm = parseJsonObject(snapshot?.draft_form) || parseJsonObject(backendItem?.draft_form) || {};
  const specs = parseJsonObject(snapshot?.specs) || parseJsonObject(backendItem?.specs) || {};
  const meta = parseJsonObject(backendItem?.meta) || {};
  const unknownSizeText = toLabel(
    extractFirstTextByKeyHints(backendItem, ['size', 'ukuran', 'dimension']),
    extractFirstTextByKeyHints(snapshot, ['size', 'ukuran', 'dimension']),
  );
  const unknownFinishingText = toLabel(
    extractFirstTextByKeyHints(backendItem, ['finishing']),
    extractFirstTextByKeyHints(snapshot, ['finishing']),
  );
  const unknownMaterialText = toLabel(
    extractFirstTextByKeyHints(backendItem, ['material', 'bahan']),
    extractFirstTextByKeyHints(snapshot, ['material', 'bahan']),
  );
  const breakdown = Array.isArray(backendItem?.finishing_breakdown) ? backendItem.finishing_breakdown : [];
  const fromBreakdown = extractDisplayFromBreakdown(breakdown);

  const widthMeter = firstPositiveNumber(
    draftForm?.width_meter,
    draftForm?.width_m,
    specs?.width_meter,
    specs?.width_m,
    meta?.width_meter,
    meta?.width_m,
    toPositiveNumber(backendItem?.width),
    toPositiveNumber(backendItem?.width_cm) / 100,
    toPositiveNumber(backendItem?.width_mm) / 1000,
    toPositiveNumber(backendItem?.width_meter),
    toPositiveNumber(backendItem?.width_m),
    toPositiveNumber(backendItem?.input_width_m),
    toPositiveNumber(backendItem?.input_width_cm) / 100,
    toPositiveNumber(backendItem?.input_width_mm) / 1000,
    toPositiveNumber(backendItem?.internal_width_mm) / 1000,
  );
  const lengthMeter = firstPositiveNumber(
    draftForm?.length_meter,
    draftForm?.length_m,
    specs?.length_meter,
    specs?.length_m,
    meta?.length_meter,
    meta?.length_m,
    toPositiveNumber(backendItem?.height),
    toPositiveNumber(backendItem?.height_cm) / 100,
    toPositiveNumber(backendItem?.height_mm) / 1000,
    toPositiveNumber(backendItem?.length),
    toPositiveNumber(backendItem?.length_cm) / 100,
    toPositiveNumber(backendItem?.length_mm) / 1000,
    toPositiveNumber(backendItem?.length_meter),
    toPositiveNumber(backendItem?.length_m),
    toPositiveNumber(backendItem?.input_height_m),
    toPositiveNumber(backendItem?.input_height_cm) / 100,
    toPositiveNumber(backendItem?.input_height_mm) / 1000,
    toPositiveNumber(backendItem?.internal_height_mm) / 1000,
  );
  const sizeFromMeters = widthMeter > 0 && lengthMeter > 0
    ? `${formatMeterNumber(widthMeter)} x ${formatMeterNumber(lengthMeter)} m`
    : '';
  const sizeText = toLabel(
    draftForm?.size_text,
    specs?.size_text,
    backendItem?.size_text,
    backendItem?.size,
    backendItem?.dimension,
    backendItem?.dimensions,
    meta?.size_text,
    meta?.size,
    unknownSizeText,
    sizeFromMeters,
    '-',
  );

  const finishingFromPayload = extractNamesFromMixedList(
    [
      ...parseJsonArray(backendItem?.finishings),
      ...parseJsonArray(backendItem?.finishing_ids),
      ...parseJsonArray(backendItem?.finishing_id),
      ...parseJsonArray(backendItem?.finishing_products),
    ],
    finishingNameMapById,
  ).join(', ');
  const lbMaxFromPayload = extractNamesFromMixedList(
    [
      ...parseJsonArray(backendItem?.lb_max),
      ...parseJsonArray(backendItem?.lbmax),
      ...parseJsonArray(backendItem?.lb_max_ids),
    ],
    finishingNameMapById,
  ).join(', ');

  const finishingText = toLabel(
    draftForm?.finishing,
    specs?.finishing,
    backendItem?.finishing,
    backendItem?.finishing_text,
    backendItem?.finishing_label,
    backendItem?.finishing_name,
    meta?.finishing,
    meta?.finishing_name,
    unknownFinishingText,
    finishingFromPayload,
    fromBreakdown.finishingText,
    '-',
  );
  const lbMaxText = toLabel(
    draftForm?.lb_max,
    specs?.lb_max,
    lbMaxFromPayload,
    fromBreakdown.lbMaxText,
    '-',
  );
  const materialText = toLabel(
    draftForm?.material,
    specs?.material,
    backendItem?.material,
    backendItem?.material_text,
    backendItem?.material_label,
    backendItem?.material_display,
    backendItem?.material_product_label,
    meta?.material,
    meta?.material_name,
    unknownMaterialText,
    buildMaterialDisplay(backendItem, materialMapById),
    '-',
  );
  const pages = Math.max(
    Number(draftForm?.pages || specs?.pages || meta?.pages || backendItem?.pages || backendItem?.page || 1) || 1,
    1,
  );

  return {
    sizeText,
    finishingText,
    lbMaxText,
    materialText,
    pages,
  };
};
const calculateDraftItemsTotal = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }
  return roundMoney(
    items.reduce((sum, item) => {
      const subtotal = Number(item?.subtotal || item?.line_total || item?.total || 0);
      const finishingTotal = Number(item?.finishing_total || 0);
      const expressFee = Number(item?.express_fee || 0);
      return sum + subtotal + finishingTotal + expressFee;
    }, 0),
  );
};
const enforceDesignFirstFlow = (backendItem = {}) => {
  const requiresProduction = String(backendItem?.production_status || '').toLowerCase() !== 'not_required'
    ? Boolean(backendItem?.requires_production ?? true)
    : false;
  return {
    ...backendItem,
    requires_production: requiresProduction,
    requires_design: requiresProduction ? true : Boolean(backendItem?.requires_design ?? false),
  };
};
const PREPARE_LOADING_TEXT = 'tunggu dulu ya kaka BosLeonardo lagi kirim data';
const REPRINT_SPEC_CACHE_KEY = 'pos_reprint_spec_cache_v1';
const REPRINT_SPEC_CACHE_MAX = 120;
let memoryReprintSpecCache = [];
const canUseLocalStorage = () => {
  return typeof globalThis !== 'undefined' && typeof globalThis.localStorage !== 'undefined';
};
const loadReprintSpecCache = () => {
  if (canUseLocalStorage()) {
    try {
      const raw = globalThis.localStorage.getItem(REPRINT_SPEC_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }
  return memoryReprintSpecCache;
};
const persistReprintSpecCache = (rows) => {
  const next = Array.isArray(rows) ? rows.slice(0, REPRINT_SPEC_CACHE_MAX) : [];
  if (canUseLocalStorage()) {
    try {
      globalThis.localStorage.setItem(REPRINT_SPEC_CACHE_KEY, JSON.stringify(next));
    } catch (_error) {
      // ignore storage errors
    }
  } else {
    memoryReprintSpecCache = next;
  }
};
const saveReprintSpecSnapshot = (entry) => {
  const orderId = Number(entry?.orderId || 0);
  const invoiceNo = String(entry?.invoiceNo || '').trim();
  const items = Array.isArray(entry?.items) ? entry.items : [];
  if (orderId <= 0 && !invoiceNo) return;
  if (items.length === 0) return;

  const current = loadReprintSpecCache();
  const filtered = current.filter((row) => {
    const sameOrder = orderId > 0 && Number(row?.orderId || 0) === orderId;
    const sameInvoice = invoiceNo && String(row?.invoiceNo || '').trim() === invoiceNo;
    return !(sameOrder || sameInvoice);
  });
  const next = [
    {
      orderId: orderId > 0 ? orderId : null,
      invoiceNo: invoiceNo || null,
      createdAt: new Date().toISOString(),
      items,
    },
    ...filtered,
  ];
  persistReprintSpecCache(next);
};
const findReprintSpecSnapshot = ({ orderId, invoiceNo }) => {
  const rows = loadReprintSpecCache();
  const safeOrderId = Number(orderId || 0);
  const safeInvoiceNo = String(invoiceNo || '').trim();
  if (safeOrderId > 0) {
    const byOrder = rows.find((row) => Number(row?.orderId || 0) === safeOrderId);
    if (byOrder) return byOrder;
  }
  if (safeInvoiceNo) {
    return rows.find((row) => String(row?.invoiceNo || '').trim() === safeInvoiceNo) || null;
  }
  return null;
};
const isNotebookLikeProductName = (name) => /(nota\s*book|notebook|buku\s*nota|\bbook\b|\bbuku\b)/i.test(String(name || ''));
const humanizeStatusLabel = (value) => {
  const text = String(value || '').trim().replace(/[_-]+/g, ' ');
  if (!text) return '-';
  return text
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};
const resolveInvoiceStatusKey = (status) => {
  const text = String(status || '').trim().toLowerCase();
  if (!text) return '';
  if (['queued_offline'].includes(text)) return 'queued_offline';
  if (['draft'].includes(text)) return 'draft';
  if (['pending', 'new', 'open'].includes(text)) return 'pending';
  if (['pending_payment', 'awaiting_payment', 'unpaid'].includes(text)) return 'pending_payment';
  if (['partially_paid', 'partial_paid', 'dp'].includes(text)) return 'partially_paid';
  if (['pending_production', 'waiting_production', 'menunggu_produksi', 'menunggu produksi'].includes(text)) return 'waiting_production';
  if (['pending_design', 'waiting_design', 'menunggu_design', 'menunggu design'].includes(text)) return 'waiting_design';
  if (['processing', 'on_process', 'on_progress', 'production_process'].includes(text)) return 'processing';
  if (['in_batch', 'batch', 'proses_produksi', 'proses produksi'].includes(text)) return 'in_batch';
  if (['ready_pickup', 'ready_for_pickup', 'siap_ambil', 'siap ambil'].includes(text)) return 'ready_pickup';
  if (['picked_up'].includes(text)) return 'picked_up';
  if (['completed', 'done', 'finished'].includes(text)) return 'completed';
  if (['paid'].includes(text)) return 'paid';
  if (['cancelled', 'canceled', 'void', 'rejected_online'].includes(text)) return 'cancelled';
  return text;
};
const formatDraftStatusLabel = (status) => {
  const key = resolveInvoiceStatusKey(status);
  if (!key) return '-';
  if (key === 'queued_offline') return 'Invoice disimpan offline';
  if (key === 'draft') return 'Draft';
  if (key === 'pending') return 'Menunggu Proses';
  if (key === 'pending_payment') return 'Menunggu Pembayaran';
  if (key === 'partially_paid') return 'Pembayaran Sebagian (DP)';
  if (key === 'waiting_design') return 'Menunggu Design';
  if (key === 'waiting_production') return 'Menunggu Produksi';
  if (key === 'processing') return 'Sedang Diproses';
  if (key === 'in_batch') return 'In Batch';
  if (key === 'ready_pickup') return 'Siap Diambil';
  if (key === 'picked_up') return 'Sudah diambil';
  if (key === 'completed') return 'Selesai';
  if (key === 'paid') return 'Lunas';
  if (key === 'cancelled') return 'Dibatalkan';
  return humanizeStatusLabel(key);
};
const getInvoiceStatusTextColor = (status) => {
  const key = resolveInvoiceStatusKey(status);
  if (['pending', 'pending_payment', 'partially_paid'].includes(key)) return '#8a6b00';
  if (key === 'waiting_design') return '#b42318';
  if (key === 'waiting_production') return '#b54708';
  if (['processing', 'in_batch'].includes(key)) return '#1849a9';
  if (['completed', 'paid', 'picked_up'].includes(key)) return '#067647';
  if (key === 'cancelled') return '#9f1239';
  return '#3a3a3a';
};
const normalizeInvoiceOrderStatus = (row) => {
  return normalizeText(
    row?.status
    || row?.order_status
    || row?.order?.status
    || row?.invoice?.status
    || '',
  );
};
const isDraftInvoiceRow = (row) => {
  if (String(row?.__source || '').toLowerCase() === 'queue') {
    return true;
  }
  return isDraftCandidate(row);
};
const isProcessingInvoiceRow = (row) => {
  if (isDraftInvoiceRow(row)) {
    return false;
  }
  const statusKey = resolveInvoiceStatusKey(normalizeInvoiceOrderStatus(row));
  if (!statusKey) {
    return false;
  }
  if (['completed', 'paid', 'cancelled', 'picked_up'].includes(statusKey)) {
    return false;
  }
  return true;
};
const isCompletedInvoiceRow = (row) => {
  if (isDraftInvoiceRow(row) || isProcessingInvoiceRow(row)) {
    return false;
  }
  const statusKey = resolveInvoiceStatusKey(normalizeInvoiceOrderStatus(row));
  return ['completed', 'paid', 'picked_up'].includes(statusKey);
};
const getProductionCountsForInvoice = (row) => {
  const items = Array.isArray(row?.items) ? row.items : [];
  if (items.length === 0) {
    return null;
  }
  const counts = {
    waiting_design: 0,
    waiting_production: 0,
    in_batch: 0,
    printed: 0,
  };
  items.forEach((item) => {
    const status = resolveProductionStatusKey(item?.production_status);
    if (Object.prototype.hasOwnProperty.call(counts, status)) {
      counts[status] += 1;
    }
  });
  const totalTracked = Object.values(counts).reduce((sum, val) => sum + Number(val || 0), 0);
  if (totalTracked <= 0) {
    return null;
  }
  return counts;
};
const summarizeProductionStatusForInvoice = (row) => {
  const counts = getProductionCountsForInvoice(row);
  if (!counts) {
    return '-';
  }
  return `Design ${counts.waiting_design} | Produksi ${counts.waiting_production} | Batch ${counts.in_batch} | Selesai ${counts.printed}`;
};
const getCurrentProductionStageForInvoice = (row) => {
  const counts = getProductionCountsForInvoice(row);
  if (!counts) {
    return { key: '', label: '-', count: 0 };
  }
  if (counts.waiting_design > 0) {
    return {
      key: 'waiting_design',
      label: formatProductionStatusLabel('waiting_design'),
      count: counts.waiting_design,
    };
  }
  if (counts.waiting_production > 0) {
    return {
      key: 'waiting_production',
      label: formatProductionStatusLabel('waiting_production'),
      count: counts.waiting_production,
    };
  }
  if (counts.in_batch > 0) {
    return {
      key: 'in_batch',
      label: formatProductionStatusLabel('in_batch'),
      count: counts.in_batch,
    };
  }
  if (counts.printed > 0) {
    return {
      key: 'printed',
      label: formatProductionStatusLabel('printed'),
      count: counts.printed,
    };
  }
  return { key: '', label: '-', count: 0 };
};
const resolveProductionStatusKey = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (['waiting_design', 'design', 'menunggu_design', 'menunggu design'].includes(raw)) {
    return 'waiting_design';
  }
  if (['waiting_production', 'menunggu_produksi', 'menunggu produksi', 'production'].includes(raw)) {
    return 'waiting_production';
  }
  if (['in_batch', 'batch', 'proses', 'proses_produksi', 'proses produksi'].includes(raw)) {
    return 'in_batch';
  }
  if (
    [
      'printed',
      'finalize',
      'finalized',
      'finished',
      'done',
      'completed',
      'ready_pickup',
      'ready_for_pickup',
      'siap_ambil',
      'siap ambil',
      'selesai',
    ].includes(raw)
  ) {
    return 'printed';
  }
  return raw;
};
const formatProductionStatusLabel = (value) => {
  const key = resolveProductionStatusKey(value);
  if (key === 'waiting_design') return 'Menunggu Design';
  if (key === 'waiting_production') return 'Menunggu Produksi';
  if (key === 'in_batch') return 'In Batch';
  if (key === 'printed') return 'Printed / Selesai';
  if (key === 'not_required') return 'Tidak Perlu Produksi';
  return humanizeStatusLabel(key);
};
const getProductionStatusTextColor = (value) => {
  const key = resolveProductionStatusKey(value);
  if (key === 'waiting_design') return '#b42318';
  if (key === 'waiting_production') return '#b54708';
  if (key === 'in_batch') return '#1849a9';
  if (key === 'printed') return '#067647';
  if (key === 'not_required') return '#475467';
  return '#2f2f2f';
};
const buildProductionNotifyText = (row, previousStatus = '') => {
  const itemId = Number(row?.id || 0);
  const invoiceNo = toLabel(row?.order?.invoice?.invoice_no, `Item #${itemId || '-'}`);
  const productName = toLabel(row?.product?.name, row?.product_name, `Produk #${Number(row?.pos_product_id || 0)}`);
  const currentStatus = formatProductionStatusLabel(row?.production_status);
  const previousLabel = formatProductionStatusLabel(previousStatus);
  if (previousStatus && String(previousStatus).trim().toLowerCase() !== String(row?.production_status || '').trim().toLowerCase()) {
    return `${invoiceNo} | ${productName}: ${previousLabel} -> ${currentStatus}`;
  }
  return `${invoiceNo} | ${productName}: update ${currentStatus}`;
};
const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
const normalizeProductName = (row) => toLabel(
  row?.product_name,
  row?.base_product_name,
  row?.item_name,
  row?.name,
  row?.title,
);
const normalizeVariantName = (row) => toLabel(
  row?.variant_name,
  row?.variant,
  row?.sku_name,
  row?.sku,
  normalizeProductName(row),
);
const resolveProductClassification = (row) => {
  const sourceProduct = row?.sourceProduct || row?.source_product || {};
  const sourceMeta = parseJsonObject(sourceProduct?.meta) || (sourceProduct?.meta && typeof sourceProduct.meta === 'object' ? sourceProduct.meta : {});
  const rowMeta = parseJsonObject(row?.meta) || (row?.meta && typeof row.meta === 'object' ? row.meta : {});

  const categoryName = toLabel(
    row?.source_main_category_name,
    row?.source_category_name,
    row?.main_category_name,
    row?.main_category,
    row?.kategori_utama,
    row?.category_name,
    row?.product_category_name,
    row?.category?.name,
    row?.category?.label,
    row?.category?.title,
    row?.product_category?.name,
    row?.product_category?.label,
    row?.group_name,
    row?.group?.name,
    sourceProduct?.category_name,
    sourceProduct?.source_main_category_name,
    sourceProduct?.source_category_name,
    sourceProduct?.main_category_name,
    sourceProduct?.main_category,
    sourceProduct?.kategori_utama,
    sourceProduct?.product_category_name,
    sourceProduct?.category?.name,
    sourceProduct?.product_category?.name,
    sourceMeta?.category_name,
    sourceMeta?.product_category_name,
    sourceMeta?.main_category_name,
    sourceMeta?.main_category,
    sourceMeta?.kategori_utama,
    sourceMeta?.kategori,
    sourceMeta?.category,
    sourceMeta?.product_category,
    rowMeta?.category_name,
    rowMeta?.product_category_name,
    rowMeta?.main_category_name,
    rowMeta?.main_category,
    rowMeta?.kategori_utama,
    rowMeta?.kategori,
    rowMeta?.category,
    rowMeta?.product_category,
    extractFirstTextByKeyHints(sourceMeta, ['category_name', 'product_category', 'main_category', 'kategori']),
    extractFirstTextByKeyHints(rowMeta, ['category_name', 'product_category', 'main_category', 'kategori']),
    extractFirstTextByKeyHints(sourceProduct, ['category_name', 'product_category', 'main_category', 'kategori']),
  );

  const subCategoryName = toLabel(
    row?.source_subcategory_name,
    row?.source_sub_category_name,
    row?.source_product_subcategory_name,
    row?.subcategory_name,
    row?.sub_category_name,
    row?.product_subcategory_name,
    row?.subcategory?.name,
    row?.subcategory?.label,
    row?.sub_category?.name,
    row?.sub_category?.label,
    row?.product_subcategory?.name,
    row?.subgroup_name,
    row?.subgroup?.name,
    sourceProduct?.subcategory_name,
    sourceProduct?.source_subcategory_name,
    sourceProduct?.source_sub_category_name,
    sourceProduct?.source_product_subcategory_name,
    sourceProduct?.sub_category_name,
    sourceProduct?.product_subcategory_name,
    sourceProduct?.subcategory?.name,
    sourceProduct?.sub_category?.name,
    sourceMeta?.subcategory_name,
    sourceMeta?.sub_category_name,
    sourceMeta?.product_subcategory_name,
    sourceMeta?.subkategori_name,
    sourceMeta?.subkategori,
    sourceMeta?.sub_kategori,
    sourceMeta?.subcategory,
    sourceMeta?.sub_category,
    rowMeta?.subcategory_name,
    rowMeta?.sub_category_name,
    rowMeta?.product_subcategory_name,
    rowMeta?.subkategori_name,
    rowMeta?.subkategori,
    rowMeta?.sub_kategori,
    rowMeta?.subcategory,
    rowMeta?.sub_category,
    extractFirstTextByKeyHints(sourceMeta, ['subcategory_name', 'sub_category_name', 'product_subcategory', 'subkategori', 'sub_kategori']),
    extractFirstTextByKeyHints(rowMeta, ['subcategory_name', 'sub_category_name', 'product_subcategory', 'subkategori', 'sub_kategori']),
    extractFirstTextByKeyHints(sourceProduct, ['subcategory_name', 'sub_category_name', 'product_subcategory', 'subkategori', 'sub_kategori']),
  );

  return {
    categoryName: categoryName || 'Tanpa Kategori',
    subCategoryName: subCategoryName || 'Tanpa Sub Kategori',
  };
};
const normalizeCategoryName = (row) => toLabel(
  resolveProductClassification(row).categoryName,
  'Tanpa Kategori',
);
const normalizeSubCategoryName = (row) => toLabel(
  resolveProductClassification(row).subCategoryName,
  'Tanpa Sub Kategori',
);
const normalizeProductFamilyName = (row) => toLabel(
  toSourceProduct(row)?.name,
  row?.source_product_name,
  row?.parent_product_name,
  row?.product_name,
  row?.base_product_name,
  row?.parent_name,
  row?.name,
  row?.title,
);
const buildSelectedProductLabel = (row) => {
  const family = normalizeProductFamilyName(row);
  const variant = normalizeVariantName(row);
  if (family && variant && normalizeText(family) !== normalizeText(variant)) {
    return `${family} - ${variant}`;
  }
  return variant || family || '';
};
const DEFAULT_CUSTOMER_TYPES = [
  { id: -1, name: 'Pelanggan Umum', code: 'umum' },
  { id: -2, name: 'Reseller', code: 'reseller' },
  { id: -3, name: 'Corporate', code: 'corporate' },
];
const CUSTOMER_TYPE_PRIORITY = {
  umum: 1,
  reseller: 2,
  corporate: 3,
};
const toCustomerTypeCode = (value) => {
  const text = normalizeText(value);
  if (['pelanggan umum', 'umum', 'regular', 'general', 'retail'].includes(text)) return 'umum';
  if (['reseller', 'agen', 'distributor'].includes(text)) return 'reseller';
  if (['corporate', 'company', 'perusahaan', 'instansi'].includes(text)) return 'corporate';
  return text || 'other';
};
const toCustomerTypeLabel = (value) => {
  const code = toCustomerTypeCode(value);
  if (code === 'umum') return 'Pelanggan Umum';
  if (code === 'reseller') return 'Reseller';
  if (code === 'corporate') return 'Corporate';
  return String(value || '').trim() || 'Tipe Lain';
};
const resolveCustomerCategoryCode = (customer, customerTypes = []) => {
  const directLabel = toCustomerTypeCode(
    customer?.label
    || customer?.customer_label
    || customer?.customer_type
    || customer?.customer_type_name
    || customer?.type_name
    || '',
  );
  if (['umum', 'reseller', 'corporate'].includes(directLabel)) {
    return directLabel;
  }
  const selectedTypeId = Number(customer?.customer_type_id || customer?.type_id || 0);
  if (selectedTypeId > 0) {
    const matchedType = (Array.isArray(customerTypes) ? customerTypes : [])
      .find((row) => Number(row?.id || 0) === selectedTypeId);
    const fromType = toCustomerTypeCode(matchedType?.code || matchedType?.name || '');
    if (['umum', 'reseller', 'corporate'].includes(fromType)) {
      return fromType;
    }
  }
  return 'umum';
};
const normalizeMaterialRow = (row) => ({
  ...row,
  id: Number(
    row?.id ||
    row?.material_id ||
    row?.material_product_id ||
    row?.pivot?.material_product_id ||
    0,
  ),
  name: String(
    row?.name ||
    row?.material_name ||
    row?.material_product_name ||
    row?.label ||
    row?.title ||
    row?.sku ||
    '',
  ).trim(),
});
const normalizeCustomerRow = (row) => ({
  ...row,
  id: Number(row?.id || 0),
  name: String(row?.name || '').trim(),
  phone: String(
    row?.phone ||
    row?.phone_number ||
    row?.mobile_phone ||
    row?.mobile ||
    row?.hp ||
    '',
  ).trim(),
  address: String(row?.address || row?.alamat || '').trim(),
  customer_type_id: Number(row?.customer_type_id || row?.type_id || 0) || null,
});
const normalizeCustomerTypeRow = (row) => ({
  ...row,
  id: Number(row?.id || 0),
  name: toCustomerTypeLabel(row?.name || row?.type_name || row?.label || ''),
  code: toCustomerTypeCode(row?.name || row?.type_name || row?.label || ''),
});
const toSourceProduct = (row) => row?.sourceProduct || row?.source_product || null;
const normalizeFinishingRow = (row) => ({
  ...row,
  id: Number(
    row?.id ||
    row?.product_id ||
    row?.finishing_product_id ||
    row?.source_product_id ||
    toSourceProduct(row)?.id ||
    0,
  ),
  name: toLabel(row?.name, row?.sku_name, row?.sku),
  sku: String(row?.sku || '').trim(),
  axis_group: String(
    row?.axis_group ||
    row?.finishing_axis_group ||
    row?.meta?.finishing_axis_group ||
    '',
  ).trim().toLowerCase(),
  payload_key: ['product_id', 'product', 'source_product_id'].includes(
    String(row?.payload_key || row?.pivot?.payload_key || '').trim().toLowerCase(),
  ) || Number(row?.product_id || row?.finishing_product_id || row?.source_product_id || 0) > 0
    ? 'product_id'
    : 'id',
});
const isPrintingProductType = (value) => ['advertising', 'printing'].includes(String(value || '').toLowerCase());
const isFinishingCatalogType = (value) => String(value || '').toLowerCase() === 'finishing';
const parseBooleanLoose = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const text = normalizeText(value);
  if (['1', 'true', 'yes', 'ya', 'y', 'on', 'enabled', 'aktif'].includes(text)) return true;
  if (['0', 'false', 'no', 'tidak', 'off', 'disabled', 'nonaktif'].includes(text)) return false;
  return null;
};
const resolveFinishingRequiresMataAyam = (row) => {
  const sourceProduct = toSourceProduct(row);
  const bucket = [row, row?.pivot, row?.meta, sourceProduct, sourceProduct?.meta];
  const keys = [
    'finishing_requires_mata_ayam',
    'requires_mata_ayam',
    'mata_ayam_required',
    'mata_ayam_enabled',
    'finishing_mata_ayam_enabled',
  ];

  for (const obj of bucket) {
    if (!obj || typeof obj !== 'object') continue;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      const parsed = parseBooleanLoose(obj[key]);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return false;
};
const collectSideFlagsFromText = (value) => {
  if (!value && value !== 0) {
    return { right: false, left: false, top: false, bottom: false };
  }
  const text = normalizeText(value)
    .replace(/[^a-z0-9_ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = text.split(/[\s,_/-]+/).filter(Boolean);
  const has = (words) => words.some((word) => tokens.includes(word) || text.includes(word));
  return {
    right: has(['right', 'kanan']),
    left: has(['left', 'kiri']),
    top: has(['top', 'atas', 'up']),
    bottom: has(['bottom', 'bawah', 'down']),
  };
};
const mergeSideFlags = (...items) => ({
  right: items.some((row) => Boolean(row?.right)),
  left: items.some((row) => Boolean(row?.left)),
  top: items.some((row) => Boolean(row?.top)),
  bottom: items.some((row) => Boolean(row?.bottom)),
});
const resolveFinishingSideFlags = (row, sourceMeta) => {
  const meta = sourceMeta || {};
  const sourceProduct = toSourceProduct(row);
  const bucket = [row, row?.pivot, row?.meta, sourceProduct, sourceProduct?.meta, meta];
  const readFlag = (keys) => {
    for (const obj of bucket) {
      if (!obj || typeof obj !== 'object') continue;
      for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const parsed = parseBooleanLoose(obj[key]);
        if (parsed !== null) return parsed;
      }
    }
    return null;
  };
  const readNumber = (keys) => {
    for (const obj of bucket) {
      if (!obj || typeof obj !== 'object') continue;
      for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const value = Number(obj[key]);
        if (Number.isFinite(value)) return value;
      }
    }
    return 0;
  };
  const readTextFlags = (keys) => {
    const collected = [];
    for (const obj of bucket) {
      if (!obj || typeof obj !== 'object') continue;
      keys.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) return;
        const value = obj[key];
        if (Array.isArray(value)) {
          value.forEach((item) => collected.push(item));
        } else if (value && typeof value === 'object') {
          if (Array.isArray(value?.items)) {
            value.items.forEach((item) => collected.push(item));
          } else {
            Object.keys(value).forEach((nestedKey) => {
              if (value[nestedKey]) collected.push(nestedKey);
            });
          }
        } else {
          collected.push(value);
        }
      });
    }
    if (collected.length === 0) {
      return { right: false, left: false, top: false, bottom: false };
    }
    return mergeSideFlags(...collected.map((item) => collectSideFlagsFromText(item)));
  };

  const byText = readTextFlags([
    'finishing_side',
    'finishing_sides',
    'sides',
    'side',
    'position',
    'positions',
    'placement',
    'finishing_position',
    'finishing_side_rule',
    'finishing_side_rules',
  ]);

  const marginRight = readNumber(['finishing_margin_right_cm', 'margin_right_cm', 'margin_right']);
  const marginLeft = readNumber(['finishing_margin_left_cm', 'margin_left_cm', 'margin_left']);
  const marginTop = readNumber(['finishing_margin_top_cm', 'margin_top_cm', 'margin_top']);
  const marginBottom = readNumber(['finishing_margin_bottom_cm', 'margin_bottom_cm', 'margin_bottom']);

  const byFlags = {
    right: readFlag(['finishing_margin_right_enabled', 'right_enabled', 'use_right', 'apply_right', 'right']) ?? marginRight > 0,
    left: readFlag(['finishing_margin_left_enabled', 'left_enabled', 'use_left', 'apply_left', 'left']) ?? marginLeft > 0,
    top: readFlag(['finishing_margin_top_enabled', 'top_enabled', 'use_top', 'apply_top', 'top']) ?? marginTop > 0,
    bottom: readFlag(['finishing_margin_bottom_enabled', 'bottom_enabled', 'use_bottom', 'apply_bottom', 'bottom']) ?? marginBottom > 0,
  };

  return mergeSideFlags(byText, byFlags);
};
const normalizeAxisGroup = (row) => {
  const meta = toSourceMeta(row);
  const sideFlags = resolveFinishingSideFlags(row, meta);
  const hasHorizontal = sideFlags.right || sideFlags.left;
  const hasVertical = sideFlags.top || sideFlags.bottom;
  const explicitAxisGroup = String(
    row?.axis_group ||
    row?.finishing_axis_group ||
    meta?.finishing_axis_group ||
    meta?.finishing_modal_group ||
    meta?.finishing_side_group ||
    '',
  ).toLowerCase().trim();
  const normalizedName = normalizeText(row?.name || '');
  const isSambungan = explicitAxisGroup === 'sambungan'
    || normalizedName.includes('sambung')
    || normalizeText(row?.sku || '').includes('sambung');
  if (isSambungan) return 'sambungan';
  if (['right_left', 'top_bottom', 'all_sides'].includes(explicitAxisGroup)) return explicitAxisGroup;
  if (hasHorizontal && !hasVertical) return 'right_left';
  if (hasVertical && !hasHorizontal) return 'top_bottom';
  return 'all_sides';
};
const isWidthFinishingOption = (option) => {
  if (!option || typeof option !== 'object') return false;
  const lbMaxWidthCm = Math.max(0, Number(option.lb_max_width_cm || 0) || 0);
  if (lbMaxWidthCm <= 0) return false;
  const axisGroup = String(option.axis_group || '').trim().toLowerCase();
  return axisGroup === 'right_left' || axisGroup === 'all_sides';
};
const extractProductFinishings = (payload) => {
  const direct = Array.isArray(payload?.finishings) ? payload.finishings : null;
  if (direct) {
    return direct;
  }
  const inData = Array.isArray(payload?.data?.finishings) ? payload.data.finishings : null;
  if (inData) {
    return inData;
  }
  const alt = Array.isArray(payload?.product_finishings) ? payload.product_finishings : null;
  if (alt) {
    return alt;
  }
  const inDataAlt = Array.isArray(payload?.data?.product_finishings) ? payload.data.product_finishings : null;
  if (inDataAlt) {
    return inDataAlt;
  }
  const inProduct = Array.isArray(payload?.product?.finishings) ? payload.product.finishings : null;
  if (inProduct) {
    return inProduct;
  }
  const inDataProduct = Array.isArray(payload?.data?.product?.finishings) ? payload.data.product.finishings : null;
  if (inDataProduct) {
    return inDataProduct;
  }
  const inSourceProduct = Array.isArray(payload?.sourceProduct?.finishings) ? payload.sourceProduct.finishings : null;
  if (inSourceProduct) {
    return inSourceProduct;
  }
  const inSourceProductSnake = Array.isArray(payload?.source_product?.finishings) ? payload.source_product.finishings : null;
  if (inSourceProductSnake) {
    return inSourceProductSnake;
  }
  const inDataSourceProduct = Array.isArray(payload?.data?.sourceProduct?.finishings)
    ? payload.data.sourceProduct.finishings
    : null;
  if (inDataSourceProduct) {
    return inDataSourceProduct;
  }
  const inDataSourceProductSnake = Array.isArray(payload?.data?.source_product?.finishings)
    ? payload.data.source_product.finishings
    : null;
  if (inDataSourceProductSnake) {
    return inDataSourceProductSnake;
  }
  return [];
};
const collectMaterialIds = (...sources) => {
  const ids = [];
  sources.forEach((source) => {
    const id = toPositiveNumber(source);
    if (id > 0) ids.push(id);
  });
  return Array.from(new Set(ids));
};
const collectMaterialNames = (...sources) => {
  const names = sources
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return Array.from(new Set(names));
};
const toMaterialIdsFromRows = (rows) => (
  Array.isArray(rows)
    ? rows.map((row) => row?.id || row?.material_id || row?.material_product_id || row?.pivot?.material_product_id)
    : []
);
const toMaterialNamesFromRows = (rows) => (
  Array.isArray(rows)
    ? rows.map(
      (row) =>
        row?.name ||
        row?.material_name ||
        row?.material_product_name ||
        row?.material_product?.name ||
        row?.material?.name ||
        row?.sku ||
        row?.title ||
        row?.label,
    )
    : []
);
const toSourceMeta = (row) => {
  const sourceProduct = toSourceProduct(row);
  const meta = sourceProduct?.meta;
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
};
const resolveStickerResellerMinimumLength = (sourceMeta = {}, pricing = null) => {
  const billingGroup = String(
    pricing?.rule?.billing_group
    || pricing?.price_breakdown?.sticker_billing_group
    || '',
  ).trim().toUpperCase();
  if (billingGroup && billingGroup !== 'ROLL_STICKER') {
    return 0;
  }

  const pricingMin = Number(
    pricing?.rule?.billing_min_length_m
    || pricing?.price_breakdown?.sticker_billing_min_length_m
    || 0,
  );
  if (Number.isFinite(pricingMin) && pricingMin > 0) {
    return pricingMin;
  }

  const resellerRuleMin = Number(
    sourceMeta?.sticker_billing_rules?.reseller?.min_length_m
    ?? sourceMeta?.sticker_min_length_reseller_m
    ?? 0,
  );
  if (Number.isFinite(resellerRuleMin) && resellerRuleMin > 0) {
    return resellerRuleMin;
  }

  return 1;
};
const buildStickerResellerMinimumMessage = (productName, inputLengthM, minLengthM) => {
  const name = String(productName || 'Produk sticker').trim() || 'Produk sticker';
  const minText = formatMeterNumber(minLengthM || 0) || String(minLengthM || 0);
  const inputText = formatMeterNumber(inputLengthM || 0) || String(inputLengthM || 0);
  return `${name}: panjang minimal pemesanan sticker reseller adalah ${minText} meter (input ${inputText} meter).`;
};
const validateStickerResellerOrderingConfig = ({
  customer,
  customerTypes,
  product,
  productDetail,
  pricing,
  lengthMeter,
}) => {
  const customerCategory = resolveCustomerCategoryCode(customer, customerTypes);
  if (customerCategory !== 'reseller') {
    return null;
  }
  const sourceMeta = toSourceMeta(productDetail || product);
  const isStickerSchema = String(sourceMeta?.sales_schema || '').trim().toLowerCase() === 'sticker'
    || Boolean(sourceMeta?.sticker_sales_enabled);
  if (!isStickerSchema) {
    return null;
  }

  const minLengthM = resolveStickerResellerMinimumLength(sourceMeta, pricing);
  const safeInputLength = toPositiveNumber(lengthMeter);
  if (!(minLengthM > 0) || safeInputLength <= 0 || safeInputLength >= minLengthM) {
    return null;
  }

  return buildStickerResellerMinimumMessage(
    toLabel(product?.name, productDetail?.name, 'Produk sticker'),
    safeInputLength,
    minLengthM,
  );
};
const resolveUsedMaterialInfoFromPricing = (pricing, fallbackMaterialInfo, materials, catalogMaterialNameMap) => {
  const directIds = collectMaterialIds(
    pricing?.material_product_id,
    pricing?.material_id,
    pricing?.rule?.selected_material_id,
    pricing?.price_breakdown?.sticker_selected_material_id,
    pricing?.internal?.material_product_id,
    pricing?.internal?.material_id,
    pricing?.material?.id,
    pricing?.material_product?.id,
    pricing?.material_used?.id,
    pricing?.selected_material?.id,
    pricing?.selected_material_product_id,
  );

  const selectedRows = []
    .concat(Array.isArray(pricing?.materials) ? pricing.materials : [])
    .concat(Array.isArray(pricing?.material_products) ? pricing.material_products : [])
    .filter((row) => row && (row.is_selected || row.selected || row.is_default));

  const selectedRowIds = collectMaterialIds(
    ...selectedRows.map((row) => row?.id || row?.material_id || row?.material_product_id),
  );
  const selectedRowNames = collectMaterialNames(
    ...selectedRows.map(
      (row) =>
        row?.name ||
        row?.material_name ||
        row?.material_product_name ||
        row?.label ||
        row?.title ||
        row?.sku,
    ),
  );

  const resolvedIds = directIds.length > 0
    ? directIds
    : (selectedRowIds.length > 0 ? selectedRowIds : (fallbackMaterialInfo?.materialIds || []));
  const materialRows = resolvedIds
    .map((id) => materials.find((row) => Number(row.id) === Number(id)))
    .filter(Boolean);
  const names = collectMaterialNames(
    pricing?.material_name,
    pricing?.material_product_name,
    pricing?.note?.material_name,
    pricing?.internal?.material_name,
    pricing?.internal?.material_product_name,
    pricing?.material?.name,
    pricing?.material_product?.name,
    pricing?.material_used?.name,
    pricing?.selected_material?.name,
    ...selectedRowNames,
    ...resolvedIds.map((id) => catalogMaterialNameMap?.[id]),
    ...materialRows.map((row) => row?.name),
  );

  const selectedWidthM = Number(
    pricing?.rule?.selected_width_m ||
    pricing?.price_breakdown?.sticker_selected_roll_width_m ||
    0,
  );
  const widthText = Number.isFinite(selectedWidthM) && selectedWidthM > 0
    ? `Roll ${selectedWidthM.toFixed(2)} m`
    : '';
  const materialName = String(names[0] || fallbackMaterialInfo?.displayText || '').trim();
  const displayText = [materialName, widthText].filter(Boolean).join(' | ');

  return {
    materialIds: resolvedIds,
    primaryMaterialId: resolvedIds[0] || fallbackMaterialInfo?.primaryMaterialId || null,
    displayText: displayText || '-',
  };
};
const PAYMENT_METHOD_LABELS = ['Cash', 'Transfer', 'QRIS', 'Card'];

const normalizePaymentMethodLabel = (value) => {
  const text = normalizeText(value);
  if (['cash', 'tunai'].includes(text)) return 'Cash';
  if (['transfer', 'bank transfer'].includes(text)) return 'Transfer';
  if (['qris', 'qr'].includes(text)) return 'QRIS';
  if (['card', 'kartu', 'debit', 'credit card'].includes(text)) return 'Card';
  return value;
};

const formatBackendValidationError = (error) => {
  const validationBody = error?.body;
  if (!validationBody || typeof validationBody !== 'object' || Array.isArray(validationBody)) {
    return error?.message || 'Terjadi kesalahan saat memproses request.';
  }

  const errorBag = validationBody?.errors && typeof validationBody.errors === 'object'
    ? validationBody.errors
    : validationBody;
  const keys = Object.keys(errorBag || {});
  const firstKey = keys.find((key) => Array.isArray(errorBag[key]));
  if (!firstKey) {
    return validationBody?.message || error?.message || 'Validasi gagal.';
  }

  const firstMessage = String(errorBag[firstKey][0] || error?.message || 'Validasi gagal.');
  return `${firstKey}: ${firstMessage}`;
};
const extractOrderItemIndexFromError = (error) => {
  const text = [
    String(error?.message || ''),
    String(error?.body?.message || ''),
    JSON.stringify(error?.body || {}),
  ].join(' | ');
  const match = text.match(/items\.(\d+)/i) || text.match(/items\[(\d+)\]/i);
  if (!match) {
    return -1;
  }
  const idx = Number(match[1]);
  return Number.isFinite(idx) && idx >= 0 ? idx : -1;
};
const buildMataAyamStockGuidanceMessage = (error, context = {}) => {
  const backendMessage = String(formatBackendValidationError(error) || '').trim();
  const lowerText = [
    String(error?.message || ''),
    backendMessage,
    String(error?.body?.message || ''),
    JSON.stringify(error?.body || {}),
  ].join(' | ').toLowerCase();

  const hasMataAyamKeyword = ['mata ayam', 'mata_ayam', 'eyelet'].some((word) => lowerText.includes(word));
  if (!hasMataAyamKeyword) {
    return '';
  }

  const hasMissingOrStockIssue = [
    'stok',
    'stock',
    'habis',
    'kosong',
    'tidak ada',
    'tidak ditemukan',
    'not found',
    'tidak cukup',
    'insufficient',
  ].some((word) => lowerText.includes(word));

  if (!hasMissingOrStockIssue) {
    return '';
  }

  const contextProductName = String(context?.productName || '').trim();
  const instructions = ['Produk/stok Mata Ayam belum siap.'];
  if (contextProductName) {
    instructions.push(`Produk yang harus diperbaiki: ${contextProductName}.`);
  }
  instructions.push('Silakan tambahkan produk material Mata Ayam di backend atau isi stok Mata Ayam terlebih dahulu.');
  if (backendMessage) {
    instructions.push(`Detail: ${backendMessage}`);
  }
  return instructions.join('\n');
};
const toDataRows = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
};
const normalizeBankAccountRow = (row) => {
  const id = Number(
    row?.id
    || row?.bank_account_id
    || row?.account_id
    || 0,
  );
  const label = toLabel(
    row?.label,
    row?.payment_label,
  );
  const code = toLabel(
    row?.code,
    row?.kode_akun,
  );
  const bankName = toLabel(
    row?.bank_name,
    row?.bank,
    row?.bank_label,
  );
  const accountName = toLabel(
    row?.name,
    row?.account_name,
    row?.holder_name,
    row?.account_holder,
    row?.label,
    row?.title,
  );
  const accountNumber = toLabel(
    row?.account_number,
    row?.no_rekening,
    row?.rekening,
    row?.number,
  );
  const displayName = label || [bankName, accountName].filter(Boolean).join(' - ') || accountName || bankName || `Bank #${id}`;
  return {
    ...row,
    id,
    label,
    code,
    bankName,
    accountName,
    accountNumber,
    displayName,
  };
};
const isDraftCandidate = (row) => {
  const status = String(row?.status || '').trim().toLowerCase();
  if (status === 'draft') {
    return true;
  }
  const notes = String(row?.notes || '').toLowerCase();
  return notes.includes('mode: simpan draft');
};
const resolveAppVersionLabel = () => {
  const raw = String(process.env.EXPO_PUBLIC_APP_VERSION || '').trim();
  if (!raw) {
    return 'v1.0.0';
  }
  return raw.toLowerCase().startsWith('v') ? raw : `v${raw}`;
};
const PRODUCTION_STATUS_TONE_MAP = {
  waiting_design: require('../../assets/notifikasi/notifikasi-masukdesign.mp3'),
  waiting_production: require('../../assets/notifikasi/notifikasi-produksi.mp3'),
  in_batch: require('../../assets/notifikasi/notifikasi-prosesproduksi.mp3'),
  printed: require('../../assets/notifikasi/notifikasi-selesai.mp3'),
  default: require('../../assets/notifikasi/notifikasi-produksi.mp3'),
};
const APP_VERSION_LABEL = resolveAppVersionLabel();
const isDraftPayload = (payload) => {
  const status = String(payload?.status || '').trim().toLowerCase();
  if (status === 'draft') {
    return true;
  }
  const notes = String(payload?.notes || '').toLowerCase();
  return notes.includes('mode: simpan draft');
};

const extractUserDisplayName = (user) => {
  return toLabel(
    user?.name,
    user?.fullname,
    user?.full_name,
    user?.username,
    user?.user_name,
    user?.email,
    'User Login',
  );
};

const extractUserRoleLabel = (user) => {
  const direct = toLabel(
    user?.role_name,
    user?.role,
    user?.position,
    user?.jabatan,
    user?.user_type,
    user?.level,
  );
  if (direct) {
    return direct;
  }

  const roleRows = Array.isArray(user?.roles)
    ? user.roles
    : (user?.roles && typeof user.roles === 'object')
      ? Object.values(user.roles)
      : [];
  const firstRole = Array.isArray(roleRows) ? roleRows[0] : null;
  const firstRoleLabel = toLabel(
    firstRole?.name,
    firstRole?.title,
    firstRole?.label,
    firstRole,
  );
  if (firstRoleLabel) {
    return firstRoleLabel;
  }

  return 'Kasir';
};

const SalesScreen = ({ currentUser, onLogout }) => {
  const { width, height } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 1200;

  const [orderNumber, setOrderNumber] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [transactionDate, setTransactionDate] = useState(formatDate(new Date()));
  const [productName, setProductName] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [qty, setQty] = useState('1');
  const [sizeWidthMeter, setSizeWidthMeter] = useState('');
  const [sizeLengthMeter, setSizeLengthMeter] = useState('');
  const [selectedFinishingIds, setSelectedFinishingIds] = useState([]);
  const [selectedFinishingMataAyamQtyById, setSelectedFinishingMataAyamQtyById] = useState({});
  const [selectedLbMaxProductId, setSelectedLbMaxProductId] = useState(null);
  const [pages, setPages] = useState('1');
  const [cartItems, setCartItems] = useState([]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountMode, setDiscountMode] = useState('percent');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [activeMenu, setActiveMenu] = useState('pos');
  const [currentDraftSourceId, setCurrentDraftSourceId] = useState(null);
  const [draftInvoices, setDraftInvoices] = useState([]);
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [isDraftLoading, setIsDraftLoading] = useState(false);
  const [isDeletingDraftId, setIsDeletingDraftId] = useState(null);
  const [productionRows, setProductionRows] = useState([]);
  const [isProductionLoading, setIsProductionLoading] = useState(false);
  const [productionStatusFilter, setProductionStatusFilter] = useState('all');
  const [productionSearch, setProductionSearch] = useState('');
  const [updatingProductionItemId, setUpdatingProductionItemId] = useState(null);

  const [backendReady, setBackendReady] = useState(false);
  const [products, setProducts] = useState([]);
  const [productDetails, setProductDetails] = useState({});
  const [finishingCatalog, setFinishingCatalog] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [catalogMaterialNameMap, setCatalogMaterialNameMap] = useState({});
  const [customers, setCustomers] = useState([]);
  const [customerTypes, setCustomerTypes] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSyncInfo, setLastSyncInfo] = useState('');
  const [queueCount, setQueueCount] = useState(0);
  const [auditLogs, setAuditLogs] = useState([]);
  const [lastPayloadPreview, setLastPayloadPreview] = useState(null);
  const [itemFinalPrice, setItemFinalPrice] = useState(0);
  const [previewMaterialDisplay, setPreviewMaterialDisplay] = useState('');
  const [mataAyamIssueBadge, setMataAyamIssueBadge] = useState({
    visible: false,
    message: '',
  });
  const previewRequestRef = useRef(0);
  const [healthStatus, setHealthStatus] = useState({
    state: 'checking',
    label: 'Offline',
    checkedAt: null,
  });
  const [isPreparingApp, setIsPreparingApp] = useState(true);
  const [prepareMessage, setPrepareMessage] = useState(PREPARE_LOADING_TEXT);
  const [noticeModal, setNoticeModal] = useState({
    visible: false,
    title: '',
    message: '',
    onClose: null,
    actions: [],
    showDefaultAction: true,
    autoCloseMs: 0,
  });
  const [isOrderPreviewOpen, setIsOrderPreviewOpen] = useState(false);
  const [isOrderPreviewSubmitting, setIsOrderPreviewSubmitting] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [isBankAccountLoading, setIsBankAccountLoading] = useState(false);
  const [isBankPickerOpen, setIsBankPickerOpen] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState(null);
  const [bankPickerAction, setBankPickerAction] = useState('save');
  const [pickupModal, setPickupModal] = useState({
    visible: false,
    orderId: 0,
    invoiceNo: '',
    customerName: '',
    receiverName: '',
    receiverPhone: '',
    note: '',
    isSubmitting: false,
  });
  const [invoiceDetailModal, setInvoiceDetailModal] = useState({
    visible: false,
    row: null,
    orderId: '-',
    invoiceNo: '-',
    customerName: 'Pelanggan umum',
    orderStatus: '-',
    productionSummary: '-',
    itemCount: 0,
    total: 0,
    createdAt: '-',
    pickedUpText: 'Belum diambil',
    items: [],
    canPickup: false,
  });
  const [productionNotifications, setProductionNotifications] = useState([]);
  const [unreadProductionCount, setUnreadProductionCount] = useState(0);
  const noticeAutoCloseRef = useRef(null);
  const previousGrandTotalRef = useRef(null);
  const productionSnapshotRef = useRef(new Map());
  const productionSnapshotReadyRef = useRef(false);
  const productionPollingRef = useRef(false);
  const audioContextRef = useRef(null);
  const audioElementRef = useRef(null);
  const toneTimeoutsRef = useRef([]);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const userDisplayName = useMemo(() => extractUserDisplayName(currentUser), [currentUser]);
  const userRoleLabel = useMemo(() => extractUserRoleLabel(currentUser), [currentUser]);
  const userInitial = useMemo(() => String(userDisplayName || 'U').trim().charAt(0).toUpperCase(), [userDisplayName]);

  const openNotice = (title, message, onClose = null, options = {}) => {
    setNoticeModal({
      visible: true,
      title: String(title || 'Informasi'),
      message: String(message || ''),
      onClose: typeof onClose === 'function' ? onClose : null,
      actions: [],
      showDefaultAction: options?.showDefaultAction !== false,
      autoCloseMs: Number(options?.autoCloseMs || 0),
    });
  };

  const openNoticeActions = (title, message, actions = [], onClose = null, options = {}) => {
    setNoticeModal({
      visible: true,
      title: String(title || 'Informasi'),
      message: String(message || ''),
      onClose: typeof onClose === 'function' ? onClose : null,
      actions: Array.isArray(actions) ? actions : [],
      showDefaultAction: options?.showDefaultAction !== false,
      autoCloseMs: Number(options?.autoCloseMs || 0),
    });
  };

  const openMataAyamStockNoticeIfNeeded = (error, title = 'SETOK HABIS', context = {}) => {
    const guidanceMessage = buildMataAyamStockGuidanceMessage(error, context);
    if (!guidanceMessage) {
      return false;
    }
    const badgeMessage = String(context?.badgeMessage || '').trim();
    setMataAyamIssueBadge({
      visible: true,
      message: badgeMessage || guidanceMessage.split('\n')[0] || 'Mata ayam bermasalah.',
    });
    openNotice(title, guidanceMessage);
    return true;
  };

  const closeNotice = (action = null) => {
    if (noticeAutoCloseRef.current) {
      clearTimeout(noticeAutoCloseRef.current);
      noticeAutoCloseRef.current = null;
    }
    const callback = typeof action?.onPress === 'function' ? action.onPress : noticeModal.onClose;
    setNoticeModal({
      visible: false,
      title: '',
      message: '',
      onClose: null,
      actions: [],
      showDefaultAction: true,
      autoCloseMs: 0,
    });
    if (typeof callback === 'function') {
      callback();
    }
  };
  const buildReprintSnapshotItems = (orderItems = []) => {
    const rows = Array.isArray(orderItems) ? orderItems : [];
    return rows.map((item, index) => {
      const restored = restoreDraftItemDisplay(item, materialMapById, finishingNameMapById);
      return {
        index,
        productName: toLabel(
          item?.product_name,
          item?.product?.name,
          productNameMapById.get(Number(item?.product_id || 0)),
          item?.name,
          `Item #${index + 1}`,
        ),
        qty: Math.max(Number(item?.qty || item?.quantity || 1) || 1, 1),
        sizeText: restored.sizeText || '-',
        finishingText: restored.finishingText || '-',
        materialText: restored.materialText || '-',
        pages: Math.max(Number(restored.pages || item?.pages || 1) || 1, 1),
      };
    });
  };
  const playSynthNotificationTone = () => {
    if (Platform.OS === 'web') {
      try {
        if (!audioContextRef.current) {
          const Ctx = globalThis?.AudioContext || globalThis?.webkitAudioContext;
          if (!Ctx) {
            return false;
          }
          audioContextRef.current = new Ctx();
        }
        const ctx = audioContextRef.current;
        if (!ctx) {
          return false;
        }

        const trigger = () => {
          const startAt = ctx.currentTime + 0.01;
          const first = ctx.createOscillator();
          const firstGain = ctx.createGain();
          first.type = 'sine';
          first.frequency.value = 1120;
          firstGain.gain.setValueAtTime(0.0001, startAt);
          firstGain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02);
          firstGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18);
          first.connect(firstGain);
          firstGain.connect(ctx.destination);
          first.start(startAt);
          first.stop(startAt + 0.2);

          const second = ctx.createOscillator();
          const secondGain = ctx.createGain();
          second.type = 'sine';
          second.frequency.value = 1280;
          secondGain.gain.setValueAtTime(0.0001, startAt + 0.2);
          secondGain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.22);
          secondGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.34);
          second.connect(secondGain);
          secondGain.connect(ctx.destination);
          second.start(startAt + 0.2);
          second.stop(startAt + 0.36);
        };

        if (ctx.state === 'suspended') {
          ctx.resume().then(trigger).catch(() => {});
          return true;
        }
        trigger();
        return true;
      } catch (_error) {
        // fallback ke vibration di bawah
      }
    }
    return false;
  };
  const playNotificationTone = async (status = '') => {
    const statusKey = resolveProductionStatusKey(status);
    const toneModule = PRODUCTION_STATUS_TONE_MAP[statusKey] || PRODUCTION_STATUS_TONE_MAP.default;
    if (Platform.OS === 'web' && toneModule && typeof globalThis?.Audio === 'function') {
      try {
        if (audioElementRef.current && typeof audioElementRef.current.pause === 'function') {
          audioElementRef.current.pause();
        }
        const toneUri = Asset.fromModule(toneModule)?.uri || '';
        if (toneUri) {
          const audio = new globalThis.Audio(toneUri);
          audioElementRef.current = audio;
          audio.preload = 'auto';
          await audio.play();
          return;
        }
      } catch (_error) {
        // fallback ke synth tone di bawah
      }
    }
    if (playSynthNotificationTone()) {
      return;
    }
    Vibration.vibrate([0, 150, 80, 150]);
  };
  const pushProductionNotifications = (entries = []) => {
    if (!Array.isArray(entries) || entries.length === 0) {
      return;
    }
    const nowIso = new Date().toISOString();
    const normalized = entries
      .map((entry, index) => ({
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        text: String(entry?.text || '').trim(),
        status: resolveProductionStatusKey(entry?.status),
        createdAt: nowIso,
      }))
      .filter((entry) => entry.text);
    if (normalized.length === 0) {
      return;
    }

    setProductionNotifications((prev) => [...normalized, ...prev].slice(0, 40));
    setUnreadProductionCount((prev) => prev + normalized.length);
    normalized.forEach((entry, index) => {
      const timer = setTimeout(() => {
        playNotificationTone(entry.status).catch(() => {});
        toneTimeoutsRef.current = toneTimeoutsRef.current.filter((id) => id !== timer);
      }, index * 540);
      toneTimeoutsRef.current.push(timer);
    });

    const firstThree = normalized.slice(0, 3).map((entry) => `- ${entry.text}`).join('\n');
    const moreCount = normalized.length > 3 ? `\n+ ${normalized.length - 3} perubahan lain` : '';
    if (!noticeModal.visible) {
      openNotice('Notifikasi Produksi', `${firstThree}${moreCount}`, null, {
        showDefaultAction: false,
        autoCloseMs: 2600,
      });
    }
  };

  const buildOrderPreviewSnapshot = () => {
    return {
      transactionDate,
      customerName: String(selectedCustomer?.name || 'Pelanggan umum'),
      paymentMethod: normalizePaymentMethodLabel(paymentMethod),
      paymentStatus,
      paymentAmount: paidAmount,
      discountAmount: finalDiscount,
      subtotal,
      grandTotal,
      notes: paymentNotes || '-',
      items: cartItems.map((item, index) => ({
        no: index + 1,
        product: String(item?.product || '-'),
        qty: Number(item?.qty || 0),
        size: String(item?.size || '-'),
        finishing: String(item?.finishing || '-'),
        lbMax: String(item?.lbMax || '-'),
        material: String(item?.material || '-'),
        total: Number(item?.total || item?.lineTotal || 0),
      })),
    };
  };

  const printOrderPreview = (snapshot, submitResult) => {
    if (Platform.OS !== 'web') {
      return;
    }
    const rows = (snapshot?.items || [])
      .map((item) => `
        <tr>
          <td>${item.no}</td>
          <td>${escapeHtml(item.product)}</td>
          <td style="text-align:center;">${item.qty}</td>
          <td>${escapeHtml(item.size)}</td>
          <td>${escapeHtml(item.finishing)}</td>
          <td>${escapeHtml(item.material)}</td>
          <td style="text-align:right;">${formatRupiah(item.total)}</td>
        </tr>
      `)
      .join('');

    const printWindow = globalThis?.open?.('', '_blank', 'width=980,height=760');
    if (!printWindow) {
      openNotice('Cetak Nota', 'Popup browser diblokir. Izinkan popup untuk mencetak nota.');
      return;
    }

    const invoiceNo = String(submitResult?.invoiceNo || '-');
    const backendOrderId = String(submitResult?.backendOrderId || '-');
    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Nota Penjualan</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #222; }
    h1 { font-size: 18px; margin: 0 0 8px 0; }
    .meta { font-size: 12px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #999; padding: 6px; vertical-align: top; }
    th { background: #edf2ff; }
    .totals { margin-top: 10px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Nota Penjualan</h1>
  <div class="meta">Invoice: ${escapeHtml(invoiceNo)} | Order ID: ${escapeHtml(backendOrderId)} | Tanggal: ${escapeHtml(snapshot.transactionDate)}</div>
  <div class="meta">Pelanggan: ${escapeHtml(snapshot.customerName)}</div>
  <table>
    <thead>
      <tr>
        <th>No</th>
        <th>Produk</th>
        <th>Qty</th>
        <th>Ukuran</th>
        <th>Finishing</th>
        <th>Bahan</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">Subtotal: ${formatRupiah(snapshot.subtotal)}</div>
  <div class="totals">Diskon: ${formatRupiah(snapshot.discountAmount)}</div>
  <div class="totals"><strong>Total: ${formatRupiah(snapshot.grandTotal)}</strong></div>
  <div class="totals">Metode Bayar: ${escapeHtml(snapshot.paymentMethod)} | Status: ${escapeHtml(snapshot.paymentStatus)}</div>
  <div class="totals">Nominal Bayar: ${formatRupiah(snapshot.paymentAmount)}</div>
  <div class="totals">Catatan: ${escapeHtml(snapshot.notes)}</div>
</body>
</html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  useEffect(() => {
    if (noticeAutoCloseRef.current) {
      clearTimeout(noticeAutoCloseRef.current);
      noticeAutoCloseRef.current = null;
    }

    const timeoutMs = Number(noticeModal.autoCloseMs || 0);
    if (noticeModal.visible && timeoutMs > 0) {
      noticeAutoCloseRef.current = setTimeout(() => {
        closeNotice();
      }, timeoutMs);
    }

    return () => {
      if (noticeAutoCloseRef.current) {
        clearTimeout(noticeAutoCloseRef.current);
        noticeAutoCloseRef.current = null;
      }
    };
  }, [noticeModal.visible, noticeModal.autoCloseMs]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setIsPreparingApp(true);
        setPrepareMessage(PREPARE_LOADING_TEXT);
        const [productsRows, finishingRows, materialsRows, productionMaterialsRows, customerRows, customerTypeRows] = await Promise.all([
          fetchPosProducts(),
          fetchPosFinishings().catch(() => []),
          fetchPosMaterials(),
          fetchPosProductionMaterials().catch(() => []),
          fetchPosCustomers(),
          fetchPosCustomerTypes().catch(() => []),
        ]);

        setProducts(toDataRows(productsRows));
        setFinishingCatalog(Array.isArray(finishingRows) ? finishingRows : []);
        setMaterials((Array.isArray(materialsRows) ? materialsRows : []).map(normalizeMaterialRow));
        const materialNameMap = {};
        (Array.isArray(productionMaterialsRows) ? productionMaterialsRows : []).forEach((row) => {
          const id = Number(row?.id || 0);
          const name = String(row?.name || '').trim();
          if (id > 0 && name) {
            materialNameMap[id] = name;
          }
        });
        setCatalogMaterialNameMap(materialNameMap);
        setCustomers((Array.isArray(customerRows) ? customerRows : []).map(normalizeCustomerRow));
        const normalizedTypes = (Array.isArray(customerTypeRows) ? customerTypeRows : [])
          .map(normalizeCustomerTypeRow)
          .filter((row) => row.name);
        const mergedTypes = [...normalizedTypes];

        DEFAULT_CUSTOMER_TYPES.forEach((fallback) => {
          if (!mergedTypes.some((row) => row.code === fallback.code || normalizeText(row.name) === normalizeText(fallback.name))) {
            mergedTypes.push(fallback);
          }
        });

        mergedTypes.sort((a, b) => {
          const pa = CUSTOMER_TYPE_PRIORITY[a.code] || 99;
          const pb = CUSTOMER_TYPE_PRIORITY[b.code] || 99;
          if (pa !== pb) return pa - pb;
          return String(a.name || '').localeCompare(String(b.name || ''), 'id');
        });
        setCustomerTypes(mergedTypes);
        setBackendReady(true);
        setHealthStatus({
          state: 'online',
          label: 'Online',
          checkedAt: new Date().toISOString(),
        });
        const queue = loadOrderQueue();
        setQueueCount(queue.length);
        setPrepareMessage(PREPARE_LOADING_TEXT);
        await flushQueuedOrders(true);
        setAuditLogs(loadOrderAuditLogs());
      } catch (error) {
        if (Number(error?.status || 0) === 401) {
          Alert.alert('Sesi Login Berakhir', 'Silakan login kembali untuk mengakses POS.', [
            { text: 'OK', onPress: () => onLogout?.() },
          ]);
          setIsPreparingApp(false);
          return;
        }
        setHealthStatus({
          state: 'offline',
          label: 'Offline',
          checkedAt: new Date().toISOString(),
        });
        Alert.alert(
          'Koneksi Backend Gagal',
          `${error.message}\nBase URL: ${getApiBaseUrl()}`,
        );
        setPrepareMessage(PREPARE_LOADING_TEXT);
      } finally {
        setIsPreparingApp(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const checkHealth = async () => {
      try {
        const me = await fetchAuthMe();
        if (isCancelled) return;
        setHealthStatus({
          state: 'online',
          label: 'Online',
          checkedAt: new Date().toISOString(),
        });
        setBackendReady(true);
      } catch (error) {
        if (isCancelled) return;
        if (Number(error?.status || 0) === 401) {
          Alert.alert('Sesi Login Berakhir', 'Silakan login kembali untuk mengakses POS.', [
            { text: 'OK', onPress: () => onLogout?.() },
          ]);
          return;
        }
        setHealthStatus({
          state: 'offline',
          label: 'Offline',
          checkedAt: new Date().toISOString(),
        });
      }
    };

    checkHealth();
    const timer = setInterval(checkHealth, 30000);
    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, []);

  const flushQueuedOrders = async (forceRun = false) => {
    const queue = loadOrderQueue();
    if ((!backendReady && !forceRun) || queue.length === 0) {
      return { successCount: 0, remaining: queue.length };
    }

    const stillQueued = [];
    let successCount = 0;

    for (const queued of queue) {
      try {
        const created = await createPosOrder(queued.payload);
        const createdId = Number(created?.id || 0) || null;
        if (isDraftPayload(queued?.payload) && createdId) {
          try {
            await updatePosOrderStatus(createdId, 'draft');
          } catch (_error) {
            // no-op
          }
        }
        successCount += 1;
      } catch (error) {
        stillQueued.push(queued);
      }
    }

    setOrderQueue(stillQueued);
    setQueueCount(stillQueued.length);

    if (successCount > 0) {
      setLastSyncInfo(`Sinkronisasi offline berhasil: ${successCount} order.`);
      setAuditLogs(
        appendOrderAuditLog({
          result: 'flush_queue_success',
          synced_count: successCount,
          queue_count: stillQueued.length,
        }),
      );
    }
    return { successCount, remaining: stillQueued.length };
  };

  useEffect(() => {
    if (backendReady) {
      flushQueuedOrders();
    }
  }, [backendReady]);

  const subtotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.lineTotal, 0),
    [cartItems],
  );

  const parsedDiscountPercent = useMemo(
    () => Math.min(Math.max(Number(discountPercent) || 0, 0), 100),
    [discountPercent],
  );
  const parsedDiscountAmount = useMemo(
    () => Math.min(Math.max(Number(discountAmount) || 0, 0), subtotal),
    [discountAmount, subtotal],
  );
  const calculatedDiscountFromPercent = useMemo(
    () => Math.round((subtotal * parsedDiscountPercent) / 100),
    [subtotal, parsedDiscountPercent],
  );
  const finalDiscount = useMemo(() => {
    if (discountMode === 'amount') {
      return parsedDiscountAmount;
    }
    return calculatedDiscountFromPercent;
  }, [discountMode, parsedDiscountAmount, calculatedDiscountFromPercent]);

  const discountAmountDisplay = useMemo(() => {
    if (discountMode === 'percent') {
      return String(calculatedDiscountFromPercent);
    }
    return discountAmount;
  }, [discountMode, calculatedDiscountFromPercent, discountAmount]);

  const grandTotal = useMemo(() => Math.max(subtotal - finalDiscount, 0), [subtotal, finalDiscount]);
  const paidAmount = useMemo(() => Number(paymentAmount) || 0, [paymentAmount]);
  const changeAmount = useMemo(() => Math.max(paidAmount - grandTotal, 0), [paidAmount, grandTotal]);
  const paymentStatus = useMemo(() => {
    if (paidAmount <= 0) return 'Belum Bayar';
    if (paidAmount >= grandTotal) return 'Lunas';
    return 'DP';
  }, [paidAmount, grandTotal]);
  useEffect(() => {
    const currentAmountText = sanitizeNumericInput(String(paymentAmount || ''));
    const currentGrandTotalText = String(Math.max(0, Math.round(grandTotal)));
    const previousGrandTotal = previousGrandTotalRef.current;
    const previousGrandTotalText =
      previousGrandTotal === null ? '' : String(Math.max(0, Math.round(previousGrandTotal)));

    // Auto-fill nominal bayar hanya saat masih default (kosong atau masih mengikuti total sebelumnya).
    const shouldAutofill =
      !currentAmountText ||
      (previousGrandTotal !== null && currentAmountText === previousGrandTotalText);

    if (shouldAutofill && currentAmountText !== currentGrandTotalText) {
      setPaymentAmount(currentGrandTotalText);
    }

    previousGrandTotalRef.current = grandTotal;
  }, [grandTotal, paymentAmount]);
  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [activeMenu]);
  const transactionType = useMemo(
    () => mapPaymentStatusToTransactionType(paymentStatus),
    [paymentStatus],
  );
  const selectedCustomer = useMemo(
    () => customers.find((row) => Number(row.id) === Number(selectedCustomerId)) || null,
    [customers, selectedCustomerId],
  );
  const selectedProductRow = useMemo(() => {
    if (selectedProductId) {
      const byId = products.find((row) => Number(row?.id) === Number(selectedProductId));
      if (byId) {
        return byId;
      }
    }
    return findByName(products, productName) || null;
  }, [selectedProductId, products, productName]);
  const materialMapById = useMemo(() => {
    const map = new Map();
    materials.forEach((row) => {
      const id = Number(row?.id || 0);
      if (id > 0) {
        map.set(id, String(row?.name || '').trim());
      }
    });
    return map;
  }, [materials]);
  const productNameMapById = useMemo(() => {
    const map = new Map();
    products.forEach((row) => {
      const id = Number(row?.id || 0);
      if (id > 0) {
        map.set(id, String(row?.name || '').trim() || `Produk #${id}`);
      }
    });
    return map;
  }, [products]);
  const finishingNameMapById = useMemo(() => {
    const map = new Map();
    (Array.isArray(finishingCatalog) ? finishingCatalog : []).forEach((row) => {
      const name = toLabel(row?.name, row?.sku_name, row?.title);
      const ids = [
        Number(row?.id || 0),
        Number(row?.product_id || 0),
        Number(row?.source_product_id || 0),
        Number(toSourceProduct(row)?.id || 0),
      ].filter((id) => id > 0);
      ids.forEach((id) => {
        if (name && !map.has(id)) {
          map.set(id, name);
        }
      });
    });
    return map;
  }, [finishingCatalog]);
  const productPickerTree = useMemo(() => {
    const rows = Array.isArray(products) ? products : [];
    const categoryMap = new Map();
    const familyMap = new Map();

    const ensureCategoryPath = (baseRow, fallbackFamilyKey = '') => {
      const categoryName = normalizeCategoryName(baseRow);
      const subCategoryName = normalizeSubCategoryName(baseRow);
      const categoryKey = `cat:${normalizeText(categoryName) || fallbackFamilyKey || 'tanpa-kategori'}`;
      const subCategoryKey = `${categoryKey}::sub:${normalizeText(subCategoryName) || 'tanpa-sub-kategori'}`;

      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, { key: categoryKey, name: categoryName, subcategories: [] });
      }
      const category = categoryMap.get(categoryKey);
      let subCategory = category.subcategories.find((item) => item.key === subCategoryKey);
      if (!subCategory) {
        subCategory = { key: subCategoryKey, name: subCategoryName, products: [] };
        category.subcategories.push(subCategory);
      }
      return { category, subCategory, categoryKey, subCategoryKey };
    };

    const ensureFamilyNode = (row) => {
      const sourceProduct = toSourceProduct(row);
      const familyId = Number(
        row?.source_product_id
        || sourceProduct?.id
        || row?.parent_product_id
        || row?.parent_id
        || row?.product_id
        || row?.id
        || 0
      );
      const familyName = toLabel(
        sourceProduct?.name,
        row?.source_product_name,
        row?.parent_product_name,
        normalizeProductFamilyName(row),
        normalizeVariantName(row),
        'Produk',
      );
      const familyKey = familyId > 0
        ? `family:${familyId}`
        : `family:${normalizeText(familyName) || JSON.stringify(row || {})}`;

      let familyNode = familyMap.get(familyKey);
      if (!familyNode) {
        const baseForClassification = sourceProduct && typeof sourceProduct === 'object'
          ? { ...row, ...sourceProduct, source_product: sourceProduct, sourceProduct }
          : row;
        const path = ensureCategoryPath(baseForClassification, familyKey);
        familyNode = {
          key: `${path.subCategoryKey}::${familyKey}`,
          name: familyName,
          variants: [],
          _variantKeys: new Set(),
          _subCategoryKey: path.subCategoryKey,
        };
        path.subCategory.products.push(familyNode);
        familyMap.set(familyKey, familyNode);
      }
      return { familyNode, familyId, sourceProduct };
    };

    const attachVariant = (familyNode, variantCandidate, fallbackRow, familyId, sourceProduct, idx = 0) => {
      const variantId = Number(variantCandidate?.id || variantCandidate?.product_id || 0);
      const variantName = toLabel(
        variantCandidate?.variant_name,
        variantCandidate?.name,
        variantCandidate?.sku_name,
        variantCandidate?.sku,
        normalizeVariantName(variantCandidate),
        normalizeVariantName(fallbackRow),
        familyNode.name,
      );
      const variantKey = variantId > 0
        ? `id:${variantId}`
        : `${familyNode.key}::var:${normalizeText(variantName) || idx}`;
      if (familyNode._variantKeys.has(variantKey)) {
        return;
      }
      const mergedRow = {
        ...fallbackRow,
        ...variantCandidate,
        source_product_id: familyId > 0 ? familyId : (fallbackRow?.source_product_id || sourceProduct?.id || null),
        source_product: sourceProduct || fallbackRow?.source_product || fallbackRow?.sourceProduct || null,
      };
      familyNode._variantKeys.add(variantKey);
      familyNode.variants.push({
        key: variantKey,
        id: variantId || null,
        name: variantName || familyNode.name,
        row: mergedRow,
      });
    };

    rows.forEach((row) => {
      const { familyNode, familyId, sourceProduct } = ensureFamilyNode(row);
      const nestedVariants = Array.isArray(row?.variants) ? row.variants : [];
      if (nestedVariants.length > 0) {
        nestedVariants.forEach((variant, idx) => {
          attachVariant(familyNode, variant, row, familyId, sourceProduct, idx);
        });
        return;
      }

      const rowId = Number(row?.id || 0);
      const isLikelyVariant = Boolean(familyId > 0 && rowId > 0 && familyId !== rowId);
      if (isLikelyVariant) {
        attachVariant(familyNode, row, row, familyId, sourceProduct, 0);
      } else if (familyNode.variants.length === 0) {
        // Produk tanpa varian tetap bisa dipilih langsung.
        attachVariant(familyNode, row, row, familyId, sourceProduct, 0);
      }
    });

    return Array.from(categoryMap.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'id'))
      .map((category) => ({
        ...category,
        subcategories: category.subcategories
          .sort((a, b) => a.name.localeCompare(b.name, 'id'))
          .map((sub) => ({
            ...sub,
            products: sub.products
              .map((product) => ({
                key: product.key,
                name: product.name,
                variants: product.variants.sort((a, b) => a.name.localeCompare(b.name, 'id')),
              }))
              .sort((a, b) => a.name.localeCompare(b.name, 'id')),
          })),
      }));
  }, [products]);

  useEffect(() => {
    let cancelled = false;
    const selectedId = Number(selectedProductId || 0);
    if (!selectedId || productDetails[selectedId]) {
      return undefined;
    }

    const loadDetail = async () => {
      try {
        const detail = await fetchPosProductDetail(selectedId);
        if (cancelled) return;
        setProductDetails((prev) => ({ ...prev, [selectedId]: detail }));
      } catch (error) {
        // no-op: validasi akan menangkap saat submit/check
      }
    };

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedProductId, productDetails]);

  const selectedProductFinishings = useMemo(() => {
    if (!selectedProductRow) {
      return [];
    }
    const selectedId = Number(selectedProductId || selectedProductRow?.id || 0);
    const detail = selectedId > 0 ? productDetails[selectedId] : null;
    const detailFinishings = extractProductFinishings(detail);
    const rows = detailFinishings.length > 0
      ? detailFinishings
      : extractProductFinishings(selectedProductRow);
    return rows
      .map(normalizeFinishingRow)
      .filter((row) => row.name)
      .filter((row) => row.is_active !== false && String(row.status || '').toLowerCase() !== 'inactive');
  }, [selectedProductId, productDetails, selectedProductRow]);
  const printingFinishingCatalog = useMemo(() => {
    return (finishingCatalog || [])
      .filter((row) => isFinishingCatalogType(row?.product_type))
      .map((row) => {
        const meta = row?.meta && typeof row.meta === 'object' && !Array.isArray(row.meta)
          ? row.meta
          : {};
        const sourceId = Number(row?.source_product_id || toSourceProduct(row)?.id || row?.id || 0);
        const recommendationGroups = Array.isArray(meta?.finishing_recommendation_groups)
          ? meta.finishing_recommendation_groups
          : [meta?.finishing_recommendation_group];
        return {
          id: sourceId,
          name: String(row?.name || '').trim(),
          sku: String(row?.sku || '').trim(),
          price: Number(row?.price || 0),
          price_reseller: Number(row?.price_reseller || 0),
          price_express: Number(row?.price_express || 0),
          unit_hint: String(meta?.finishing_unit_hint || meta?.unit_hint || 'flat'),
          lb_max_width_cm: Number(meta?.finishing_lb_max_width_cm ?? meta?.lb_max_width_cm ?? 0),
          source: 'catalog',
          axis_group: normalizeAxisGroup(row),
          recommendation_groups: recommendationGroups
            .map((item) => String(item || '').trim().toLowerCase())
            .filter(Boolean),
          requires_mata_ayam: resolveFinishingRequiresMataAyam({ ...row, meta }),
          payload_key: 'product_id',
        };
      })
      .filter((row) => row.id > 0 && row.name);
  }, [finishingCatalog]);
  const selectedProductType = useMemo(
    () => String(toSourceProduct(selectedProductRow)?.product_type || selectedProductRow?.product_type || '').toLowerCase(),
    [selectedProductRow],
  );
  const selectedFinishingGroup = useMemo(() => {
    const sourceMeta = toSourceMeta(selectedProductRow);
    return String(sourceMeta?.finishing_recommendation_group || '').trim().toLowerCase();
  }, [selectedProductRow]);
  const selectedSalesSchema = useMemo(() => {
    const sourceMeta = toSourceMeta(selectedProductRow);
    return String(sourceMeta?.sales_schema || '').trim().toLowerCase();
  }, [selectedProductRow]);
  const effectiveFinishingOptions = useMemo(() => {
    const productFinishings = selectedProductFinishings.map((row) => ({
      id: Number(row.id || 0),
      name: String(row.name || '').trim(),
      sku: String(row.sku || '').trim(),
      price: Number(row.price || row.unit_price || row.selling_price || 0),
      price_reseller: Number(row.price_reseller || 0),
      price_express: Number(row.price_express || 0),
      unit_hint: String(row.unit_hint || row.meta?.finishing_unit_hint || row.meta?.unit_hint || 'flat'),
      lb_max_width_cm: Number(row.lb_max_width_cm || row.meta?.finishing_lb_max_width_cm || row.meta?.lb_max_width_cm || 0),
      source: 'product',
      axis_group: ['right_left', 'top_bottom', 'all_sides', 'sambungan'].includes(String(row.axis_group || ''))
        ? String(row.axis_group)
        : normalizeAxisGroup(row),
      recommendation_groups: Array.isArray(row.recommendation_groups)
        ? row.recommendation_groups.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
        : [],
      requires_mata_ayam: resolveFinishingRequiresMataAyam(row),
      payload_key: row.payload_key === 'product_id' ? 'product_id' : 'id',
    })).filter((row) => row.id > 0 && row.name);

    if (isPrintingProductType(selectedProductType)) {
      return printingFinishingCatalog.filter((option) => {
        if (!selectedFinishingGroup) {
          // Sticker tidak boleh fallback ke semua finishing katalog.
          if (selectedSalesSchema === 'sticker') {
            return false;
          }
          return true;
        }
        if (!Array.isArray(option.recommendation_groups) || option.recommendation_groups.length === 0) {
          return false;
        }
        return option.recommendation_groups.includes(selectedFinishingGroup);
      });
    }
    if (productFinishings.length > 0) {
      return productFinishings;
    }
    return [];
  }, [selectedProductType, printingFinishingCatalog, selectedFinishingGroup, selectedProductFinishings, selectedSalesSchema]);
  const selectedFinishingSummary = useMemo(() => {
    if (!Array.isArray(selectedFinishingIds) || selectedFinishingIds.length === 0) {
      return '';
    }
    const byId = new Map(
      (effectiveFinishingOptions || []).map((row) => [Number(row.id), String(row.name || '').trim()]),
    );
    return selectedFinishingIds
      .map((id) => byId.get(Number(id)) || '')
      .filter(Boolean)
      .join(', ');
  }, [selectedFinishingIds, effectiveFinishingOptions]);
  const selectedMataAyamSummary = useMemo(() => {
    if (!Array.isArray(selectedFinishingIds) || selectedFinishingIds.length === 0) {
      return '';
    }
    const byId = new Map(
      (effectiveFinishingOptions || []).map((row) => [Number(row.id), String(row.name || '').trim()]),
    );
    const rows = selectedFinishingIds
      .map((id) => Number(id))
      .filter((id) => id > 0)
      .map((id) => {
        const qty = Math.max(0, Math.floor(Number(selectedFinishingMataAyamQtyById?.[id] || 0)));
        if (qty <= 0) return '';
        const finishingName = byId.get(id) || `Finishing #${id}`;
        return `${finishingName}: ${qty} pcs`;
      })
      .filter(Boolean);
    return rows.join(', ');
  }, [selectedFinishingIds, selectedFinishingMataAyamQtyById, effectiveFinishingOptions]);
  const selectedFinishingDisplay = useMemo(() => {
    if (!selectedFinishingSummary) {
      return selectedMataAyamSummary ? `Mata Ayam (${selectedMataAyamSummary})` : '';
    }
    if (!selectedMataAyamSummary) {
      return selectedFinishingSummary;
    }
    return `${selectedFinishingSummary} | Mata Ayam: ${selectedMataAyamSummary}`;
  }, [selectedFinishingSummary, selectedMataAyamSummary]);
  const lbMaxFinishingOptions = useMemo(() => {
    if (!isPrintingProductType(selectedProductType)) {
      return [];
    }
    return effectiveFinishingOptions.filter((row) => isWidthFinishingOption(row));
  }, [selectedProductType, effectiveFinishingOptions]);
  const regularFinishingOptions = useMemo(() => {
    if (!isPrintingProductType(selectedProductType)) {
      return effectiveFinishingOptions;
    }
    return effectiveFinishingOptions.filter((row) => !isWidthFinishingOption(row));
  }, [selectedProductType, effectiveFinishingOptions]);
  const finishingRequiresMataAyamById = useMemo(() => {
    return new Map(
      regularFinishingOptions
        .map((row) => [Number(row.id || 0), row.requires_mata_ayam === true])
        .filter(([id]) => id > 0),
    );
  }, [regularFinishingOptions]);
  const selectedRequiresMataAyam = useMemo(() => {
    return (Array.isArray(selectedFinishingIds) ? selectedFinishingIds : [])
      .map((id) => Number(id))
      .filter((id) => id > 0)
      .some((id) => finishingRequiresMataAyamById.get(id) === true);
  }, [selectedFinishingIds, finishingRequiresMataAyamById]);
  const hasMataAyamCatalogProduct = useMemo(() => {
    return (Array.isArray(finishingCatalog) ? finishingCatalog : []).some((row) => {
      const name = String(row?.name || '').trim().toLowerCase();
      const type = String(row?.product_type || '').trim().toLowerCase();
      return name.includes('mata ayam') && (type === 'finishing' || type === '');
    });
  }, [finishingCatalog]);
  const autoMataAyamIssueBadge = useMemo(() => {
    if (!selectedRequiresMataAyam) {
      return { visible: false, message: '' };
    }
    if (!hasMataAyamCatalogProduct) {
      return {
        visible: true,
        message: 'Produk Mata Ayam belum ada di backend.',
      };
    }
    return { visible: false, message: '' };
  }, [selectedRequiresMataAyam, hasMataAyamCatalogProduct]);
  const mergedMataAyamIssueBadge = useMemo(() => {
    if (autoMataAyamIssueBadge.visible) {
      return autoMataAyamIssueBadge;
    }
    if (mataAyamIssueBadge?.visible) {
      return mataAyamIssueBadge;
    }
    return { visible: false, message: '' };
  }, [autoMataAyamIssueBadge, mataAyamIssueBadge]);
  const selectedLbMaxSummary = useMemo(() => {
    const selectedId = Number(selectedLbMaxProductId || 0);
    if (selectedId <= 0) {
      return '';
    }
    const option = lbMaxFinishingOptions.find((row) => Number(row.id) === selectedId);
    if (!option) {
      return '';
    }
    const widthCm = Math.max(0, Number(option.lb_max_width_cm || 0) || 0);
    return `${String(option.name || 'LB Max').trim()}${widthCm > 0 ? ` (+${widthCm} cm)` : ''}`;
  }, [selectedLbMaxProductId, lbMaxFinishingOptions]);
  useEffect(() => {
    const validIds = new Set(regularFinishingOptions.map((row) => Number(row.id)).filter((id) => id > 0));
    setSelectedFinishingIds((prev) => {
      const filtered = (Array.isArray(prev) ? prev : [])
        .map((id) => Number(id))
        .filter((id) => id > 0 && validIds.has(id));
      if (filtered.length === (Array.isArray(prev) ? prev.length : 0)) {
        return prev;
      }
      return filtered;
    });
  }, [regularFinishingOptions]);
  useEffect(() => {
    const selectedIds = new Set(
      (Array.isArray(selectedFinishingIds) ? selectedFinishingIds : [])
        .map((id) => Number(id))
        .filter((id) => id > 0),
    );
    setSelectedFinishingMataAyamQtyById((prev) => {
      const source = prev && typeof prev === 'object' ? prev : {};
      const next = {};
      Object.keys(source).forEach((key) => {
        const id = Number(key);
        if (id <= 0 || !selectedIds.has(id) || finishingRequiresMataAyamById.get(id) !== true) {
          return;
        }
        const qty = Number(source[key]);
        next[id] = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
      });
      return next;
    });
  }, [selectedFinishingIds, finishingRequiresMataAyamById]);
  useEffect(() => {
    if (!selectedRequiresMataAyam) {
      setMataAyamIssueBadge({ visible: false, message: '' });
    }
  }, [selectedRequiresMataAyam]);
  useEffect(() => {
    const selectedId = Number(selectedLbMaxProductId || 0);
    if (selectedId <= 0) {
      return;
    }
    const exists = lbMaxFinishingOptions.some((row) => Number(row.id) === selectedId);
    if (!exists) {
      setSelectedLbMaxProductId(null);
    }
  }, [selectedLbMaxProductId, lbMaxFinishingOptions]);

  const resolveMaterialInfo = (product, productDetail = null) => {
    const productSourceMeta = toSourceMeta(product);
    const detailSourceMeta = toSourceMeta(productDetail);

    const ids = collectMaterialIds(
      product?.material_product_id,
      product?.material_id,
      product?.material_product?.id,
      product?.material?.id,
      productSourceMeta?.material_product_id,
      ...(Array.isArray(productSourceMeta?.material_product_ids) ? productSourceMeta.material_product_ids : []),
      productDetail?.material_product_id,
      productDetail?.material_id,
      productDetail?.material_product?.id,
      productDetail?.material?.id,
      detailSourceMeta?.material_product_id,
      ...(Array.isArray(detailSourceMeta?.material_product_ids) ? detailSourceMeta.material_product_ids : []),
      ...(Array.isArray(product?.material_product_ids) ? product.material_product_ids : []),
      ...(Array.isArray(productDetail?.material_product_ids) ? productDetail.material_product_ids : []),
      ...(Array.isArray(product?.material_products) ? product.material_products.map((row) => row?.id || row?.material_id) : []),
      ...(Array.isArray(productDetail?.material_products) ? productDetail.material_products.map((row) => row?.id || row?.material_id) : []),
      ...(Array.isArray(product?.materials) ? product.materials.map((row) => row?.id || row?.material_id) : []),
      ...(Array.isArray(productDetail?.materials) ? productDetail.materials.map((row) => row?.id || row?.material_id) : []),
      ...toMaterialIdsFromRows(product?.product_materials),
      ...toMaterialIdsFromRows(productDetail?.product_materials),
      ...toMaterialIdsFromRows(product?.allowed_materials),
      ...toMaterialIdsFromRows(productDetail?.allowed_materials),
      ...toMaterialIdsFromRows(product?.selectable_materials),
      ...toMaterialIdsFromRows(productDetail?.selectable_materials),
    );

    const materialRows = ids
      .map((id) => materials.find((row) => Number(row.id) === Number(id)))
      .filter(Boolean);

    const names = collectMaterialNames(
      ...ids.map((id) => catalogMaterialNameMap[id]),
      ...materialRows.map((row) => row?.name),
      product?.material_name,
      product?.material_product_name,
      productSourceMeta?.material_product_name,
      ...(Array.isArray(productSourceMeta?.material_product_names) ? productSourceMeta.material_product_names : []),
      product?.material?.name,
      product?.material_product?.name,
      productDetail?.material_name,
      productDetail?.material_product_name,
      detailSourceMeta?.material_product_name,
      ...(Array.isArray(detailSourceMeta?.material_product_names) ? detailSourceMeta.material_product_names : []),
      productDetail?.material?.name,
      productDetail?.material_product?.name,
      ...(Array.isArray(product?.material_products) ? product.material_products.map((row) => row?.name || row?.material_name || row?.sku) : []),
      ...(Array.isArray(productDetail?.material_products) ? productDetail.material_products.map((row) => row?.name || row?.material_name || row?.sku) : []),
      ...(Array.isArray(product?.materials) ? product.materials.map((row) => row?.name || row?.material_name || row?.sku) : []),
      ...(Array.isArray(productDetail?.materials) ? productDetail.materials.map((row) => row?.name || row?.material_name || row?.sku) : []),
      ...toMaterialNamesFromRows(product?.product_materials),
      ...toMaterialNamesFromRows(productDetail?.product_materials),
      ...toMaterialNamesFromRows(product?.allowed_materials),
      ...toMaterialNamesFromRows(productDetail?.allowed_materials),
      ...toMaterialNamesFromRows(product?.selectable_materials),
      ...toMaterialNamesFromRows(productDetail?.selectable_materials),
    );

    return {
      materialIds: ids,
      primaryMaterialId: ids[0] || null,
      displayText: names.join(', '),
    };
  };

  const selectedProductMaterialInfo = useMemo(() => {
    if (!selectedProductRow) {
      return { materialIds: [], primaryMaterialId: null, displayText: '' };
    }
    const detail = selectedProductId ? productDetails[Number(selectedProductId)] : null;
    return resolveMaterialInfo(selectedProductRow, detail);
  }, [selectedProductRow, selectedProductId, productDetails, materials, catalogMaterialNameMap]);
  const isMaterialLoading = useMemo(() => {
    const selectedId = Number(selectedProductId || 0);
    return Boolean(selectedId) && !productDetails[selectedId];
  }, [selectedProductId, productDetails]);

  const resolveCustomerId = async () => {
    if (!selectedCustomerId) {
      return null;
    }
    return Number(selectedCustomerId);
  };

  const handleCreateCustomer = async (form) => {
    const selectedType = customerTypes.find((row) => Number(row.id) === Number(form?.customer_type_id)) || null;
    const selectedTypeId = Number(selectedType?.id || 0);
    const selectedTypeName = String(selectedType?.name || '').trim();
    const selectedTypeCode = toCustomerTypeCode(selectedType?.code || selectedTypeName);

    const payload = {
      name: String(form?.name || '').trim(),
      phone: String(form?.phone || '').trim(),
      phone_number: String(form?.phone || '').trim(),
      mobile_phone: String(form?.phone || '').trim(),
      customer_type_id: selectedTypeId > 0 ? selectedTypeId : null,
      type_id: selectedTypeId > 0 ? selectedTypeId : null,
      customer_type: selectedTypeCode || selectedTypeName || null,
      customer_type_name: selectedTypeName || null,
      address: String(form?.address || '').trim(),
      alamat: String(form?.address || '').trim(),
    };

    const created = await createPosCustomer(payload);
    let normalized = normalizeCustomerRow(created);
    if (!normalized.id) {
      const refreshed = (await fetchPosCustomers(payload.name)).map(normalizeCustomerRow);
      const exact = refreshed.find((row) => normalizeText(row.name) === normalizeText(payload.name));
      if (refreshed.length > 0) {
        setCustomers((prev) => {
          const merge = [...prev];
          refreshed.forEach((row) => {
            if (!merge.some((existing) => Number(existing.id) === Number(row.id))) {
              merge.push(row);
            }
          });
          return merge;
        });
      }
      normalized = exact || normalized;
    }

    if (normalized?.id) {
      setCustomers((prev) => {
        if (prev.some((item) => Number(item.id) === Number(normalized.id))) {
          return prev;
        }
        return [normalized, ...prev];
      });
      setSelectedCustomerId(Number(normalized.id));
    }
  };

  const loadDraftInvoices = async () => {
    const queueRows = loadOrderQueue()
      .filter((queued) => isDraftPayload(queued?.payload))
      .map((queued) => {
        const queuedItems = Array.isArray(queued?.payload?.items) ? queued.payload.items : [];
        return {
          id: `queue-${queued.id}`,
          __queue_id: queued.id,
          status: 'queued_offline',
          created_at: queued.created_at,
          notes: queued?.payload?.notes || '',
          customer: null,
          invoice: null,
          items: queuedItems,
          __source: 'queue',
          __queue_payload: queued?.payload || null,
          __queue_total: calculateDraftItemsTotal(queuedItems),
        };
      });

    if (!backendReady) {
      setDraftInvoices(queueRows);
      return;
    }
    try {
      setIsDraftLoading(true);
      const payload = await fetchPosOrderTransactions();
      let rows = toDataRows(payload);
      if (rows.length === 0) {
        const fallback = await fetchPosOrders();
        rows = toDataRows(fallback);
      }
      rows = rows.filter((row) => isDraftInvoiceRow(row) || isProcessingInvoiceRow(row) || isCompletedInvoiceRow(row));
      setDraftInvoices([...queueRows, ...rows]);
    } catch (error) {
      setDraftInvoices(queueRows);
      if (queueRows.length === 0) {
        openNotice('Invoice', `Gagal memuat invoice: ${error.message}`);
      }
    } finally {
      setIsDraftLoading(false);
    }
  };

  useEffect(() => {
    if (activeMenu === 'draft') {
      loadDraftInvoices();
    }
  }, [activeMenu, backendReady]);

  const loadProductionItems = async (override = {}) => {
    if (!backendReady) {
      setProductionRows([]);
      return;
    }

    const status = String(override?.status || productionStatusFilter || 'all');
    const search = String(override?.search || productionSearch || '').trim();
    try {
      setIsProductionLoading(true);
      const payload = await fetchPosProductionItems({
        status,
        search,
      });
      setProductionRows(toDataRows(payload));
    } catch (error) {
      setProductionRows([]);
      openNotice('Produksi', `Gagal memuat data produksi: ${error.message}`);
    } finally {
      setIsProductionLoading(false);
    }
  };

  useEffect(() => {
    if (activeMenu === 'production') {
      loadProductionItems();
    }
  }, [activeMenu, backendReady]);

  useEffect(() => {
    if (activeMenu !== 'production') {
      return;
    }

    const timeout = setTimeout(() => {
      loadProductionItems();
    }, 350);

    return () => clearTimeout(timeout);
  }, [productionSearch, productionStatusFilter, activeMenu]);
  const checkProductionRealtimeUpdates = async () => {
    if (!backendReady || productionPollingRef.current) {
      return;
    }
    productionPollingRef.current = true;
    try {
      const payload = await fetchPosProductionItems({ status: 'all' });
      const rows = toDataRows(payload);
      const nextSnapshot = new Map();
      const changes = [];

      rows.forEach((row) => {
        const rowId = Number(row?.id || 0);
        if (rowId <= 0) {
          return;
        }
        const currentStatus = resolveProductionStatusKey(row?.production_status);
        const currentUpdatedAt = String(
          row?.updated_at
          || row?.updatedAt
          || row?.order_item?.updated_at
          || row?.order?.updated_at
          || '',
        ).trim();
        const previous = productionSnapshotRef.current.get(rowId);
        nextSnapshot.set(rowId, {
          status: currentStatus,
          updatedAt: currentUpdatedAt,
        });

        if (!productionSnapshotReadyRef.current) {
          return;
        }
        if (!previous) {
          changes.push({
            text: `Item produksi baru: ${buildProductionNotifyText(row)}`,
            status: currentStatus,
          });
          return;
        }

        const statusChanged = previous.status !== currentStatus;
        if (statusChanged) {
          changes.push({
            text: buildProductionNotifyText(row, previous.status),
            status: currentStatus,
          });
        }
      });

      productionSnapshotRef.current = nextSnapshot;
      if (!productionSnapshotReadyRef.current) {
        productionSnapshotReadyRef.current = true;
      } else if (changes.length > 0) {
        pushProductionNotifications(changes);
      }

      if (activeMenu === 'production' && productionStatusFilter === 'all' && !productionSearch.trim()) {
        setProductionRows(rows);
      }
    } catch (_error) {
      // no-op: notifikasi realtime tidak mengganggu alur utama
    } finally {
      productionPollingRef.current = false;
    }
  };

  useEffect(() => {
    if (!backendReady) {
      productionSnapshotRef.current = new Map();
      productionSnapshotReadyRef.current = false;
    }
  }, [backendReady]);

  useEffect(() => {
    if (!backendReady) {
      return undefined;
    }
    checkProductionRealtimeUpdates();
    const timer = setInterval(() => {
      checkProductionRealtimeUpdates();
    }, 9000);
    return () => clearInterval(timer);
  }, [backendReady, activeMenu, productionStatusFilter, productionSearch]);

  useEffect(() => {
    if (activeMenu !== 'production') {
      return undefined;
    }
    const timer = setInterval(() => {
      loadProductionItems();
    }, 9000);
    return () => clearInterval(timer);
  }, [activeMenu, productionStatusFilter, productionSearch, backendReady]);
  useEffect(() => {
    return () => {
      toneTimeoutsRef.current.forEach((timer) => clearTimeout(timer));
      toneTimeoutsRef.current = [];
      if (audioElementRef.current && typeof audioElementRef.current.pause === 'function') {
        audioElementRef.current.pause();
      }
      audioElementRef.current = null;
      if (audioContextRef.current && typeof audioContextRef.current.close === 'function') {
        audioContextRef.current.close().catch(() => {});
      }
      audioContextRef.current = null;
    };
  }, []);

  const handleUpdateProductionStatus = async (row, nextStatus) => {
    const itemId = Number(row?.id || 0);
    if (itemId <= 0) {
      return;
    }

    try {
      setUpdatingProductionItemId(itemId);
      await updatePosProductionItemStatus(itemId, nextStatus);
      pushProductionNotifications([
        {
          text: buildProductionNotifyText(
            { ...row, production_status: nextStatus },
            row?.production_status,
          ),
          status: nextStatus,
        },
      ]);
      productionSnapshotRef.current.set(itemId, {
        status: resolveProductionStatusKey(nextStatus),
        updatedAt: '',
      });
      await loadProductionItems();
      openNotice('Produksi', `Status item #${itemId} berhasil diubah ke ${nextStatus}.`, null, {
        showDefaultAction: false,
        autoCloseMs: 1400,
      });
    } catch (error) {
      openNotice('Produksi', `Gagal update status item #${itemId}: ${error.message}`);
    } finally {
      setUpdatingProductionItemId(null);
    }
  };

  const handleContinueDraft = async (row) => {
    if (row?.__source === 'queue') {
      const payload = row?.__queue_payload || {};
      const queueItems = Array.isArray(payload?.items) ? payload.items : [];
      if (queueItems.length === 0) {
        openNotice('Invoice', 'Draft dari antrian tidak memiliki item.');
        return;
      }

      const cartFromQueue = queueItems.map((backendItem, idx) => {
        const restored = restoreDraftItemDisplay(backendItem, materialMapById, finishingNameMapById);
        const subtotal = Number(backendItem?.subtotal || 0);
        const finishingTotal = Number(backendItem?.finishing_total || 0);
        const expressFee = Number(backendItem?.express_fee || 0);
        const lineTotal = roundMoney(subtotal + finishingTotal + expressFee);
        return {
          id: `queue-item-${idx}-${Date.now()}`,
          product: toLabel(
            backendItem?.product_name,
            productNameMapById.get(Number(backendItem?.product_id || 0)),
            `Produk #${Number(backendItem?.product_id || 0)}`,
          ),
          qty: Number(backendItem?.qty || 1) || 1,
          size: restored.sizeText,
          finishing: restored.finishingText,
          lbMax: restored.lbMaxText,
          pages: restored.pages,
          material: restored.materialText,
          lineTotal,
          total: lineTotal,
          backendItem,
        };
      });

      setCartItems(cartFromQueue);
      setCurrentDraftSourceId(null);
      setOrderNumber('');
      setSelectedCustomerId(Number(payload?.customer_id || 0) || null);
      setProductName('');
      setSelectedProductId(null);
      setQty('1');
      setSizeWidthMeter('');
      setSizeLengthMeter('');
      setPreviewMaterialDisplay('');
      setSelectedFinishingIds([]);
      setSelectedFinishingMataAyamQtyById({});
      setMataAyamIssueBadge({ visible: false, message: '' });
      setSelectedLbMaxProductId(null);
      setPages('1');
      setDiscountPercent('0');
      setDiscountAmount('0');
      setDiscountMode('percent');
      setPaymentMethod(normalizePaymentMethodLabel(payload?.payment?.method || 'Cash'));
      setPaymentAmount(String(Math.max(0, Number(payload?.payment?.amount || 0))));
      setPaymentNotes(String(payload?.payment?.note || ''));
      setLastSyncInfo('');
      setActiveMenu('pos');
      return;
    }

    const selectedId = Number(row?.id || 0);
    if (selectedId <= 0) {
      return;
    }

    try {
      const order = await fetchPosOrderDetail(selectedId);
      if (!isDraftCandidate(order)) {
        openNotice('Invoice', 'Order ini bukan kandidat draft yang bisa dilanjutkan.');
        return;
      }
      const rows = Array.isArray(order?.items) ? order.items : [];
      if (rows.length === 0) {
        openNotice('Invoice', 'Order draft tidak memiliki item.');
        return;
      }

      const cartFromDraft = rows.map((item) => {
        const breakdown = Array.isArray(item?.finishing_breakdown) ? item.finishing_breakdown : [];
        const restored = restoreDraftItemDisplay(item, materialMapById, finishingNameMapById);
        const materialId = Number(item?.material_product_id || item?.material_id || 0);
        const materialCandidates = Array.isArray(item?.material_candidate_ids)
          ? item.material_candidate_ids.map((id) => Number(id)).filter((id) => id > 0)
          : Array.isArray(item?.material_product_ids)
            ? item.material_product_ids.map((id) => Number(id)).filter((id) => id > 0)
          : [];
        const subtotal = Number(item?.subtotal || 0);
        const finishingTotal = Number(item?.finishing_total || 0);
        const expressFee = Number(item?.express_fee || 0);
        const lineTotal = roundMoney(subtotal + finishingTotal + expressFee);
        return {
          id: `draft-${selectedId}-${item?.id || Math.random().toString(36).slice(2, 7)}`,
          product: toLabel(
            item?.product_name,
            productNameMapById.get(Number(item?.product_id || 0)),
            '-',
          ),
          qty: Number(item?.qty || 1) || 1,
          size: restored.sizeText,
          finishing: restored.finishingText,
          lbMax: restored.lbMaxText,
          pages: restored.pages,
          material: restored.materialText,
          lineTotal,
          total: lineTotal,
          backendItem: {
            product_id: Number(item?.product_id || 0),
            qty: Number(item?.qty || 1) || 1,
            input_width_mm: Number(item?.input_width_mm || 0) || null,
            input_height_mm: Number(item?.input_height_mm || 0) || null,
            internal_width_mm: Number(item?.internal_width_mm || 0) || null,
            internal_height_mm: Number(item?.internal_height_mm || 0) || null,
            input_area_m2: Number(item?.input_area_m2 || 0) || null,
            internal_area_m2: Number(item?.internal_area_m2 || 0) || null,
            extra_margin_cm: Number(item?.extra_margin_cm || 0) || 0,
            calc_unit: String(item?.calc_unit || 'unit'),
            subtotal: roundMoney(subtotal),
            finishing_total: roundMoney(finishingTotal),
            express_fee: roundMoney(expressFee),
            requires_production: String(item?.production_status || '').toLowerCase() !== 'not_required',
            requires_design: Boolean(item?.requires_design),
            material_product_id: materialId > 0 ? materialId : null,
            material_product_ids: materialCandidates,
            finishing_breakdown: breakdown,
            lb_max: Array.isArray(item?.lb_max) ? item.lb_max : [],
            spec_snapshot: item?.spec_snapshot || null,
          },
        };
      }).filter((row) => Number(row?.backendItem?.product_id || 0) > 0);

      if (cartFromDraft.length === 0) {
        openNotice('Invoice', 'Item draft tidak valid untuk dilanjutkan.');
        return;
      }

      setCartItems(cartFromDraft);
      setCurrentDraftSourceId(selectedId);
      setOrderNumber('');
      setSelectedCustomerId(Number(order?.customer?.id || 0) || null);
      setProductName('');
      setSelectedProductId(null);
      setQty('1');
      setSizeWidthMeter('');
      setSizeLengthMeter('');
      setPreviewMaterialDisplay('');
      setSelectedFinishingIds([]);
      setSelectedFinishingMataAyamQtyById({});
      setMataAyamIssueBadge({ visible: false, message: '' });
      setSelectedLbMaxProductId(null);
      setPages('1');
      setDiscountPercent('0');
      setDiscountAmount('0');
      setDiscountMode('percent');
      setPaymentMethod(normalizePaymentMethodLabel(order?.payment?.method || 'Cash'));
      setPaymentAmount(String(Math.max(0, Number(order?.invoice?.paid_total || 0))));
      setPaymentNotes('');
      setLastSyncInfo(
        `Lanjut Draft #${selectedId}${order?.invoice?.invoice_no ? ` | ${order.invoice.invoice_no}` : ''}`,
      );
      setActiveMenu('pos');
    } catch (error) {
      openNotice('Invoice', `Gagal membuka draft: ${error.message}`);
    }
  };

  const handleDeleteDraft = async (row) => {
    if (!row) {
      return;
    }

    const isQueueRow = row?.__source === 'queue';
    const rowId = String(row?.id || '');

    if (!rowId) {
      return;
    }

    setIsDeletingDraftId(rowId);
    try {
      if (isQueueRow) {
        const queueId = String(row?.__queue_id || rowId.replace(/^queue-/, ''));
        const nextQueue = loadOrderQueue().filter((queued) => String(queued?.id || '') !== queueId);
        setOrderQueue(nextQueue);
        setQueueCount(nextQueue.length);
        setDraftInvoices((prev) => prev.filter((draft) => String(draft?.id || '') !== rowId));
        await loadDraftInvoices();
        openNotice('Invoice', 'Draft dari antrian berhasil dihapus.');
        return;
      }

      const selectedId = Number(row?.id || 0);
      if (selectedId <= 0) {
        throw new Error('ID draft tidak valid.');
      }

      try {
        await deletePosOrder(selectedId);
      } catch (error) {
        const status = Number(error?.status || 0);
        const message = String(error?.message || '');
        const endpointMissing = status === 404 || status === 405 || message.toLowerCase().includes('endpoint tidak ditemukan');
        if (!endpointMissing) {
          throw error;
        }
        await updatePosOrderStatus(selectedId, 'cancelled');
      }

      if (Number(currentDraftSourceId || 0) === selectedId) {
        setCurrentDraftSourceId(null);
      }
      setDraftInvoices((prev) => prev.filter((draft) => Number(draft?.id || 0) !== selectedId));
      await loadDraftInvoices();
      openNotice('Invoice', `Draft #${selectedId} berhasil dihapus.`);
    } catch (error) {
      openNotice('Invoice', `Gagal menghapus draft: ${error.message}`);
    } finally {
      setIsDeletingDraftId(null);
    }
  };

  const confirmDeleteDraft = (row) => {
    if (!row) {
      return;
    }

    const displayId = String(row?.id || '-');
    const runDelete = () => {
      if (isDeletingDraftId) {
        return;
      }
      handleDeleteDraft(row);
    };

    openNoticeActions(
      'Hapus Draft',
      `Draft #${displayId} akan dihapus. Lanjutkan?`,
      [
        { label: 'Batal', role: 'secondary' },
        {
          label: 'Hapus',
          role: 'danger',
          onPress: runDelete,
        },
      ],
    );
  };

  const handleSelectProductVariant = (variantRow) => {
    if (!variantRow || typeof variantRow !== 'object') {
      return;
    }
    const productId = Number(variantRow.id || 0) || null;
    setSelectedProductId(productId);
    setProductName(buildSelectedProductLabel(variantRow));
    setSelectedFinishingIds([]);
    setSelectedFinishingMataAyamQtyById({});
    setMataAyamIssueBadge({ visible: false, message: '' });
    setSelectedLbMaxProductId(null);
    setPreviewMaterialDisplay('');
    if (productId) {
      fetchPosProductDetail(productId)
        .then((detail) => {
          setProductDetails((prev) => ({ ...prev, [productId]: detail }));
        })
        .catch(() => {});
    }
  };

  const resolveProduct = () => {
    return selectedProductRow;
  };

  const handleSaveSelectedFinishings = (ids) => {
    const normalizedIds = Array.from(
      new Set((Array.isArray(ids) ? ids : [])
        .map((id) => Number(id))
        .filter((id) => id > 0)),
    );
    setSelectedFinishingIds(normalizedIds);
    setSelectedFinishingMataAyamQtyById((prev) => {
      const source = prev && typeof prev === 'object' ? prev : {};
      const next = {};
      normalizedIds.forEach((id) => {
        if (finishingRequiresMataAyamById.get(id) !== true) {
          return;
        }
        const qty = Number(source[id]);
        next[id] = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
      });
      return next;
    });
    setMataAyamIssueBadge({ visible: false, message: '' });
  };

  const handleSaveSelectedFinishingMataAyamQtyById = (nextMap) => {
    const incoming = nextMap && typeof nextMap === 'object' ? nextMap : {};
    setSelectedFinishingMataAyamQtyById(() => {
      const next = {};
      Object.keys(incoming).forEach((key) => {
        const id = Number(key);
        if (id <= 0 || finishingRequiresMataAyamById.get(id) !== true) {
          return;
        }
        const qty = Number(incoming[key]);
        next[id] = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
      });
      return next;
    });
    setMataAyamIssueBadge({ visible: false, message: '' });
  };

  const resolveProductDetail = async (productId) => {
    if (productDetails[productId]) {
      return productDetails[productId];
    }
    const detail = await fetchPosProductDetail(productId);
    setProductDetails((prev) => ({ ...prev, [productId]: detail }));
    return detail;
  };

  const buildFinishingsPayload = (productDetail, qtyNumber) => {
    if (!Array.isArray(selectedFinishingIds) || selectedFinishingIds.length === 0) {
      return [];
    }

    const available = regularFinishingOptions;
    const availableIds = new Set(available.map((row) => Number(row.id)).filter((id) => id > 0));
    const selectedIds = Array.from(
      new Set(selectedFinishingIds.map((id) => Number(id)).filter((id) => id > 0)),
    );

    if (selectedIds.some((id) => !availableIds.has(id))) {
      return null;
    }

    const rows = selectedIds.map((id) => {
      const option = available.find((item) => Number(item.id) === Number(id));
      const mataAyamQty = option?.requires_mata_ayam === true
        ? Math.max(0, Math.floor(Number(selectedFinishingMataAyamQtyById?.[id] || 0)))
        : 0;
      if (option?.payload_key === 'product_id' || option?.source === 'catalog') {
        return { product_id: id, qty: qtyNumber, mata_ayam_qty: mataAyamQty };
      }
      return { id, qty: qtyNumber, mata_ayam_qty: mataAyamQty };
    });

    if (isPrintingProductType(selectedProductType)) {
      const groupMap = new Map();
      rows.forEach((row) => {
        const option = available.find((item) => Number(item.id) === Number(row.id || row.product_id));
        const groupKey = String(option?.axis_group || 'all_sides');
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, row);
        }
      });
      return Array.from(groupMap.values());
    }

    return rows;
  };
  const buildLbMaxPayload = () => {
    const selectedId = Number(selectedLbMaxProductId || 0);
    if (selectedId <= 0) {
      return [];
    }
    const option = lbMaxFinishingOptions.find((row) => Number(row.id) === selectedId);
    if (!option) {
      return null;
    }
    return [{ product_id: selectedId, qty: 1 }];
  };

  const computePricingFromBackend = async (product, customerId) => {
    const qtyNumber = Math.max(Number(qty) || 0, 1);
    const size = buildSizeFromMeters(sizeWidthMeter, sizeLengthMeter);
    const productDetail = await resolveProductDetail(Number(product.id));
    const materialInfo = resolveMaterialInfo(product, productDetail);
    const sourceMeta = toSourceMeta(productDetail || product);
    const isStickerSchema = String(sourceMeta?.sales_schema || '').trim().toLowerCase() === 'sticker'
      || Boolean(sourceMeta?.sticker_sales_enabled);
    const finishingsPayload = buildFinishingsPayload(productDetail, qtyNumber);
    const lbMaxPayload = buildLbMaxPayload();

    if (Array.isArray(selectedFinishingIds) && selectedFinishingIds.length > 0 && finishingsPayload === null) {
      throw new Error('Finishing tidak ditemukan pada produk backend yang dipilih.');
    }
    if (selectedLbMaxProductId && lbMaxPayload === null) {
      throw new Error('LB Max tidak ditemukan pada produk backend yang dipilih.');
    }

    const pricingPayload = {
      qty: qtyNumber,
      width_mm: size.widthMm || null,
      height_mm: size.heightMm || null,
      material_product_id: isStickerSchema ? null : (materialInfo.primaryMaterialId || null),
      extra_margin_cm: 0,
      customer_id: customerId || null,
      express: false,
      finishings: finishingsPayload || [],
      lb_max: lbMaxPayload || [],
    };

    const pricing = await previewPosPricing(Number(product.id), pricingPayload);
    if (pricing?.validation_error) {
      throw new Error(pricing.validation_error);
    }
    const resellerMinimumMessage = validateStickerResellerOrderingConfig({
      customer: selectedCustomer,
      customerTypes,
      product,
      productDetail,
      pricing,
      lengthMeter: size.lengthMeter,
    });
    if (resellerMinimumMessage) {
      throw new Error(resellerMinimumMessage);
    }

    const usedMaterialInfo = resolveUsedMaterialInfoFromPricing(
      pricing,
      materialInfo,
      materials,
      catalogMaterialNameMap,
    );

    return { pricing, pricingPayload, productDetail, materialInfo, usedMaterialInfo, size };
  };

  useEffect(() => {
    let cancelled = false;
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;

    if (!backendReady || !selectedProductRow) {
      setItemFinalPrice(0);
      setPreviewMaterialDisplay('');
      return undefined;
    }

    const qtyNumber = Number(qty);
    const widthMeter = parseMeterValue(sizeWidthMeter);
    const lengthMeter = parseMeterValue(sizeLengthMeter);
    if (qtyNumber < 1 || widthMeter <= 0 || lengthMeter <= 0) {
      setItemFinalPrice(0);
      setPreviewMaterialDisplay('');
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const customerId = Number(selectedCustomerId || 0) || null;
        const { pricing, usedMaterialInfo } = await computePricingFromBackend(selectedProductRow, customerId);
        const nextTotal = roundMoney(
          (pricing?.subtotal || 0) + (pricing?.finishing_total || 0) + (pricing?.express_fee || 0),
        );
        if (!cancelled && previewRequestRef.current === requestId) {
          setItemFinalPrice(nextTotal);
          setPreviewMaterialDisplay(String(usedMaterialInfo?.displayText || '').trim());
        }
      } catch (error) {
        if (!cancelled && previewRequestRef.current === requestId) {
          setItemFinalPrice(0);
          setPreviewMaterialDisplay('');
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    backendReady,
    selectedProductRow,
    selectedCustomerId,
    qty,
    sizeWidthMeter,
    sizeLengthMeter,
    selectedFinishingIds,
    selectedFinishingMataAyamQtyById,
    selectedLbMaxProductId,
    selectedFinishingSummary,
    pages,
    selectedProductMaterialInfo,
    selectedProductType,
    effectiveFinishingOptions,
    regularFinishingOptions,
    lbMaxFinishingOptions,
    productDetails,
  ]);

  const resetTransaction = () => {
    setOrderNumber('');
    setCurrentDraftSourceId(null);
    setSelectedCustomerId(null);
    setTransactionDate(formatDate(new Date()));
    setProductName('');
    setSelectedProductId(null);
    setQty('1');
    setSizeWidthMeter('');
    setSizeLengthMeter('');
    setPreviewMaterialDisplay('');
    setSelectedFinishingIds([]);
    setSelectedFinishingMataAyamQtyById({});
    setMataAyamIssueBadge({ visible: false, message: '' });
    setSelectedLbMaxProductId(null);
    setPages('1');
    setCartItems([]);
    setDiscountPercent('0');
    setDiscountAmount('0');
    setDiscountMode('percent');
    setPaymentMethod('Cash');
    setPaymentAmount('');
    setPaymentNotes('');
    setIsBankPickerOpen(false);
    setIsBankAccountLoading(false);
    setSelectedBankAccountId(null);
    setBankPickerAction('save');
    setLastSyncInfo('');
    setQueueCount(loadOrderQueue().length);
    setLastPayloadPreview(null);
  };

  const handleChangePaymentAmount = (value) => {
    setPaymentAmount(sanitizeNumericInput(value));
  };

  const handleValidateProduct = async () => {
    if (!backendReady) {
      openNotice('Backend Belum Siap', 'Tunggu koneksi backend selesai.');
      return;
    }
    if (!selectedCustomerId) {
      openNotice('Validasi', 'Pilih pelanggan untuk melanjut proses');
      return;
    }

    const product = resolveProduct();
    if (!product) {
      openNotice('Produk Tidak Ditemukan', `Produk "${productName}" belum ada di backend POS.`);
      return;
    }

    try {
      const customerId = await resolveCustomerId();
      const { pricing } = await computePricingFromBackend(product, customerId);
      setProductName(buildSelectedProductLabel(product));
      setSelectedProductId(Number(product.id || 0) || null);
      openNotice(
        'Produk Valid',
        `${product.name} valid. Preview backend: ${formatRupiah(pricing.grand_total || 0)}`,
      );
    } catch (error) {
      const targetProduct = String(buildSelectedProductLabel(product) || product?.name || productName || '').trim();
      if (openMataAyamStockNoticeIfNeeded(error, 'MATA AYAM BELUM SIAP', {
        productName: targetProduct,
        badgeMessage: targetProduct
          ? `Produk ${targetProduct}: stok/produk mata ayam bermasalah.`
          : 'Stok/produk mata ayam bermasalah.',
      })) {
        return;
      }
      openNotice('Preview Gagal', error.message);
    }
  };

  const handleAddToCart = async () => {
    if (!backendReady) {
      openNotice('Backend Belum Siap', 'Koneksi API belum siap.');
      return;
    }
    if (!selectedCustomerId) {
      openNotice('Validasi', 'Pilih pelanggan untuk melanjut proses');
      return;
    }

    const product = resolveProduct();
    if (!product) {
      openNotice('Validasi', 'Produk belum cocok dengan data backend.');
      return;
    }

    const qtyNumber = Number(qty);
    if (!qty || qtyNumber < 1) {
      openNotice('Validasi', 'Qty harus diisi dan minimal 1.');
      return;
    }

    const widthMeter = parseMeterValue(sizeWidthMeter);
    const lengthMeter = parseMeterValue(sizeLengthMeter);
    if (widthMeter <= 0 || lengthMeter <= 0) {
      openNotice('Validasi', 'L Mater dan P Mater wajib diisi dan lebih dari 0.');
      return;
    }
    if (selectedRequiresMataAyam && !hasMataAyamCatalogProduct) {
      const targetProduct = String(buildSelectedProductLabel(product) || product?.name || productName || '').trim();
      setMataAyamIssueBadge({
        visible: true,
        message: targetProduct
          ? `Produk ${targetProduct}: produk Mata Ayam belum ada di backend.`
          : 'Produk Mata Ayam belum ada di backend.',
      });
      openNotice(
        'MATA AYAM BELUM SIAP',
        `${targetProduct ? `Produk yang harus diperbaiki: ${targetProduct}.\n` : ''}Produk material Mata Ayam belum ada di backend. Silakan tambahkan produk Mata Ayam terlebih dahulu.`,
      );
      return;
    }

    try {
      const customerId = await resolveCustomerId();
      const { pricing, pricingPayload, productDetail, materialInfo, usedMaterialInfo, size } = await computePricingFromBackend(product, customerId);
      const sourceMeta = toSourceMeta(productDetail || product);
      const itemId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const pageNumber = Math.max(Number(pages) || 1, 1);
      const materialId = Number(usedMaterialInfo?.primaryMaterialId || materialInfo?.primaryMaterialId || 0);
      const materialCandidateIds = Array.isArray(usedMaterialInfo?.materialIds)
        ? usedMaterialInfo.materialIds.map((id) => Number(id)).filter((id) => id > 0)
        : [];
      const materialText = String(usedMaterialInfo?.displayText || '-').trim() || '-';

      const backendItem = {
        product_id: Number(product.id),
        qty: qtyNumber,
        input_width_mm: size.widthMm || null,
        input_height_mm: size.heightMm || null,
        internal_width_mm: Number(pricing?.internal?.width_mm || size.widthMm || 0) || null,
        internal_height_mm: Number(pricing?.internal?.height_mm || size.heightMm || 0) || null,
        input_area_m2: Number(size.areaM2 || 0) || null,
        internal_area_m2: Number(pricing?.internal?.area_m2 || size.areaM2 || 0) || null,
        extra_margin_cm: 0,
        calc_unit: String(pricing.unit || product.calc_type || 'unit'),
        subtotal: roundMoney(pricing.subtotal || 0),
        finishing_total: roundMoney(pricing.finishing_total || 0),
        express_fee: 0,
        requires_production: Boolean(product.requires_production ?? true),
        requires_design: Boolean(product.requires_production ?? true),
        material_product_id: materialId || null,
        material_product_ids: materialCandidateIds,
        lb_max: buildLbMaxPayload() || [],
        finishing_breakdown: Array.isArray(pricing.finishing_breakdown) ? pricing.finishing_breakdown : [],
        spec_snapshot: {
          type: 'custom_order',
          sales_schema: String(sourceMeta?.sales_schema || '').trim().toLowerCase() || null,
          sticker_rule: pricing?.rule && typeof pricing.rule === 'object'
            ? {
              customer_category: String(pricing.rule?.customer_category || '').trim().toLowerCase() || null,
              billing_group: String(pricing.rule?.billing_group || '').trim().toUpperCase() || null,
              billing_min_length_m: Number(pricing.rule?.billing_min_length_m || 0) || null,
            }
            : null,
          specs: {
            size_text: size.displayText,
            width_meter: size.widthMeter,
            length_meter: size.lengthMeter,
            pages: pageNumber,
            finishing: selectedFinishingDisplay || '-',
            lb_max: selectedLbMaxSummary || '-',
            material: materialText,
          },
          draft_form: {
            product_name: product.name,
            qty: qtyNumber,
            size_text: size.displayText,
            width_meter: size.widthMeter,
            length_meter: size.lengthMeter,
            finishing: selectedFinishingDisplay || '-',
            lb_max: selectedLbMaxSummary || '-',
            finishings_json: JSON.stringify(Array.isArray(pricingPayload?.finishings) ? pricingPayload.finishings : []),
            lb_max_json: JSON.stringify(Array.isArray(pricingPayload?.lb_max) ? pricingPayload.lb_max : []),
            pages: pageNumber,
            material: materialText,
          },
        },
      };
      const normalizedBackendItem = enforceDesignFirstFlow(backendItem);

      const lineTotal = roundMoney(
        (backendItem.subtotal || 0) + (backendItem.finishing_total || 0) + (backendItem.express_fee || 0),
      );

      setCartItems((prevItems) => [
        ...prevItems,
        {
          id: itemId,
          product: String(product.name || ''),
          qty: qtyNumber,
          size: size.displayText,
          finishing: selectedFinishingDisplay || '-',
          lbMax: selectedLbMaxSummary || '-',
          pages: pageNumber,
          material: materialText,
          lineTotal,
          total: lineTotal,
          backendItem: normalizedBackendItem,
        },
      ]);

      setQty('1');
      setSizeWidthMeter('');
      setSizeLengthMeter('');
      setPages('1');
      setMataAyamIssueBadge({ visible: false, message: '' });
      openNotice('Simpan Item', 'Item berhasil ditambahkan ke keranjang.', null, {
        showDefaultAction: false,
        autoCloseMs: 1400,
      });
    } catch (error) {
      const targetProduct = String(buildSelectedProductLabel(product) || product?.name || productName || '').trim();
      if (openMataAyamStockNoticeIfNeeded(error, 'MATA AYAM BELUM SIAP', {
        productName: targetProduct,
        badgeMessage: targetProduct
          ? `Produk ${targetProduct}: stok/produk mata ayam bermasalah.`
          : 'Stok/produk mata ayam bermasalah.',
      })) {
        return;
      }
      openNotice('Tambah Item Gagal', error.message);
    }
  };

  const handleDeleteItem = (itemOrId, itemIndex) => {
    setCartItems((prevItems) => {
      const resolvedId = typeof itemOrId === 'object' && itemOrId !== null ? itemOrId.id : itemOrId;
      const hasId = resolvedId !== undefined && resolvedId !== null && String(resolvedId) !== '';

      if (hasId) {
        return prevItems.filter((item) => String(item?.id ?? '') !== String(resolvedId));
      }

      if (Number.isInteger(itemIndex) && itemIndex >= 0 && itemIndex < prevItems.length) {
        return prevItems.filter((_, index) => index !== itemIndex);
      }

      return prevItems;
    });
  };

  const handleCancelItem = () => {
    setProductName('');
    setSelectedProductId(null);
    setQty('1');
    setSizeWidthMeter('');
    setSizeLengthMeter('');
    setSelectedFinishingIds([]);
    setSelectedFinishingMataAyamQtyById({});
    setMataAyamIssueBadge({ visible: false, message: '' });
    setSelectedLbMaxProductId(null);
    setPages('1');
  };

  const handleClearCart = () => {
    if (cartItems.length === 0) {
      return;
    }

    Alert.alert('Konfirmasi', 'Hapus semua item di keranjang?', [
      { text: 'Tidak', style: 'cancel' },
      { text: 'Ya', style: 'destructive', onPress: () => setCartItems([]) },
    ]);
  };

  const submitTransaction = async (mode = 'draft', options = {}) => {
    if (isSubmitting) {
      openNotice('Informasi', 'Transaksi sedang diproses, mohon tunggu.');
      return null;
    }

    if (!backendReady) {
      openNotice('Backend Belum Siap', 'Koneksi backend belum siap.');
      return null;
    }

    if (cartItems.length === 0) {
      openNotice('Validasi', 'Keranjang masih kosong.');
      return null;
    }

    if (!selectedCustomerId) {
      openNotice('Validasi', 'Pilih pelanggan terlebih dahulu sebelum menyimpan pesanan.');
      return null;
    }

    const currentCustomerType = resolveCustomerCategoryCode(selectedCustomer, customerTypes);
    if (currentCustomerType === 'reseller') {
      const violation = cartItems.find((item) => {
        const backendItem = item?.backendItem || {};
        const snapshot = parseJsonObject(backendItem?.spec_snapshot) || {};
        const productId = Number(backendItem?.product_id || 0);
        const productRow = products.find((row) => Number(row?.id || 0) === productId) || null;
        const sourceMeta = toSourceMeta(productRow);
        const schema = String(snapshot?.sales_schema || sourceMeta?.sales_schema || '').trim().toLowerCase();
        const stickerEnabled = schema === 'sticker' || Boolean(sourceMeta?.sticker_sales_enabled);
        if (!stickerEnabled) {
          return false;
        }
        const lengthMm = Number(backendItem?.input_height_mm || backendItem?.height_mm || backendItem?.internal_height_mm || 0);
        const lengthM = lengthMm > 0 ? (lengthMm / 1000) : 0;
        const stickerRule = snapshot?.sticker_rule && typeof snapshot.sticker_rule === 'object' ? snapshot.sticker_rule : {};
        const minLengthM = Number(stickerRule?.billing_min_length_m || resolveStickerResellerMinimumLength(sourceMeta, null) || 0);
        if (!(minLengthM > 0)) {
          return false;
        }
        return lengthM > 0 && lengthM < minLengthM;
      });
      if (violation) {
        const backendItem = violation?.backendItem || {};
        const snapshot = parseJsonObject(backendItem?.spec_snapshot) || {};
        const productName = String(violation?.product || snapshot?.draft_form?.product_name || 'Produk sticker');
        const lengthMm = Number(backendItem?.input_height_mm || backendItem?.height_mm || backendItem?.internal_height_mm || 0);
        const lengthM = lengthMm > 0 ? (lengthMm / 1000) : 0;
        const minLengthM = Number(snapshot?.sticker_rule?.billing_min_length_m || 1);
        openNotice('Aturan Pemesanan', buildStickerResellerMinimumMessage(productName, lengthM, minLengthM));
        return null;
      }
    }

    const canonicalMethodLabel = normalizePaymentMethodLabel(paymentMethod);
    if (!PAYMENT_METHOD_LABELS.includes(canonicalMethodLabel)) {
      openNotice('Validasi', `Metode Bayar wajib salah satu: ${PAYMENT_METHOD_LABELS.join(', ')}.`);
      return null;
    }
    const isDraftMode = mode === 'draft';
    const method = mapPaymentMethodToBackend(canonicalMethodLabel);
    const selectedBankId = Number(options?.bankAccountId || 0);
    const fallbackBankId = mapPaymentMethodToBankAccountId(canonicalMethodLabel);
    const bankAccountId = selectedBankId > 0 ? selectedBankId : fallbackBankId;

    let payload = null;

    try {
      setIsSubmitting(true);

      const customerId = await resolveCustomerId();
      const totalLine = cartItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
      const discountToApply = Math.min(Math.max(finalDiscount, 0), totalLine);

      const adjustedItems = cartItems.map((item, _index, arr) => {
        const line = item.lineTotal || 0;
        const share =
          arr.length === 1
            ? discountToApply
            : Math.round(((discountToApply * line) / (totalLine || 1)) * 100) / 100;
        const adjustedLine = Math.max(0, line - share);
        const originalFinishing = Number(item.backendItem.finishing_total || 0);
        const originalExpress = Number(item.backendItem.express_fee || 0);
        const adjustedSubtotal = Math.max(0, roundMoney(adjustedLine - originalFinishing - originalExpress));
        const currentSpec = parseJsonObject(item?.backendItem?.spec_snapshot) || {};
        const currentDraftForm = parseJsonObject(currentSpec?.draft_form) || {};
        const currentSpecs = parseJsonObject(currentSpec?.specs) || {};
        const widthMeter = firstPositiveNumber(
          currentDraftForm?.width_meter,
          currentSpecs?.width_meter,
          toPositiveNumber(item?.backendItem?.input_width_mm) / 1000,
          toPositiveNumber(item?.backendItem?.width_mm) / 1000,
          toPositiveNumber(item?.backendItem?.internal_width_mm) / 1000,
        );
        const lengthMeter = firstPositiveNumber(
          currentDraftForm?.length_meter,
          currentSpecs?.length_meter,
          toPositiveNumber(item?.backendItem?.input_height_mm) / 1000,
          toPositiveNumber(item?.backendItem?.height_mm) / 1000,
          toPositiveNumber(item?.backendItem?.internal_height_mm) / 1000,
        );
        const mergedSnapshot = {
          ...currentSpec,
          type: currentSpec?.type || 'custom_order',
          specs: {
            ...currentSpecs,
            size_text: toLabel(currentSpecs?.size_text, item?.size, '-'),
            width_meter: firstPositiveNumber(currentSpecs?.width_meter, widthMeter),
            length_meter: firstPositiveNumber(currentSpecs?.length_meter, lengthMeter),
            pages: Math.max(Number(currentSpecs?.pages || item?.pages || 1) || 1, 1),
            finishing: toLabel(currentSpecs?.finishing, item?.finishing, '-'),
            lb_max: toLabel(currentSpecs?.lb_max, item?.lbMax, '-'),
            material: toLabel(currentSpecs?.material, item?.material, '-'),
          },
          draft_form: {
            ...currentDraftForm,
            product_name: toLabel(currentDraftForm?.product_name, item?.product, ''),
            qty: Math.max(Number(currentDraftForm?.qty || item?.qty || item?.backendItem?.qty || 1) || 1, 1),
            size_text: toLabel(currentDraftForm?.size_text, item?.size, '-'),
            width_meter: firstPositiveNumber(currentDraftForm?.width_meter, widthMeter),
            length_meter: firstPositiveNumber(currentDraftForm?.length_meter, lengthMeter),
            finishing: toLabel(currentDraftForm?.finishing, item?.finishing, '-'),
            lb_max: toLabel(currentDraftForm?.lb_max, item?.lbMax, '-'),
            pages: Math.max(Number(currentDraftForm?.pages || item?.pages || 1) || 1, 1),
            material: toLabel(currentDraftForm?.material, item?.material, '-'),
          },
        };

        return enforceDesignFirstFlow({
          ...item.backendItem,
          subtotal: adjustedSubtotal,
          finishing_total: originalFinishing,
          express_fee: originalExpress,
          spec_snapshot: mergedSnapshot,
        });
      });

      const paymentTransactionType = isDraftMode ? 'unpaid' : transactionType;
      const paymentAmountPayload = isDraftMode
        ? 0
        : transactionType === 'full'
          ? grandTotal
          : transactionType === 'dp'
            ? Math.min(paidAmount, grandTotal)
            : 0;
      if (!isDraftMode && paymentAmountPayload > 0 && !(bankAccountId > 0)) {
        openNotice('Bank Penampung', 'Akun bank penampung wajib dipilih sebelum proses order.');
        return null;
      }

      payload = {
        customer_id: customerId,
        ...(mode === 'draft' ? { status: 'draft' } : {}),
        due_at: null,
        notes: [
          selectedCustomer?.name ? `Customer: ${selectedCustomer.name}` : '',
          `Tanggal Order: ${transactionDate}`,
          mode === 'draft' ? 'Mode: Simpan Draft' : 'Mode: Proses Orderan',
          currentDraftSourceId ? `Lanjutan Draft ID: ${currentDraftSourceId}` : '',
          discountToApply > 0 ? `Diskon Order: ${discountToApply}` : '',
          paymentNotes ? `Catatan: ${paymentNotes}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        items: adjustedItems,
        payment: {
          transaction_type: paymentTransactionType,
          method,
          ...(!isDraftMode ? { bank_account_id: bankAccountId || null } : {}),
          amount: roundMoney(paymentAmountPayload),
          note: paymentNotes || null,
          paid_at: new Date().toISOString(),
        },
      };
      setLastPayloadPreview(payload);

      const created = await createPosOrder(payload);
      const backendOrderId = Number(created?.id || 0) || null;
      const invoiceNo = created?.invoice?.invoice_no || '-';
      setOrderNumber(String(invoiceNo || '').trim());
      saveReprintSpecSnapshot({
        orderId: backendOrderId || 0,
        invoiceNo,
        items: buildReprintSnapshotItems(adjustedItems),
      });
      let draftStatusWarning = '';
      if (mode === 'draft' && backendOrderId) {
        try {
          await updatePosOrderStatus(backendOrderId, 'draft');
          const updated = await fetchPosOrderDetail(backendOrderId);
          if (String(updated?.status || '').toLowerCase() !== 'draft') {
            throw new Error('Status order belum berubah menjadi draft.');
          }
          await loadDraftInvoices();
        } catch (statusError) {
          draftStatusWarning = `\nCatatan: status draft belum terkonfirmasi otomatis (${statusError.message}).`;
        }
      }

      setLastSyncInfo(`Order #${backendOrderId} | Invoice ${invoiceNo}`);
      setAuditLogs(
        appendOrderAuditLog({
          result: 'success',
          order_id: backendOrderId,
          invoice_no: invoiceNo,
          total: grandTotal,
          queue_count: loadOrderQueue().length,
            payload_summary: {
              items: payload.items.length,
              payment_type: payload.payment.transaction_type,
              payment_method: payload.payment.method,
              bank_account_id: payload.payment.bank_account_id || null,
          },
        }),
      );

      openNotice(
        mode === 'draft' ? 'Draft Berhasil Tersimpan' : 'Order Berhasil Diproses',
        `Order backend ID: ${backendOrderId}\nInvoice: ${invoiceNo}\nTotal: ${formatRupiah(grandTotal)}${draftStatusWarning}`,
        resetTransaction,
      );
      loadDraftInvoices();
      return { ok: true, backendOrderId, invoiceNo };
    } catch (error) {
      const status = Number(error?.status || 0);
      const shouldQueue = status === 0 || status >= 500 || /network|fetch|timeout|Failed to fetch/i.test(String(error?.message || ''));

      if (shouldQueue) {
        if (mode === 'process') {
          setAuditLogs(
            appendOrderAuditLog({
              result: 'failed_process_backend_unreachable',
              total: grandTotal,
              queue_count: loadOrderQueue().length,
              error: String(error?.message || 'Gagal mengirim order ke backend'),
            }),
          );
          openNotice(
            'Proses Order Gagal',
            'Order belum terkirim ke server, jadi belum masuk produksi. Cek koneksi/backend lalu klik Proses Orderan lagi.',
          );
          return null;
        }

        const queuedPayload = payload || {
          customer_id: null,
          ...(mode === 'draft' ? { status: 'draft' } : {}),
          due_at: null,
          notes: paymentNotes || null,
          items: cartItems.map((item) => enforceDesignFirstFlow(item.backendItem)),
          payment: {
            transaction_type: isDraftMode ? 'unpaid' : transactionType,
            method,
            ...(!isDraftMode ? { bank_account_id: bankAccountId || null } : {}),
            amount: roundMoney(
              isDraftMode
                ? 0
                : transactionType === 'full'
                  ? grandTotal
                  : paidAmount,
            ),
            note: paymentNotes || null,
            paid_at: new Date().toISOString(),
          },
        };
        enqueueOrderPayload(queuedPayload);
        const count = loadOrderQueue().length;
        setQueueCount(count);
        setLastPayloadPreview(queuedPayload);
        setAuditLogs(
          appendOrderAuditLog({
            result: 'queued_offline',
            total: grandTotal,
            queue_count: count,
            payload_summary: {
              items: queuedPayload.items.length,
              payment_type: queuedPayload.payment.transaction_type,
              payment_method: queuedPayload.payment.method,
              bank_account_id: queuedPayload.payment.bank_account_id || null,
            },
          }),
        );
        openNotice(
          mode === 'draft' ? 'Draft Masuk Antrian Offline' : 'Order Masuk Antrian Offline',
          `Data belum terkirim ke server, disimpan sementara. Nanti dikirim otomatis. (${count} data antrian)`,
        );
        return { ok: true, queuedOffline: true, backendOrderId: null, invoiceNo: '-' };
      }

      setAuditLogs(
        appendOrderAuditLog({
          result: 'failed_validation',
          total: grandTotal,
          queue_count: loadOrderQueue().length,
          error: formatBackendValidationError(error),
        }),
      );
      const failedIndex = extractOrderItemIndexFromError(error);
      const failedItemName = failedIndex >= 0
        ? String(cartItems?.[failedIndex]?.product || '').trim()
        : '';
      if (openMataAyamStockNoticeIfNeeded(error, 'SETOK HABIS', {
        productName: failedItemName,
        badgeMessage: failedItemName
          ? `Item ${failedItemName}: stok/produk mata ayam bermasalah.`
          : 'Stok/produk mata ayam bermasalah.',
      })) {
        return null;
      }
      const validationMessage = String(formatBackendValidationError(error) || '').trim();
      const lowerValidationMessage = validationMessage.toLowerCase();
      const isBankAccountValidation = lowerValidationMessage.includes('bank_account_id')
        || lowerValidationMessage.includes('bank penampungan')
        || lowerValidationMessage.includes('akun bank penampungan')
        || lowerValidationMessage.includes('akun bank');
      if (isBankAccountValidation) {
        openNotice('Bank Penampung', validationMessage || 'Akun bank penampung penjualan wajib dipilih.');
        return null;
      }
      const clearMessage = failedItemName
        ? `Produk yang harus diperbaiki: ${failedItemName}.\nDetail: ${validationMessage || 'Validasi stok gagal.'}`
        : (validationMessage || 'Validasi stok gagal.');
      openNotice('Validasi', clearMessage);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const openBankPickerForProcess = async (action = 'save') => {
    setBankPickerAction(action === 'print' ? 'print' : 'save');
    setIsBankPickerOpen(true);
    setIsBankAccountLoading(true);
    try {
      const rows = await fetchPosBankAccounts();
      const options = toDataRows(rows)
        .map((row) => normalizeBankAccountRow(row))
        .filter((row) => Number(row?.id || 0) > 0);
      setBankAccounts(options);
      if (options.length === 0) {
        setIsBankPickerOpen(false);
        openNotice('Bank Penampung', 'Data akun bank penampung belum tersedia di backend.');
        return;
      }
      const currentId = Number(selectedBankAccountId || 0);
      const exists = options.some((row) => Number(row.id) === currentId);
      setSelectedBankAccountId(exists ? currentId : Number(options[0].id));
    } catch (error) {
      setIsBankPickerOpen(false);
      openNotice('Bank Penampung', `Gagal memuat daftar akun bank: ${error.message}`);
    } finally {
      setIsBankAccountLoading(false);
    }
  };

  const handleSaveTransaction = async () => {
    await submitTransaction('draft');
  };

  const handleCloseBankPicker = () => {
    if (isSubmitting || isOrderPreviewSubmitting) {
      return;
    }
    setIsBankPickerOpen(false);
  };

  const handleConfirmSaveWithBankAccount = async () => {
    const bankId = Number(
      selectedBankAccountId
      || bankAccounts?.[0]?.id
      || 0,
    );
    if (bankId <= 0) {
      openNotice('Validasi', 'Pilih akun bank penampung terlebih dahulu.');
      return;
    }
    const shouldPrint = bankPickerAction === 'print';
    const snapshot = shouldPrint ? buildOrderPreviewSnapshot() : null;
    setIsBankPickerOpen(false);
    try {
      setIsOrderPreviewSubmitting(true);
      const result = await submitTransaction('process', { bankAccountId: bankId });
      if (result?.ok) {
        setSelectedBankAccountId(bankId);
        setIsOrderPreviewOpen(false);
        if (shouldPrint && snapshot) {
          printOrderPreview(snapshot, result);
        }
        if (!result?.queuedOffline) {
          setActiveMenu('production');
          loadProductionItems();
        }
      }
    } finally {
      setIsOrderPreviewSubmitting(false);
    }
  };

  const handleProcessOrder = async () => {
    if (isSubmitting || isOrderPreviewSubmitting) {
      openNotice('Informasi', 'Transaksi sedang diproses, mohon tunggu.');
      return;
    }
    if (!backendReady) {
      openNotice('Backend Belum Siap', 'Koneksi backend belum siap.');
      return;
    }
    if (cartItems.length === 0) {
      openNotice('Validasi', 'Keranjang masih kosong.');
      return;
    }
    if (!selectedCustomerId) {
      openNotice('Validasi', 'Pilih pelanggan terlebih dahulu sebelum memproses pesanan.');
      return;
    }
    setIsOrderPreviewOpen(true);
  };

  const handleOpenBankPickerFromPreview = async (action = 'save') => {
    if (isSubmitting || isOrderPreviewSubmitting) {
      openNotice('Informasi', 'Transaksi sedang diproses, mohon tunggu.');
      return;
    }
    await openBankPickerForProcess(action);
  };

  const handleCancelTransaction = () => {
    if (
      !selectedCustomerId &&
      cartItems.length === 0 &&
      !paymentAmount &&
      !paymentNotes &&
      Number(discountPercent || '0') === 0
    ) {
      resetTransaction();
      return;
    }

    openNoticeActions(
      'Batalkan Transaksi',
      'Semua input transaksi saat ini akan dihapus. Lanjutkan?',
      [
        { label: 'Tidak', role: 'secondary' },
        { label: 'Ya', role: 'danger', onPress: resetTransaction },
      ],
    );
  };

  const handleNotificationPress = () => {
    setIsProfileMenuOpen(false);
    setUnreadProductionCount(0);
    if (productionNotifications.length === 0) {
      openNotice('Notifikasi', 'Belum ada notifikasi produksi terbaru.');
      return;
    }
    const lines = productionNotifications
      .slice(0, 8)
      .map((entry, idx) => `${idx + 1}. ${entry.text}`);
    openNotice('Notifikasi Produksi', lines.join('\n'));
  };
  const handleToggleProfileMenu = () => {
    setIsProfileMenuOpen((prev) => !prev);
  };
  const handleLogoutFromProfileMenu = () => {
    setIsProfileMenuOpen(false);
    onLogout?.();
  };
  const filteredInvoices = useMemo(() => {
    const rows = Array.isArray(draftInvoices) ? draftInvoices : [];
    const keyword = normalizeText(invoiceSearch);
    const searchedRows = keyword
      ? rows.filter((row) => {
        const customerName = normalizeText(row?.customer?.name || '');
        const invoiceNo = normalizeText(row?.invoice?.invoice_no || '');
        const orderId = normalizeText(row?.id || '');
        return customerName.includes(keyword) || invoiceNo.includes(keyword) || orderId.includes(keyword);
      })
      : rows;
    if (invoiceFilter === 'draft') {
      return searchedRows.filter((row) => isDraftInvoiceRow(row));
    }
    if (invoiceFilter === 'processing') {
      return searchedRows.filter((row) => isProcessingInvoiceRow(row));
    }
    return searchedRows;
  }, [draftInvoices, invoiceFilter, invoiceSearch]);
  const closeInvoiceDetailModal = () => {
    setInvoiceDetailModal({
      visible: false,
      row: null,
      orderId: '-',
      invoiceNo: '-',
      customerName: 'Pelanggan umum',
      orderStatus: '-',
      productionSummary: '-',
      itemCount: 0,
      total: 0,
      createdAt: '-',
      pickedUpText: 'Belum diambil',
      items: [],
      canPickup: false,
    });
  };
  const handleViewInvoiceDetail = async (row) => {
    let sourceRow = row;
    const selectedOrderId = Number(row?.id || 0);
    if (selectedOrderId > 0) {
      try {
        const detailPayload = await fetchPosOrderDetail(selectedOrderId);
        const detailData = detailPayload?.data && typeof detailPayload.data === 'object' ? detailPayload.data : null;
        const nestedOrder = detailData?.order && typeof detailData.order === 'object' ? detailData.order : null;
        const detailRow = Array.isArray(detailPayload)
          ? detailPayload[0]
          : (detailData && !Array.isArray(detailData) ? detailData : detailPayload);
        const detailItems = Array.isArray(detailRow?.items)
          ? detailRow.items
          : Array.isArray(detailRow?.order_items)
            ? detailRow.order_items
            : Array.isArray(detailData?.items)
              ? detailData.items
              : Array.isArray(detailData?.order_items)
                ? detailData.order_items
                : Array.isArray(nestedOrder?.items)
                  ? nestedOrder.items
                  : Array.isArray(nestedOrder?.order_items)
                    ? nestedOrder.order_items
                    : [];
        if (detailRow && typeof detailRow === 'object') {
          sourceRow = {
            ...row,
            ...(nestedOrder || {}),
            ...detailRow,
            customer: detailRow?.customer || nestedOrder?.customer || row?.customer,
            invoice: detailRow?.invoice || nestedOrder?.invoice || row?.invoice,
            pickup: detailRow?.pickup || nestedOrder?.pickup || row?.pickup,
            production: detailRow?.production || nestedOrder?.production || row?.production,
            items: detailItems.length > 0 ? detailItems : (Array.isArray(row?.items) ? row.items : []),
          };
        }
      } catch (_error) {
        // fallback ke row list invoice
      }
    }

    const orderId = String(sourceRow?.id || '-');
    const invoiceNo = String(sourceRow?.invoice?.invoice_no || '-');
    const customerName = String(sourceRow?.customer?.name || 'Pelanggan umum');
    const orderStatus = normalizeInvoiceOrderStatus(sourceRow) || '';
    const orderStatusLabel = formatDraftStatusLabel(orderStatus);
    const pickup = sourceRow?.pickup && typeof sourceRow.pickup === 'object' ? sourceRow.pickup : {};
    const pickedUpBy = String(pickup?.receiver_name || '').trim();
    const pickedUpAt = String(pickup?.confirmed_at || '').trim();
    const isPickedUp = orderStatus === 'picked_up' || Boolean(pickedUpAt);
    const canPickup = Boolean(sourceRow?.production?.can_pickup) && !isPickedUp;
    const productionSummary = summarizeProductionStatusForInvoice(sourceRow);
    const items = Array.isArray(sourceRow?.items) ? sourceRow.items : [];
    const itemCount = items.length;
    const total = Number(
      sourceRow?.invoice?.total
      || sourceRow?.total
      || sourceRow?.grand_total
      || sourceRow?.__queue_total
      || calculateDraftItemsTotal(items)
      || 0,
    );
    let detailItems = items.map((item, index) => {
      const restored = restoreDraftItemDisplay(item, materialMapById, finishingNameMapById);
      const snapshot = parseJsonObject(item?.spec_snapshot) || {};
      const specs = parseJsonObject(snapshot?.specs) || {};
      const draftForm = parseJsonObject(snapshot?.draft_form) || {};
      const lineSubtotal = Number(item?.line_total || item?.subtotal || item?.total || 0);
      const finishingTotal = Number(item?.finishing_total || 0);
      const expressFee = Number(item?.express_fee || 0);
      const lineTotal = roundMoney(lineSubtotal + finishingTotal + expressFee);
      const productName = toLabel(
        item?.product_name,
        item?.product?.name,
        productNameMapById.get(Number(item?.product_id || item?.pos_product_id || 0)),
        item?.name,
        `Item #${index + 1}`,
      );
      const pages = Math.max(Number(restored.pages || item?.pages || 1) || 1, 1);
      const showPages = isNotebookLikeProductName(productName) || pages > 1;
      return {
        key: String(item?.id || `item-${index}`),
        productName,
        qty: Math.max(Number(item?.qty || item?.quantity || 1) || 1, 1),
        sizeText: restored.sizeText || '-',
        finishingText: restored.finishingText || '-',
        lbMaxText: restored.lbMaxText || '-',
        materialText: restored.materialText || '-',
        pages,
        showPages,
        productionStatus: String(item?.production_status || ''),
        productionStatusLabel: formatProductionStatusLabel(item?.production_status),
        lineTotal,
        note: toLabel(
          item?.notes,
          item?.note,
          draftForm?.notes,
          draftForm?.note,
          specs?.notes,
          specs?.note,
          snapshot?.notes,
          snapshot?.note,
          '-',
        ),
      };
    });
    const isDashValue = (value) => {
      const text = String(value || '').trim();
      return !text || text === '-';
    };
    const cachedSnapshot = findReprintSpecSnapshot({
      orderId: Number(sourceRow?.id || row?.id || 0),
      invoiceNo: String(sourceRow?.invoice?.invoice_no || row?.invoice?.invoice_no || ''),
    });
    const cachedItems = Array.isArray(cachedSnapshot?.items) ? cachedSnapshot.items : [];
    if (cachedItems.length > 0) {
      detailItems = detailItems.map((item, index) => {
        const byIndex = cachedItems[index];
        const byMatch = cachedItems.find((candidate) => (
          normalizeText(candidate?.productName) === normalizeText(item.productName)
          && Number(candidate?.qty || 0) === Number(item.qty || 0)
        ));
        const fallback = byIndex || byMatch || null;
        if (!fallback) return item;
        const fallbackPages = Math.max(Number(fallback.pages || 1) || 1, 1);
        return {
          ...item,
          sizeText: isDashValue(item.sizeText) ? String(fallback.sizeText || '-').trim() || '-' : item.sizeText,
          finishingText: isDashValue(item.finishingText) ? String(fallback.finishingText || '-').trim() || '-' : item.finishingText,
          materialText: isDashValue(item.materialText) ? String(fallback.materialText || '-').trim() || '-' : item.materialText,
          pages: Number(item.pages || 0) > 0 ? item.pages : fallbackPages,
          showPages: item.showPages || isNotebookLikeProductName(item.productName) || fallbackPages > 1,
        };
      });
    }
    const pickedUpText = isPickedUp
      ? `Sudah diambil oleh ${pickedUpBy || '-'}${pickedUpAt ? ` (${pickedUpAt})` : ''}`
      : 'Belum diambil';
    setInvoiceDetailModal({
      visible: true,
      row: sourceRow,
      orderId,
      invoiceNo,
      customerName,
      orderStatus: orderStatusLabel,
      productionSummary,
      itemCount,
      total,
      createdAt: String(sourceRow?.created_at || '-'),
      pickedUpText,
      items: detailItems,
      canPickup,
    });
  };
  const openPickupModal = (row) => {
    const orderId = Number(row?.id || 0);
    if (orderId <= 0) {
      openNotice('Pengambilan', 'Order ID tidak valid.');
      return;
    }
    const pickup = row?.pickup && typeof row.pickup === 'object' ? row.pickup : {};
    setPickupModal({
      visible: true,
      orderId,
      invoiceNo: String(row?.invoice?.invoice_no || '-'),
      customerName: String(row?.customer?.name || 'Pelanggan umum'),
      receiverName: String(pickup?.receiver_name || row?.customer?.name || '').trim(),
      receiverPhone: String(pickup?.receiver_phone || row?.customer?.phone || '').trim(),
      note: String(pickup?.note || '').trim(),
      isSubmitting: false,
    });
  };
  const closePickupModal = () => {
    if (pickupModal.isSubmitting) {
      return;
    }
    setPickupModal((prev) => ({ ...prev, visible: false }));
  };
  const handleSubmitPickup = async () => {
    const orderId = Number(pickupModal.orderId || 0);
    const receiverName = String(pickupModal.receiverName || '').trim();
    if (orderId <= 0) {
      openNotice('Pengambilan', 'Order ID tidak valid.');
      return;
    }
    if (!receiverName) {
      openNotice('Pengambilan', 'Nama pengambil wajib diisi.');
      return;
    }
    try {
      setPickupModal((prev) => ({ ...prev, isSubmitting: true }));
      await pickupPosOrder(orderId, {
        receiver_name: receiverName,
        receiver_phone: String(pickupModal.receiverPhone || '').trim() || null,
        pickup_note: String(pickupModal.note || '').trim() || null,
      });
      setPickupModal((prev) => ({ ...prev, visible: false, isSubmitting: false }));
      await loadDraftInvoices();
      openNotice(
        'Pengambilan Berhasil',
        `Invoice ${pickupModal.invoiceNo || '-'} sudah ditandai diambil oleh ${receiverName}.`,
      );
    } catch (error) {
      setPickupModal((prev) => ({ ...prev, isSubmitting: false }));
      openNotice('Pengambilan', `Gagal proses pengambilan: ${error.message}`);
    }
  };
  const handleReprintInvoice = async (row) => {
    if (Platform.OS !== 'web') {
      openNotice('Cetak Ulang', 'Cetak ulang tersedia pada mode web.');
      return;
    }
    let sourceRow = row;
    const orderId = Number(row?.id || 0);
    if (orderId > 0) {
      try {
        const detailPayload = await fetchPosOrderDetail(orderId);
        const detailData = detailPayload?.data && typeof detailPayload.data === 'object' ? detailPayload.data : null;
        const nestedOrder = detailData?.order && typeof detailData.order === 'object' ? detailData.order : null;
        const detailRow = Array.isArray(detailPayload)
          ? detailPayload[0]
          : (detailData && !Array.isArray(detailData) ? detailData : detailPayload);
        const detailItems = Array.isArray(detailRow?.items)
          ? detailRow.items
          : Array.isArray(detailRow?.order_items)
            ? detailRow.order_items
            : Array.isArray(detailData?.items)
              ? detailData.items
              : Array.isArray(detailData?.order_items)
                ? detailData.order_items
                : Array.isArray(nestedOrder?.items)
                  ? nestedOrder.items
                  : Array.isArray(nestedOrder?.order_items)
                    ? nestedOrder.order_items
                    : [];
        if (detailRow && typeof detailRow === 'object') {
          sourceRow = {
            ...row,
            ...(nestedOrder || {}),
            ...detailRow,
            customer: detailRow?.customer || nestedOrder?.customer || row?.customer,
            invoice: detailRow?.invoice || nestedOrder?.invoice || row?.invoice,
            items: detailItems.length > 0 ? detailItems : (Array.isArray(row?.items) ? row.items : []),
          };
        }
      } catch (_error) {
        // fallback pakai data list invoice bila detail order gagal diambil
      }
    }
    const items = Array.isArray(sourceRow?.items) ? sourceRow.items : [];
    let itemDetails = items.map((item) => {
      const restored = restoreDraftItemDisplay(item, materialMapById, finishingNameMapById);
      const lineSubtotal = Number(item?.line_total || item?.subtotal || item?.total || 0);
      const finishingTotal = Number(item?.finishing_total || 0);
      const expressFee = Number(item?.express_fee || 0);
      const lineTotal = roundMoney(lineSubtotal + finishingTotal + expressFee);
      const statusText = formatProductionStatusLabel(item?.production_status);
      const statusColor = getProductionStatusTextColor(item?.production_status);
      return {
        productName: toLabel(item?.product_name, item?.product?.name, item?.name, '-'),
        qty: Math.max(Number(item?.qty || item?.quantity || 1) || 1, 1),
        sizeText: restored.sizeText || '-',
        finishingText: restored.finishingText || '-',
        materialText: restored.materialText || '-',
        pages: Math.max(Number(restored.pages || item?.pages || 1) || 1, 1),
        statusText,
        statusColor,
        lineTotal,
      };
    });
    const isDashValue = (value) => {
      const text = String(value || '').trim();
      return !text || text === '-';
    };
    let snapshot = findReprintSpecSnapshot({
      orderId: Number(sourceRow?.id || row?.id || 0),
      invoiceNo: String(sourceRow?.invoice?.invoice_no || row?.invoice?.invoice_no || ''),
    });
    if (!snapshot) {
      const safeOrderId = String(sourceRow?.id || row?.id || '').trim();
      const safeInvoiceNo = String(sourceRow?.invoice?.invoice_no || row?.invoice?.invoice_no || '').trim();
      const canUseLastPayload = Array.isArray(lastPayloadPreview?.items) && lastPayloadPreview.items.length > 0;
      const sameAsLastOrder = safeOrderId && String(lastSyncInfo || '').includes(`Order #${safeOrderId}`);
      const sameAsLastInvoice = safeInvoiceNo && String(lastSyncInfo || '').includes(`Invoice ${safeInvoiceNo}`);
      if (canUseLastPayload && (sameAsLastOrder || sameAsLastInvoice)) {
        snapshot = {
          items: buildReprintSnapshotItems(lastPayloadPreview.items),
        };
      }
    }
    const cachedItems = Array.isArray(snapshot?.items) ? snapshot.items : [];
    if (cachedItems.length > 0) {
      itemDetails = itemDetails.map((item, index) => {
        const byIndex = cachedItems[index];
        const byMatch = cachedItems.find((candidate) => (
          normalizeText(candidate?.productName) === normalizeText(item.productName)
          && Number(candidate?.qty || 0) === Number(item.qty || 0)
        ));
        const fallback = byIndex || byMatch || null;
        if (!fallback) return item;
        return {
          ...item,
          sizeText: isDashValue(item.sizeText) ? String(fallback.sizeText || '-').trim() || '-' : item.sizeText,
          finishingText: isDashValue(item.finishingText) ? String(fallback.finishingText || '-').trim() || '-' : item.finishingText,
          materialText: isDashValue(item.materialText) ? String(fallback.materialText || '-').trim() || '-' : item.materialText,
          pages: Number(item.pages || 0) > 0 ? item.pages : Math.max(Number(fallback.pages || 1) || 1, 1),
        };
      });
    }
    const isMmtOrSticker = (name) => /(mmt|sticker|stiker)/i.test(String(name || ''));
    const isNotebookLike = (name) => /(nota\s*book|notebook|buku\s*nota|nota\b)/i.test(String(name || ''));
    const allMmtOrSticker = itemDetails.length > 0 && itemDetails.every((item) => isMmtOrSticker(item.productName));
    const showSpecColumns = !allMmtOrSticker;
    const showPagesColumn = showSpecColumns && itemDetails.some((item) => item.pages > 1 || isNotebookLike(item.productName));

    const tableHeaders = [
      'No',
      'Produk',
      'Qty',
      ...(showSpecColumns ? ['Ukuran', 'Finishing', 'Bahan'] : []),
      ...(showPagesColumn ? ['Hal.'] : []),
      'Status Produksi',
      'Total',
    ];

    const rowsHtml = itemDetails.map((item, idx) => {
      const cells = [
        `<td>${idx + 1}</td>`,
        `<td>${escapeHtml(item.productName)}</td>`,
        `<td style="text-align:center;">${item.qty}</td>`,
      ];
      if (showSpecColumns) {
        cells.push(`<td>${escapeHtml(item.sizeText)}</td>`);
        cells.push(`<td>${escapeHtml(item.finishingText)}</td>`);
        cells.push(`<td>${escapeHtml(item.materialText)}</td>`);
      }
      if (showPagesColumn) {
        cells.push(`<td style="text-align:center;">${item.pages}</td>`);
      }
      cells.push(`<td style="text-align:center;color:${item.statusColor};font-weight:700;">${escapeHtml(item.statusText)}</td>`);
      cells.push(`<td style="text-align:right;">${formatRupiah(item.lineTotal)}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    }).join('');
    const total = Number(
      sourceRow?.invoice?.total
      || sourceRow?.total
      || sourceRow?.grand_total
      || calculateDraftItemsTotal(items)
      || 0,
    );
    const printWindow = globalThis?.open?.('', '_blank', 'width=980,height=760');
    if (!printWindow) {
      openNotice('Cetak Ulang', 'Popup browser diblokir. Izinkan popup untuk cetak ulang.');
      return;
    }
    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Cetak Ulang Invoice</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #222; }
    h1 { font-size: 18px; margin: 0 0 8px 0; }
    .meta { font-size: 12px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #999; padding: 6px; vertical-align: top; }
    th { background: #edf2ff; }
    .totals { margin-top: 10px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Invoice Penjualan</h1>
  <div class="meta">Order ID: ${escapeHtml(String(sourceRow?.id || '-'))}</div>
  <div class="meta">Invoice: ${escapeHtml(String(sourceRow?.invoice?.invoice_no || '-'))}</div>
  <div class="meta">Customer: ${escapeHtml(String(sourceRow?.customer?.name || 'Pelanggan umum'))}</div>
  <div class="meta">Status Order: ${escapeHtml(formatDraftStatusLabel(normalizeInvoiceOrderStatus(sourceRow)))}</div>
  <div class="meta">Status Produksi: ${escapeHtml(summarizeProductionStatusForInvoice(sourceRow))}</div>
  <table>
    <thead>
      <tr>
        ${tableHeaders.map((header) => `<th>${header}</th>`).join('')}
      </tr>
    </thead>
    <tbody>${rowsHtml || `<tr><td colspan="${tableHeaders.length}" style="text-align:center;">Tidak ada item</td></tr>`}</tbody>
  </table>
  <div class="totals">Grand Total: ${formatRupiah(total)}</div>
</body>
</html>`;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const orderPreviewSnapshot = buildOrderPreviewSnapshot();

  return (
    <View style={styles.screen}>
      <View style={styles.topBlueLine}>
        <View style={styles.topBlueLineContent}>
          <View style={styles.topBlueBrandWrap}>
            <Image
              source={require('../../assets/logo-sidomulyo.png')}
              style={styles.topBlueLogo}
              resizeMode="contain"
            />
            <Text style={styles.topBlueVersion}>{APP_VERSION_LABEL}</Text>
          </View>
          <View style={styles.topRightActions}>
            <Pressable style={styles.notificationButton} onPress={handleNotificationPress}>
              <Text style={styles.notificationIconText}>{'\uD83D\uDD14'}</Text>
              {unreadProductionCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadProductionCount > 99 ? '99+' : String(unreadProductionCount)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <View style={styles.profileMenuWrap}>
              <Pressable style={styles.profileButton} onPress={handleToggleProfileMenu}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>{userInitial || 'U'}</Text>
                </View>
                <View style={styles.profileTextWrap}>
                  <Text style={styles.profileNameText} numberOfLines={1}>{userDisplayName}</Text>
                  <Text style={styles.profileRoleText} numberOfLines={1}>{userRoleLabel}</Text>
                </View>
                <Text style={styles.profileCaret}>{isProfileMenuOpen ? '?' : '?'}</Text>
              </Pressable>
              {isProfileMenuOpen ? (
                <View style={styles.profileDropdown}>
                  <Pressable style={styles.profileDropdownItem} onPress={handleLogoutFromProfileMenu}>
                    <Text style={styles.profileDropdownItemText}>Logout</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.scrollDesktop,
          isDesktop && { minHeight: Math.max(height - 20, 700) },
        ]}
        showsVerticalScrollIndicator={!isDesktop}
      >
        <View style={styles.frame}>
          <View style={styles.tabsRow}>
            <Pressable
              style={[styles.greenTab, activeMenu === 'pos' ? styles.greenTabActive : null]}
              onPress={() => setActiveMenu('pos')}
            >
              <Text style={styles.greenTabText}>Input Order</Text>
            </Pressable>
            <Pressable
              style={[styles.greenTab, activeMenu === 'draft' ? styles.greenTabActive : null]}
              onPress={() => setActiveMenu('draft')}
            >
              <Text style={styles.greenTabText}>Invoice</Text>
            </Pressable>
            <Pressable
              style={[styles.greenTab, activeMenu === 'production' ? styles.greenTabActive : null]}
              onPress={() => setActiveMenu('production')}
            >
              <Text style={styles.greenTabText}>Produksi</Text>
            </Pressable>
            <Pressable
              style={[styles.greenTab, activeMenu === 'debug' ? styles.greenTabActive : null]}
              onPress={() => setActiveMenu('debug')}
            >
              <Text style={styles.greenTabText}>Menu Tools</Text>
            </Pressable>
          </View>

          {activeMenu === 'pos' ? (
            <>
              <View style={styles.transactionRow}>
                <TransactionHeader
                  noteNumber={orderNumber}
                  transactionDate={transactionDate}
                  customers={customers}
                  selectedCustomerId={selectedCustomerId}
                  onSelectCustomerId={setSelectedCustomerId}
                  customerTypes={customerTypes}
                  onCreateCustomer={handleCreateCustomer}
                  backendReady={backendReady}
                />

                <View style={styles.tagihanPanel}>
                  <Text style={styles.tagihanText}>Tagihan : {formatRupiah(grandTotal)}</Text>
                  {queueCount > 0 ? <Text style={styles.payloadFlag}>Antrian invoice disimpan offline: {queueCount}</Text> : null}
                  {lastSyncInfo ? <Text style={styles.payloadFlag}>{lastSyncInfo}</Text> : null}
                </View>
              </View>

              <ProductForm
                productName={productName}
                productPickerTree={productPickerTree}
                onSelectProductVariant={handleSelectProductVariant}
                qty={qty}
                onChangeQty={(value) => setQty(sanitizeQtyInput(value))}
                sizeWidthMeter={sizeWidthMeter}
                onChangeSizeWidthMeter={(value) => setSizeWidthMeter(sanitizeDecimalInput(value))}
                sizeLengthMeter={sizeLengthMeter}
                onChangeSizeLengthMeter={(value) => setSizeLengthMeter(sanitizeDecimalInput(value))}
                selectedFinishingIds={selectedFinishingIds}
                selectedFinishingMataAyamQtyById={selectedFinishingMataAyamQtyById}
                finishingSummary={selectedFinishingDisplay}
                finishingOptions={regularFinishingOptions}
                isPrintingFinishingMode={isPrintingProductType(selectedProductType)}
                onSaveSelectedFinishings={handleSaveSelectedFinishings}
                onSaveSelectedFinishingMataAyamQtyById={handleSaveSelectedFinishingMataAyamQtyById}
                selectedLbMaxProductId={selectedLbMaxProductId}
                lbMaxSummary={selectedLbMaxSummary}
                lbMaxOptions={lbMaxFinishingOptions}
                onSaveSelectedLbMax={setSelectedLbMaxProductId}
                showPagesInput={selectedProductType === 'book'}
                pages={pages}
                onChangePages={(value) => setPages(sanitizeNumericInput(value))}
                materialDisplay={
                  isMaterialLoading
                    ? 'Memuat material produk...'
                    : (previewMaterialDisplay || 'Material akan dipilih otomatis sesuai hitung backend')
                }
                mataAyamIssueBadge={mergedMataAyamIssueBadge}
                onValidateProduct={handleValidateProduct}
                onAddToCart={handleAddToCart}
                itemFinalPrice={itemFinalPrice}
                onCancelItem={handleCancelItem}
                onClearCart={handleClearCart}
              />

              <CartList cartItems={cartItems} onDeleteItem={handleDeleteItem} />

              <PaymentSummary
                subtotal={subtotal}
                discountPercent={discountPercent}
                onChangeDiscountPercent={(value) => {
                  setDiscountMode('percent');
                  setDiscountPercent(sanitizeNumericInput(value));
                }}
                discountAmount={discountAmountDisplay}
                onChangeDiscountAmount={(value) => {
                  setDiscountMode('amount');
                  setDiscountAmount(sanitizeNumericInput(value));
                }}
                grandTotal={grandTotal}
                paymentMethod={paymentMethod}
                paymentMethodOptions={PAYMENT_METHOD_LABELS}
                onChangePaymentMethod={(value) => setPaymentMethod(normalizePaymentMethodLabel(value))}
                paymentStatus={paymentStatus}
                paymentAmount={paymentAmount}
                onChangePaymentAmount={handleChangePaymentAmount}
                changeAmount={changeAmount}
                paymentNotes={paymentNotes}
                onChangePaymentNotes={setPaymentNotes}
                onSaveTransaction={handleSaveTransaction}
                onProcessOrder={handleProcessOrder}
                onCancelTransaction={handleCancelTransaction}
                isSubmitting={isSubmitting}
              />
            </>
          ) : activeMenu === 'draft' ? (
            <View style={styles.draftPanel}>
              <View style={styles.draftHeaderRow}>
                <Text style={styles.debugTitle}>Daftar Invoice</Text>
                <View style={styles.headerActions}>
                  <Pressable
                    style={styles.refreshButton}
                    onPress={async () => {
                      await flushQueuedOrders();
                      await loadDraftInvoices();
                    }}
                  >
                    <Text style={styles.refreshButtonText}>Kirim Ulang Antrian</Text>
                  </Pressable>
                  <Pressable style={styles.refreshButton} onPress={loadDraftInvoices}>
                    <Text style={styles.refreshButtonText}>{isDraftLoading ? 'Memuat...' : 'Refresh'}</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.filterRow}>
                <Pressable
                  style={[styles.filterButton, invoiceFilter === 'all' ? styles.filterButtonActive : null]}
                  onPress={() => setInvoiceFilter('all')}
                >
                  <Text style={[styles.filterButtonText, invoiceFilter === 'all' ? styles.filterButtonTextActive : null]}>Semua</Text>
                </Pressable>
                <Pressable
                  style={[styles.filterButton, invoiceFilter === 'draft' ? styles.filterButtonActive : null]}
                  onPress={() => setInvoiceFilter('draft')}
                >
                  <Text style={[styles.filterButtonText, invoiceFilter === 'draft' ? styles.filterButtonTextActive : null]}>Draft Invoice</Text>
                </Pressable>
                <Pressable
                  style={[styles.filterButton, invoiceFilter === 'processing' ? styles.filterButtonActive : null]}
                  onPress={() => setInvoiceFilter('processing')}
                >
                  <Text style={[styles.filterButtonText, invoiceFilter === 'processing' ? styles.filterButtonTextActive : null]}>Invoice Proses</Text>
                </Pressable>
              </View>
              <TextInput
                value={invoiceSearch}
                onChangeText={setInvoiceSearch}
                placeholder="Cari nama customer / no invoice / order id..."
                placeholderTextColor="#777777"
                style={styles.invoiceSearchInput}
              />
              {filteredInvoices.length === 0 ? (
                <Text style={styles.debugText}>
                  {isDraftLoading ? 'Memuat invoice...' : 'Belum ada invoice sesuai filter.'}
                </Text>
              ) : (
                <View style={styles.draftList}>
                  {filteredInvoices.map((row, index) => {
                    const displayId = String(row?.id || '-');
                    const invoiceNo = String(row?.invoice?.invoice_no || '-');
                    const customerName = String(row?.customer?.name || 'Pelanggan umum');
                    const queuedItems = Array.isArray(row?.items) ? row.items : [];
                    const total = Number(
                      row?.invoice?.total
                      || row?.total
                      || row?.grand_total
                      || row?.__queue_total
                      || calculateDraftItemsTotal(queuedItems)
                      || 0,
                    );
                    const itemCount = Array.isArray(row?.items) ? row.items.length : 0;
                    const isDeleting = String(isDeletingDraftId || '') === String(row?.id || '');
                    const isDraftRow = isDraftInvoiceRow(row);
                    const invoiceStatus = normalizeInvoiceOrderStatus(row);
                    const productionStage = getCurrentProductionStageForInvoice(row);
                    return (
                      <View key={String(row?.id || `row-${index}`)} style={styles.draftCard}>
                        <View style={styles.draftInfo}>
                          <Text style={styles.draftTitle}>#{displayId} | {invoiceNo}</Text>
                          <Text style={styles.draftMeta}>{customerName}</Text>
                          <View style={styles.invoiceStatusRow}>
                            <Text style={styles.draftMeta}>Status: </Text>
                            <Text style={[styles.draftMeta, styles.invoiceStatusText, { color: getInvoiceStatusTextColor(invoiceStatus) }]}>
                              {formatDraftStatusLabel(invoiceStatus)}
                            </Text>
                          </View>
                          <View style={styles.productionCurrentRow}>
                            <Text style={styles.draftMeta}>Produksi: </Text>
                            <Text
                              style={[
                                styles.draftMeta,
                                styles.productionCurrentText,
                                { color: getProductionStatusTextColor(productionStage.key) },
                              ]}
                            >
                              {productionStage.label}
                              {productionStage.count > 0 ? ` (${productionStage.count} item)` : ''}
                            </Text>
                          </View>
                          <Text style={styles.draftMeta}>Item: {itemCount} | Total: {formatRupiah(total)}</Text>
                          <Text style={styles.draftMeta}>Tanggal: {String(row?.created_at || '-')}</Text>
                        </View>
                        <View style={styles.draftActionColumn}>
                          {isDraftRow ? (
                            <>
                              <Pressable
                                style={[
                                  styles.continueDraftButton,
                                  isDeleting ? styles.draftActionDisabled : null,
                                ]}
                                disabled={isDeleting}
                                onPress={() => handleContinueDraft(row)}
                              >
                                <Text style={styles.continueDraftButtonText}>Lanjutkan</Text>
                              </Pressable>
                              <Pressable
                                style={[
                                  styles.deleteDraftButton,
                                  isDeleting ? styles.draftActionDisabled : null,
                                ]}
                                disabled={isDeleting}
                                onPress={() => confirmDeleteDraft(row)}
                              >
                                <Text style={styles.deleteDraftButtonText}>{isDeleting ? 'Memproses...' : 'Hapus'}</Text>
                              </Pressable>
                            </>
                          ) : (
                            <>
                              <Pressable style={styles.continueDraftButton} onPress={() => handleViewInvoiceDetail(row)}>
                                <Text style={styles.continueDraftButtonText}>Detail</Text>
                              </Pressable>
                              <Pressable style={styles.refreshButton} onPress={() => handleReprintInvoice(row)}>
                                <Text style={styles.refreshButtonText}>Cetak Ulang</Text>
                              </Pressable>
                            </>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ) : activeMenu === 'production' ? (
            <ProductionPanel
              rows={productionRows}
              isLoading={isProductionLoading}
              statusFilter={productionStatusFilter}
              onChangeStatusFilter={setProductionStatusFilter}
              searchText={productionSearch}
              onChangeSearchText={setProductionSearch}
              onRefresh={loadProductionItems}
              onUpdateStatus={handleUpdateProductionStatus}
              updatingItemId={updatingProductionItemId}
            />
          ) : (
            <View style={styles.debugPanel}>
              {__DEV__ ? (
                <>
                  <Text style={styles.debugTitle}>Debug Payload (DEV)</Text>
                  <Text style={styles.debugText} numberOfLines={14}>
                    {lastPayloadPreview ? JSON.stringify(lastPayloadPreview, null, 2) : 'Belum ada payload.'}
                  </Text>
                  <Text style={styles.debugTitle}>Audit Log (DEV)</Text>
                  <Text style={styles.debugText} numberOfLines={14}>
                    {auditLogs.length > 0 ? JSON.stringify(auditLogs.slice(0, 10), null, 2) : 'Belum ada log.'}
                  </Text>
                </>
              ) : (
                <Text style={styles.debugTitle}>Menu tools hanya tersedia pada mode development.</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={isPreparingApp}
        transparent
        animationType="fade"
      >
        <View style={styles.popupBackdrop}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#2f64ef" />
            <Text style={styles.loadingTitle}>Sedang Menyiapkan Data</Text>
            <Text style={styles.loadingMessage}>{prepareMessage}</Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isOrderPreviewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isOrderPreviewSubmitting) {
            setIsOrderPreviewOpen(false);
          }
        }}
      >
        <View style={styles.popupBackdrop}>
          <View style={[styles.popupCard, styles.orderPreviewCard]}>
            <Text style={styles.popupTitle}>Preview Nota Penjualan</Text>
            <Text style={styles.popupMessage}>Invoice: Akan dibuat otomatis oleh backend setelah pesanan disimpan.</Text>
            <Text style={styles.popupMessage}>Pelanggan: {orderPreviewSnapshot.customerName}</Text>
            <Text style={styles.popupMessage}>Tanggal: {orderPreviewSnapshot.transactionDate}</Text>

            <ScrollView style={styles.previewList}>
              {orderPreviewSnapshot.items.map((item) => (
                <View key={`preview-${item.no}-${item.product}`} style={styles.previewItemCard}>
                  <Text style={styles.previewItemTitle}>{item.no}. {item.product}</Text>
                  <Text style={styles.previewItemMeta}>Qty: {item.qty} | Ukuran: {item.size}</Text>
                  <Text style={styles.previewItemMeta}>Finishing: {item.finishing}</Text>
                  <Text style={styles.previewItemMeta}>Bahan: {item.material}</Text>
                  <Text style={styles.previewItemTotal}>Total: {formatRupiah(item.total)}</Text>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.popupMessage}>Subtotal: {formatRupiah(orderPreviewSnapshot.subtotal)}</Text>
            <Text style={styles.popupMessage}>Diskon: {formatRupiah(orderPreviewSnapshot.discountAmount)}</Text>
            <Text style={styles.popupMessage}>Grand Total: {formatRupiah(orderPreviewSnapshot.grandTotal)}</Text>

            <View style={styles.popupActions}>
              <Pressable
                style={[styles.popupButton, styles.popupButtonSecondary]}
                disabled={isOrderPreviewSubmitting}
                onPress={() => setIsOrderPreviewOpen(false)}
              >
                <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.popupButton, isOrderPreviewSubmitting ? styles.draftActionDisabled : null]}
                disabled={isOrderPreviewSubmitting}
                onPress={() => handleOpenBankPickerFromPreview('print')}
              >
                <Text style={styles.popupButtonText}>{isOrderPreviewSubmitting ? 'Memproses...' : 'Cetak'}</Text>
              </Pressable>
              <Pressable
                style={[styles.popupButton, isOrderPreviewSubmitting ? styles.draftActionDisabled : null]}
                disabled={isOrderPreviewSubmitting}
                onPress={() => handleOpenBankPickerFromPreview('save')}
              >
                <Text style={styles.popupButtonText}>{isOrderPreviewSubmitting ? 'Memproses...' : 'Simpan'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isBankPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseBankPicker}
      >
        <View style={styles.popupBackdrop}>
          <View style={[styles.popupCard, styles.bankPickerCard]}>
            <Text style={styles.popupTitle}>Pilih Bank Penampung</Text>
            <Text style={styles.popupMessage}>Pilih akun bank backend untuk menampung saldo penjualan ini.</Text>

            {isBankAccountLoading ? (
              <View style={styles.bankPickerLoadingWrap}>
                <ActivityIndicator size="small" color="#2f64ef" />
                <Text style={styles.loadingMessage}>Memuat akun bank dari backend...</Text>
              </View>
            ) : (
              <ScrollView style={styles.bankPickerList}>
                {bankAccounts.map((row, index) => {
                  const rowId = Number(row?.id || 0);
                  const active = rowId > 0 && rowId === Number(selectedBankAccountId || 0);
                  return (
                    <Pressable
                      key={String(rowId || `bank-${index}`)}
                      style={[styles.bankPickerItem, active ? styles.bankPickerItemActive : null]}
                      onPress={() => setSelectedBankAccountId(rowId)}
                    >
                      <Text style={styles.bankPickerItemTitle}>{row?.displayName || `Bank #${rowId}`}</Text>
                      <Text style={styles.bankPickerItemMeta}>No Rek: {row?.accountNumber || '-'}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.popupActions}>
              <Pressable
                style={[styles.popupButton, styles.popupButtonSecondary]}
                disabled={isSubmitting || isOrderPreviewSubmitting}
                onPress={handleCloseBankPicker}
              >
                <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.popupButton, (isBankAccountLoading || isSubmitting || isOrderPreviewSubmitting) ? styles.draftActionDisabled : null]}
                disabled={isBankAccountLoading || isSubmitting || isOrderPreviewSubmitting}
                onPress={handleConfirmSaveWithBankAccount}
              >
                <Text style={styles.popupButtonText}>{isSubmitting || isOrderPreviewSubmitting ? 'Memproses...' : 'Simpan Order'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pickupModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closePickupModal}
      >
        <View style={styles.popupBackdrop}>
          <View style={[styles.popupCard, styles.pickupCard]}>
            <Text style={styles.popupTitle}>Konfirmasi Pengambilan</Text>
            <Text style={styles.popupMessage}>Invoice: {pickupModal.invoiceNo || '-'}</Text>
            <Text style={styles.popupMessage}>Customer: {pickupModal.customerName || '-'}</Text>

            <View style={styles.pickupForm}>
              <Text style={styles.pickupLabel}>Nama Pengambil</Text>
              <TextInput
                value={pickupModal.receiverName}
                onChangeText={(value) => setPickupModal((prev) => ({ ...prev, receiverName: String(value || '') }))}
                placeholder="Nama penerima pesanan"
                placeholderTextColor="#777777"
                style={styles.pickupInput}
                editable={!pickupModal.isSubmitting}
              />
              <Text style={styles.pickupLabel}>Nomor HP (Opsional)</Text>
              <TextInput
                value={pickupModal.receiverPhone}
                onChangeText={(value) => setPickupModal((prev) => ({ ...prev, receiverPhone: String(value || '') }))}
                placeholder="08xxxxxxxxxx"
                placeholderTextColor="#777777"
                style={styles.pickupInput}
                editable={!pickupModal.isSubmitting}
              />
              <Text style={styles.pickupLabel}>Catatan (Opsional)</Text>
              <TextInput
                value={pickupModal.note}
                onChangeText={(value) => setPickupModal((prev) => ({ ...prev, note: String(value || '') }))}
                placeholder="Catatan pengambilan"
                placeholderTextColor="#777777"
                style={[styles.pickupInput, styles.pickupInputNote]}
                multiline
                editable={!pickupModal.isSubmitting}
              />
            </View>

            <View style={styles.popupActions}>
              <Pressable
                style={[styles.popupButton, styles.popupButtonSecondary]}
                disabled={pickupModal.isSubmitting}
                onPress={closePickupModal}
              >
                <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.popupButton, pickupModal.isSubmitting ? styles.draftActionDisabled : null]}
                disabled={pickupModal.isSubmitting}
                onPress={handleSubmitPickup}
              >
                <Text style={styles.popupButtonText}>{pickupModal.isSubmitting ? 'Memproses...' : 'Simpan Pengambilan'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={invoiceDetailModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeInvoiceDetailModal}
      >
        <View style={styles.popupBackdrop}>
          <View style={[styles.popupCard, styles.invoiceDetailCard]}>
            <Text style={styles.popupTitle}>Detail Invoice</Text>
            <ScrollView style={styles.invoiceDetailList} contentContainerStyle={styles.invoiceDetailListContent}>
              <Text style={styles.popupMessage}>Order ID: {invoiceDetailModal.orderId}</Text>
              <Text style={styles.popupMessage}>Invoice: {invoiceDetailModal.invoiceNo}</Text>
              <Text style={styles.popupMessage}>Customer: {invoiceDetailModal.customerName}</Text>
              <Text style={styles.popupMessage}>Status Order: {invoiceDetailModal.orderStatus}</Text>
              <Text style={styles.popupMessage}>Produksi Ringkas: {invoiceDetailModal.productionSummary}</Text>
              <Text style={styles.popupMessage}>Item: {invoiceDetailModal.itemCount} | Total: {formatRupiah(invoiceDetailModal.total)}</Text>
              <Text style={styles.popupMessage}>Pengambilan: {invoiceDetailModal.pickedUpText}</Text>
              <Text style={styles.popupMessage}>Tanggal: {invoiceDetailModal.createdAt}</Text>

              {Array.isArray(invoiceDetailModal.items) && invoiceDetailModal.items.length > 0 ? (
                invoiceDetailModal.items.map((item, index) => (
                  <View key={`${item.key}-${index}`} style={styles.invoiceItemCard}>
                    <View style={styles.invoiceItemHeader}>
                      <Text style={styles.invoiceItemTitle}>{index + 1}. {item.productName}</Text>
                      <Text style={[styles.invoiceItemStatus, { color: getProductionStatusTextColor(item.productionStatus) }]}>
                        {item.productionStatusLabel}
                      </Text>
                    </View>
                    <Text style={styles.invoiceItemMeta}>
                      Qty: {item.qty}{item.showPages ? ` | Halaman: ${item.pages}` : ''}
                    </Text>
                    <Text style={styles.invoiceItemMeta}>Ukuran: {item.sizeText}</Text>
                    <Text style={styles.invoiceItemMeta}>Bahan: {item.materialText}</Text>
                    <Text style={styles.invoiceItemMeta}>Finishing: {item.finishingText}</Text>
                    <Text style={styles.invoiceItemMeta}>LB Max: {item.lbMaxText}</Text>
                    <Text style={styles.invoiceItemMeta}>Catatan: {item.note}</Text>
                    <Text style={styles.invoiceItemTotal}>Total Item: {formatRupiah(item.lineTotal)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.invoiceDetailEmpty}>Tidak ada detail item pada invoice ini.</Text>
              )}
            </ScrollView>
            <View style={styles.popupActions}>
              <Pressable style={[styles.popupButton, styles.popupButtonSecondary]} onPress={closeInvoiceDetailModal}>
                <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>Tutup</Text>
              </Pressable>
              {invoiceDetailModal.canPickup ? (
                <Pressable
                  style={styles.popupButton}
                  onPress={() => {
                    const targetRow = invoiceDetailModal.row;
                    closeInvoiceDetailModal();
                    if (targetRow) {
                      openPickupModal(targetRow);
                    }
                  }}
                >
                  <Text style={styles.popupButtonText}>Pengambilan</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={noticeModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeNotice}
      >
        <View style={styles.popupBackdrop}>
          <View style={styles.popupCard}>
            <Text
              style={[
                styles.popupTitle,
                String(noticeModal.title || '').trim().toUpperCase() === 'SETOK HABIS'
                  ? styles.popupTitleDanger
                  : null,
              ]}
            >
              {noticeModal.title || 'Informasi'}
            </Text>
            <Text style={styles.popupMessage}>{noticeModal.message || '-'}</Text>
            {(Array.isArray(noticeModal.actions) && noticeModal.actions.length > 0
              ? noticeModal.actions
              : (noticeModal.showDefaultAction ? [{ label: 'OK', role: 'primary' }] : [])
            ).length > 0 ? (
              <View style={styles.popupActions}>
                {(Array.isArray(noticeModal.actions) && noticeModal.actions.length > 0
                  ? noticeModal.actions
                  : (noticeModal.showDefaultAction ? [{ label: 'OK', role: 'primary' }] : [])
                ).map((action, index) => (
                  <Pressable
                    key={`${String(action?.label || 'action')}-${index}`}
                    style={[
                      styles.popupButton,
                      action?.role === 'secondary' ? styles.popupButtonSecondary : null,
                      action?.role === 'danger' ? styles.popupButtonDanger : null,
                    ]}
                    onPress={() => closeNotice(action)}
                  >
                    <Text
                      style={[
                        styles.popupButtonText,
                        action?.role === 'secondary' ? styles.popupButtonTextSecondary : null,
                      ]}
                    >
                      {String(action?.label || 'OK')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#d9dadc',
  },
  topBlueLine: {
    backgroundColor: '#0f45af',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#0b3282',
    zIndex: 40,
  },
  topBlueLineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topBlueBrandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBlueLogo: {
    width: 132,
    height: 26,
  },
  topBlueVersion: {
    color: '#d6e3ff',
    fontSize: 10,
    fontWeight: '700',
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 10,
    paddingBottom: 16,
  },
  scrollDesktop: {
    padding: 8,
  },
  frame: {
    width: '100%',
    flex: 1,
    borderWidth: 1,
    borderColor: '#a9a9a9',
    backgroundColor: '#e3e3e3',
    padding: 10,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
    flexWrap: 'wrap',
  },
  greenTab: {
    backgroundColor: '#2f64ef',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  greenTabActive: {
    backgroundColor: '#1f4cc5',
  },
  greenTabText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 80,
  },
  notificationButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#7ea6ff',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#d32f2f',
    borderWidth: 1,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
  },
  notificationIconText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 15,
  },
  profileMenuWrap: {
    position: 'relative',
  },
  profileButton: {
    minWidth: 160,
    maxWidth: 230,
    borderWidth: 1,
    borderColor: '#7ea6ff',
    backgroundColor: 'rgba(255,255,255,0.17)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff',
    backgroundColor: '#2457d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  profileTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  profileNameText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  profileRoleText: {
    color: '#d6e3ff',
    fontSize: 10,
    marginTop: 1,
  },
  profileCaret: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  profileDropdown: {
    position: 'absolute',
    top: 34,
    right: 0,
    minWidth: 130,
    borderWidth: 1,
    borderColor: '#cc4b4b',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingVertical: 6,
    zIndex: 90,
    elevation: 4,
  },
  profileDropdownItem: {
    marginHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#a71d1d',
    backgroundColor: '#d32f2f',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  profileDropdownItemText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  transactionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  tagihanPanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#b3b3b3',
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 154,
  },
  tagihanText: {
    color: '#ff0000',
    fontSize: 24,
    fontWeight: '800',
  },
  payloadFlag: {
    marginTop: 6,
    fontSize: 11,
    color: '#2457d6',
    fontWeight: '700',
  },
  healthBar: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  healthOnline: {
    borderColor: '#1f4cc5',
    backgroundColor: '#2f64ef',
  },
  healthOffline: {
    borderColor: '#8a1717',
    backgroundColor: '#d62828',
  },
  healthText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  debugPanel: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#999999',
    backgroundColor: 'rgba(255,255,255,0.55)',
    padding: 8,
  },
  draftPanel: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#999999',
    backgroundColor: 'rgba(255,255,255,0.55)',
    padding: 10,
  },
  draftHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: '#9c9c9c',
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  filterButtonActive: {
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
  },
  filterButtonText: {
    fontSize: 11,
    color: '#2c2c2c',
    fontWeight: '700',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
  },
  draftList: {
    gap: 8,
  },
  invoiceSearchInput: {
    borderWidth: 1,
    borderColor: '#bdbdbd',
    backgroundColor: '#ffffff',
    color: '#1f1f1f',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  draftCard: {
    borderWidth: 1,
    borderColor: '#c2c2c2',
    backgroundColor: '#ffffff',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  draftInfo: {
    flex: 1,
  },
  draftTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1f1f1f',
    marginBottom: 2,
  },
  draftMeta: {
    fontSize: 11,
    color: '#3a3a3a',
  },
  invoiceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  invoiceStatusText: {
    fontWeight: '700',
  },
  productionCurrentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  productionCurrentText: {
    fontWeight: '700',
  },
  draftActionColumn: {
    gap: 6,
    minWidth: 104,
  },
  continueDraftButton: {
    borderWidth: 1,
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  continueDraftButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
  },
  deleteDraftButton: {
    borderWidth: 1,
    borderColor: '#982222',
    backgroundColor: '#c53333',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  deleteDraftButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
  },
  draftActionDisabled: {
    opacity: 0.55,
  },
  popupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#a9a9a9',
    backgroundColor: '#e3e3e3',
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadingTitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '800',
    color: '#11469f',
  },
  loadingMessage: {
    marginTop: 6,
    fontSize: 12,
    color: '#2f2f2f',
    textAlign: 'center',
  },
  popupCard: {
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderColor: '#a9a9a9',
    backgroundColor: '#e3e3e3',
    padding: 12,
  },
  orderPreviewCard: {
    maxWidth: 760,
  },
  bankPickerCard: {
    maxWidth: 560,
  },
  pickupCard: {
    maxWidth: 520,
  },
  invoiceDetailCard: {
    maxWidth: 760,
    maxHeight: '86%',
  },
  invoiceDetailList: {
    maxHeight: 500,
    borderWidth: 1,
    borderColor: '#c9c9c9',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
  },
  invoiceDetailListContent: {
    paddingVertical: 8,
    gap: 4,
  },
  invoiceItemCard: {
    borderWidth: 1,
    borderColor: '#d5d5d5',
    backgroundColor: '#f8f9fb',
    padding: 8,
    marginTop: 8,
  },
  invoiceItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  invoiceItemTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#1f1f1f',
  },
  invoiceItemStatus: {
    fontSize: 11,
    fontWeight: '800',
  },
  invoiceItemMeta: {
    fontSize: 11,
    color: '#2f2f2f',
    marginBottom: 2,
  },
  invoiceItemTotal: {
    marginTop: 2,
    fontSize: 11,
    color: '#0b3a8f',
    fontWeight: '700',
  },
  invoiceDetailEmpty: {
    marginTop: 10,
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  pickupForm: {
    marginTop: 8,
    gap: 6,
  },
  pickupLabel: {
    fontSize: 11,
    color: '#2f2f2f',
    fontWeight: '700',
  },
  pickupInput: {
    borderWidth: 1,
    borderColor: '#b7b7b7',
    backgroundColor: '#f7f5eb',
    color: '#1f1f1f',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pickupInputNote: {
    minHeight: 62,
    textAlignVertical: 'top',
  },
  bankPickerLoadingWrap: {
    borderWidth: 1,
    borderColor: '#bcbcbc',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bankPickerList: {
    maxHeight: 280,
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#bcbcbc',
    backgroundColor: '#ffffff',
  },
  bankPickerItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bankPickerItemActive: {
    backgroundColor: '#e4ecff',
  },
  bankPickerItemTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1f1f1f',
  },
  bankPickerItemMeta: {
    marginTop: 2,
    fontSize: 11,
    color: '#3a3a3a',
  },
  previewList: {
    maxHeight: 280,
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#bcbcbc',
    backgroundColor: '#ffffff',
    padding: 8,
  },
  previewItemCard: {
    borderWidth: 1,
    borderColor: '#d2d2d2',
    backgroundColor: '#f9f9f9',
    padding: 8,
    marginBottom: 7,
  },
  previewItemTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e1e1e',
    marginBottom: 4,
  },
  previewItemMeta: {
    fontSize: 11,
    color: '#303030',
    marginBottom: 2,
  },
  previewItemTotal: {
    fontSize: 11,
    color: '#11469f',
    fontWeight: '700',
    marginTop: 2,
  },
  popupTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#11469f',
    marginBottom: 8,
  },
  popupTitleDanger: {
    color: '#c62828',
    textAlign: 'center',
  },
  popupMessage: {
    fontSize: 12,
    color: '#2f2f2f',
    lineHeight: 18,
  },
  popupActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  popupButton: {
    borderWidth: 1,
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  popupButtonSecondary: {
    borderColor: '#8b8b8b',
    backgroundColor: '#f2f2f2',
  },
  popupButtonDanger: {
    borderColor: '#982222',
    backgroundColor: '#c53333',
  },
  popupButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  popupButtonTextSecondary: {
    color: '#2a2a2a',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f1f1f',
    marginBottom: 4,
  },
  debugText: {
    fontSize: 10,
    color: '#2f2f2f',
    marginBottom: 6,
  },
});

export default SalesScreen;












