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
  createPosCashFlow,
  createPosInvoicePayment,
  createPosOrder,
  deletePosOrder,
  fetchPosBankAccounts,
  fetchPosCashFlows,
  fetchPosCashFlowTypes,
  fetchPosCloserOrder,
  fetchPosCustomers,
  fetchPosCustomerTypes,
  fetchPosFinanceRecipients,
  fetchPosFinishings,
  fetchPosMaterials,
  fetchPosClosingSummary,
  fetchPosOrderDetail,
  fetchPosOrders,
  fetchPosOrderTransactions,
  fetchPosProductionItems,
  fetchPosProductionMaterials,
  fetchPosProductDetail,
  fetchPosProducts,
  fetchPosSettings,
  pickupPosOrder,
  fetchAuthMe,
  getApiBaseUrl,
  previewPosPricing,
  submitPosCloserOrder,
  updatePosProductionItemStatus,
  updatePosOrderStatus,
} from '../services/erpApi';
import { appEnv } from '../config/appEnv';
import { enqueueOrderPayload, loadOrderQueue, setOrderQueue } from '../utils/orderQueue';
import { appendOrderAuditLog, loadOrderAuditLogs } from '../utils/orderAuditLog';
import {
  createPrinterProfile,
  createBrowserPrintOptions,
  DEFAULT_PRINTER_PROFILES,
  generateTestReceipt,
  isBrowserPrintProfile,
  normalizePrinterProfile,
  PrinterSettingsForm,
  printReceipt,
  renderReceiptHtml,
  renderReceiptText,
  writeHtmlToPrintWindow,
} from '../printing';
const { buildProductPickerTree, hasA3Token } = require('../utils/productPickerTree');

const formatDate = (date) => {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
const formatDateText = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value || '-');
  }
  return formatDate(parsed);
};
const diffDaysFromNow = (value) => {
  if (!value) return 0;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }
  const now = new Date();
  const start = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((end - start) / 86400000));
};
const formatIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const DRAFT_AUTO_DELETE_HOURS = 24;
const DRAFT_AUTO_DELETE_MS = DRAFT_AUTO_DELETE_HOURS * 60 * 60 * 1000;
const getDraftExpiryMeta = (createdAt, nowTs = Date.now()) => {
  const createdTs = new Date(createdAt || 0).getTime();
  if (!Number.isFinite(createdTs) || createdTs <= 0) {
    return {
      isValid: false,
      isExpired: false,
      remainingMs: 0,
      label: `Auto hapus ${DRAFT_AUTO_DELETE_HOURS} jam`,
    };
  }
  const expiresAtTs = createdTs + DRAFT_AUTO_DELETE_MS;
  const remainingMs = Math.max(0, expiresAtTs - nowTs);
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const compact =
    hours > 0
      ? `${hours}j${minutes > 0 ? ` ${minutes}m` : ''}`
      : `${Math.max(1, minutes)}m`;
  return {
    isValid: true,
    isExpired: remainingMs <= 0,
    remainingMs,
    label: remainingMs <= 0 ? 'Draft kadaluarsa' : `Auto hapus ${compact} lagi`,
  };
};

const sanitizeNumericInput = (value) => value.replace(/[^0-9]/g, '');
const sanitizeDecimalInput = (value) => String(value || '').replace(/[^0-9.,]/g, '');
const sanitizeCurrencyInput = (value) => sanitizeNumericInput(String(value || ''));
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
const resolvePricingGrandTotal = (pricing) => {
  if (pricing && pricing.grand_total !== undefined && pricing.grand_total !== null) {
    return roundMoney(pricing.grand_total);
  }
  return roundMoney(
    (pricing?.subtotal || 0) + (pricing?.finishing_total || 0) + (pricing?.express_fee || 0),
  );
};
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
const parseCurrencyInput = (value) => {
  const digits = sanitizeCurrencyInput(value);
  if (!digits) {
    return 0;
  }
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? roundMoney(parsed) : 0;
};
const resolveA3NegotiationConfig = (product, productDetail = null) => {
  const rows = [
    product,
    productDetail,
    toSourceProduct(product),
    toSourceProduct(productDetail),
  ].filter(Boolean);
  const fixedSizeMode = resolveFixedSizeA3Mode(product, productDetail);
  const enabled = fixedSizeMode.enabled && rows.some((row) => row?.bottom_price_enabled === true);
  const bottomPriceRaw = rows
    .map((row) => row?.bottom_price)
    .find((value) => value !== undefined && value !== null && value !== '');
  const minimumQtyRaw = rows
    .map((row) => row?.bottom_price_min_qty)
    .find((value) => value !== undefined && value !== null && value !== '');
  return {
    enabled,
    bottomPrice: roundMoney(Number(bottomPriceRaw || 0)),
    minimumQty: Math.max(0, Number.parseInt(String(minimumQtyRaw || '0'), 10) || 0),
    label: fixedSizeMode.label || 'A3+',
  };
};
const resolveA3NegotiationState = ({
  config,
  qtyValue,
  negotiatedPriceInput,
  fallbackBottomPrice = 0,
} = {}) => {
  if (!config?.enabled) {
    return {
      visible: false,
      tone: 'info',
      message: '',
      isApplied: false,
      isBlocking: false,
      value: null,
      bottomPrice: roundMoney(Number(fallbackBottomPrice || 0)),
      minimumQty: 0,
    };
  }

  const qtyNumber = Math.max(1, Number(qtyValue) || 1);
  const bottomPrice = roundMoney(Number(config?.bottomPrice || 0) || Number(fallbackBottomPrice || 0) || 0);
  const minimumQty = Math.max(0, Number(config?.minimumQty || 0) || 0);
  const negotiatedPrice = parseCurrencyInput(negotiatedPriceInput);
  const hasInput = negotiatedPrice > 0;

  if (minimumQty > 0 && qtyNumber < minimumQty) {
    return {
      visible: false,
      tone: 'info',
      message: '',
      isApplied: false,
      isBlocking: false,
      value: null,
      bottomPrice,
      minimumQty,
    };
  }

  if (!hasInput) {
    return {
      visible: true,
      tone: 'info',
      message: `Masukkan harga negosiasi untuk ${config?.label || 'A3+'}.${minimumQty > 0 ? ` Minimal qty ${minimumQty}.` : ''}`,
      isApplied: false,
      isBlocking: false,
      value: null,
      bottomPrice,
      minimumQty,
    };
  }

  if (bottomPrice > 0 && negotiatedPrice < bottomPrice) {
    return {
      visible: true,
      tone: 'error',
      message: `Harga negosiasi ${formatRupiah(negotiatedPrice)} tidak boleh di bawah harga bottom ${formatRupiah(bottomPrice)}.`,
      isApplied: false,
      isBlocking: true,
      value: null,
      bottomPrice,
      minimumQty,
    };
  }

  return {
    visible: true,
    tone: 'success',
    message: `Harga negosiasi aktif di ${formatRupiah(negotiatedPrice)}.`,
    isApplied: true,
    isBlocking: false,
    value: negotiatedPrice,
    bottomPrice,
    minimumQty,
  };
};

const resolvePricingSubtotalPerUnit = (pricing, qtyFallback = 1) => {
  const qty = Math.max(1, Number(pricing?.qty || qtyFallback || 1) || 1);
  const subtotal = roundMoney(Number(pricing?.subtotal || 0));
  if (subtotal <= 0) {
    return 0;
  }

  return roundMoney(subtotal / qty);
};
const isLbMaxBreakdown = (item) => {
  return (String(item?.source || '') === 'lb_max_width')
    || (String(item?.stock_usage_formula || '').toLowerCase() === 'lb_max_area')
    || Boolean(item?.meta?.lb_max);
};
const isBundlingDiscountBreakdown = (item) => {
  return String(item?.source || '').toLowerCase() === 'bundling_discount';
};
const isMataAyamAddonBreakdown = (item) => {
  return String(item?.source || '').toLowerCase() === 'addon_mata_ayam'
    || String(item?.meta?.addon_type || '').toLowerCase() === 'mata_ayam';
};
const extractDisplayFromBreakdown = (breakdown = []) => {
  const finishingNames = breakdown
    .filter((row) => !isLbMaxBreakdown(row) && !isBundlingDiscountBreakdown(row) && !isMataAyamAddonBreakdown(row))
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
const resolvePricingBreakdownBundleDiscount = (pricing = null) => {
  const explicit = Number(
    pricing?.price_breakdown?.finishing_bundle_discount
    ?? pricing?.price_breakdown?.sticker_finishing_bundling_discount
    ?? 0,
  );
  if (Number.isFinite(explicit) && explicit > 0) {
    return roundMoney(explicit);
  }
  const breakdown = Array.isArray(pricing?.finishing_breakdown) ? pricing.finishing_breakdown : [];
  const derived = breakdown.reduce((sum, row) => {
    if (!isBundlingDiscountBreakdown(row)) {
      return sum;
    }
    return sum + Math.abs(Number(row?.line_total || row?.unit_price || 0));
  }, 0);
  return roundMoney(derived);
};
const buildPricingDisplaySummary = ({
  pricing = null,
  materialText = '',
  stickerRule = null,
  negotiation = null,
} = {}) => {
  const subtotal = roundMoney(Number(pricing?.subtotal || 0));
  const finishingFinal = roundMoney(Number(pricing?.finishing_total || 0));
  const bundleDiscount = resolvePricingBreakdownBundleDiscount(pricing);
  const finishingBeforeDiscount = roundMoney(finishingFinal + bundleDiscount);
  const negotiatedSubtotal = negotiation?.isApplied
    ? roundMoney(Number(negotiation?.value || 0) * Math.max(1, Number(pricing?.qty || 1) || 1))
    : 0;
  const printSubtotal = negotiation?.isApplied ? negotiatedSubtotal : subtotal;
  const grandTotal = negotiation?.isApplied
    ? roundMoney(negotiatedSubtotal + finishingFinal + Number(pricing?.express_fee || 0))
    : resolvePricingGrandTotal(pricing);
  const bundleActive = bundleDiscount > 0;
  const billingGroup = String(
    stickerRule?.billing_group
    || pricing?.rule?.billing_group
    || pricing?.price_breakdown?.sticker_billing_group
    || ''
  ).trim().toUpperCase();
  const rollWidth = Number(
    stickerRule?.selected_width_m
    || pricing?.rule?.selected_width_m
    || pricing?.price_breakdown?.sticker_selected_roll_width_m
    || 0
  );
  const designLengthM = Number(
    stickerRule?.design_length_m
    || pricing?.rule?.design_length_m
    || pricing?.price_breakdown?.sticker_design_length_m
    || 0
  );
  const billedLengthM = Number(
    stickerRule?.billed_length_m
    || pricing?.rule?.billed_length_m
    || pricing?.price_breakdown?.sticker_billed_length_m
    || 0
  );
  const billingMinLengthM = Number(
    stickerRule?.billing_min_length_m
    || pricing?.rule?.billing_min_length_m
    || pricing?.price_breakdown?.sticker_billing_min_length_m
    || 0
  );
  const stickerNotice = resolveStickerBillingNotice({
    pricing,
    stickerRule,
    fallbackInputLengthM: designLengthM,
  });
  const summaryParts = [];
  if (billingGroup) {
    summaryParts.push(`Rule ${billingGroup}`);
  }
  if (rollWidth > 0) {
    summaryParts.push(`Lebar roll ${formatMeterNumber(rollWidth)} m`);
  }
  if (bundleDiscount > 0) {
    summaryParts.push(`Diskon bundling ${formatRupiah(bundleDiscount)}`);
  }
  if (negotiation?.isApplied) {
    summaryParts.push(`Nego ${formatRupiah(negotiatedSubtotal)}`);
  }
  return {
    subtotal,
    printSubtotal,
    finishingFinal,
    finishingBeforeDiscount,
    bundleDiscount,
    bundleActive,
    grandTotal,
    materialText: String(materialText || '').trim(),
    billingGroup,
    rollWidth,
    designLengthM,
    billedLengthM,
    billingMinLengthM,
    stickerNotice,
    isNegotiated: Boolean(negotiation?.isApplied),
    negotiatedSubtotal,
    bottomPrice: roundMoney(Number(negotiation?.bottomPrice || 0)),
    minimumQty: Math.max(0, Number(negotiation?.minimumQty || 0) || 0),
    shortText: summaryParts.join(' | '),
  };
};
const buildPricingSummaryFromBackendItem = (backendItem, materialText = '') => {
  const snapshot = parseJsonObject(backendItem?.spec_snapshot) || {};
  const stickerRule = snapshot?.sticker_rule && typeof snapshot.sticker_rule === 'object'
    ? snapshot.sticker_rule
    : null;
  return buildPricingDisplaySummary({
    pricing: backendItem,
    materialText,
    stickerRule,
    negotiation: Number(backendItem?.negotiated_price || 0) > 0
      ? {
        isApplied: true,
        value: Number(backendItem?.negotiated_price || 0),
        bottomPrice: Number(backendItem?.bottom_price || 0),
        minimumQty: Number(backendItem?.bottom_price_min_qty || 0),
      }
      : null,
  });
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
const extractFinishingLabelsFromPayload = (rows, nameMapById) => {
  const list = Array.isArray(rows) ? rows : [];
  const labels = list
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return '';
      }
      const baseName = toLabel(
        row?.name,
        row?.label,
        row?.title,
        row?.sku_name,
        nameMapById.get(Number(row?.id || row?.product_id || row?.finishing_id || row?.source_product_id || 0)),
      );
      if (!baseName) {
        return '';
      }
      const mataAyamQty = Math.max(0, Number(row?.mata_ayam_qty || 0) || 0);
      return mataAyamQty > 0 ? `${baseName} + Mata Ayam x${mataAyamQty}` : baseName;
    })
    .map((label) => String(label || '').trim())
    .filter(Boolean);

  return Array.from(new Set(labels));
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
    backendItem?.size_text,
    draftForm?.size_text,
    specs?.size_text,
    backendItem?.size,
    backendItem?.dimension,
    backendItem?.dimensions,
    meta?.size_text,
    meta?.size,
    unknownSizeText,
    sizeFromMeters,
    '-',
  );

  const finishingFromPayload = extractFinishingLabelsFromPayload(
    parseJsonArray(backendItem?.finishings),
    finishingNameMapById,
  ).join(', ') || extractNamesFromMixedList(
    [
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
    backendItem?.finishing_text,
    backendItem?.finishing_label,
    backendItem?.finishing,
    draftForm?.finishing,
    specs?.finishing,
    backendItem?.finishing_name,
    meta?.finishing,
    meta?.finishing_name,
    unknownFinishingText,
    finishingFromPayload,
    fromBreakdown.finishingText,
    '-',
  );
  const lbMaxText = toLabel(
    backendItem?.lb_max_text,
    draftForm?.lb_max,
    specs?.lb_max,
    lbMaxFromPayload,
    fromBreakdown.lbMaxText,
    '-',
  );
  const materialText = toLabel(
    backendItem?.material_text,
    backendItem?.material_label,
    backendItem?.material,
    draftForm?.material,
    specs?.material,
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
const buildCartItemFromDraftSource = (sourceItem, itemKey, materialMapById, finishingNameMapById, productNameMapById) => {
  const breakdown = Array.isArray(sourceItem?.finishing_breakdown) ? sourceItem.finishing_breakdown : [];
  const restored = restoreDraftItemDisplay(sourceItem, materialMapById, finishingNameMapById);
  const snapshot = parseJsonObject(sourceItem?.spec_snapshot) || {};
  const draftForm = parseJsonObject(snapshot?.draft_form) || parseJsonObject(sourceItem?.draft_form) || {};
  const specs = parseJsonObject(snapshot?.specs) || parseJsonObject(sourceItem?.specs) || {};
  const originalFlow = parseJsonObject(snapshot?.original_flow) || {};
  const productId = Number(
    sourceItem?.product_id
    || sourceItem?.pos_product_id
    || sourceItem?.product?.id
    || sourceItem?.pos_product?.id
    || 0
  );
  const materialId = Number(sourceItem?.material_product_id || sourceItem?.material_id || 0);
  const materialCandidates = Array.isArray(sourceItem?.material_candidate_ids)
    ? sourceItem.material_candidate_ids.map((id) => Number(id)).filter((id) => id > 0)
    : Array.isArray(sourceItem?.material_product_ids)
      ? sourceItem.material_product_ids.map((id) => Number(id)).filter((id) => id > 0)
      : [];
  const subtotal = Number(sourceItem?.subtotal || sourceItem?.line_total || sourceItem?.total || 0);
  const finishingTotal = Number(sourceItem?.finishing_total || 0);
  const expressFee = Number(sourceItem?.express_fee || 0);
  const lineTotal = roundMoney(subtotal + finishingTotal + expressFee);
  const materialText = restored.materialText || '-';

  return {
    id: itemKey,
    product: toLabel(
      sourceItem?.product_name,
      draftForm?.product_name,
      sourceItem?.product?.name,
      productNameMapById.get(productId),
      sourceItem?.name,
      '-',
    ),
    qty: Math.max(Number(sourceItem?.qty || sourceItem?.quantity || draftForm?.qty || 1) || 1, 1),
    size: restored.sizeText || '-',
    finishing: restored.finishingText || '-',
    lbMax: restored.lbMaxText || '-',
    pages: Math.max(Number(restored.pages || sourceItem?.pages || draftForm?.pages || 1) || 1, 1),
    material: materialText,
    note: toLabel(
      sourceItem?.notes,
      sourceItem?.note,
      draftForm?.note,
      specs?.note,
      '-',
    ),
    lineTotal,
    total: lineTotal,
    pricingSummary: buildPricingSummaryFromBackendItem(sourceItem, materialText),
    backendItem: {
      product_id: productId,
      qty: Math.max(Number(sourceItem?.qty || sourceItem?.quantity || draftForm?.qty || 1) || 1, 1),
      input_width_mm: Number(sourceItem?.input_width_mm || 0) || null,
      input_height_mm: Number(sourceItem?.input_height_mm || 0) || null,
      internal_width_mm: Number(sourceItem?.internal_width_mm || 0) || null,
      internal_height_mm: Number(sourceItem?.internal_height_mm || 0) || null,
      input_area_m2: Number(sourceItem?.input_area_m2 || 0) || null,
      internal_area_m2: Number(sourceItem?.internal_area_m2 || 0) || null,
      extra_margin_cm: Number(sourceItem?.extra_margin_cm || 0) || 0,
      calc_unit: String(sourceItem?.calc_unit || 'unit'),
      subtotal: roundMoney(subtotal),
      finishing_total: roundMoney(finishingTotal),
      express_fee: roundMoney(expressFee),
      negotiated_price: Number(sourceItem?.negotiated_price || 0) > 0 ? roundMoney(sourceItem.negotiated_price) : null,
      bottom_price_enabled: Boolean(sourceItem?.bottom_price_enabled),
      bottom_price: roundMoney(Number(sourceItem?.bottom_price || 0)),
      bottom_price_min_qty: Math.max(0, Number(sourceItem?.bottom_price_min_qty || 0) || 0),
      requires_production: Boolean(
        originalFlow?.requires_production
        ?? draftForm?.requires_production
        ?? sourceItem?.requires_production
        ?? true,
      ),
      requires_design: Boolean(
        originalFlow?.requires_design
        ?? draftForm?.requires_design
        ?? sourceItem?.requires_design
        ?? true,
      ),
      material_product_id: materialId > 0 ? materialId : null,
      material_product_ids: materialCandidates,
      finishings: Array.isArray(sourceItem?.finishings) ? sourceItem.finishings : [],
      finishing_breakdown: breakdown,
      lb_max: Array.isArray(sourceItem?.lb_max) ? sourceItem.lb_max : [],
      spec_snapshot: sourceItem?.spec_snapshot || null,
    },
  };
};
const calculateDraftItemsTotal = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }
  return roundMoney(
    items.reduce((sum, item) => sum + resolveItemGrandTotal(item), 0),
  );
};
const resolveItemGrandTotal = (item, pricingSummaryInput = null) => {
  const directFrontendTotal = Number(item?.lineTotal ?? 0) || 0;
  if (directFrontendTotal > 0) {
    return roundMoney(directFrontendTotal);
  }

  const directBackendTotal = Number(
    item?.line_total
    ?? item?.grand_total
    ?? item?.final_total
    ?? 0,
  ) || 0;
  if (directBackendTotal > 0) {
    return roundMoney(directBackendTotal);
  }

  const pricingSummary = pricingSummaryInput && typeof pricingSummaryInput === 'object'
    ? pricingSummaryInput
    : null;
  const summaryGrandTotal = Number(pricingSummary?.grandTotal || 0) || 0;
  if (summaryGrandTotal > 0) {
    return roundMoney(summaryGrandTotal);
  }

  const subtotal = Number(item?.subtotal ?? item?.total ?? 0) || 0;
  const finishingTotal = Number(item?.finishing_total || 0) || 0;
  const expressFee = Number(item?.express_fee || 0) || 0;
  return roundMoney(subtotal + finishingTotal + expressFee);
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
const PRINTER_PROFILE_STORAGE_KEY = 'pos_printer_profile_v1';
let memoryReprintSpecCache = [];
let memoryPrinterProfile = null;
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
const getDefaultPrinterProfile = () => normalizePrinterProfile({
  ...DEFAULT_PRINTER_PROFILES.thermal80,
});
const loadStoredPrinterProfile = () => {
  if (canUseLocalStorage()) {
    try {
      const raw = globalThis.localStorage.getItem(PRINTER_PROFILE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return normalizePrinterProfile({
        ...getDefaultPrinterProfile(),
        ...parsed,
      });
    } catch (_error) {
      return null;
    }
  }
  return memoryPrinterProfile ? normalizePrinterProfile(memoryPrinterProfile) : null;
};
const persistPrinterProfile = (profile) => {
  if (!profile || typeof profile !== 'object') {
    if (canUseLocalStorage()) {
      try {
        globalThis.localStorage.removeItem(PRINTER_PROFILE_STORAGE_KEY);
      } catch (_error) {
        // ignore storage errors
      }
    }
    memoryPrinterProfile = null;
    return;
  }

  const next = normalizePrinterProfile(profile);
  if (canUseLocalStorage()) {
    try {
      globalThis.localStorage.setItem(PRINTER_PROFILE_STORAGE_KEY, JSON.stringify(next));
    } catch (_error) {
      // ignore storage errors
    }
  } else {
    memoryPrinterProfile = next;
  }
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
  row?.source_variant_label,
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
  row?.source_parent_product_name,
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
const resolveReceiptProductName = (row, fallback = '') => toLabel(
  row?.productBaseName,
  row?.base_product_name,
  row?.source_product_name,
  row?.source_parent_product_name,
  row?.parent_product_name,
  row?.parent_name,
  row?.product?.name,
  row?.sourceProduct?.name,
  row?.source_product?.name,
  row?.productName,
  row?.product,
  row?.product_name,
  row?.name,
  fallback,
);
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
  stock: Number(
    row?.stock ||
    row?.stock_m2 ||
    row?.available_decimal ||
    row?.available_main ||
    0,
  ) || 0,
  min_stock: Number(
    row?.min_stock ||
    row?.minimum_stock ||
    row?.low_stock_threshold ||
    0,
  ) || 0,
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
  ...(() => {
    const sourceMeta = toSourceMeta(row);
    const sideFlags = resolveFinishingSideFlags(row, sourceMeta);
    return {
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
      side_groups: Array.from(new Set([
        ...(Array.isArray(row?.side_groups) ? row.side_groups : []),
        ...(sideFlags.right || sideFlags.left ? ['right_left'] : []),
        ...(sideFlags.top || sideFlags.bottom ? ['top_bottom'] : []),
      ].map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))),
      domain: resolveFinishingDomain(row, sourceMeta),
      payload_key: ['product_id', 'product', 'source_product_id'].includes(
        String(row?.payload_key || row?.pivot?.payload_key || '').trim().toLowerCase(),
      ) || Number(row?.product_id || row?.finishing_product_id || row?.source_product_id || 0) > 0
        ? 'product_id'
        : 'id',
    };
  })(),
});
const isPrintingProductType = (value) => ['advertising', 'printing'].includes(String(value || '').toLowerCase());
const isFinishingCatalogType = (value) => String(value || '').toLowerCase() === 'finishing';
const formatFinishingOptionLabel = (row) => {
  const name = String(row?.name || '').trim();
  const unitHint = String(row?.unit_hint || '').trim().toUpperCase();
  if (!name) {
    return '-';
  }
  if (!unitHint) {
    return name;
  }
  const compactName = name.toUpperCase();
  if (compactName.includes(unitHint)) {
    return name;
  }
  return `${name} (${unitHint})`;
};
const parseBooleanLoose = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const text = normalizeText(value);
  if (['1', 'true', 'yes', 'ya', 'y', 'on', 'enabled', 'aktif'].includes(text)) return true;
  if (['0', 'false', 'no', 'tidak', 'off', 'disabled', 'nonaktif'].includes(text)) return false;
  return null;
};
const containsAnyTerm = (haystack, terms = []) => {
  const text = normalizeText(haystack);
  return terms.some((term) => {
    const token = normalizeText(term);
    return token && text.includes(token);
  });
};
const resolveFinishingDomain = (row, sourceMeta = null) => {
  const meta = sourceMeta && typeof sourceMeta === 'object' && !Array.isArray(sourceMeta)
    ? sourceMeta
    : toSourceMeta(row);
  const sourceProduct = toSourceProduct(row);
  const explicitDomain = normalizeText(
    meta?.finishing_domain
    || meta?.domain
    || row?.finishing_domain
    || row?.domain
    || sourceProduct?.finishing_domain
    || sourceProduct?.domain
    || sourceProduct?.meta?.finishing_domain
    || sourceProduct?.meta?.domain
    || '',
  );
  if (['sticker', 'mmt', 'shared'].includes(explicitDomain)) {
    return explicitDomain;
  }

  const stickerOnly = [
    meta?.sticker_only,
    row?.sticker_only,
    sourceProduct?.sticker_only,
    sourceProduct?.meta?.sticker_only,
  ].map(parseBooleanLoose).find((value) => value !== null);
  if (stickerOnly === true) {
    return 'sticker';
  }

  const mmtOnly = [
    meta?.mmt_only,
    row?.mmt_only,
    sourceProduct?.mmt_only,
    sourceProduct?.meta?.mmt_only,
  ].map(parseBooleanLoose).find((value) => value !== null);
  if (mmtOnly === true) {
    return 'mmt';
  }

  const haystack = [
    row?.name,
    row?.sku,
    meta?.finishing_recommendation_group,
    ...(Array.isArray(meta?.finishing_recommendation_groups) ? meta.finishing_recommendation_groups : []),
    meta?.seed_filter_category,
    meta?.seed_service_name,
    meta?.seed_product_main_name,
    meta?.category_name,
    meta?.product_category_name,
    meta?.main_category_name,
    meta?.main_category,
    meta?.kategori,
    meta?.material_for,
    meta?.material_group,
    meta?.seeded_group,
    sourceProduct?.name,
    sourceProduct?.sku,
  ].filter(Boolean).join(' ');

  const hasStickerToken = containsAnyTerm(haystack, ['sticker', 'stiker']);
  const hasMmtToken = containsAnyTerm(haystack, ['mmt', 'banner', 'frontlite', 'backlite', 'flexi', 'cloth']);
  if (hasStickerToken && !hasMmtToken) {
    return 'sticker';
  }
  if (hasMmtToken && !hasStickerToken) {
    return 'mmt';
  }

  return 'shared';
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
  const sideGroups = Array.isArray(option.side_groups)
    ? option.side_groups.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
    : [];
  if (sideGroups.includes('right_left')) return true;
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
const extractPosConfiguredFinishings = (payload) => {
  const direct = Array.isArray(payload?.pos_finishings) ? payload.pos_finishings : null;
  if (direct) {
    return direct;
  }
  const inData = Array.isArray(payload?.data?.pos_finishings) ? payload.data.pos_finishings : null;
  if (inData) {
    return inData;
  }
  const inProduct = Array.isArray(payload?.product?.pos_finishings) ? payload.product.pos_finishings : null;
  if (inProduct) {
    return inProduct;
  }
  const inDataProduct = Array.isArray(payload?.data?.product?.pos_finishings) ? payload.data.product.pos_finishings : null;
  if (inDataProduct) {
    return inDataProduct;
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
const resolveFixedSizeA3Mode = (product, productDetail = null) => {
  const explicitA3Plus = [
    productDetail?.a3_plus,
    product?.a3_plus,
    productDetail?.data?.a3_plus,
    product?.data?.a3_plus,
  ].find((value) => typeof value === 'boolean');
  const rows = [
    product,
    productDetail,
    toSourceProduct(product),
    toSourceProduct(productDetail),
  ].filter(Boolean);
  const metas = rows.map((row) => {
    const meta = row?.meta;
    return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  });
  const explicitEnabled = rows.some((row) =>
    row?.supports_a3_bottom_negotiation === true
    || row?.is_a3_product === true
    || row?.a3_fixed_size === true
  ) || metas.some((meta) =>
    meta?.supports_a3_bottom_negotiation === true
    || meta?.a3_fixed_size === true
    || meta?.fixed_size_a3 === true
  );
  const label = toLabel(
    ...metas.map((meta) => meta?.size_label || meta?.paper_size || meta?.size_text),
    'A3+',
  );
  const textCandidates = []
    .concat(rows.map((row) => row?.name))
    .concat(rows.map((row) => row?.sku))
    .concat(rows.map((row) => row?.product_type))
    .concat(rows.map((row) => row?.category_name))
    .concat(rows.map((row) => row?.subcategory_name))
    .concat(rows.map((row) => row?.material_name))
    .concat(rows.map((row) => row?.stock_display_unit))
    .concat(metas.map((meta) => meta?.product_type))
    .concat(metas.map((meta) => meta?.configurator))
    .concat(metas.map((meta) => meta?.sales_schema))
    .concat(metas.map((meta) => meta?.material_group))
    .concat(metas.map((meta) => meta?.material_for))
    .concat(metas.map((meta) => meta?.seeded_group))
    .concat(metas.map((meta) => meta?.stock_display_unit))
    .concat(metas.map((meta) => meta?.paper_size))
    .concat(metas.map((meta) => meta?.size_text))
    .concat(metas.map((meta) => meta?.size_label));

  if (explicitA3Plus === false && !explicitEnabled && !textCandidates.some((value) => hasA3Token(value))) {
    return {
      enabled: false,
      label: 'A3+',
      helperText: '',
    };
  }

  if (explicitA3Plus !== true && !explicitEnabled && !textCandidates.some((value) => hasA3Token(value))) {
    return {
      enabled: false,
      label: 'A3+',
      helperText: '',
    };
  }

  const normalizedLabel = hasA3Token(label) ? label : 'A3+';
  return {
    enabled: true,
    label: normalizedLabel,
    helperText: 'Produk A3+ memakai ukuran tetap. Kasir cukup isi qty dan finishing.',
  };
};
const isStrictStickerSalesProduct = (product, productDetail = null) => {
  const explicitA3Plus = [
    productDetail?.a3_plus,
    product?.a3_plus,
    productDetail?.data?.a3_plus,
    product?.data?.a3_plus,
  ].find((value) => typeof value === 'boolean');
  if (explicitA3Plus === true) {
    return false;
  }

  const explicitStrictSticker = [
    productDetail?.strict_sticker,
    product?.strict_sticker,
    productDetail?.data?.strict_sticker,
    product?.data?.strict_sticker,
  ].find((value) => typeof value === 'boolean');
  if (typeof explicitStrictSticker === 'boolean') {
    return explicitStrictSticker;
  }

  const rows = [
    product,
    productDetail,
    toSourceProduct(product),
    toSourceProduct(productDetail),
  ].filter(Boolean);
  const metas = rows.map((row) => {
    const meta = row?.meta;
    return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  });
  const sourceMeta = metas.find((meta) => Object.keys(meta).length > 0) || {};
  const sourceType = String(
    toSourceProduct(productDetail)?.product_type
    || toSourceProduct(product)?.product_type
    || productDetail?.product_type
    || product?.product_type
    || sourceMeta?.product_type
    || ''
  ).trim().toLowerCase();

  if (sourceType === 'book') return false;
  if (String(sourceMeta?.configurator || '').trim().toLowerCase() === 'book') return false;
  if (sourceMeta?.book_category) return false;

  const schema = String(sourceMeta?.sales_schema || '').trim().toLowerCase();
  const enabled = Boolean(sourceMeta?.sticker_sales_enabled);
  if (schema !== 'sticker' && !enabled) return false;

  const categoryHaystack = normalizeText([
    product?.source_category_name,
    product?.source_main_category_name,
    product?.source_subcategory_name,
    sourceMeta?.seed_filter_category,
  ].filter(Boolean).join(' '));
  const identityHaystack = normalizeText([
    product?.name,
    productDetail?.name,
    toSourceProduct(product)?.name,
    toSourceProduct(productDetail)?.name,
    toSourceProduct(product)?.sku,
    toSourceProduct(productDetail)?.sku,
    sourceMeta?.seed_service_name,
    sourceMeta?.seed_product_main_name,
  ].filter(Boolean).join(' '));
  const fullHaystack = `${categoryHaystack} ${identityHaystack}`.trim();

  const looksLikeBook = containsAnyTerm(fullHaystack, ['book', 'buku', 'blueprint']);
  if (looksLikeBook) return false;

  const explicitStickerCategory = containsAnyTerm(categoryHaystack, ['sticker', 'stiker']);
  const explicitStickerIdentity = containsAnyTerm(identityHaystack, ['sticker', 'stiker']);
  const explicitSticker = explicitStickerCategory || explicitStickerIdentity;

  const explicitMmtCategory = containsAnyTerm(categoryHaystack, ['mmt', 'banner', 'frontlite', 'backlite', 'flexi', 'cloth']);
  const explicitMmtIdentity = containsAnyTerm(identityHaystack, ['mmt', 'banner', 'frontlite', 'backlite', 'flexi', 'cloth']);
  if (explicitMmtCategory || (explicitMmtIdentity && !explicitSticker)) return false;

  return explicitSticker;
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
  return `${name}: reseller minimum ${minText} m. Input ${inputText} m tetap boleh, tetapi tagihan mengikuti minimum.`;
};
const resolveStickerBillingNotice = ({
  pricing = null,
  stickerRule = null,
  fallbackInputLengthM = 0,
} = {}) => {
  const billingGroup = String(
    stickerRule?.billing_group
    || pricing?.rule?.billing_group
    || pricing?.price_breakdown?.sticker_billing_group
    || ''
  ).trim().toUpperCase();
  const designLengthM = Number(
    stickerRule?.design_length_m
    || pricing?.rule?.design_length_m
    || pricing?.price_breakdown?.sticker_design_length_m
    || fallbackInputLengthM
    || 0
  );
  const billedLengthM = Number(
    stickerRule?.billed_length_m
    || pricing?.rule?.billed_length_m
    || pricing?.price_breakdown?.sticker_billed_length_m
    || 0
  );
  const minLengthM = Number(
    stickerRule?.billing_min_length_m
    || pricing?.rule?.billing_min_length_m
    || pricing?.price_breakdown?.sticker_billing_min_length_m
    || 0
  );

  if (billingGroup === 'ROLL_STICKER' && designLengthM > 0 && billedLengthM > designLengthM && minLengthM > 0) {
    return `Aturan reseller: input ${formatMeterNumber(designLengthM)} m, tagih ${formatMeterNumber(billedLengthM)} m minimum.`;
  }

  if (billingGroup === 'ROLL_FREE_LENGTH' && designLengthM > 0) {
    return `Aturan retail: panjang mengikuti input ${formatMeterNumber(designLengthM)} m.`;
  }

  return '';
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
  const isStickerSchema = isStrictStickerSalesProduct(product, productDetail);
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
  const explicitMaterialStockRaw =
    pricing?.rule?.selected_material_stock ??
    pricing?.note?.material_stock;
  const explicitMaterialMinStockRaw =
    pricing?.rule?.selected_material_min_stock ??
    pricing?.note?.material_min_stock;
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
    ? ('Roll ' + selectedWidthM.toFixed(2) + ' m')
    : '';
  const materialName = String(names[0] || fallbackMaterialInfo?.displayText || '').trim();
  const displayText = [materialName, widthText].filter(Boolean).join(' | ');
  const primaryRow = materialRows[0] || null;
  const materialStock = Number(
    pricing?.rule?.selected_material_stock ??
    pricing?.note?.material_stock ??
    primaryRow?.stock ??
    primaryRow?.stock_m2 ??
    primaryRow?.available_decimal ??
    primaryRow?.available_main ??
    0,
  ) || 0;
  const materialMinStock = Number(
    pricing?.rule?.selected_material_min_stock ??
    pricing?.note?.material_min_stock ??
    primaryRow?.min_stock ??
    primaryRow?.minimum_stock ??
    primaryRow?.low_stock_threshold ??
    0,
  ) || 0;
  return {
    materialIds: resolvedIds,
    primaryMaterialId: resolvedIds[0] || fallbackMaterialInfo?.primaryMaterialId || null,
    displayText: displayText || '-',
    materialName: materialName || '-',
    materialStock,
    materialMinStock,
    hasExplicitMaterialStock: explicitMaterialStockRaw !== undefined && explicitMaterialStockRaw !== null && explicitMaterialStockRaw !== '',
    hasExplicitMaterialMinStock: explicitMaterialMinStockRaw !== undefined && explicitMaterialMinStockRaw !== null && explicitMaterialMinStockRaw !== '',
  };
};
const buildSelectedMaterialStockMessage = (usedMaterialInfo, productName = '') => {
  const materialName = String(
    usedMaterialInfo?.materialName ||
    usedMaterialInfo?.displayText ||
    'material',
  ).trim();
  const targetProduct = String(productName || '').trim();
  const stock = Number(usedMaterialInfo?.materialStock || 0) || 0;
  const minStock = Number(usedMaterialInfo?.materialMinStock || 0) || 0;
  const lines = [];
  if (stock <= 0) {
    lines.push('Stok material tidak tersedia. Item tetap bisa disimpan sebagai draft sementara.');
  } else {
    lines.push('Stok material sudah menyentuh batas minimum. Item sebaiknya disimpan dulu sebagai draft.');
  }
  if (targetProduct) {
    lines.push('Produk: ' + targetProduct + '.');
  }
  if (materialName) {
    lines.push('Material: ' + materialName + '.');
  }
  lines.push('Stok saat ini: ' + formatMeterNumber(stock) + '.');
  if (minStock > 0) {
    lines.push('Batas minimum: ' + formatMeterNumber(minStock) + '.');
  }
  lines.push('Jika bahan masih menunggu disiapkan, lanjutkan dengan Simpan Draft.');
  return lines.join('\n');
};
const buildSelectedMaterialLowStockWarning = (usedMaterialInfo, productName = '') => {
  const materialName = String(
    usedMaterialInfo?.materialName ||
    usedMaterialInfo?.displayText ||
    'material',
  ).trim();
  const targetProduct = String(productName || '').trim();
  const stock = Number(usedMaterialInfo?.materialStock || 0) || 0;
  const minStock = Number(usedMaterialInfo?.materialMinStock || 0) || 0;
  if (stock <= 0 || minStock <= 0 || stock > minStock) {
    return '';
  }
  const lines = ['Peringatan stok material: stok sudah menyentuh batas minimum.'];
  if (targetProduct) {
    lines.push('Produk: ' + targetProduct + '.');
  }
  if (materialName) {
    lines.push('Material: ' + materialName + '.');
  }
  lines.push('Stok saat ini: ' + formatMeterNumber(stock) + '.');
  lines.push('Batas minimum: ' + formatMeterNumber(minStock) + '.');
  return lines.join('\n');
};
const validateSelectedMaterialStock = (usedMaterialInfo, productName = '') => {
  if (!usedMaterialInfo?.hasExplicitMaterialStock) {
    return '';
  }
  const stock = Number(usedMaterialInfo?.materialStock || 0) || 0;
  if (stock <= 0) {
    return buildSelectedMaterialStockMessage(usedMaterialInfo, productName);
  }
  return '';
};
const resolveSelectedMaterialWarning = (usedMaterialInfo, productName = '') => {
  if (!usedMaterialInfo?.hasExplicitMaterialStock) {
    return '';
  }
  const stock = Number(usedMaterialInfo?.materialStock || 0) || 0;
  if (stock <= 0) {
    return buildSelectedMaterialStockMessage(usedMaterialInfo, productName);
  }
  return buildSelectedMaterialLowStockWarning(usedMaterialInfo, productName);
};
const PAYMENT_METHOD_LABELS = ['Cash', 'Transfer', 'QRIS', 'Card'];
const DEFAULT_CASH_FLOW_QUICK_CATEGORIES = {
  expense: [
    'Beli ATK',
    'Beli konsumsi',
    'Beli galon',
    'Operasional mendadak',
    'Ambil owner',
    'Biaya kurir',
  ],
  income: [
    'Titipan uang',
    'Pengembalian supplier',
    'Tambahan modal kas',
    'Setoran lain',
    'Penerimaan operasional',
  ],
};
const DEFAULT_RECEIPT_LOGO_MODULE = require('../../assets/logo-sidomulyo.png');
const DEFAULT_RECEIPT_SETTINGS = {
  brand_name: 'POS Kasir',
  brand_tagline: '',
  receipt_logo_url: '',
  receipt_title: 'Nota Penjualan',
  receipt_store_address: '',
  receipt_store_phone: '',
  receipt_header_text: '',
  receipt_footer: 'Terima kasih sudah berbelanja.',
  receipt_show_order_id: true,
  receipt_show_cashier: true,
  receipt_show_customer: true,
  receipt_show_payment_detail: true,
};
const resolveDefaultReceiptLogoUrl = () => {
  try {
    return String(Asset.fromModule(DEFAULT_RECEIPT_LOGO_MODULE)?.uri || '').trim();
  } catch (_error) {
    return '';
  }
};
const normalizeReceiptSettings = (value = null) => {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const nested = raw?.receipt && typeof raw.receipt === 'object' && !Array.isArray(raw.receipt) ? raw.receipt : {};
  const resolvedLogoUrl = toLabel(
    raw.receipt_logo_url,
    raw.brand_logo,
    raw.logo_url,
    raw.logo,
    nested.logo_url,
    nested.logo,
    DEFAULT_RECEIPT_SETTINGS.receipt_logo_url,
  );
  return {
    brand_name: toLabel(raw.brand_name, nested.brand_name, DEFAULT_RECEIPT_SETTINGS.brand_name),
    brand_tagline: toLabel(raw.brand_tagline, nested.brand_tagline, DEFAULT_RECEIPT_SETTINGS.brand_tagline),
    receipt_logo_url: resolvedLogoUrl || resolveDefaultReceiptLogoUrl(),
    receipt_title: toLabel(raw.receipt_title, nested.title, DEFAULT_RECEIPT_SETTINGS.receipt_title),
    receipt_store_address: toLabel(raw.receipt_store_address, nested.store_address, DEFAULT_RECEIPT_SETTINGS.receipt_store_address),
    receipt_store_phone: toLabel(raw.receipt_store_phone, nested.store_phone, DEFAULT_RECEIPT_SETTINGS.receipt_store_phone),
    receipt_header_text: toLabel(raw.receipt_header_text, nested.header_text, DEFAULT_RECEIPT_SETTINGS.receipt_header_text),
    receipt_footer: toLabel(raw.receipt_footer, nested.footer, DEFAULT_RECEIPT_SETTINGS.receipt_footer),
    receipt_show_order_id: raw.receipt_show_order_id ?? nested.show_order_id ?? DEFAULT_RECEIPT_SETTINGS.receipt_show_order_id,
    receipt_show_cashier: raw.receipt_show_cashier ?? nested.show_cashier ?? DEFAULT_RECEIPT_SETTINGS.receipt_show_cashier,
    receipt_show_customer: raw.receipt_show_customer ?? nested.show_customer ?? DEFAULT_RECEIPT_SETTINGS.receipt_show_customer,
    receipt_show_payment_detail: raw.receipt_show_payment_detail ?? nested.show_payment_detail ?? DEFAULT_RECEIPT_SETTINGS.receipt_show_payment_detail,
  };
};

const normalizePaymentMethodLabel = (value) => {
  const text = normalizeText(value);
  if (['cash', 'tunai'].includes(text)) return 'Cash';
  if (['transfer', 'bank transfer'].includes(text)) return 'Transfer';
  if (['qris', 'qr'].includes(text)) return 'QRIS';
  if (['card', 'kartu', 'debit', 'credit card'].includes(text)) return 'Card';
  return value;
};
const humanizePaymentMethod = (value) => {
  const normalized = normalizePaymentMethodLabel(value);
  const text = String(normalized || '').trim();
  return text || 'Lainnya';
};
const formatCashFlowSourceLabel = (value) => {
  const source = String(value || '').trim().toLowerCase();
  if (source === 'backend') return 'Backend';
  if (source === 'recent') return 'Riwayat';
  if (source === 'fallback') return 'Cepat';
  if (source === 'manual') return 'Manual';
  return 'Custom';
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
  const detail = toLabel(
    row?.detail,
    row?.payment_detail,
    row?.description,
    row?.keterangan,
  );
  const displayTitle = [code, accountName].filter(Boolean).join(' - ')
    || accountName
    || bankName
    || label
    || `Bank #${id}`;
  const subtitleParts = [];
  if (bankName && !displayTitle.toLowerCase().includes(bankName.toLowerCase())) {
    subtitleParts.push(bankName);
  }
  if (accountNumber) {
    subtitleParts.push(`No Rek: ${accountNumber}`);
  }
  const displaySubtitle = subtitleParts.join(' | ');
  const displayDetail = detail && detail !== displaySubtitle ? detail : '';
  const displayName = label || displayTitle;
  const paymentType = normalizeText(
    row?.type
    || row?.account_type
    || row?.payment_type
    || '',
  );
  return {
    ...row,
    id,
    label,
    code,
    bankName,
    accountName,
    accountNumber,
    detail,
    displayTitle,
    displaySubtitle,
    displayDetail,
    displayName,
    paymentType,
  };
};
const isDraftCandidate = (row) => {
  const status = String(row?.status || '').trim().toLowerCase();
  if (status === 'draft') {
    return true;
  }
  const notes = String(row?.notes || '').toLowerCase();
  if (!notes.includes('mode: simpan draft')) {
    return false;
  }
  return !notes.includes('mode: proses orderan');
};
const resolveAppVersionLabel = () => {
  const raw = appEnv.appVersion;
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
  if (!notes.includes('mode: simpan draft')) {
    return false;
  }
  return !notes.includes('mode: proses orderan');
};

const stripWorkflowSystemNotes = (value) => {
  const text = String(value || '');
  if (!text.trim()) {
    return '';
  }
  return text
    .split(/\r?\n/)
    .map((line) => String(line || '').trim())
    .filter((line) => line && !/^customer\s*:/i.test(line))
    .filter((line) => line && !/^tanggal order\s*:/i.test(line))
    .filter((line) => line && !/^mode\s*:/i.test(line))
    .filter((line) => line && !/^lanjutan draft id\s*:/i.test(line))
    .filter((line) => line && !/^diskon order\s*:/i.test(line))
    .map((line) => line.replace(/^catatan\s*:\s*/i, '').trim())
    .filter(Boolean)
    .join('\n');
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
  const [negotiatedPriceInput, setNegotiatedPriceInput] = useState('');
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
  const [draftTimeTick, setDraftTimeTick] = useState(() => Date.now());
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [receivableStatusFilter, setReceivableStatusFilter] = useState('all');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [isDraftLoading, setIsDraftLoading] = useState(false);
  const [isDeletingDraftId, setIsDeletingDraftId] = useState(null);
  const [productionRows, setProductionRows] = useState([]);
  const [isProductionLoading, setIsProductionLoading] = useState(false);
  const [productionStatusFilter, setProductionStatusFilter] = useState('all');
  const [productionSearch, setProductionSearch] = useState('');
  const [updatingProductionItemId, setUpdatingProductionItemId] = useState(null);
  const [closingReportDate, setClosingReportDate] = useState(formatIsoDate(new Date()));
  const [closingReport, setClosingReport] = useState(null);
  const [closingRecord, setClosingRecord] = useState(null);
  const [isClosingReportLoading, setIsClosingReportLoading] = useState(false);
  const [financeRecipients, setFinanceRecipients] = useState([]);
  const [isFinanceRecipientsLoading, setIsFinanceRecipientsLoading] = useState(false);
  const [cashFlowTypes, setCashFlowTypes] = useState([]);
  const [isCashFlowTypesLoading, setIsCashFlowTypesLoading] = useState(false);
  const [cashFlowRows, setCashFlowRows] = useState([]);
  const [isCashFlowRowsLoading, setIsCashFlowRowsLoading] = useState(false);
  const [cashFlowTransactionType, setCashFlowTransactionType] = useState('expense');
  const [cashFlowHistoryFilter, setCashFlowHistoryFilter] = useState('all');
  const [cashFlowTypeId, setCashFlowTypeId] = useState(null);
  const [cashFlowCategory, setCashFlowCategory] = useState('');
  const [cashFlowAmount, setCashFlowAmount] = useState('');
  const [cashFlowNote, setCashFlowNote] = useState('');
  const [isCashFlowSubmitting, setIsCashFlowSubmitting] = useState(false);
  const [isClosingSubmitLoading, setIsClosingSubmitLoading] = useState(false);
  const [closingOpeningCash, setClosingOpeningCash] = useState('');
  const [closingActualCash, setClosingActualCash] = useState('');
  const [closingFinanceRecipientId, setClosingFinanceRecipientId] = useState(null);
  const [closingFinanceRecipient, setClosingFinanceRecipient] = useState('');
  const [closingShiftNote, setClosingShiftNote] = useState('');
  const [damageProductSearch, setDamageProductSearch] = useState('');
  const [selectedDamageProductId, setSelectedDamageProductId] = useState(null);
  const [damageQtyInput, setDamageQtyInput] = useState('1');
  const [damageNoteInput, setDamageNoteInput] = useState('');
  const [closingDamageItems, setClosingDamageItems] = useState([]);

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
  const [previewFallbackBottomPrice, setPreviewFallbackBottomPrice] = useState(0);
  const [previewMaterialDisplay, setPreviewMaterialDisplay] = useState('');
  const [previewMaterialError, setPreviewMaterialError] = useState('');
  const [previewMaterialWarning, setPreviewMaterialWarning] = useState('');
  const [previewPricingSummary, setPreviewPricingSummary] = useState(null);
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
  const [posSettings, setPosSettings] = useState(DEFAULT_RECEIPT_SETTINGS);
  const [printerProfile, setPrinterProfile] = useState(() => loadStoredPrinterProfile() || getDefaultPrinterProfile());
  const [hasSavedPrinterProfile, setHasSavedPrinterProfile] = useState(() => Boolean(loadStoredPrinterProfile()));
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState(null);
  const selectedBankAccountRow = useMemo(
    () => bankAccounts.find((row) => Number(row?.id || 0) === Number(selectedBankAccountId || 0)) || null,
    [bankAccounts, selectedBankAccountId],
  );
  const paymentMethodHelperText = useMemo(() => {
    const method = mapPaymentMethodToBackend(paymentMethod);
    const selectedAccountName = String(
      selectedBankAccountRow?.displayTitle
      || selectedBankAccountRow?.displayName
      || ''
    ).trim();

    if (method === 'cash') {
      return selectedAccountName
        ? `Pembayaran tunai akan otomatis masuk ke akun kas penjualan: ${selectedAccountName}.`
        : 'Pembayaran tunai akan otomatis masuk ke akun kas penjualan sesuai mapping backend.';
    }

    if (method === 'qris') {
      return selectedAccountName
        ? `Pembayaran QRIS akan otomatis dicatat ke rekening/akun tujuan: ${selectedAccountName}.`
        : 'Pembayaran QRIS akan otomatis dicatat ke rekening/akun tujuan sesuai mapping backend.';
    }

    if (method === 'card') {
      return selectedAccountName
        ? `Pembayaran kartu akan otomatis dicatat ke akun penampung: ${selectedAccountName}.`
        : 'Pembayaran kartu akan otomatis dicatat ke akun penampung sesuai mapping backend.';
    }

    return selectedAccountName
      ? `Pembayaran transfer akan otomatis dicatat ke rekening tujuan: ${selectedAccountName}.`
      : 'Pembayaran transfer akan otomatis dicatat ke rekening tujuan sesuai mapping backend.';
  }, [paymentMethod, selectedBankAccountRow]);
  const [receivablePaymentModal, setReceivablePaymentModal] = useState({
    visible: false,
    orderId: 0,
    invoiceId: 0,
    invoiceNo: '',
    customerName: 'Pelanggan umum',
    customerPhone: '',
    dueTotal: 0,
    amount: '',
    method: 'Cash',
    selectedAccountId: null,
    accountOptions: [],
    isLoadingAccounts: false,
    isSubmitting: false,
  });
  const selectedReceivableAccountRow = useMemo(
    () => (Array.isArray(receivablePaymentModal.accountOptions) ? receivablePaymentModal.accountOptions : [])
      .find((row) => Number(row?.id || 0) === Number(receivablePaymentModal.selectedAccountId || 0)) || null,
    [receivablePaymentModal.accountOptions, receivablePaymentModal.selectedAccountId],
  );
  const receivablePaymentHelperText = useMemo(() => {
    const method = mapPaymentMethodToBackend(receivablePaymentModal.method);
    const selectedAccountName = String(
      selectedReceivableAccountRow?.displayTitle
      || selectedReceivableAccountRow?.displayName
      || ''
    ).trim();
    if (method === 'cash') {
      return selectedAccountName
        ? `Pelunasan tunai akan masuk ke akun kas: ${selectedAccountName}.`
        : 'Pelunasan tunai akan masuk ke akun kas yang dipilih.';
    }
    if (method === 'qris') {
      return selectedAccountName
        ? `Pelunasan QRIS akan dicatat ke rekening tujuan: ${selectedAccountName}.`
        : 'Pelunasan QRIS akan dicatat ke rekening tujuan yang dipilih.';
    }
    if (method === 'card') {
      return selectedAccountName
        ? `Pelunasan kartu akan dicatat ke akun penampung: ${selectedAccountName}.`
        : 'Pelunasan kartu akan dicatat ke akun penampung yang dipilih.';
    }
    return selectedAccountName
      ? `Pelunasan transfer akan dicatat ke rekening tujuan: ${selectedAccountName}.`
      : 'Pelunasan transfer akan dicatat ke rekening tujuan yang dipilih.';
  }, [receivablePaymentModal.method, selectedReceivableAccountRow]);
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
    note: '',
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
  const activePrinterProfile = useMemo(
    () => normalizePrinterProfile(printerProfile || getDefaultPrinterProfile()),
    [printerProfile],
  );
  const printerStatusTone = hasSavedPrinterProfile ? 'active' : 'fallback';
  const printerStatusLabel = hasSavedPrinterProfile ? 'Printer Kasir Aktif' : 'Fallback Browser';
  const printerTargetSummary = useMemo(() => {
    if (!hasSavedPrinterProfile) {
      return {
        primary: 'Browser Print',
        secondary: 'Popup browser standar',
      };
    }
    const profile = activePrinterProfile;
    if (profile.connection === 'lan' || profile.connection === 'wifi') {
      return {
        primary: `${String(profile.connection || '').toUpperCase()} Thermal`,
        secondary: `${profile.ipAddress || '-'}:${profile.port || 9100}`,
      };
    }
    if (profile.connection === 'qz_tray') {
      return {
        primary: 'QZ Tray',
        secondary: profile.printerName || profile.name || 'Printer belum dipilih',
      };
    }
    if (profile.connection === 'local_service') {
      return {
        primary: 'Local Service',
        secondary: profile.printerName || profile.name || 'Service printer lokal',
      };
    }
    if (profile.connection === 'bluetooth') {
      return {
        primary: 'Bluetooth',
        secondary: profile.printerName || profile.name || 'Printer bluetooth',
      };
    }
    if (profile.connection === 'usb') {
      return {
        primary: 'USB Printer',
        secondary: profile.printerName || profile.name || 'Printer USB',
      };
    }
    return {
      primary: 'Browser Print',
      secondary: profile.name || 'Popup browser standar',
    };
  }, [activePrinterProfile, hasSavedPrinterProfile]);
  const printerProfileSummary = useMemo(() => {
    if (!hasSavedPrinterProfile) {
      return 'Belum ada printer kasir khusus. Cetak akan tetap memakai popup browser biasa.';
    }
    const profile = activePrinterProfile;
    const target = profile.connection === 'lan' || profile.connection === 'wifi'
      ? `${profile.ipAddress || '-'}:${profile.port || 9100}`
      : (profile.printerName || profile.connection || '-');
    return `${profile.name} | ${profile.type} | ${profile.paperWidth} | ${target}`;
  }, [activePrinterProfile, hasSavedPrinterProfile]);
  const printerPaperSummary = useMemo(() => {
    const profile = activePrinterProfile;
    const paperLabel = profile.paperWidth === 'custom'
      ? 'Custom / Browser'
      : profile.paperWidth === '58mm'
        ? 'Thermal 58mm'
        : 'Thermal 80mm';
    return `${paperLabel} | ${profile.charsPerLine || '-'} karakter per baris`;
  }, [activePrinterProfile]);

  const handlePrinterProfileChange = (nextProfile) => {
    const defaultProfile = getDefaultPrinterProfile();
    const normalized = normalizePrinterProfile({
      ...createPrinterProfile({
        id: activePrinterProfile?.id || defaultProfile.id,
        name: activePrinterProfile?.name || defaultProfile.name,
        type: activePrinterProfile?.type || defaultProfile.type,
        connection: activePrinterProfile?.connection || defaultProfile.connection,
      }),
      ...(nextProfile || {}),
    });
    setPrinterProfile(normalized);
    setHasSavedPrinterProfile(true);
    persistPrinterProfile(normalized);
  };
  const handleResetPrinterToBrowser = () => {
    const fallbackProfile = getDefaultPrinterProfile();
    setPrinterProfile(fallbackProfile);
    setHasSavedPrinterProfile(false);
    persistPrinterProfile(null);
    openNotice('Printer Kasir', 'Printer kasir khusus dinonaktifkan. Cetak kembali memakai browser print.', null, {
      autoCloseMs: 2200,
    });
  };
  const handleRestoreRecommendedPrinterDefaults = () => {
    const recommended = normalizePrinterProfile({
      ...getDefaultPrinterProfile(),
      name: 'Thermal 80mm',
    });
    setPrinterProfile(recommended);
    setHasSavedPrinterProfile(false);
    persistPrinterProfile(null);
    openNotice('Printer Kasir', 'Form printer dikembalikan ke default Thermal 80mm.', null, {
      autoCloseMs: 2200,
    });
  };
  const confirmDisablePrinterProfile = () => {
    if (!hasSavedPrinterProfile) {
      handleRestoreRecommendedPrinterDefaults();
      return;
    }
    openNoticeActions(
      'Nonaktifkan Printer Kasir',
      'Cetak thermal/QZ/LAN akan dimatikan dan transaksi kembali memakai popup browser. Lanjutkan?',
      [
        { label: 'Batal', role: 'secondary' },
        { label: 'Nonaktifkan', role: 'danger', onPress: handleResetPrinterToBrowser },
      ],
    );
  };

  const loadClosingReport = async (overrideDate = null) => {
    const reportDate = String(overrideDate || closingReportDate || formatIsoDate(new Date())).trim();
    if (!reportDate) {
      openNotice('Laporan Close Order', 'Tanggal laporan wajib diisi.');
      return;
    }
    if (!backendReady) {
      setClosingReport(null);
      return;
    }
    try {
      setIsClosingReportLoading(true);
      const payload = await fetchPosClosingSummary({ date: reportDate });
      setClosingReport(payload && typeof payload === 'object' ? payload : null);
    } catch (error) {
      setClosingReport(null);
      openNotice('Laporan Close Order', `Gagal memuat laporan closing: ${error.message}`);
    } finally {
      setIsClosingReportLoading(false);
    }
  };

  const loadFinanceRecipients = async () => {
    if (!backendReady) {
      setFinanceRecipients([]);
      return;
    }
    try {
      setIsFinanceRecipientsLoading(true);
      const rows = await fetchPosFinanceRecipients();
      const normalizedRows = (Array.isArray(rows) ? rows : [])
        .filter((row) => normalizeText(row?.role_name) === 'admin_keuangan')
        .map((row) => ({
          ...row,
          id: Number(row?.id || 0),
          name: String(row?.name || '').trim(),
          email: String(row?.email || '').trim(),
          outletName: String(row?.outlet_name || '').trim(),
        }))
        .filter((row) => row.id > 0 && row.name);
      setFinanceRecipients(normalizedRows);
      if (!(Number(closingFinanceRecipientId || 0) > 0) && normalizedRows.length > 0) {
        setClosingFinanceRecipientId(normalizedRows[0].id);
        setClosingFinanceRecipient(normalizedRows[0].name);
      }
    } catch (error) {
      setFinanceRecipients([]);
      openNotice('Laporan Close Order', `Gagal memuat admin keuangan: ${error.message}`);
    } finally {
      setIsFinanceRecipientsLoading(false);
    }
  };

  const loadCloserOrderRecord = async (overrideDate = null) => {
    const reportDate = String(overrideDate || closingReportDate || formatIsoDate(new Date())).trim();
    if (!backendReady) {
      setClosingRecord(null);
      return;
    }
    try {
      const payload = await fetchPosCloserOrder({ date: reportDate });
      const row = payload && typeof payload === 'object' ? payload : null;
      setClosingRecord(row);
      if (row) {
        setClosingOpeningCash(sanitizeCurrencyInput(String(Math.max(0, Number(row?.opening_cash || 0)))));
        setClosingActualCash(sanitizeCurrencyInput(String(Math.max(0, Number(row?.cashier_actual_cash || 0)))));
        setClosingFinanceRecipientId(Number(row?.finance_user?.id || 0) || null);
        setClosingFinanceRecipient(String(row?.finance_user?.name || '').trim());
        setClosingShiftNote(String(row?.cashier_note || '').trim());
        setClosingDamageItems(
          (Array.isArray(row?.damage_items) ? row.damage_items : []).map((item) => ({
            id: Number(item?.id || 0) || `damage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            productId: Number(item?.product_id || 0) || null,
            productName: String(item?.product_name || '').trim(),
            qty: Math.max(0, Number(item?.qty || 0)) || 0,
            note: String(item?.cashier_note || '').trim(),
            estimatedTotalValue: roundMoney(Number(item?.estimated_total_value || 0)),
            auditStatus: String(item?.audit_status || 'reported'),
            responsibility: String(item?.responsibility || ''),
          })),
        );
      } else {
        setClosingDamageItems([]);
      }
    } catch (_error) {
      setClosingRecord(null);
    }
  };

  const loadCashFlowTypes = async (transactionType = null) => {
    if (!backendReady) {
      setCashFlowTypes([]);
      return;
    }
    try {
      setIsCashFlowTypesLoading(true);
      const rows = await fetchPosCashFlowTypes({
        type: transactionType || cashFlowTransactionType || '',
        active_only: true,
      });
      setCashFlowTypes(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setCashFlowTypes([]);
      openNotice('Kas Masuk / Keluar', `Gagal memuat tipe transaksi: ${error.message}`);
    } finally {
      setIsCashFlowTypesLoading(false);
    }
  };

  const loadCashFlowRows = async (overrideDate = null) => {
    const reportDate = String(overrideDate || closingReportDate || formatIsoDate(new Date())).trim();
    if (!backendReady) {
      setCashFlowRows([]);
      return;
    }
    try {
      setIsCashFlowRowsLoading(true);
      const payload = await fetchPosCashFlows({
        date_from: reportDate,
        date_to: reportDate,
        per_page: 20,
      });
      const rows = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
      setCashFlowRows(rows);
    } catch (error) {
      setCashFlowRows([]);
      openNotice('Kas Masuk / Keluar', `Gagal memuat riwayat kas: ${error.message}`);
    } finally {
      setIsCashFlowRowsLoading(false);
    }
  };

  const loadClosingWorkspace = async (overrideDate = null) => {
    const reportDate = String(overrideDate || closingReportDate || formatIsoDate(new Date())).trim();
    await Promise.all([
      loadClosingReport(reportDate),
      loadCashFlowRows(reportDate),
      loadCloserOrderRecord(reportDate),
      loadFinanceRecipients(),
    ]);
  };

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
  const normalizeOrderDetailRow = (payload, fallbackRow = null) => {
    const detailData = payload?.data && typeof payload.data === 'object' ? payload.data : null;
    const nestedOrder = detailData?.order && typeof detailData.order === 'object' ? detailData.order : null;
    const detailRow = Array.isArray(payload)
      ? payload[0]
      : (detailData && !Array.isArray(detailData) ? detailData : payload);
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
    if (!detailRow || typeof detailRow !== 'object') {
      return fallbackRow;
    }
    return {
      ...(fallbackRow && typeof fallbackRow === 'object' ? fallbackRow : {}),
      ...(nestedOrder || {}),
      ...detailRow,
      customer: detailRow?.customer || nestedOrder?.customer || fallbackRow?.customer || null,
      invoice: detailRow?.invoice || nestedOrder?.invoice || fallbackRow?.invoice || null,
      pickup: detailRow?.pickup || nestedOrder?.pickup || fallbackRow?.pickup || null,
      production: detailRow?.production || nestedOrder?.production || fallbackRow?.production || null,
      payment: detailRow?.payment || nestedOrder?.payment || fallbackRow?.payment || null,
      items: detailItems.length > 0
        ? detailItems
        : (Array.isArray(fallbackRow?.items) ? fallbackRow.items : []),
    };
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
    const paymentTargetName = String(
      selectedBankAccountRow?.displayTitle
      || selectedBankAccountRow?.displayName
      || ''
    ).trim();
    return {
      draftNo: currentDraftSourceId ? `DRF-${currentDraftSourceId}` : '-',
      transactionDate,
      customerName: String(selectedCustomer?.name || 'Pelanggan umum'),
      customerPhone: String(selectedCustomer?.phone || selectedCustomer?.mobile || selectedCustomer?.whatsapp || '-'),
      cashierName: String(currentUser?.name || 'Kasir'),
      paymentMethod: normalizePaymentMethodLabel(paymentMethod),
      paymentTargetName,
      paymentStatus,
      paymentAmount: paidAmount,
      discountAmount: finalDiscount,
      subtotal,
      grandTotal,
      notes: paymentNotes || '-',
      items: cartItems.map((item, index) => ({
        no: index + 1,
        product: String(resolveReceiptProductName(item, item?.product || '-') || '-'),
        qty: Number(item?.qty || 0),
        price: Number(
          item?.pricingSummary?.grandTotal
          || item?.pricingSummary?.printSubtotal
          || item?.lineTotal
          || item?.total
          || 0,
        ) / Math.max(Number(item?.qty || 0) || 1, 1),
        size: String(item?.size || '-'),
        finishing: String(item?.finishing || '-'),
        lbMax: String(item?.lbMax || '-'),
        material: String(item?.material || '-'),
        pages: Math.max(Number(item?.pages || 1) || 1, 1),
        note: String(item?.note || item?.notes || '-'),
        total: Number(item?.total || item?.lineTotal || 0),
      })),
    };
  };

  const formatClipboardMoney = (value) => formatRupiah(Number(value || 0) || 0);

  const appendClipboardSection = (lines, title, values = []) => {
    lines.push(title);
    values.filter(Boolean).forEach((value) => lines.push(value));
    lines.push('');
  };

  const buildInvoiceClipboardText = (receiptData, options = {}) => {
    const estimatedDoneAt = String(options?.estimatedDoneAt || '-').trim() || '-';
    const customerPhone = String(options?.customerPhone || '-').trim() || '-';
    const items = Array.isArray(receiptData?.items) ? receiptData.items : [];
    const orderNotes = String(receiptData?.transaction?.notes || '').trim();
    const paidAmount = Number(receiptData?.summary?.paid || 0) || 0;
    const remainingDue = Number(receiptData?.summary?.remainingDue || 0) || 0;
    const paymentAmountLabel = remainingDue > 0
      ? 'DP'
      : (paidAmount > 0 ? 'Pembayaran' : 'Bayar');
    const lines = [];

    appendClipboardSection(lines, 'INVOICE', [
      `No. Invoice: ${receiptData?.transaction?.invoiceNo || '-'}`,
      `Tanggal: ${receiptData?.transaction?.date || '-'}`,
      `Pelanggan: ${receiptData?.transaction?.customer || '-'}`,
      `No. HP: ${customerPhone}`,
      `Status Pembayaran: ${receiptData?.transaction?.paymentStatus || '-'}`,
      `Metode Pembayaran: ${receiptData?.payment?.method || '-'}`,
      `Estimasi Selesai: ${estimatedDoneAt}`,
      ...(orderNotes ? [`Catatan: ${orderNotes}`] : []),
    ]);

    appendClipboardSection(lines, 'DETAIL PESANAN', items.flatMap((item, index) => ([
      `${index + 1}. ${item?.name || '-'}`,
      `   Qty: ${item?.qty || 0}`,
      `   Ukuran: ${item?.size || '-'}`,
      `   Bahan: ${item?.material || '-'}`,
      `   Finishing: ${item?.finishing || '-'}`,
      `   Catatan: ${item?.notes || '-'}`,
      `   Harga: ${formatClipboardMoney(item?.price || 0)}`,
      `   Subtotal: ${formatClipboardMoney(item?.total || 0)}`,
      ...(item?.pages > 1 ? [`   Halaman: ${item.pages}`] : []),
    ])));

    appendClipboardSection(lines, 'RINGKASAN PEMBAYARAN', [
      `Subtotal: ${formatClipboardMoney(receiptData?.summary?.subtotal || 0)}`,
      `Total: ${formatClipboardMoney(receiptData?.summary?.grandTotal || 0)}`,
      `${paymentAmountLabel}: ${formatClipboardMoney(paidAmount)}`,
      `Sisa Bayar: ${formatClipboardMoney(remainingDue)}`,
    ]);

    return lines.join('\n').trim();
  };

  const buildOrderClipboardText = (snapshot, options = {}) => {
    const estimatedDoneAt = String(options?.estimatedDoneAt || '-').trim() || '-';
    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    const lines = [];

    appendClipboardSection(lines, 'DETAIL PESANAN', [
      `No. Invoice: ${snapshot?.invoiceNo || snapshot?.draftNo || '-'}`,
      `Tanggal: ${snapshot?.transactionDate || '-'}`,
      `Pelanggan: ${snapshot?.customerName || '-'}`,
      `No. HP: ${snapshot?.customerPhone || '-'}`,
      `Estimasi Selesai: ${estimatedDoneAt}`,
    ]);

    items.forEach((item, index) => {
      lines.push(`${index + 1}. ${item?.product || '-'}`);
      lines.push(`   Qty: ${item?.qty || 0}`);
      lines.push(`   Ukuran: ${item?.size || '-'}`);
      lines.push(`   Bahan: ${item?.material || '-'}`);
      lines.push(`   Finishing: ${item?.finishing || '-'}`);
      lines.push(`   Catatan: ${item?.note || '-'}`);
      if (Number(item?.pages || 0) > 1) {
        lines.push(`   Halaman: ${item.pages}`);
      }
      lines.push(`   Harga: ${formatClipboardMoney(item?.price || 0)}`);
      lines.push(`   Subtotal: ${formatClipboardMoney(item?.total || 0)}`);
      lines.push('');
    });

    return lines.join('\n').trim();
  };

  const copyTextToClipboard = async (text) => {
    const value = String(text || '').trim();
    if (!value) {
      throw new Error('Teks yang akan disalin kosong.');
    }

    if (typeof globalThis?.navigator?.clipboard?.writeText === 'function') {
      await globalThis.navigator.clipboard.writeText(value);
      return;
    }

    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return;
    }

    throw new Error('Clipboard tidak tersedia di environment ini.');
  };

  const handleCopyOrderSnapshot = async (snapshot, noticeTitle = 'Salin Pesanan') => {
    try {
      await copyTextToClipboard(buildOrderClipboardText(snapshot));
      openNotice(noticeTitle, 'Detail pesanan berhasil disalin. Tinggal paste ke WhatsApp customer atau tim produksi.', null, {
        autoCloseMs: 2000,
      });
    } catch (error) {
      openNotice(noticeTitle, `Gagal menyalin detail pesanan: ${error.message}`);
    }
  };

  const buildReceiptDataFromPreview = (snapshot, submitResult, receiptSettingsInput = null) => {
    const receiptSettings = normalizeReceiptSettings(receiptSettingsInput || posSettings);
    const invoiceNo = String(submitResult?.invoiceNo || '-');
    const orderId = String(submitResult?.backendOrderId || '').trim();
    return {
      store: {
        title: receiptSettings.receipt_title,
        name: receiptSettings.brand_name,
        logoUrl: receiptSettings.receipt_logo_url,
        tagline: receiptSettings.brand_tagline,
        address: receiptSettings.receipt_store_address,
        phone: receiptSettings.receipt_store_phone,
        headerText: receiptSettings.receipt_header_text,
        footer: receiptSettings.receipt_footer,
      },
      transaction: {
        invoiceNo,
        orderId,
        date: String(snapshot?.transactionDate || ''),
        cashier: String(snapshot?.cashierName || ''),
        customer: String(snapshot?.customerName || ''),
        paymentStatus: String(snapshot?.paymentStatus || ''),
        notes: String(snapshot?.notes || '').trim(),
      },
      items: Array.isArray(snapshot?.items)
        ? snapshot.items.map((item) => ({
          name: String(resolveReceiptProductName(item, item?.product || '-') || '-'),
          qty: Number(item?.qty || 0) || 0,
          price: Number(item?.price || 0) || 0,
          size: String(item?.size || '-'),
          material: String(item?.material || '-'),
          finishing: String(item?.finishing || '-'),
          lbMax: String(item?.lbMax || '-'),
          pages: Math.max(Number(item?.pages || 0) || 0, 0) || undefined,
          notes: String(item?.note || '-'),
          total: Number(item?.total || 0) || 0,
        }))
        : [],
      summary: {
        subtotal: Number(snapshot?.subtotal || 0) || 0,
        discount: Number(snapshot?.discountAmount || 0) || 0,
        grandTotal: Number(snapshot?.grandTotal || 0) || 0,
        paid: Number(snapshot?.paymentAmount || 0) || 0,
        change: Math.max(0, (Number(snapshot?.paymentAmount || 0) || 0) - (Number(snapshot?.grandTotal || 0) || 0)),
        remainingDue: Math.max(0, (Number(snapshot?.grandTotal || 0) || 0) - (Number(snapshot?.paymentAmount || 0) || 0)),
      },
      payment: {
        method: String(snapshot?.paymentMethod || ''),
        amount: Number(snapshot?.paymentAmount || 0) || 0,
        targetAccount: String(snapshot?.paymentTargetName || ''),
      },
      layout: {
        showOrderId: Boolean(receiptSettings.receipt_show_order_id),
        showCashier: Boolean(receiptSettings.receipt_show_cashier),
        showCustomer: Boolean(receiptSettings.receipt_show_customer),
        showPaymentDetail: Boolean(receiptSettings.receipt_show_payment_detail),
      },
    };
  };

  const mapReceiptItemFromSource = (item, index = 0) => {
    const restored = restoreDraftItemDisplay(item, materialMapById, finishingNameMapById);
    const productName = resolveReceiptProductName(item, `Item #${index + 1}`);
    const qty = Math.max(Number(item?.qty || item?.quantity || 1) || 1, 1);
    const rawLineTotal = Number(
      item?.lineTotal
      ?? item?.line_total
      ?? item?.total
      ?? item?.subtotal
      ?? 0,
    ) || 0;
    const directPrice = Number(item?.price || 0) || 0;
    const pricingSummary = item?.pricingSummary && typeof item.pricingSummary === 'object'
      ? item.pricingSummary
      : buildPricingSummaryFromBackendItem(item, restored.materialText || '');
    const lineTotal = resolveItemGrandTotal(item, pricingSummary);

    const resolvedUnitPrice = directPrice > 0
      ? directPrice
      : roundMoney(
          (
            Number(pricingSummary?.grandTotal || 0)
            || Number(pricingSummary?.printSubtotal || 0)
            || rawLineTotal
          ) / qty,
        );

    return {
      name: productName,
      qty,
      price: resolvedUnitPrice,
      size: toLabel(item?.size, item?.sizeText, restored.sizeText, '-'),
      material: toLabel(item?.material, item?.materialText, restored.materialText, '-'),
      finishing: toLabel(item?.finishing, item?.finishingText, restored.finishingText, '-'),
      lbMax: toLabel(item?.lbMax, item?.lbMaxText, restored.lbMaxText, '-'),
      pages: Math.max(Number(item?.pages || restored.pages || 0) || 0, 0) || undefined,
      notes: toLabel(item?.note, item?.notes, '-'),
      total: lineTotal,
    };
  };

  const buildReceiptDataFromOrderRow = (sourceRow, items = [], receiptSettingsInput = null) => {
    const receiptSettings = normalizeReceiptSettings(receiptSettingsInput || posSettings);
    const total = Number(
      sourceRow?.invoice?.total
      || sourceRow?.total
      || sourceRow?.grand_total
      || calculateDraftItemsTotal(items)
      || 0
    );
    const paidTotal = Number(sourceRow?.invoice?.paid_total || sourceRow?.paid_total || 0) || 0;
    const dueTotal = Number(sourceRow?.invoice?.due_total || sourceRow?.due_total || 0) || 0;
    const resolvedBankAccountId = Number(
      sourceRow?.bank_account_id
      || sourceRow?.invoice?.bank_account_id
      || sourceRow?.payment?.bank_account_id
      || 0
    );
    const resolvedPaymentTarget = bankAccounts.find((row) => Number(row?.id || 0) === resolvedBankAccountId) || null;
    const paymentTargetName = String(
      resolvedPaymentTarget?.displayTitle
      || resolvedPaymentTarget?.displayName
      || ''
    ).trim();
    const paymentMethodLabel = normalizePaymentMethodLabel(
      sourceRow?.invoice?.payment_method
      || sourceRow?.payment_method
      || sourceRow?.payment?.method
      || sourceRow?.payment?.payment_method
      || ''
    );
    const paymentStatusLabel = dueTotal > 0
      ? (paidTotal > 0 ? 'DP / Piutang' : 'Piutang')
      : (paidTotal > 0 ? 'Lunas' : '');
    return {
      store: {
        title: receiptSettings.receipt_title,
        name: receiptSettings.brand_name,
        logoUrl: receiptSettings.receipt_logo_url,
        tagline: receiptSettings.brand_tagline,
        address: receiptSettings.receipt_store_address,
        phone: receiptSettings.receipt_store_phone,
        headerText: receiptSettings.receipt_header_text,
        footer: receiptSettings.receipt_footer,
      },
      transaction: {
        invoiceNo: String(sourceRow?.invoice?.invoice_no || '-'),
        orderId: String(sourceRow?.id || ''),
        date: String(sourceRow?.created_at || ''),
        cashier: String(sourceRow?.cashier?.name || currentUser?.name || 'Kasir'),
        customer: String(sourceRow?.customer?.name || 'Pelanggan umum'),
        paymentStatus: paymentStatusLabel,
        notes: stripWorkflowSystemNotes(sourceRow?.payment?.note || sourceRow?.note || sourceRow?.notes || ''),
      },
      items: Array.isArray(items)
        ? items.map((item, index) => mapReceiptItemFromSource(item, index))
        : [],
      summary: {
        subtotal: total,
        grandTotal: total,
        paid: paidTotal > 0 ? paidTotal : undefined,
        remainingDue: dueTotal > 0 ? dueTotal : 0,
      },
      payment: paymentMethodLabel ? {
        method: paymentMethodLabel,
        amount: paidTotal,
        targetAccount: paymentTargetName,
      } : undefined,
      layout: {
        showOrderId: Boolean(receiptSettings.receipt_show_order_id),
        showCashier: Boolean(receiptSettings.receipt_show_cashier),
        showCustomer: Boolean(receiptSettings.receipt_show_customer),
        showPaymentDetail: Boolean(receiptSettings.receipt_show_payment_detail),
      },
    };
  };

  const buildBrowserReceiptPreviewHtml = (receiptData, profileInput = null) => {
    const profile = normalizePrinterProfile(profileInput || activePrinterProfile || getDefaultPrinterProfile());
    const receiptTitle = String(receiptData?.store?.title || 'Nota Penjualan').trim() || 'Nota Penjualan';
    const receiptText = renderReceiptText(receiptData, profile);
    return renderReceiptHtml(receiptText, profile, receiptTitle, {
      logoUrl: receiptData?.store?.logoUrl,
      hideTitleText: Boolean(receiptData?.store?.logoUrl),
      titleText: receiptTitle,
    });
  };

  const buildBrowserPrintOptionsFromReceipt = (receiptData, noticeTitle = 'Receipt') => {
    const receiptTitle = String(receiptData?.store?.title || noticeTitle || 'Receipt').trim() || 'Receipt';
    const logoUrl = String(receiptData?.store?.logoUrl || '').trim();
    return {
      title: receiptTitle,
      logoUrl,
      hideTitleText: Boolean(logoUrl),
      titleText: receiptTitle,
    };
  };

  const printReceiptViaBrowserFallback = async ({
    noticeTitle,
    receiptData,
    profileInput = activePrinterProfile,
    shouldTryPrinterProfile = true,
    forceBrowserPrint = false,
    onPrinterFailureMessage,
    onPrinted,
  }) => {
    if (forceBrowserPrint || !shouldTryPrinterProfile) {
      const html = buildBrowserReceiptPreviewHtml(receiptData, profileInput);
      const written = writeHtmlToPrintWindow(html, {
        title: noticeTitle,
      });
      if (!written) {
        openNotice(noticeTitle, 'Dokumen cetak gagal ditampilkan di popup browser.');
      }
      return written;
    }

    try {
      const printed = await printReceipt(
        receiptData,
        profileInput,
        createBrowserPrintOptions(profileInput, null, buildBrowserPrintOptionsFromReceipt(receiptData, noticeTitle)),
      );
      if (typeof onPrinted === 'function') {
        onPrinted(printed);
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown printing error';
      if (typeof onPrinterFailureMessage === 'function') {
        onPrinterFailureMessage(message);
      }
      const html = buildBrowserReceiptPreviewHtml(receiptData, profileInput);
      const written = writeHtmlToPrintWindow(html, {
        title: noticeTitle,
      });
      if (!written) {
        openNotice(noticeTitle, 'Dokumen cetak gagal ditampilkan di popup browser.');
      }
      return written;
    }
  };

  const printHtmlDocument = (html, noticeTitle) => {
    if (!html) {
      return false;
    }
    const written = writeHtmlToPrintWindow(html, {
      title: noticeTitle,
    });
    if (!written) {
      openNotice(noticeTitle, 'Dokumen cetak gagal ditampilkan di popup browser.');
    }
    return written;
  };

  const printOrderPreview = async (snapshot, submitResult) => {
    const receiptData = buildReceiptDataFromPreview(snapshot, submitResult, {
      ...posSettings,
      ...(submitResult?.receipt && typeof submitResult.receipt === 'object' ? { receipt: submitResult.receipt } : {}),
    });
    await printReceiptViaBrowserFallback({
      noticeTitle: 'Cetak Nota',
      receiptData,
      profileInput: activePrinterProfile,
      shouldTryPrinterProfile: hasSavedPrinterProfile,
      forceBrowserPrint: true,
      onPrinterFailureMessage: (message) => {
        openNotice('Cetak Nota', `Printer kasir gagal dipakai, fallback ke browser. Detail: ${message}`);
      },
    });
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
        const [productsRows, finishingRows, materialsRows, productionMaterialsRows, customerRows, customerTypeRows, posSettingsPayload] = await Promise.all([
          fetchPosProducts(),
          fetchPosFinishings().catch(() => []),
          fetchPosMaterials(),
          fetchPosProductionMaterials().catch(() => []),
          fetchPosCustomers(),
          fetchPosCustomerTypes().catch(() => []),
          fetchPosSettings().catch(() => null),
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
        if (posSettingsPayload && typeof posSettingsPayload === 'object' && !Array.isArray(posSettingsPayload)) {
          setPosSettings((prev) => ({
            ...prev,
            ...normalizeReceiptSettings(posSettingsPayload),
          }));
        }
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
  const selectedProductDetail = useMemo(() => {
    const selectedId = Number(selectedProductId || selectedProductRow?.id || 0);
    return selectedId > 0 ? productDetails[selectedId] || null : null;
  }, [selectedProductId, selectedProductRow, productDetails]);
  const selectedProductFixedSizeMode = useMemo(
    () => resolveFixedSizeA3Mode(selectedProductRow, selectedProductDetail),
    [selectedProductRow, selectedProductDetail],
  );
  const selectedA3NegotiationConfig = useMemo(
    () => resolveA3NegotiationConfig(selectedProductRow, selectedProductDetail),
    [selectedProductRow, selectedProductDetail],
  );
  const selectedA3NegotiationState = useMemo(
    () => resolveA3NegotiationState({
      config: selectedA3NegotiationConfig,
      qtyValue: qty,
      negotiatedPriceInput,
      fallbackBottomPrice: previewFallbackBottomPrice,
    }),
    [selectedA3NegotiationConfig, qty, negotiatedPriceInput, previewFallbackBottomPrice],
  );
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
    return buildProductPickerTree(Array.isArray(products) ? products : [], {
      normalizeText,
      toLabel,
      normalizeCategoryName,
      normalizeSubCategoryName,
      toSourceProduct,
      normalizeProductFamilyName,
      normalizeVariantName,
    });
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
          price_type: String(row?.price_type || meta?.finishing_price_type || 'flat'),
          unit_hint: String(meta?.finishing_unit_hint || meta?.unit_hint || 'flat'),
          lb_max_width_cm: Number(meta?.finishing_lb_max_width_cm ?? meta?.lb_max_width_cm ?? 0),
          source: 'catalog',
          axis_group: normalizeAxisGroup(row),
          side_groups: (() => {
            const sideFlags = resolveFinishingSideFlags(row, meta);
            return [
              ...(sideFlags.right || sideFlags.left ? ['right_left'] : []),
              ...(sideFlags.top || sideFlags.bottom ? ['top_bottom'] : []),
            ];
          })(),
          recommendation_groups: recommendationGroups
            .map((item) => String(item || '').trim().toLowerCase())
            .filter(Boolean),
          domain: resolveFinishingDomain(row, meta),
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
  const selectedIsStrictSticker = useMemo(() => {
    const detail = selectedProductId ? productDetails[Number(selectedProductId)] : null;
    return isStrictStickerSalesProduct(selectedProductRow, detail);
  }, [selectedProductRow, selectedProductId, productDetails]);
  const selectedFinishingDomain = useMemo(
    () => (selectedIsStrictSticker ? 'sticker' : 'mmt'),
    [selectedIsStrictSticker],
  );
  const autoApplyMmtFinishing = useMemo(() => {
    return isPrintingProductType(selectedProductType)
      && !selectedIsStrictSticker
      && !selectedProductFixedSizeMode.enabled;
  }, [selectedProductType, selectedIsStrictSticker, selectedProductFixedSizeMode.enabled]);
  const effectiveFinishingOptions = useMemo(() => {
    const productFinishings = selectedProductFinishings.map((row) => ({
      id: Number(row.id || 0),
      name: String(row.name || '').trim(),
      sku: String(row.sku || '').trim(),
      price: Number(row.price || row.unit_price || row.selling_price || 0),
      price_reseller: Number(row.price_reseller || 0),
      price_express: Number(row.price_express || 0),
      price_type: String(row.price_type || row.meta?.finishing_price_type || 'flat'),
      unit_hint: String(row.unit_hint || row.meta?.finishing_unit_hint || row.meta?.unit_hint || 'flat'),
      lb_max_width_cm: Number(row.lb_max_width_cm || row.meta?.finishing_lb_max_width_cm || row.meta?.lb_max_width_cm || 0),
      source: 'product',
      axis_group: ['right_left', 'top_bottom', 'all_sides', 'sambungan'].includes(String(row.axis_group || ''))
        ? String(row.axis_group)
        : normalizeAxisGroup(row),
      side_groups: Array.isArray(row.side_groups)
        ? row.side_groups.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
        : [],
      recommendation_groups: Array.isArray(row.recommendation_groups)
        ? row.recommendation_groups.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
        : [],
      domain: resolveFinishingDomain(row, row?.meta),
      requires_mata_ayam: resolveFinishingRequiresMataAyam(row),
      payload_key: row.payload_key === 'product_id' ? 'product_id' : 'id',
    })).filter((row) => row.id > 0 && row.name);

    const matchesFinishingDomain = (option) => {
      const domain = String(option?.domain || 'shared').trim().toLowerCase();
      if (!isPrintingProductType(selectedProductType)) {
        return true;
      }
      if (domain === 'shared') {
        return true;
      }
      return domain === selectedFinishingDomain;
    };

    const hasSelectableAxis = (option) => {
      const sideGroups = Array.isArray(option?.side_groups) ? option.side_groups : [];
      return sideGroups.length > 0 || ['right_left', 'top_bottom', 'all_sides', 'sambungan'].includes(String(option?.axis_group || ''));
    };

    const catalogByName = new Map();
    printingFinishingCatalog.forEach((option) => {
      const key = normalizeText(option?.name || '');
      if (!key || catalogByName.has(key)) {
        return;
      }
      catalogByName.set(key, option);
    });

    const hydratedProductFinishings = productFinishings.map((option) => {
      const catalogMatch = catalogByName.get(normalizeText(option?.name || ''));
      if (!catalogMatch) {
        return option;
      }

      const optionHasAxis = hasSelectableAxis(option);
      const shouldHydrateFromCatalog = Number(option?.price || 0) <= 0
        || (!optionHasAxis && hasSelectableAxis(catalogMatch))
        || !String(option?.unit_hint || '').trim();

      if (!shouldHydrateFromCatalog) {
        return option;
      }

      const catalogPriceType = String(catalogMatch.price_type || '').trim() || 'flat';
      const catalogUnitHint = String(catalogMatch.unit_hint || '').trim() || 'flat';
      const optionPrice = Number(option.price || 0);
      const useCatalogPricingMeta = selectedFinishingDomain === 'mmt' && optionPrice <= 0;

      return {
        ...option,
        id: Number(catalogMatch.id || option.id || 0),
        sku: String(option.sku || catalogMatch.sku || '').trim(),
        price: optionPrice > 0 ? optionPrice : Number(catalogMatch.price || 0),
        price_reseller: Number(option.price_reseller || 0) > 0
          ? Number(option.price_reseller || 0)
          : Number(catalogMatch.price_reseller || 0),
        price_express: Number(option.price_express || 0) > 0
          ? Number(option.price_express || 0)
          : Number(catalogMatch.price_express || 0),
        price_type: useCatalogPricingMeta
          ? catalogPriceType
          : optionPrice > 0
          ? (String(option.price_type || '').trim() || catalogPriceType)
          : catalogPriceType,
        unit_hint: useCatalogPricingMeta
          ? catalogUnitHint
          : optionPrice > 0
          ? (String(option.unit_hint || '').trim() || catalogUnitHint)
          : catalogUnitHint,
        lb_max_width_cm: Number(option.lb_max_width_cm || 0) > 0
          ? Number(option.lb_max_width_cm || 0)
          : Number(catalogMatch.lb_max_width_cm || 0),
        source: 'catalog',
        axis_group: optionHasAxis ? String(option.axis_group || '') : String(catalogMatch.axis_group || ''),
        side_groups: Array.isArray(option.side_groups) && option.side_groups.length > 0
          ? option.side_groups
          : (Array.isArray(catalogMatch.side_groups) ? catalogMatch.side_groups : []),
        recommendation_groups: Array.isArray(option.recommendation_groups) && option.recommendation_groups.length > 0
          ? option.recommendation_groups
          : (Array.isArray(catalogMatch.recommendation_groups) ? catalogMatch.recommendation_groups : []),
        domain: String(option.domain || '').trim() || String(catalogMatch.domain || '').trim() || 'shared',
        requires_mata_ayam: option.requires_mata_ayam === true || catalogMatch.requires_mata_ayam === true,
        payload_key: 'product_id',
      };
    }).filter((row) => row.id > 0 && row.name);

    if (isPrintingProductType(selectedProductType)) {
      if (hydratedProductFinishings.length > 0) {
        return hydratedProductFinishings.filter((option) => matchesFinishingDomain(option) && hasSelectableAxis(option));
      }

      if (selectedIsStrictSticker) {
        return [];
      }

      return printingFinishingCatalog.filter((option) => {
        if (!matchesFinishingDomain(option)) {
          return false;
        }
        if (!selectedFinishingGroup) {
          return hasSelectableAxis(option);
        }
        if (!Array.isArray(option.recommendation_groups) || option.recommendation_groups.length === 0) {
          return false;
        }
        if (!option.recommendation_groups.includes(selectedFinishingGroup)) {
          return false;
        }
        return hasSelectableAxis(option);
      });
    }
    if (productFinishings.length > 0) {
      return productFinishings;
    }
    return [];
  }, [selectedProductType, printingFinishingCatalog, selectedFinishingGroup, selectedProductFinishings, selectedIsStrictSticker, selectedFinishingDomain]);
  const selectedFinishingSummary = useMemo(() => {
    if (!Array.isArray(selectedFinishingIds) || selectedFinishingIds.length === 0) {
      return '';
    }
    const byId = new Map(
      (effectiveFinishingOptions || []).map((row) => [Number(row.id), formatFinishingOptionLabel(row)]),
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
      (effectiveFinishingOptions || []).map((row) => [Number(row.id), formatFinishingOptionLabel(row)]),
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
    if (selectedProductFixedSizeMode.enabled) {
      return [];
    }
    if (!isPrintingProductType(selectedProductType)) {
      return [];
    }
    return effectiveFinishingOptions.filter((row) => isWidthFinishingOption(row));
  }, [selectedProductType, effectiveFinishingOptions, selectedProductFixedSizeMode.enabled]);
  const regularFinishingOptions = useMemo(() => {
    if (selectedProductFixedSizeMode.enabled) {
      return [];
    }
    if (!isPrintingProductType(selectedProductType)) {
      return effectiveFinishingOptions;
    }
    return effectiveFinishingOptions.filter((row) => !isWidthFinishingOption(row));
  }, [selectedProductType, effectiveFinishingOptions, selectedProductFixedSizeMode.enabled]);
  const finishingAvailabilityMessage = useMemo(() => {
    if (!selectedProductRow) {
      return 'Pilih produk dulu untuk melihat finishing.';
    }
    if (regularFinishingOptions.length > 0) {
      return '';
    }
    if (!isPrintingProductType(selectedProductType)) {
      return 'Produk ini belum punya finishing aktif.';
    }
    if (selectedIsStrictSticker && !selectedFinishingGroup) {
      return 'Produk sticker ini belum punya grup finishing sticker.';
    }
    if (selectedProductFinishings.length > 0) {
      return 'Produk ini belum punya finishing reguler yang bisa dipilih kasir.';
    }
    if (selectedFinishingGroup) {
      return `Belum ada finishing yang cocok dengan grup "${selectedFinishingGroup}".`;
    }
    return 'Belum ada finishing aktif untuk produk ini.';
  }, [
    regularFinishingOptions,
    selectedProductRow,
    selectedProductType,
    selectedIsStrictSticker,
    selectedFinishingGroup,
    selectedProductFinishings,
  ]);
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
  const resolvedPreviewMaterialDisplay = useMemo(() => {
    const previewText = String(previewMaterialDisplay || '').trim();
    if (previewText) {
      return previewText;
    }

    if (isMaterialLoading) {
      return 'Memuat material produk...';
    }

    const fallbackText = String(selectedProductMaterialInfo?.displayText || '').trim();
    if (fallbackText) {
      return fallbackText;
    }

    return 'Material akan dipilih otomatis sesuai hitung backend';
  }, [previewMaterialDisplay, isMaterialLoading, selectedProductMaterialInfo]);

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

  useEffect(() => {
    const timer = setInterval(() => {
      setDraftTimeTick(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

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
      setProductionRows(
        toDataRows(payload).filter((row) => !isDraftCandidate(row?.order || row)),
      );
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
    if (activeMenu === 'report') {
      loadClosingWorkspace();
      loadCashFlowTypes();
    }
  }, [activeMenu, backendReady]);

  useEffect(() => {
    const matchedRecipient = (Array.isArray(financeRecipients) ? financeRecipients : [])
      .find((row) => Number(row?.id || 0) === Number(closingFinanceRecipientId || 0)) || null;
    if (matchedRecipient?.name) {
      setClosingFinanceRecipient(matchedRecipient.name);
    }
  }, [financeRecipients, closingFinanceRecipientId]);

  useEffect(() => {
    if (activeMenu === 'report') {
      loadCashFlowTypes(cashFlowTransactionType);
      setCashFlowTypeId(null);
    }
  }, [cashFlowTransactionType]);

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
      const rows = toDataRows(payload).filter((row) => !isDraftCandidate(row?.order || row));
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

      const cartFromQueue = queueItems
        .map((backendItem, idx) => buildCartItemFromDraftSource(
          backendItem,
          `queue-item-${idx}-${Date.now()}`,
          materialMapById,
          finishingNameMapById,
          productNameMapById,
        ))
        .filter((item) => Number(item?.backendItem?.product_id || 0) > 0);

      setCartItems(cartFromQueue);
      setCurrentDraftSourceId(null);
      setOrderNumber('');
      setSelectedCustomerId(Number(payload?.customer_id || 0) || null);
      setProductName('');
      setSelectedProductId(null);
      setNegotiatedPriceInput('');
      setQty('1');
      setSizeWidthMeter('');
      setSizeLengthMeter('');
      setPreviewMaterialDisplay('');
      setPreviewMaterialError('');
      setPreviewMaterialWarning('');
      setPreviewPricingSummary(null);
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
      setPaymentNotes(stripWorkflowSystemNotes(payload?.payment?.note || payload?.note || payload?.notes || ''));
      setLastSyncInfo(`Lanjut Draft Antrian${payload?.invoice_no ? ` | ${payload.invoice_no}` : ''}`);
      setActiveMenu('pos');
      return;
    }

    const selectedId = Number(row?.id || 0);
    if (selectedId <= 0) {
      return;
    }

    try {
      let order = row;
      const detailPayload = await fetchPosOrderDetail(selectedId);
      order = normalizeOrderDetailRow(detailPayload, row) || row;
      if (!isDraftCandidate(order)) {
        openNotice('Invoice', 'Order ini bukan kandidat draft yang bisa dilanjutkan.');
        return;
      }
      const rows = Array.isArray(order?.items)
        ? order.items
        : Array.isArray(order?.order_items)
          ? order.order_items
          : [];
      if (rows.length === 0) {
        openNotice('Invoice', 'Order draft tidak memiliki item.');
        return;
      }

      const cartFromDraft = rows
        .map((item) => buildCartItemFromDraftSource(
          item,
          `draft-${selectedId}-${item?.id || Math.random().toString(36).slice(2, 7)}`,
          materialMapById,
          finishingNameMapById,
          productNameMapById,
        ))
        .filter((row) => Number(row?.backendItem?.product_id || 0) > 0);

      if (cartFromDraft.length === 0) {
        openNotice('Invoice', 'Item draft tidak valid untuk dilanjutkan.');
        return;
      }

      setCartItems(cartFromDraft);
      setCurrentDraftSourceId(selectedId);
      setOrderNumber('');
      setSelectedCustomerId(Number(order?.customer?.id || order?.customer_id || 0) || null);
      setProductName('');
      setSelectedProductId(null);
      setNegotiatedPriceInput('');
      setQty('1');
      setSizeWidthMeter('');
      setSizeLengthMeter('');
      setPreviewMaterialDisplay('');
      setPreviewMaterialError('');
      setPreviewMaterialWarning('');
      setPreviewPricingSummary(null);
      setSelectedFinishingIds([]);
      setSelectedFinishingMataAyamQtyById({});
      setMataAyamIssueBadge({ visible: false, message: '' });
      setSelectedLbMaxProductId(null);
      setPages('1');
      setDiscountPercent('0');
      setDiscountAmount('0');
      setDiscountMode('percent');
      setPaymentMethod(normalizePaymentMethodLabel(
        order?.payment?.method
        || order?.payment_method
        || order?.invoice?.payment_method
        || 'Cash',
      ));
      setPaymentAmount(String(Math.max(0, Number(order?.invoice?.paid_total || order?.paid_total || 0))));
      setPaymentNotes(stripWorkflowSystemNotes(order?.payment?.note || order?.note || order?.notes || ''));
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
    const fixedSizeMode = resolveFixedSizeA3Mode(variantRow);
    setSelectedProductId(productId);
    setProductName(buildSelectedProductLabel(variantRow));
    setNegotiatedPriceInput('');
    setSelectedFinishingIds([]);
    setSelectedFinishingMataAyamQtyById({});
    setMataAyamIssueBadge({ visible: false, message: '' });
    setSelectedLbMaxProductId(null);
    setPreviewMaterialDisplay('');
    setPreviewMaterialError('');
    setPreviewMaterialWarning('');
    if (fixedSizeMode.enabled) {
      setSizeWidthMeter('');
      setSizeLengthMeter('');
    }
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
    if (selectedProductFixedSizeMode.enabled) {
      return [];
    }
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
      const optionPrice = Math.max(0, Number(
        option?.price
        || option?.unit_price
        || option?.selling_price
        || option?.harga
        || 0,
      ) || 0);
      const optionPayload = {
        qty: qtyNumber,
        mata_ayam_qty: mataAyamQty,
        name: String(option?.name || '').trim(),
        price: optionPrice,
        price_type: String(option?.price_type || option?.unit_hint || '').trim(),
      };
      if (option?.payload_key === 'product_id' || option?.source === 'catalog') {
        return { ...optionPayload, product_id: id };
      }
      return { ...optionPayload, id };
    });

    if (selectedIsStrictSticker || selectedFinishingDomain === 'mmt') {
      return rows;
    }

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
    if (selectedProductFixedSizeMode.enabled) {
      return [];
    }
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
    const productDetail = await resolveProductDetail(Number(product.id));
    const fixedSizeMode = resolveFixedSizeA3Mode(product, productDetail);
    const size = fixedSizeMode.enabled
      ? {
        widthMeter: 0,
        lengthMeter: 0,
        widthMm: null,
        heightMm: null,
        areaM2: 0,
        displayText: `${fixedSizeMode.label || 'A3+'} (Ukuran Tetap)`,
      }
      : buildSizeFromMeters(sizeWidthMeter, sizeLengthMeter);
    const materialInfo = resolveMaterialInfo(product, productDetail);
    const sourceMeta = toSourceMeta(productDetail || product);
    const isStickerSchema = isStrictStickerSalesProduct(product, productDetail);
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
      material_product_id: materialInfo.primaryMaterialId || null,
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
    const stickerOrderingNotice = resellerMinimumMessage || resolveStickerBillingNotice({
      pricing,
      stickerRule: pricing?.rule && typeof pricing.rule === 'object' ? pricing.rule : null,
      fallbackInputLengthM: size.lengthMeter,
    });

    const usedMaterialInfo = resolveUsedMaterialInfoFromPricing(
      pricing,
      materialInfo,
      materials,
      catalogMaterialNameMap,
    );

    return { pricing, pricingPayload, productDetail, materialInfo, usedMaterialInfo, size, stickerOrderingNotice };
  };

  useEffect(() => {
    let cancelled = false;
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;

    if (!backendReady || !selectedProductRow) {
      setItemFinalPrice(0);
      setPreviewFallbackBottomPrice(0);
      setPreviewMaterialDisplay('');
      setPreviewMaterialError('');
      setPreviewMaterialWarning('');
      setPreviewPricingSummary(null);
      return undefined;
    }

    const qtyNumber = Number(qty);
    const widthMeter = parseMeterValue(sizeWidthMeter);
    const lengthMeter = parseMeterValue(sizeLengthMeter);
    const isFixedSizeProduct = selectedProductFixedSizeMode.enabled;
    if (qtyNumber < 1 || (!isFixedSizeProduct && (widthMeter <= 0 || lengthMeter <= 0))) {
      setItemFinalPrice(0);
      setPreviewFallbackBottomPrice(0);
      setPreviewMaterialDisplay('');
      setPreviewMaterialError('');
      setPreviewMaterialWarning('');
      setPreviewPricingSummary(null);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const customerId = Number(selectedCustomerId || 0) || null;
        const { pricing, usedMaterialInfo, productDetail, stickerOrderingNotice } = await computePricingFromBackend(selectedProductRow, customerId);
        const negotiationConfig = resolveA3NegotiationConfig(selectedProductRow, productDetail);
        const negotiationState = resolveA3NegotiationState({
          config: negotiationConfig,
          qtyValue: qtyNumber,
          negotiatedPriceInput,
          fallbackBottomPrice: resolvePricingSubtotalPerUnit(pricing, qtyNumber),
        });
        const nextTotal = negotiationState.isApplied
          ? roundMoney(
            (Number(negotiationState.value || 0) * qtyNumber)
            + Number(pricing?.finishing_total || 0)
            + Number(pricing?.express_fee || 0),
          )
          : resolvePricingGrandTotal(pricing);
        if (!cancelled && previewRequestRef.current === requestId) {
          const targetProduct = String(buildSelectedProductLabel(selectedProductRow) || selectedProductRow?.name || '').trim();
          setItemFinalPrice(nextTotal);
          setPreviewFallbackBottomPrice(resolvePricingSubtotalPerUnit(pricing, qtyNumber));
          setPreviewMaterialDisplay(String(usedMaterialInfo?.displayText || '').trim());
          setPreviewMaterialError(negotiationState.tone === 'error' ? negotiationState.message : '');
          const combinedWarning = [
            resolveSelectedMaterialWarning(usedMaterialInfo, targetProduct),
            stickerOrderingNotice,
          ].filter((text) => String(text || '').trim() !== '').join('\n');
          setPreviewMaterialWarning(combinedWarning);
          setPreviewPricingSummary(buildPricingDisplaySummary({
            pricing,
            materialText: String(usedMaterialInfo?.displayText || '').trim(),
            negotiation: negotiationState,
          }));
        }
      } catch (error) {
        if (!cancelled && previewRequestRef.current === requestId) {
          setItemFinalPrice(0);
          setPreviewFallbackBottomPrice(0);
          setPreviewMaterialDisplay('');
          setPreviewMaterialError(String(error?.message || 'Preview bahan gagal dihitung.'));
          setPreviewMaterialWarning('');
          setPreviewPricingSummary(null);
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
    negotiatedPriceInput,
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
    selectedProductFixedSizeMode.enabled,
  ]);

  const resetTransaction = () => {
    setOrderNumber('');
    setCurrentDraftSourceId(null);
    setSelectedCustomerId(null);
    setTransactionDate(formatDate(new Date()));
    setProductName('');
    setSelectedProductId(null);
    setNegotiatedPriceInput('');
    setQty('1');
    setSizeWidthMeter('');
    setSizeLengthMeter('');
    setPreviewMaterialDisplay('');
    setPreviewMaterialError('');
    setPreviewMaterialWarning('');
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
    setSelectedBankAccountId(null);
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
      const { pricing, stickerOrderingNotice } = await computePricingFromBackend(product, customerId);
      setProductName(buildSelectedProductLabel(product));
      setSelectedProductId(Number(product.id || 0) || null);
      openNotice(
        'Produk Valid',
        `${product.name} valid. Preview backend: ${formatRupiah(pricing.grand_total || 0)}${stickerOrderingNotice ? `\n${stickerOrderingNotice}` : ''}`,
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
    if (!selectedProductFixedSizeMode.enabled && (widthMeter <= 0 || lengthMeter <= 0)) {
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
      const { pricing, pricingPayload, productDetail, materialInfo, usedMaterialInfo, size, stickerOrderingNotice } = await computePricingFromBackend(product, customerId);
      const targetProduct = String(buildSelectedProductLabel(product) || product?.name || productName || '').trim();
      const materialStockMessage = validateSelectedMaterialStock(usedMaterialInfo, targetProduct);
      if (materialStockMessage) {
        openNotice('Stok Material', materialStockMessage);
      }
      const sourceMeta = toSourceMeta(productDetail || product);
      const negotiationConfig = resolveA3NegotiationConfig(product, productDetail);
      const negotiationState = resolveA3NegotiationState({
        config: negotiationConfig,
        qtyValue: qtyNumber,
        negotiatedPriceInput,
        fallbackBottomPrice: resolvePricingSubtotalPerUnit(pricing, qtyNumber),
      });
      if (negotiationState.isBlocking) {
        openNotice('Aturan Negosiasi A3+', negotiationState.message);
        return;
      }
      const itemId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const pageNumber = Math.max(Number(pages) || 1, 1);
      const materialId = Number(usedMaterialInfo?.primaryMaterialId || materialInfo?.primaryMaterialId || 0);
      const materialCandidateIds = Array.isArray(usedMaterialInfo?.materialIds)
        ? usedMaterialInfo.materialIds.map((id) => Number(id)).filter((id) => id > 0)
        : [];
      const materialText = String(usedMaterialInfo?.displayText || '-').trim() || '-';

      const backendItem = {
        product_id: Number(product.id),
        product_name: String(buildSelectedProductLabel(product) || product.name || '').trim(),
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
        size_text: size.displayText,
        material_text: materialText,
        finishing_text: selectedFinishingDisplay || '-',
        lb_max_text: selectedLbMaxSummary || '-',
        pages: pageNumber,
        note: '-',
        lb_max: buildLbMaxPayload() || [],
        finishing_breakdown: Array.isArray(pricing.finishing_breakdown) ? pricing.finishing_breakdown : [],
        spec_snapshot: {
          type: 'custom_order',
          original_flow: {
            requires_production: Boolean(product.requires_production ?? true),
            requires_design: Boolean(product.requires_production ?? true),
          },
          sales_schema: String(sourceMeta?.sales_schema || '').trim().toLowerCase() || null,
          sticker_rule: pricing?.rule && typeof pricing.rule === 'object'
            ? {
              customer_category: String(pricing.rule?.customer_category || '').trim().toLowerCase() || null,
              billing_group: String(pricing.rule?.billing_group || '').trim().toUpperCase() || null,
              billing_min_length_m: Number(pricing.rule?.billing_min_length_m || 0) || null,
              design_length_m: Number(pricing.rule?.design_length_m || pricing?.price_breakdown?.sticker_design_length_m || size.lengthMeter || 0) || null,
              billed_length_m: Number(pricing.rule?.billed_length_m || pricing?.price_breakdown?.sticker_billed_length_m || 0) || null,
              selected_width_m: Number(pricing.rule?.selected_width_m || pricing?.price_breakdown?.sticker_selected_roll_width_m || 0) || null,
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
            product_name: String(buildSelectedProductLabel(product) || product.name || '').trim(),
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
            note: '-',
            requires_production: Boolean(product.requires_production ?? true),
            requires_design: Boolean(product.requires_production ?? true),
          },
        },
      };
      if (negotiationState.isApplied && negotiationState.value > 0) {
        backendItem.negotiated_price = roundMoney(negotiationState.value);
        backendItem.bottom_price = roundMoney(negotiationState.bottomPrice);
        backendItem.bottom_price_enabled = true;
        backendItem.bottom_price_min_qty = negotiationState.minimumQty;
      }
      const normalizedBackendItem = enforceDesignFirstFlow(backendItem);

      const lineTotal = negotiationState.isApplied
        ? roundMoney(
          (Number(negotiationState.value || 0) * qtyNumber)
          + Number(pricing?.finishing_total || 0)
          + Number(pricing?.express_fee || 0),
        )
        : resolvePricingGrandTotal(pricing);
      const itemPricingSummary = buildPricingDisplaySummary({
        pricing,
        materialText,
        stickerRule: pricing?.rule && typeof pricing.rule === 'object'
          ? pricing.rule
          : null,
        negotiation: negotiationState,
      });
      const warningNotes = [itemPricingSummary.stickerNotice, materialStockMessage, stickerOrderingNotice]
        .filter((text) => String(text || '').trim() !== '')
        .join('\n');
      if (warningNotes) {
        itemPricingSummary.stickerNotice = warningNotes;
      }

      setCartItems((prevItems) => [
        ...prevItems,
        {
          id: itemId,
          product: String(buildSelectedProductLabel(product) || product.name || ''),
          productBaseName: String(normalizeProductFamilyName(product) || product.name || '').trim(),
          qty: qtyNumber,
          size: size.displayText,
          finishing: selectedFinishingDisplay || '-',
          lbMax: selectedLbMaxSummary || '-',
          pages: pageNumber,
          material: materialText,
          lineTotal,
          total: lineTotal,
          pricingSummary: itemPricingSummary,
          backendItem: normalizedBackendItem,
        },
      ]);

      setQty('1');
      setNegotiatedPriceInput('');
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

  useEffect(() => {
    if (!selectedProductFixedSizeMode.enabled) {
      return;
    }
    if (sizeWidthMeter || sizeLengthMeter) {
      setSizeWidthMeter('');
      setSizeLengthMeter('');
    }
  }, [selectedProductFixedSizeMode.enabled, sizeWidthMeter, sizeLengthMeter]);

  const handleCancelItem = () => {
    setProductName('');
    setSelectedProductId(null);
    setNegotiatedPriceInput('');
    setQty('1');
    setSizeWidthMeter('');
    setSizeLengthMeter('');
    setSelectedFinishingIds([]);
    setSelectedFinishingMataAyamQtyById({});
    setMataAyamIssueBadge({ visible: false, message: '' });
    setSelectedLbMaxProductId(null);
    setPages('1');
    setItemFinalPrice(0);
    setPreviewFallbackBottomPrice(0);
    setPreviewMaterialDisplay('');
    setPreviewMaterialError('');
    setPreviewMaterialWarning('');
    setPreviewPricingSummary(null);
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

    const negotiationViolation = cartItems.find((item) => {
      const backendItem = item?.backendItem || {};
      const negotiatedPrice = Number(backendItem?.negotiated_price || 0);
      if (!(negotiatedPrice > 0)) {
        return false;
      }
      const minimumQty = Math.max(0, Number(backendItem?.bottom_price_min_qty || 0) || 0);
      const bottomPrice = roundMoney(Number(backendItem?.bottom_price || 0));
      const itemQty = Math.max(1, Number(item?.qty || backendItem?.qty || 1) || 1);
      if (minimumQty > 0 && itemQty < minimumQty) {
        return true;
      }
      return bottomPrice > 0 && negotiatedPrice < bottomPrice;
    });
    if (negotiationViolation) {
      const backendItem = negotiationViolation?.backendItem || {};
      const minimumQty = Math.max(0, Number(backendItem?.bottom_price_min_qty || 0) || 0);
      const bottomPrice = roundMoney(Number(backendItem?.bottom_price || 0));
      const negotiatedPrice = roundMoney(Number(backendItem?.negotiated_price || 0));
      const itemQty = Math.max(1, Number(negotiationViolation?.qty || backendItem?.qty || 1) || 1);
      const productLabel = String(negotiationViolation?.product || 'Produk A3+').trim();
      if (minimumQty > 0 && itemQty < minimumQty) {
        openNotice('Aturan Negosiasi A3+', `${productLabel}: minimal qty untuk negosiasi adalah ${minimumQty}. Qty saat ini ${itemQty}.`);
        return null;
      }
      openNotice('Aturan Negosiasi A3+', `${productLabel}: harga negosiasi ${formatRupiah(negotiatedPrice)} tidak boleh di bawah bottom ${formatRupiah(bottomPrice)}.`);
      return null;
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
        const hasNegotiatedPrice = Number(item?.backendItem?.negotiated_price || 0) > 0;
        const itemQty = Math.max(1, Number(item?.qty || item?.backendItem?.qty || 1) || 1);
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
          original_flow: {
            requires_production: Boolean(
              currentSpec?.original_flow?.requires_production
              ?? currentDraftForm?.requires_production
              ?? item?.backendItem?.requires_production
              ?? true,
            ),
            requires_design: Boolean(
              currentSpec?.original_flow?.requires_design
              ?? currentDraftForm?.requires_design
              ?? item?.backendItem?.requires_design
              ?? true,
            ),
          },
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
            product_name: toLabel(item?.product, currentDraftForm?.product_name, ''),
            qty: Math.max(Number(currentDraftForm?.qty || item?.qty || item?.backendItem?.qty || 1) || 1, 1),
            size_text: toLabel(item?.size, currentDraftForm?.size_text, '-'),
            width_meter: firstPositiveNumber(currentDraftForm?.width_meter, widthMeter),
            length_meter: firstPositiveNumber(currentDraftForm?.length_meter, lengthMeter),
            finishing: toLabel(item?.finishing, currentDraftForm?.finishing, '-'),
            lb_max: toLabel(item?.lbMax, currentDraftForm?.lb_max, '-'),
            pages: Math.max(Number(currentDraftForm?.pages || item?.pages || 1) || 1, 1),
            material: toLabel(item?.material, currentDraftForm?.material, '-'),
            note: toLabel(item?.note, item?.notes, currentDraftForm?.note, '-'),
            requires_production: Boolean(
              currentDraftForm?.requires_production
              ?? currentSpec?.original_flow?.requires_production
              ?? item?.backendItem?.requires_production
              ?? true,
            ),
            requires_design: Boolean(
              currentDraftForm?.requires_design
              ?? currentSpec?.original_flow?.requires_design
              ?? item?.backendItem?.requires_design
              ?? true,
            ),
          },
        };

        const originalRequiresProduction = Boolean(
          mergedSnapshot?.original_flow?.requires_production
          ?? item?.backendItem?.requires_production
          ?? true,
        );
        const originalRequiresDesign = Boolean(
          mergedSnapshot?.original_flow?.requires_design
          ?? item?.backendItem?.requires_design
          ?? true,
        );

        return enforceDesignFirstFlow({
          ...item.backendItem,
          product_name: toLabel(item?.backendItem?.product_name, item?.product, ''),
          ...(hasNegotiatedPrice ? { negotiated_price: roundMoney(adjustedSubtotal / itemQty) } : {}),
          subtotal: adjustedSubtotal,
          finishing_total: originalFinishing,
          express_fee: originalExpress,
          size_text: toLabel(item?.backendItem?.size_text, item?.size, '-'),
          material_text: toLabel(item?.backendItem?.material_text, item?.material, '-'),
          finishing_text: toLabel(item?.backendItem?.finishing_text, item?.finishing, '-'),
          lb_max_text: toLabel(item?.backendItem?.lb_max_text, item?.lbMax, '-'),
          pages: Math.max(Number(item?.backendItem?.pages || item?.pages || 1) || 1, 1),
          note: toLabel(item?.backendItem?.note, item?.note, item?.notes, '-'),
          requires_production: isDraftMode ? false : originalRequiresProduction,
          requires_design: isDraftMode ? false : originalRequiresDesign,
          production_status: isDraftMode ? 'not_required' : item?.backendItem?.production_status,
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
        openNotice('Akun Pembayaran', 'Akun pembayaran wajib dipilih sebelum proses order.');
        return null;
      }

      payload = {
        customer_id: customerId,
        ...(mode === 'draft' ? { status: 'draft' } : {}),
        due_at: null,
        note: paymentNotes || null,
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
      if (created?.receipt && typeof created.receipt === 'object' && !Array.isArray(created.receipt)) {
        setPosSettings((prev) => ({
          ...prev,
          ...normalizeReceiptSettings({ receipt: created.receipt }),
        }));
      }
      setOrderNumber(String(invoiceNo || '').trim());
      saveReprintSpecSnapshot({
        orderId: backendOrderId || 0,
        invoiceNo,
        items: buildReprintSnapshotItems(adjustedItems),
      });
      let draftStatusWarning = '';
      if (!isDraftMode && backendOrderId && Number(currentDraftSourceId || 0) > 0) {
        try {
          await deletePosOrder(Number(currentDraftSourceId || 0));
          setDraftInvoices((prev) => prev.filter((draft) => Number(draft?.id || 0) !== Number(currentDraftSourceId || 0)));
        } catch (cleanupError) {
          draftStatusWarning = `\nCatatan: draft sumber belum berhasil dihapus otomatis (${cleanupError.message}).`;
        }
      }
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
      return { ok: true, backendOrderId, invoiceNo, receipt: created?.receipt || null };
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
          note: paymentNotes || null,
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
      const isNegotiationValidation = lowerValidationMessage.includes('negosiasi')
        || lowerValidationMessage.includes('harga bottom')
        || lowerValidationMessage.includes('minimum_qty')
        || lowerValidationMessage.includes('bottom_price');
      if (isNegotiationValidation) {
        const productName = String(error?.body?.product_name || failedItemName || 'Produk A3+').trim();
        const minimumQty = Math.max(0, Number(error?.body?.minimum_qty || 0) || 0);
        const bottomPrice = roundMoney(Number(error?.body?.bottom_price || 0));
        if (minimumQty > 0) {
          openNotice('Aturan Negosiasi A3+', `${productName}: minimal pembelian untuk negosiasi adalah ${minimumQty}.`);
          return null;
        }
        if (bottomPrice > 0) {
          openNotice('Aturan Negosiasi A3+', `${productName}: harga negosiasi tidak boleh di bawah ${formatRupiah(bottomPrice)}.`);
          return null;
        }
        openNotice('Aturan Negosiasi A3+', validationMessage || 'Negosiasi item A3+ belum sesuai aturan backend.');
        return null;
      }
      const isBankAccountValidation = lowerValidationMessage.includes('bank_account_id')
        || lowerValidationMessage.includes('bank penampungan')
        || lowerValidationMessage.includes('akun bank penampungan')
        || lowerValidationMessage.includes('akun bank');
      if (isBankAccountValidation) {
            openNotice('Akun Pembayaran', validationMessage || 'Akun pembayaran penjualan wajib dipilih.');
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

  const loadPaymentAccountOptionsForMethod = async (methodLabel) => {
    const rows = await fetchPosBankAccounts();
    const allOptions = toDataRows(rows)
      .map((row) => normalizeBankAccountRow(row))
      .filter((row) => Number(row?.id || 0) > 0);
    const currentMethod = mapPaymentMethodToBackend(methodLabel);
    const filteredOptions = allOptions.filter((row) => {
      const type = String(row?.paymentType || '').trim().toLowerCase();
      if (!type) {
        return false;
      }
      if (currentMethod === 'cash') {
        return type === 'cash';
      }
      if (currentMethod === 'qris') {
        return type === 'qris';
      }
      if (currentMethod === 'card') {
        return type === 'card';
      }
      return type === 'transfer';
    });
    if (filteredOptions.length > 0) {
      return filteredOptions;
    }
    return currentMethod === 'cash' ? [] : allOptions;
  };

  const resolveAutoPaymentAccountId = async (methodLabel) => {
    const currentMethod = mapPaymentMethodToBackend(methodLabel);
    const options = await loadPaymentAccountOptionsForMethod(methodLabel);
    if (options.length === 0) {
      openNotice(
        currentMethod === 'cash' ? 'Akun Kas Penjualan' : 'Akun Pembayaran',
        currentMethod === 'cash'
          ? 'Belum ada akun kas yang cocok untuk pembayaran cash. Siapkan akun kas di accounting agar cash penjualan masuk ke kas yang benar.'
          : `Belum ada akun pembayaran yang cocok untuk metode ${normalizePaymentMethodLabel(methodLabel)}.`,
      );
      return 0;
    }

    const currentId = Number(selectedBankAccountId || 0);
    const matchingCurrent = options.find((row) => Number(row?.id || 0) === currentId) || null;
    const selectedRow = matchingCurrent || options[0] || null;
    const selectedId = Number(selectedRow?.id || 0);

    setBankAccounts(options);
    setSelectedBankAccountId(selectedId > 0 ? selectedId : null);

    return selectedId;
  };

  const handleOpenReceivablePaymentModal = async (row) => {
    const invoiceId = Number(row?.invoice?.id || 0);
    const dueTotal = roundMoney(Number(row?.invoice?.due_total || 0));
    if (!(invoiceId > 0) || dueTotal <= 0) {
      openNotice('Piutang Pelanggan', 'Invoice ini tidak memiliki sisa piutang untuk dibayar.');
      return;
    }

    setReceivablePaymentModal({
      visible: true,
      orderId: Number(row?.id || 0),
      invoiceId,
      invoiceNo: String(row?.invoice?.invoice_no || '-'),
      customerName: String(row?.customer?.name || 'Pelanggan umum'),
      customerPhone: String(row?.customer?.phone || '').trim(),
      dueTotal,
      amount: String(Math.max(0, dueTotal)),
      method: 'Cash',
      selectedAccountId: null,
      accountOptions: [],
      isLoadingAccounts: true,
      isSubmitting: false,
    });

    try {
      const options = await loadPaymentAccountOptionsForMethod('Cash');
      if (options.length === 0) {
        setReceivablePaymentModal((prev) => ({
          ...prev,
          isLoadingAccounts: false,
          accountOptions: [],
          selectedAccountId: null,
        }));
        openNotice('Piutang Pelanggan', 'Belum ada akun kas yang cocok untuk pembayaran tunai piutang.');
        return;
      }
      setReceivablePaymentModal((prev) => ({
        ...prev,
        isLoadingAccounts: false,
        accountOptions: options,
        selectedAccountId: Number(options[0]?.id || 0) || null,
      }));
    } catch (error) {
      setReceivablePaymentModal((prev) => ({
        ...prev,
        isLoadingAccounts: false,
      }));
      openNotice('Piutang Pelanggan', `Gagal memuat akun pembayaran: ${error.message}`);
    }
  };

  const handleCloseReceivablePaymentModal = () => {
    if (receivablePaymentModal.isSubmitting) {
      return;
    }
    setReceivablePaymentModal((prev) => ({
      ...prev,
      visible: false,
    }));
  };

  const handleChangeReceivablePaymentMethod = async (value) => {
    const nextMethod = normalizePaymentMethodLabel(value);
    setReceivablePaymentModal((prev) => ({
      ...prev,
      method: nextMethod,
      isLoadingAccounts: true,
      selectedAccountId: null,
      accountOptions: [],
    }));
    try {
      const options = await loadPaymentAccountOptionsForMethod(nextMethod);
      setReceivablePaymentModal((prev) => ({
        ...prev,
        method: nextMethod,
        isLoadingAccounts: false,
        accountOptions: options,
        selectedAccountId: Number(options[0]?.id || 0) || null,
      }));
    } catch (error) {
      setReceivablePaymentModal((prev) => ({
        ...prev,
        isLoadingAccounts: false,
      }));
      openNotice('Piutang Pelanggan', `Gagal memuat akun pembayaran: ${error.message}`);
    }
  };

  const handleSubmitReceivablePayment = async () => {
    const invoiceId = Number(receivablePaymentModal.invoiceId || 0);
    const accountId = Number(receivablePaymentModal.selectedAccountId || 0);
    const amount = roundMoney(parseCurrencyInput(receivablePaymentModal.amount));
    const dueTotal = roundMoney(Number(receivablePaymentModal.dueTotal || 0));

    if (!(invoiceId > 0)) {
      openNotice('Piutang Pelanggan', 'Invoice piutang tidak valid.');
      return;
    }
    if (amount <= 0) {
      openNotice('Piutang Pelanggan', 'Nominal pembayaran piutang wajib diisi.');
      return;
    }
    if (amount > dueTotal) {
      openNotice('Piutang Pelanggan', 'Nominal pembayaran melebihi sisa piutang pelanggan.');
      return;
    }
    if (!(accountId > 0)) {
      openNotice('Piutang Pelanggan', 'Pilih akun pembayaran terlebih dahulu.');
      return;
    }

    setReceivablePaymentModal((prev) => ({
      ...prev,
      isSubmitting: true,
    }));
    try {
      await createPosInvoicePayment(invoiceId, {
        method: mapPaymentMethodToBackend(receivablePaymentModal.method),
        bank_account_id: accountId,
        amount,
        transaction_type: amount >= dueTotal ? 'pelunasan' : 'angsuran',
        paid_at: new Date().toISOString(),
      });
      setReceivablePaymentModal((prev) => ({
        ...prev,
        visible: false,
        isSubmitting: false,
      }));
      await loadDraftInvoices();
      await loadClosingWorkspace(closingReportDate);
      openNotice(
        'Piutang Pelanggan',
        `Pembayaran piutang untuk ${receivablePaymentModal.customerName} sebesar ${formatRupiah(amount)} berhasil dicatat.`,
        null,
        { autoCloseMs: 2200 },
      );
    } catch (error) {
      setReceivablePaymentModal((prev) => ({
        ...prev,
        isSubmitting: false,
      }));
      openNotice('Piutang Pelanggan', formatBackendValidationError(error));
    }
  };

  const handleSaveTransaction = async () => {
    const result = await submitTransaction('draft');
    if (result?.ok) {
      setActiveMenu('draft');
      await loadDraftInvoices();
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
    const bankId = await resolveAutoPaymentAccountId(paymentMethod);
    if (!(bankId > 0)) {
      return;
    }
    setIsOrderPreviewOpen(true);
  };

  const handleOpenBankPickerFromPreview = async (action = 'save') => {
    if (isSubmitting || isOrderPreviewSubmitting) {
      openNotice('Informasi', 'Transaksi sedang diproses, mohon tunggu.');
      return;
    }
    if (action === 'copy_order') {
      const snapshot = buildOrderPreviewSnapshot();
      await handleCopyOrderSnapshot(snapshot, 'Salin Pesanan');
      return;
    }
    const bankId = await resolveAutoPaymentAccountId(paymentMethod);
    if (!(bankId > 0)) {
      return;
    }
    const shouldPrint = action === 'print';
    const shouldCopyInvoice = action === 'copy_invoice';
    const snapshot = (shouldPrint || shouldCopyInvoice) ? buildOrderPreviewSnapshot() : null;
    try {
      setIsOrderPreviewSubmitting(true);
      const result = await submitTransaction('process', { bankAccountId: bankId });
      if (result?.ok) {
        setIsOrderPreviewOpen(false);
        if (shouldPrint && snapshot) {
          await printOrderPreview(snapshot, result);
        }
        if (shouldCopyInvoice && snapshot) {
          const receiptData = buildReceiptDataFromPreview(snapshot, result, {
            ...posSettings,
            ...(result?.receipt && typeof result.receipt === 'object' ? { receipt: result.receipt } : {}),
          });
          try {
            await copyTextToClipboard(buildInvoiceClipboardText(receiptData, {
              customerPhone: snapshot?.customerPhone,
            }));
            openNotice('Salin Invoice', 'Invoice final berhasil disalin. Tinggal paste ke WhatsApp customer.', null, {
              autoCloseMs: 2200,
            });
          } catch (copyError) {
            openNotice('Salin Invoice', `Invoice sudah dibuat, tetapi gagal disalin: ${copyError.message}`);
          }
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
        const customerPhone = normalizeText(row?.customer?.phone || '');
        const invoiceNo = normalizeText(row?.invoice?.invoice_no || '');
        const orderId = normalizeText(row?.id || '');
        return customerName.includes(keyword)
          || customerPhone.includes(keyword)
          || invoiceNo.includes(keyword)
          || orderId.includes(keyword);
      })
      : rows;
    if (invoiceFilter === 'draft') {
      return searchedRows.filter((row) => isDraftInvoiceRow(row));
    }
    if (invoiceFilter === 'processing') {
      return searchedRows.filter((row) => isProcessingInvoiceRow(row));
    }
    if (invoiceFilter === 'receivable') {
      return searchedRows
        .filter((row) => Number(row?.invoice?.due_total || 0) > 0)
        .filter((row) => {
          if (receivableStatusFilter === 'payable') {
            return Boolean(row?.invoice?.can_pay);
          }
          if (receivableStatusFilter === 'blocked') {
            return !Boolean(row?.invoice?.can_pay);
          }
          return true;
        });
    }
    return searchedRows;
  }, [draftInvoices, invoiceFilter, invoiceSearch, receivableStatusFilter]);
  const receivableInvoiceRows = useMemo(() => {
    const keyword = normalizeText(invoiceSearch);
    return (Array.isArray(draftInvoices) ? draftInvoices : [])
      .filter((row) => Number(row?.invoice?.due_total || 0) > 0)
      .filter((row) => {
        if (!keyword) {
          return true;
        }
        const customerName = normalizeText(row?.customer?.name || '');
        const customerPhone = normalizeText(row?.customer?.phone || '');
        const invoiceNo = normalizeText(row?.invoice?.invoice_no || '');
        const orderId = normalizeText(row?.id || '');
        return customerName.includes(keyword)
          || customerPhone.includes(keyword)
          || invoiceNo.includes(keyword)
          || orderId.includes(keyword);
      });
  }, [draftInvoices, invoiceSearch]);
  const receivableCustomerSummary = useMemo(() => {
    const keyword = normalizeText(invoiceSearch);
    if (!keyword) {
      return null;
    }
    const rows = receivableInvoiceRows;
    if (rows.length === 0) {
      return null;
    }
    const uniqueCustomers = Array.from(new Set(
      rows.map((row) => `${String(row?.customer?.name || 'Pelanggan umum').trim()}|${String(row?.customer?.phone || '').trim()}`)
        .filter(Boolean),
    ));
    const oldestRow = [...rows].sort((a, b) => {
      const aTime = new Date(a?.created_at || 0).getTime() || 0;
      const bTime = new Date(b?.created_at || 0).getTime() || 0;
      return aTime - bTime;
    })[0] || null;
    const summary = rows.reduce((acc, row) => {
      acc.totalDue += Number(row?.invoice?.due_total || 0);
      acc.totalAmount += Number(row?.invoice?.total || 0);
      acc.totalInvoice += 1;
      return acc;
    }, {
      customerName: String(rows[0]?.customer?.name || 'Pelanggan umum'),
      customerPhone: String(rows[0]?.customer?.phone || '').trim(),
      totalDue: 0,
      totalAmount: 0,
      totalInvoice: 0,
    });
    return {
      ...summary,
      totalDue: roundMoney(summary.totalDue),
      totalAmount: roundMoney(summary.totalAmount),
      customerCount: uniqueCustomers.length,
      oldestInvoiceNo: String(oldestRow?.invoice?.invoice_no || '-'),
      oldestInvoiceDate: String(oldestRow?.created_at || ''),
      oldestInvoiceAgeDays: diffDaysFromNow(oldestRow?.created_at),
    };
  }, [invoiceSearch, receivableInvoiceRows]);
  const receivablePortfolioSummary = useMemo(() => {
    if (invoiceFilter !== 'receivable') {
      return null;
    }
    const rows = filteredInvoices.filter((row) => Number(row?.invoice?.due_total || 0) > 0);
    if (rows.length === 0) {
      return null;
    }
    const totals = rows.reduce((acc, row) => {
      acc.totalDue += Number(row?.invoice?.due_total || 0);
      acc.totalPaid += Number(row?.invoice?.paid_total || 0);
      acc.totalInvoices += 1;
      if (Boolean(row?.invoice?.can_pay)) {
        acc.totalPayable += 1;
      } else {
        acc.totalBlocked += 1;
      }
      return acc;
    }, {
      totalDue: 0,
      totalPaid: 0,
      totalInvoices: 0,
      totalPayable: 0,
      totalBlocked: 0,
    });
    return {
      totalInvoices: totals.totalInvoices,
      totalDue: roundMoney(totals.totalDue),
      totalPaid: roundMoney(totals.totalPaid),
      totalPayable: totals.totalPayable,
      totalBlocked: totals.totalBlocked,
    };
  }, [filteredInvoices, invoiceFilter]);
  const closeInvoiceDetailModal = () => {
    setInvoiceDetailModal({
      visible: false,
      row: null,
      orderId: '-',
      invoiceNo: '-',
      customerName: 'Pelanggan umum',
      note: '',
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
        sourceRow = normalizeOrderDetailRow(detailPayload, row) || row;
      } catch (_error) {
        // fallback ke row list invoice
      }
    }

    const orderId = String(sourceRow?.id || '-');
    const invoiceNo = String(sourceRow?.invoice?.invoice_no || '-');
    const customerName = String(sourceRow?.customer?.name || 'Pelanggan umum');
    const orderNote = stripWorkflowSystemNotes(sourceRow?.payment?.note || sourceRow?.note || sourceRow?.notes || '');
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
      const productName = toLabel(
        item?.product_name,
        item?.product?.name,
        productNameMapById.get(Number(item?.product_id || item?.pos_product_id || 0)),
        item?.name,
        `Item #${index + 1}`,
      );
      const pages = Math.max(Number(restored.pages || item?.pages || 1) || 1, 1);
      const showPages = isNotebookLikeProductName(productName) || pages > 1;
      const materialText = restored.materialText || '-';
      const pricingSummary = buildPricingSummaryFromBackendItem(item, materialText);
      const lineTotal = resolveItemGrandTotal(item, pricingSummary);
      return {
        key: String(item?.id || `item-${index}`),
        productName,
        qty: Math.max(Number(item?.qty || item?.quantity || 1) || 1, 1),
        sizeText: restored.sizeText || '-',
        finishingText: restored.finishingText || '-',
        lbMaxText: restored.lbMaxText || '-',
        materialText,
        pages,
        showPages,
        productionStatus: String(item?.production_status || ''),
        productionStatusLabel: formatProductionStatusLabel(item?.production_status),
        pricingSummary,
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
      note: orderNote,
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
    let sourceRow = row;
    const orderId = Number(row?.id || 0);
    if (orderId > 0) {
      try {
        const detailPayload = await fetchPosOrderDetail(orderId);
        sourceRow = normalizeOrderDetailRow(detailPayload, row) || row;
      } catch (_error) {
        // fallback pakai data list invoice bila detail order gagal diambil
      }
    }
    const items = Array.isArray(sourceRow?.items) ? sourceRow.items : [];
    let itemDetails = items.map((item) => {
      const restored = restoreDraftItemDisplay(item, materialMapById, finishingNameMapById);
      const lineTotal = resolveItemGrandTotal(item);
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
    const total = Number(
      sourceRow?.invoice?.total
      || sourceRow?.total
      || sourceRow?.grand_total
      || calculateDraftItemsTotal(items)
      || 0,
    );
    const receiptData = buildReceiptDataFromOrderRow(sourceRow, items, posSettings);
    await printReceiptViaBrowserFallback({
      noticeTitle: 'Cetak Ulang',
      receiptData,
      profileInput: activePrinterProfile,
      shouldTryPrinterProfile: hasSavedPrinterProfile,
      forceBrowserPrint: true,
      onPrinterFailureMessage: (message) => {
        openNotice('Cetak Ulang', `Printer kasir gagal dipakai, fallback ke browser. Detail: ${message}`);
      },
    });
  };

  const handleTestPrint = async () => {
    const profile = activePrinterProfile;
    const receiptSettings = normalizeReceiptSettings(posSettings);
    const baseReceipt = generateTestReceipt(profile);
    const receiptData = {
      ...baseReceipt,
      store: {
        ...baseReceipt.store,
        title: receiptSettings.receipt_title || baseReceipt.store.title,
        name: receiptSettings.brand_name || baseReceipt.store.name,
        logoUrl: receiptSettings.receipt_logo_url || baseReceipt.store.logoUrl,
        tagline: receiptSettings.brand_tagline || baseReceipt.store.tagline,
        address: receiptSettings.receipt_store_address || baseReceipt.store.address,
        phone: receiptSettings.receipt_store_phone || baseReceipt.store.phone,
        headerText: receiptSettings.receipt_header_text || baseReceipt.store.headerText,
        footer: receiptSettings.receipt_footer || baseReceipt.store.footer,
      },
      layout: {
        showOrderId: Boolean(receiptSettings.receipt_show_order_id),
        showCashier: Boolean(receiptSettings.receipt_show_cashier),
        showCustomer: Boolean(receiptSettings.receipt_show_customer),
        showPaymentDetail: Boolean(receiptSettings.receipt_show_payment_detail),
      },
    };

    const printed = await printReceiptViaBrowserFallback({
      noticeTitle: 'Test Printer',
      receiptData,
      profileInput: profile,
      onPrinterFailureMessage: () => {},
    }).catch((error) => {
      openNotice('Test Printer', `Test print gagal: ${error.message}`);
      return false;
    });

    if (printed) {
      setHasSavedPrinterProfile(true);
      persistPrinterProfile(profile);
      openNotice('Test Printer', `Test print berhasil dikirim ke profile ${profile.name}.`, null, { autoCloseMs: 2200 });
    }
  };

  const closingPaymentRows = useMemo(
    () => Array.isArray(closingReport?.payments?.breakdown) ? closingReport.payments.breakdown : [],
    [closingReport],
  );
  const closingPaymentMethodSummary = useMemo(() => {
    const totals = {
      cash: 0,
      transfer: 0,
      qris: 0,
      card: 0,
      other: 0,
    };
    closingPaymentRows.forEach((row) => {
      const method = String(row?.method || '').trim().toLowerCase();
      const amount = roundMoney(Number(row?.total_amount || 0));
      if (method === 'cash') {
        totals.cash += amount;
      } else if (method === 'transfer') {
        totals.transfer += amount;
      } else if (method === 'qris') {
        totals.qris += amount;
      } else if (method === 'card') {
        totals.card += amount;
      } else {
        totals.other += amount;
      }
    });
    return {
      cash: roundMoney(totals.cash),
      transfer: roundMoney(totals.transfer),
      qris: roundMoney(totals.qris),
      card: roundMoney(totals.card),
      other: roundMoney(totals.other),
    };
  }, [closingPaymentRows]);
  const closingCashInHandSummary = useMemo(() => {
    const cashSales = roundMoney(Number(closingReport?.payments?.cash_total || 0));
    const cashReceivable = roundMoney(Number(closingReport?.receivable_collections?.cash_total || 0));
    const cashIncomeOther = roundMoney(Number(closingReport?.external_cash?.income_total || 0));
    const cashExpenseOther = roundMoney(Number(closingReport?.external_cash?.expense_total || 0));
    const physicalCashExpected = roundMoney(cashSales + cashReceivable + cashIncomeOther - cashExpenseOther);
    return {
      cashSales,
      cashReceivable,
      cashIncomeOther,
      cashExpenseOther,
      physicalCashExpected,
    };
  }, [closingReport]);
  const closingNonCashSummary = useMemo(() => {
    const nonCashSales = roundMoney(Number(closingReport?.payments?.non_cash_total || 0));
    const nonCashReceivable = roundMoney(Number(closingReport?.receivable_collections?.non_cash_total || 0));
    return {
      nonCashSales,
      nonCashReceivable,
      total: roundMoney(nonCashSales + nonCashReceivable),
    };
  }, [closingReport]);
  const availableCashFlowTypes = useMemo(
    () => (Array.isArray(cashFlowTypes) ? cashFlowTypes : []).filter((row) => String(row?.transaction_type || '') === String(cashFlowTransactionType || '')),
    [cashFlowTransactionType, cashFlowTypes],
  );
  const filteredCashFlowRows = useMemo(() => {
    const rows = Array.isArray(cashFlowRows) ? cashFlowRows : [];
    if (!['income', 'expense'].includes(String(cashFlowHistoryFilter || ''))) {
      return rows;
    }
    return rows.filter((row) => String(row?.transaction_type || '').toLowerCase() === String(cashFlowHistoryFilter || '').toLowerCase());
  }, [cashFlowHistoryFilter, cashFlowRows]);
  const selectedCashFlowType = useMemo(
    () => availableCashFlowTypes.find((row) => Number(row?.id || 0) === Number(cashFlowTypeId || 0)) || null,
    [availableCashFlowTypes, cashFlowTypeId],
  );
  const recentCashFlowCategories = useMemo(
    () => Array.from(new Set(
      (Array.isArray(cashFlowRows) ? cashFlowRows : [])
        .filter((row) => String(row?.transaction_type || '') === String(cashFlowTransactionType || ''))
        .map((row) => String(row?.category || '').trim())
        .filter(Boolean),
    )).slice(0, 6),
    [cashFlowRows, cashFlowTransactionType],
  );
  const quickCashFlowCategories = useMemo(() => {
    const backendTypeRows = availableCashFlowTypes.map((row) => ({
      key: `type-${row?.id || row?.name || ''}`,
      label: String(row?.name || '-'),
      typeId: Number(row?.id || 0) || null,
      manualCategory: '',
      source: 'backend',
    }));
    const fallbackRows = (DEFAULT_CASH_FLOW_QUICK_CATEGORIES[cashFlowTransactionType] || []).map((label) => ({
      key: `fallback-${cashFlowTransactionType}-${label}`,
      label,
      typeId: null,
      manualCategory: label,
      source: 'fallback',
    }));
    const recentRows = recentCashFlowCategories.map((label) => ({
      key: `recent-${cashFlowTransactionType}-${label}`,
      label,
      typeId: null,
      manualCategory: label,
      source: 'recent',
    }));
    const merged = [...backendTypeRows, ...recentRows, ...fallbackRows];
    const seen = new Set();
    return merged.filter((row) => {
      const signature = normalizeText(row.label);
      if (!signature || seen.has(signature)) {
        return false;
      }
      seen.add(signature);
      return true;
    }).slice(0, 12);
  }, [availableCashFlowTypes, cashFlowTransactionType, recentCashFlowCategories]);
  const closingExternalRows = useMemo(
    () => Array.isArray(closingReport?.external_cash?.transactions) ? closingReport.external_cash.transactions : [],
    [closingReport],
  );
  const closingReceivableSettlementRows = useMemo(
    () => Array.isArray(closingReport?.receivable_collections?.settlements) ? closingReport.receivable_collections.settlements : [],
    [closingReport],
  );
  const closingReceivableBreakdownRows = useMemo(
    () => Array.isArray(closingReport?.receivable_collections?.breakdown) ? closingReport.receivable_collections.breakdown : [],
    [closingReport],
  );
  const selectedFinanceRecipientRow = useMemo(
    () => (Array.isArray(financeRecipients) ? financeRecipients : [])
      .find((row) => Number(row?.id || 0) === Number(closingFinanceRecipientId || 0)) || null,
    [financeRecipients, closingFinanceRecipientId],
  );
  const filteredDamageProductOptions = useMemo(() => {
    const keyword = normalizeText(damageProductSearch);
    const rows = Array.isArray(products) ? products : [];
    const filtered = keyword
      ? rows.filter((row) => {
        const name = normalizeText(row?.name || '');
        const sku = normalizeText(row?.sku || '');
        return name.includes(keyword) || sku.includes(keyword);
      })
      : rows;

    return filtered
      .slice(0, 12)
      .map((row) => ({
        id: Number(row?.id || 0),
        name: String(row?.name || '').trim(),
        unitValue: roundMoney(Number(row?.price_regular || row?.price || row?.price_reseller || row?.bottom_price || 0)),
      }))
      .filter((row) => row.id > 0 && row.name);
  }, [damageProductSearch, products]);
  const selectedDamageProductRow = useMemo(
    () => filteredDamageProductOptions.find((row) => Number(row?.id || 0) === Number(selectedDamageProductId || 0))
      || (Array.isArray(products) ? products : []).map((row) => ({
        id: Number(row?.id || 0),
        name: String(row?.name || '').trim(),
        unitValue: roundMoney(Number(row?.price_regular || row?.price || row?.price_reseller || row?.bottom_price || 0)),
      })).find((row) => Number(row?.id || 0) === Number(selectedDamageProductId || 0))
      || null,
    [filteredDamageProductOptions, products, selectedDamageProductId],
  );
  const closingTopProducts = useMemo(
    () => Array.isArray(closingReport?.top_products) ? closingReport.top_products : [],
    [closingReport],
  );
  const closingStatusRows = useMemo(
    () => Array.isArray(closingReport?.sales?.status_breakdown) ? closingReport.sales.status_breakdown : [],
    [closingReport],
  );
  const closingDamageSummary = useMemo(() => {
    const rows = Array.isArray(closingDamageItems) ? closingDamageItems : [];
    return rows.reduce((acc, row) => {
      const qty = Math.max(0, Number(row?.qty || 0)) || 0;
      const estimatedTotalValue = roundMoney(Number(row?.estimatedTotalValue || 0));
      acc.itemCount += 1;
      acc.totalQty += qty;
      acc.totalEstimatedValue = roundMoney(acc.totalEstimatedValue + estimatedTotalValue);
      if (String(row?.auditStatus || '').trim().toLowerCase() !== 'reported') {
        acc.auditedCount += 1;
      }
      return acc;
    }, {
      itemCount: 0,
      totalQty: 0,
      totalEstimatedValue: 0,
      auditedCount: 0,
    });
  }, [closingDamageItems]);
  const closingOpeningCashValue = useMemo(() => parseCurrencyInput(closingOpeningCash), [closingOpeningCash]);
  const closingActualCashValue = useMemo(() => parseCurrencyInput(closingActualCash), [closingActualCash]);
  const closingExpectedCashValue = useMemo(() => {
    if (!closingReport) return 0;
    return roundMoney(closingOpeningCashValue + Number(closingReport?.closing?.net_cash_movement || 0));
  }, [closingOpeningCashValue, closingReport]);
  const closingCashDifferenceValue = useMemo(
    () => roundMoney(closingActualCashValue - closingExpectedCashValue),
    [closingActualCashValue, closingExpectedCashValue],
  );
  const pendingCashOutAfterInput = useMemo(() => {
    if (String(cashFlowTransactionType || '') !== 'expense') {
      return closingExpectedCashValue;
    }
    return roundMoney(closingExpectedCashValue - parseCurrencyInput(cashFlowAmount));
  }, [cashFlowAmount, cashFlowTransactionType, closingExpectedCashValue]);
  const cashOutWarningText = useMemo(() => {
    const amount = parseCurrencyInput(cashFlowAmount);
    if (String(cashFlowTransactionType || '') !== 'expense' || amount <= 0) {
      return '';
    }
    if (amount > closingExpectedCashValue && closingExpectedCashValue > 0) {
      return `Nominal kas keluar melebihi saldo kas sistem saat ini (${formatRupiah(closingExpectedCashValue)}).`;
    }
    if (pendingCashOutAfterInput < 0) {
      return `Setelah transaksi ini, saldo kas sistem menjadi minus ${formatRupiah(Math.abs(pendingCashOutAfterInput))}.`;
    }
    if (closingExpectedCashValue > 0 && amount >= (closingExpectedCashValue * 0.7)) {
      return `Nominal kas keluar cukup besar dibanding saldo kas sistem saat ini (${formatRupiah(closingExpectedCashValue)}).`;
    }
    return '';
  }, [cashFlowAmount, cashFlowTransactionType, closingExpectedCashValue, pendingCashOutAfterInput]);
  const closingSummaryText = useMemo(() => {
    if (!closingReport) {
      return '';
    }
    const reportDate = String(closingReport?.date || closingReportDate || '-');
    const cashierName = String(currentUser?.name || 'Kasir').trim() || 'Kasir';
    return [
      `LAPORAN TUTUP TOKO`,
      `Tanggal: ${reportDate}`,
      `Kasir: ${cashierName}`,
      '',
      `Penjualan bruto: ${formatRupiah(closingReport?.sales?.gross_total || 0)}`,
      `Pembayaran penjualan hari ini: ${formatRupiah(closingReport?.sales?.payment_received_total || 0)}`,
      `Pelunasan piutang hari ini: ${formatRupiah(closingReport?.receivable_collections?.total || 0)}`,
      `Piutang / belum lunas: ${formatRupiah(closingReport?.sales?.outstanding_total || 0)}`,
      `Rata-rata transaksi: ${formatRupiah(closingReport?.sales?.average_ticket || 0)}`,
      '',
      `Tunai seharusnya di kasir: ${formatRupiah(closingCashInHandSummary.physicalCashExpected)}`,
      `Non tunai masuk rekening: ${formatRupiah(closingNonCashSummary.total)}`,
      `Kas masuk lain: ${formatRupiah(closingReport?.external_cash?.income_total || 0)}`,
      `Kas keluar: ${formatRupiah(closingReport?.external_cash?.expense_total || 0)}`,
      `Pergerakan kas bersih: ${formatRupiah(closingReport?.closing?.net_cash_movement || 0)}`,
      `Saldo awal kas: ${formatRupiah(closingOpeningCashValue)}`,
      `Saldo kas sistem: ${formatRupiah(closingExpectedCashValue)}`,
      `Uang fisik akhir: ${formatRupiah(closingActualCashValue)}`,
      `Selisih kas: ${formatRupiah(closingCashDifferenceValue)}`,
    ].join('\n');
  }, [
    closingActualCashValue,
    closingCashDifferenceValue,
    closingCashInHandSummary.physicalCashExpected,
    closingExpectedCashValue,
    closingNonCashSummary.total,
    closingOpeningCashValue,
    closingReport,
    closingReportDate,
    currentUser?.name,
  ]);

  const handleCopyClosingSummary = async () => {
    if (!closingSummaryText) {
      openNotice('Laporan Close Order', 'Belum ada ringkasan laporan yang bisa disalin.');
      return;
    }
    try {
      const clipboard = globalThis?.navigator?.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') {
        throw new Error('Clipboard belum tersedia di perangkat ini.');
      }
      await clipboard.writeText(closingSummaryText);
      openNotice('Laporan Close Order', 'Ringkasan laporan berhasil disalin. Tinggal kirim ke finance.', null, {
        autoCloseMs: 2200,
      });
    } catch (error) {
      openNotice('Laporan Close Order', `Gagal menyalin ringkasan: ${error.message}`);
    }
  };

  const handleSubmitCloserOrder = async () => {
    if (!closingReport) {
      openNotice('Laporan Close Order', 'Generate laporan dulu sebelum kirim ke finance.');
      return;
    }
    const financeUserId = Number(closingFinanceRecipientId || 0);
    if (!(financeUserId > 0)) {
      openNotice('Laporan Close Order', 'Pilih admin keuangan penerima close order terlebih dahulu.');
      return;
    }

    try {
      setIsClosingSubmitLoading(true);
      const payload = await submitPosCloserOrder({
        report_date: String(closingReport?.date || closingReportDate || formatIsoDate(new Date())),
        finance_user_id: financeUserId,
        opening_cash: closingOpeningCashValue,
        expected_cash: closingExpectedCashValue,
        cashier_actual_cash: closingActualCashValue,
        cashier_note: closingShiftNote || '',
        damage_items: closingDamageItems.map((row) => ({
          product_id: Number(row?.productId || 0),
          qty: Math.max(0, Number(row?.qty || 0)),
          note: String(row?.note || '').trim(),
        })).filter((row) => row.product_id > 0 && row.qty > 0),
        report_snapshot: {
          sales: closingReport?.sales || null,
          payments: closingReport?.payments || null,
          receivable_collections: closingReport?.receivable_collections || null,
          external_cash: closingReport?.external_cash || null,
          closing: closingReport?.closing || null,
          top_products: closingReport?.top_products || [],
        },
      });
      setClosingRecord(payload && typeof payload === 'object' ? payload : null);
      openNotice('Laporan Close Order', 'Close order berhasil dikirim ke admin keuangan untuk divalidasi.', null, {
        autoCloseMs: 2200,
      });
    } catch (error) {
      openNotice('Laporan Close Order', `Gagal mengirim close order: ${error.message}`);
    } finally {
      setIsClosingSubmitLoading(false);
    }
  };

  const handleAddDamageItem = () => {
    const productId = Number(selectedDamageProductId || 0);
    const qty = Math.max(0, Number(String(damageQtyInput || '0').replace(',', '.')) || 0);
    if (!(productId > 0) || qty <= 0) {
      openNotice('Barang Rusak', 'Pilih produk dan isi qty barang rusak terlebih dahulu.');
      return;
    }

    const productRow = selectedDamageProductRow;
    const productName = String(productRow?.name || '').trim();
    const unitValue = roundMoney(Number(productRow?.unitValue || 0));

    setClosingDamageItems((prev) => ([
      ...prev,
      {
        id: `damage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productId,
        productName,
        qty,
        note: String(damageNoteInput || '').trim(),
        estimatedTotalValue: roundMoney(unitValue * qty),
        auditStatus: 'reported',
        responsibility: '',
      },
    ]));
    setSelectedDamageProductId(null);
    setDamageProductSearch('');
    setDamageQtyInput('1');
    setDamageNoteInput('');
  };

  const handleSubmitCashFlow = async () => {
    const amount = parseCurrencyInput(cashFlowAmount);
    const occurredAt = String(closingReportDate || formatIsoDate(new Date())).trim();
    const manualCategory = String(cashFlowCategory || '').trim();
    if (!occurredAt) {
      openNotice('Kas Masuk / Keluar', 'Tanggal transaksi wajib diisi.');
      return;
    }
    if (amount <= 0) {
      openNotice('Kas Masuk / Keluar', 'Nominal transaksi wajib lebih dari nol.');
      return;
    }
    if (!selectedCashFlowType && !manualCategory) {
      openNotice('Kas Masuk / Keluar', 'Pilih kategori transaksi atau isi kategori manual.');
      return;
    }

    try {
      setIsCashFlowSubmitting(true);
      await createPosCashFlow({
        transaction_type: cashFlowTransactionType,
        occurred_at: occurredAt,
        amount,
        income_expense_type_id: selectedCashFlowType ? Number(selectedCashFlowType.id) : null,
        category: selectedCashFlowType ? null : manualCategory,
        note: String(cashFlowNote || '').trim() || null,
      });
      setCashFlowTypeId(null);
      setCashFlowCategory('');
      setCashFlowAmount('');
      setCashFlowNote('');
      await Promise.all([
        loadCashFlowRows(occurredAt),
        loadClosingReport(occurredAt),
      ]);
      openNotice(
        'Kas Masuk / Keluar',
        `${cashFlowTransactionType === 'income' ? 'Kas masuk' : 'Kas keluar'} berhasil dicatat dan masuk ke laporan closing.`,
        null,
        { autoCloseMs: 2200 },
      );
    } catch (error) {
      openNotice('Kas Masuk / Keluar', `Gagal menyimpan transaksi kas: ${formatBackendValidationError(error)}`);
    } finally {
      setIsCashFlowSubmitting(false);
    }
  };

  const handleSelectQuickCashFlowCategory = (row) => {
    const nextTypeId = Number(row?.typeId || 0) || null;
    if (nextTypeId) {
      setCashFlowTypeId(nextTypeId);
      setCashFlowCategory('');
      return;
    }
    setCashFlowTypeId(null);
    setCashFlowCategory(String(row?.manualCategory || row?.label || '').trim());
  };

  const buildClosingReportHtml = () => {
    if (!closingReport) {
      return '';
    }
    const reportDate = String(closingReport?.date || closingReportDate || '-');
    const cashierName = String(currentUser?.name || 'Kasir').trim() || 'Kasir';
    const receiptSettings = normalizeReceiptSettings(posSettings);
    const logoUrl = String(receiptSettings?.receipt_logo_url || '').trim();
    const brandName = String(receiptSettings?.brand_name || 'SIDOMULYO ADVERTISING').trim() || 'SIDOMULYO ADVERTISING';
    const brandTagline = String(receiptSettings?.brand_tagline || '').trim();
    const financeRecipient = String(closingFinanceRecipient || '').trim() || '-';
    const shiftNote = String(closingShiftNote || '').trim() || '-';
    const paymentLines = closingPaymentRows.length > 0
      ? closingPaymentRows.map((row) => `<div class="line"><span>${escapeHtml(humanizePaymentMethod(row?.method))}</span><strong>${escapeHtml(formatRupiah(row?.total_amount || 0))}</strong></div>`).join('')
      : '<div class="muted">Belum ada pembayaran penjualan hari ini</div>';
    const receivableLines = closingReceivableBreakdownRows.length > 0
      ? closingReceivableBreakdownRows.map((row) => `<div class="line"><span>${escapeHtml(humanizePaymentMethod(row?.method))}</span><strong>${escapeHtml(formatRupiah(row?.total_amount || 0))}</strong></div>`).join('')
      : '<div class="muted">Belum ada pelunasan piutang hari ini</div>';
    const externalLines = closingExternalRows.length > 0
      ? closingExternalRows.slice(0, 6).map((row) => `
        <div class="mini-item">
          <div><strong>${escapeHtml(String(row?.transaction_type || '').toLowerCase() === 'expense' ? 'Keluar' : 'Masuk')}</strong> - ${escapeHtml(String(row?.category || '-'))}</div>
          <div class="muted">${escapeHtml(String(row?.note || '-'))}</div>
          <div><strong>${escapeHtml(formatRupiah(row?.amount || 0))}</strong></div>
        </div>
      `).join('')
      : '<div class="muted">Tidak ada kas masuk / keluar tambahan</div>';
    const receivableRefs = closingReceivableSettlementRows.length > 0
      ? closingReceivableSettlementRows.slice(0, 5).map((row) => `
        <div class="mini-item">
          <div><strong>${escapeHtml(String(row?.invoice_no || '-'))}</strong></div>
          <div class="muted">${escapeHtml(String(row?.customer_name || 'Pelanggan umum'))} | ${escapeHtml(humanizePaymentMethod(row?.method))}</div>
          <div><strong>${escapeHtml(formatRupiah(row?.amount || 0))}</strong></div>
        </div>
      `).join('')
      : '<div class="muted">Tidak ada referensi pelunasan piutang</div>';
    const damageLines = closingDamageItems.length > 0
      ? closingDamageItems.map((row, index) => `
        <div class="mini-item">
          <div><strong>${index + 1}. ${escapeHtml(String(row?.productName || '-'))}</strong></div>
          <div class="muted">Qty: ${escapeHtml(String(row?.qty || 0))} | Estimasi: ${escapeHtml(formatRupiah(row?.estimatedTotalValue || 0))}</div>
          <div class="muted">Status Audit: ${escapeHtml(humanizeStatusLabel(row?.auditStatus || 'reported'))}${row?.responsibility ? ` | Beban: ${escapeHtml(humanizeStatusLabel(row.responsibility))}` : ''}</div>
          <div>${escapeHtml(String(row?.note || '-'))}</div>
        </div>
      `).join('')
      : '<div class="muted">Tidak ada barang reject / rusak yang dilaporkan.</div>';

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Laporan Close Order ${escapeHtml(reportDate)}</title>
  <style>
    body { font-family: "Courier New", monospace; margin: 0; padding: 0; color: #111; }
    .wrap { width: 80mm; max-width: 80mm; margin: 0 auto; padding: 8px 6px 12px; }
    .brand { text-align: center; margin-bottom: 8px; }
    .brand-logo { max-width: 38mm; max-height: 18mm; object-fit: contain; margin: 0 auto 4px; display: block; }
    .brand-name { font-size: 12px; font-weight: 700; margin-bottom: 2px; }
    .brand-tagline { font-size: 9px; margin-bottom: 4px; }
    h1 { margin: 0 0 6px 0; font-size: 15px; text-align: center; }
    h2 { margin: 12px 0 6px 0; font-size: 12px; text-transform: uppercase; border-top: 1px dashed #444; padding-top: 6px; }
    .meta { font-size: 10px; margin-bottom: 2px; text-align: center; }
    .line { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; margin-bottom: 3px; }
    .line strong { font-size: 10px; }
    .muted { font-size: 9px; color: #444; margin-bottom: 4px; }
    .mini-item { font-size: 10px; margin-bottom: 5px; }
    .signatures { margin-top: 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .signature-card { text-align: center; font-size: 10px; }
    .signature-space { height: 44px; border-bottom: 1px solid #444; margin-bottom: 5px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      ${logoUrl ? `<img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="Logo Toko" />` : ''}
      <div class="brand-name">${escapeHtml(brandName)}</div>
      ${brandTagline ? `<div class="brand-tagline">${escapeHtml(brandTagline)}</div>` : ''}
    </div>
    <h1>Laporan Close Order</h1>
    <div class="meta">Tanggal: ${escapeHtml(reportDate)}</div>
    <div class="meta">Kasir: ${escapeHtml(cashierName)}</div>
    <h2>Omzet</h2>
    <div class="line"><span>Omzet Hari Ini</span><strong>${escapeHtml(formatRupiah(closingReport?.sales?.gross_total || 0))}</strong></div>
    <div class="line"><span>Bayar Penjualan Hari Ini</span><strong>${escapeHtml(formatRupiah(closingReport?.sales?.payment_received_total || 0))}</strong></div>
    <div class="line"><span>Piutang Hari Ini</span><strong>${escapeHtml(formatRupiah(closingReport?.sales?.outstanding_total || 0))}</strong></div>

    <h2>Pelunasan Piutang</h2>
    <div class="line"><span>Total Pelunasan</span><strong>${escapeHtml(formatRupiah(closingReport?.receivable_collections?.total || 0))}</strong></div>
    <div class="line"><span>Cash</span><strong>${escapeHtml(formatRupiah(closingReport?.receivable_collections?.cash_total || 0))}</strong></div>
    <div class="line"><span>Non Cash</span><strong>${escapeHtml(formatRupiah(closingReport?.receivable_collections?.non_cash_total || 0))}</strong></div>
    ${receivableLines}

    <h2>Pembayaran</h2>
    <div class="line"><span>Cash Sales</span><strong>${escapeHtml(formatRupiah(closingReport?.payments?.cash_total || 0))}</strong></div>
    <div class="line"><span>Transfer Sales</span><strong>${escapeHtml(formatRupiah(closingPaymentMethodSummary.transfer))}</strong></div>
    <div class="line"><span>QRIS Sales</span><strong>${escapeHtml(formatRupiah(closingPaymentMethodSummary.qris))}</strong></div>
    <div class="line"><span>Card Sales</span><strong>${escapeHtml(formatRupiah(closingPaymentMethodSummary.card))}</strong></div>
    <div class="line"><span>Non Cash Sales</span><strong>${escapeHtml(formatRupiah(closingReport?.payments?.non_cash_total || 0))}</strong></div>
    ${closingPaymentMethodSummary.other > 0 ? `<div class="line"><span>Metode Lain</span><strong>${escapeHtml(formatRupiah(closingPaymentMethodSummary.other))}</strong></div>` : ''}
    ${paymentLines}

    <h2>Kasir vs Rekening</h2>
    <div class="line"><span>Tunai di Kasir</span><strong>${escapeHtml(formatRupiah(closingCashInHandSummary.physicalCashExpected))}</strong></div>
    <div class="line"><span>Non Tunai Rekening</span><strong>${escapeHtml(formatRupiah(closingNonCashSummary.total))}</strong></div>

    <h2>Kas Lain</h2>
    <div class="line"><span>Kas Masuk Lain</span><strong>${escapeHtml(formatRupiah(closingReport?.external_cash?.income_total || 0))}</strong></div>
    <div class="line"><span>Kas Keluar</span><strong>${escapeHtml(formatRupiah(closingReport?.external_cash?.expense_total || 0))}</strong></div>
    ${externalLines}

    <h2>Barang Reject / Rusak</h2>
    <div class="line"><span>Jumlah Item</span><strong>${escapeHtml(String(closingDamageSummary.itemCount || 0))}</strong></div>
    <div class="line"><span>Total Qty</span><strong>${escapeHtml(String(closingDamageSummary.totalQty || 0))}</strong></div>
    <div class="line"><span>Estimasi Nilai</span><strong>${escapeHtml(formatRupiah(closingDamageSummary.totalEstimatedValue || 0))}</strong></div>
    <div class="line"><span>Sudah Diaudit</span><strong>${escapeHtml(String(closingDamageSummary.auditedCount || 0))}</strong></div>
    ${damageLines}

    <h2>Closing Kas</h2>
    <div class="line"><span>Saldo Awal</span><strong>${escapeHtml(formatRupiah(closingOpeningCashValue))}</strong></div>
    <div class="line"><span>Saldo Sistem</span><strong>${escapeHtml(formatRupiah(closingExpectedCashValue))}</strong></div>
    <div class="line"><span>Uang Fisik</span><strong>${escapeHtml(formatRupiah(closingActualCashValue))}</strong></div>
    <div class="line"><span>Selisih</span><strong>${escapeHtml(formatRupiah(closingCashDifferenceValue))}</strong></div>

    <h2>Referensi Piutang</h2>
    ${receivableRefs}

    <h2>Serah Terima</h2>
    <div class="mini-item"><strong>Finance:</strong> ${escapeHtml(financeRecipient)}</div>
    <div class="mini-item"><strong>Catatan:</strong> ${escapeHtml(shiftNote)}</div>

    <div class="signatures">
      <div class="signature-card">
        <div class="signature-space"></div>
        <div>Kasir</div>
      </div>
      <div class="signature-card">
        <div class="signature-space"></div>
        <div>Finance</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  };

  const handlePrintClosingReport = () => {
    if (!closingReport) {
      openNotice('Laporan Close Order', 'Generate laporan dulu sebelum dicetak.');
      return;
    }
    const html = buildClosingReportHtml();
    if (!html) {
      openNotice('Laporan Close Order', 'HTML laporan belum berhasil dibuat.');
      return;
    }
    printHtmlDocument(html, 'Cetak Laporan Close Order');
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
              style={[styles.greenTab, activeMenu === 'report' ? styles.greenTabActive : null]}
              onPress={() => setActiveMenu('report')}
            >
              <Text style={styles.greenTabText}>Laporan</Text>
            </Pressable>
            <Pressable
              style={[styles.greenTab, activeMenu === 'settings' ? styles.greenTabActive : null]}
              onPress={() => setActiveMenu('settings')}
            >
              <Text style={styles.greenTabText}>Pengaturan</Text>
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
                negotiatedPriceInput={negotiatedPriceInput}
                onChangeNegotiatedPrice={(value) => setNegotiatedPriceInput(sanitizeCurrencyInput(value))}
                sizeWidthMeter={sizeWidthMeter}
                onChangeSizeWidthMeter={(value) => setSizeWidthMeter(sanitizeDecimalInput(value))}
                sizeLengthMeter={sizeLengthMeter}
                onChangeSizeLengthMeter={(value) => setSizeLengthMeter(sanitizeDecimalInput(value))}
                isFixedSizeProduct={selectedProductFixedSizeMode.enabled}
                fixedSizeLabel={selectedProductFixedSizeMode.label}
                fixedSizeHint={selectedProductFixedSizeMode.helperText}
                hideFinishingField={selectedProductFixedSizeMode.enabled}
                selectedFinishingIds={selectedFinishingIds}
                selectedFinishingMataAyamQtyById={selectedFinishingMataAyamQtyById}
                finishingSummary={selectedFinishingDisplay}
                finishingOptions={regularFinishingOptions}
                finishingAvailabilityMessage={finishingAvailabilityMessage}
                isPrintingFinishingMode={isPrintingProductType(selectedProductType)}
                isStrictStickerFinishingMode={selectedIsStrictSticker}
                autoApplyFinishingSelection={autoApplyMmtFinishing}
                onSaveSelectedFinishings={handleSaveSelectedFinishings}
                onSaveSelectedFinishingMataAyamQtyById={handleSaveSelectedFinishingMataAyamQtyById}
                selectedLbMaxProductId={selectedLbMaxProductId}
                lbMaxSummary={selectedLbMaxSummary}
                lbMaxOptions={lbMaxFinishingOptions}
                onSaveSelectedLbMax={setSelectedLbMaxProductId}
                showPagesInput={selectedProductType === 'book'}
                pages={pages}
                onChangePages={(value) => setPages(sanitizeNumericInput(value))}
                materialDisplay={resolvedPreviewMaterialDisplay}
                materialError={previewMaterialError}
                materialWarning={previewMaterialWarning}
                mataAyamIssueBadge={mergedMataAyamIssueBadge}
                onValidateProduct={handleValidateProduct}
                onAddToCart={handleAddToCart}
                itemFinalPrice={itemFinalPrice}
                pricingSummary={previewPricingSummary}
                negotiationNotice={selectedA3NegotiationState}
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
                paymentMethodHelperText={paymentMethodHelperText}
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
                <Pressable
                  style={[styles.filterButton, invoiceFilter === 'receivable' ? styles.filterButtonActive : null]}
                  onPress={() => setInvoiceFilter('receivable')}
                >
                  <Text style={[styles.filterButtonText, invoiceFilter === 'receivable' ? styles.filterButtonTextActive : null]}>Piutang</Text>
                </Pressable>
              </View>
              {invoiceFilter === 'receivable' ? (
                <View style={styles.filterRow}>
                  <Pressable
                    style={[styles.filterButton, receivableStatusFilter === 'all' ? styles.filterButtonActive : null]}
                    onPress={() => setReceivableStatusFilter('all')}
                  >
                    <Text style={[styles.filterButtonText, receivableStatusFilter === 'all' ? styles.filterButtonTextActive : null]}>
                      Semua Piutang
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.filterButton, receivableStatusFilter === 'payable' ? styles.filterButtonActive : null]}
                    onPress={() => setReceivableStatusFilter('payable')}
                  >
                    <Text style={[styles.filterButtonText, receivableStatusFilter === 'payable' ? styles.filterButtonTextActive : null]}>
                      Bisa Dibayar
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.filterButton, receivableStatusFilter === 'blocked' ? styles.filterButtonActive : null]}
                    onPress={() => setReceivableStatusFilter('blocked')}
                  >
                    <Text style={[styles.filterButtonText, receivableStatusFilter === 'blocked' ? styles.filterButtonTextActive : null]}>
                      Belum Bisa Dibayar
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              <TextInput
                value={invoiceSearch}
                onChangeText={setInvoiceSearch}
                placeholder="Cari nama customer / no HP / no invoice / order id..."
                placeholderTextColor="#777777"
                style={styles.invoiceSearchInput}
              />
              {receivableCustomerSummary ? (
                <View style={styles.receivableSummaryCard}>
                  <Text style={styles.receivableSummaryTitle}>Ringkasan Piutang Pelanggan</Text>
                  <Text style={styles.receivableSummaryName}>
                    {receivableCustomerSummary.customerName}
                    {receivableCustomerSummary.customerPhone ? ` | ${receivableCustomerSummary.customerPhone}` : ''}
                  </Text>
                  {receivableCustomerSummary.customerCount > 1 ? (
                    <Text style={styles.receivableSummaryWarning}>
                      Hasil pencarian mencakup {receivableCustomerSummary.customerCount} pelanggan. Persempit nama / nomor HP agar tracking lebih spesifik.
                    </Text>
                  ) : null}
                  <Text style={styles.receivableSummaryMeta}>
                    Total invoice piutang: {receivableCustomerSummary.totalInvoice}
                  </Text>
                  <Text style={styles.receivableSummaryMeta}>
                    Total nilai invoice: {formatRupiah(receivableCustomerSummary.totalAmount)}
                  </Text>
                  <Text style={styles.receivableSummaryMeta}>
                    Invoice tertua: {receivableCustomerSummary.oldestInvoiceNo} | {formatDateText(receivableCustomerSummary.oldestInvoiceDate)}
                  </Text>
                  <Text style={styles.receivableSummaryMeta}>
                    Umur piutang tertua: {receivableCustomerSummary.oldestInvoiceAgeDays} hari
                  </Text>
                  <Text style={styles.receivableSummaryAmount}>
                    Total piutang: {formatRupiah(receivableCustomerSummary.totalDue)}
                  </Text>
                </View>
              ) : null}
              {receivablePortfolioSummary ? (
                <View style={styles.receivableSummaryCard}>
                  <Text style={styles.receivableSummaryTitle}>Portofolio Piutang Tampil</Text>
                  <Text style={styles.receivableSummaryMeta}>
                    Total invoice piutang: {receivablePortfolioSummary.totalInvoices}
                  </Text>
                  <Text style={styles.receivableSummaryMeta}>
                    Bisa dibayar: {receivablePortfolioSummary.totalPayable} | Belum bisa dibayar: {receivablePortfolioSummary.totalBlocked}
                  </Text>
                  <Text style={styles.receivableSummaryMeta}>
                    Total sudah dibayar: {formatRupiah(receivablePortfolioSummary.totalPaid)}
                  </Text>
                  <Text style={styles.receivableSummaryAmount}>
                    Total outstanding: {formatRupiah(receivablePortfolioSummary.totalDue)}
                  </Text>
                </View>
              ) : null}
              {filteredInvoices.length === 0 ? (
                <Text style={styles.debugText}>
                  {isDraftLoading
                    ? 'Memuat invoice...'
                    : invoiceFilter === 'receivable'
                      ? 'Belum ada invoice piutang sesuai filter.'
                      : 'Belum ada invoice sesuai filter.'}
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
                    const draftExpiry = isDraftRow ? getDraftExpiryMeta(row?.created_at, draftTimeTick) : null;
                    const invoiceStatus = normalizeInvoiceOrderStatus(row);
                    const productionStage = getCurrentProductionStageForInvoice(row);
                    const productionLabel = isDraftRow ? 'Belum Masuk Produksi' : productionStage.label;
                    const productionColor = isDraftRow ? '#6b7280' : getProductionStatusTextColor(productionStage.key);
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
                                { color: productionColor },
                              ]}
                            >
                              {productionLabel}
                              {!isDraftRow && productionStage.count > 0 ? ` (${productionStage.count} item)` : ''}
                            </Text>
                          </View>
                          <Text style={styles.draftMeta}>Item: {itemCount} | Total: {formatRupiah(total)}</Text>
                          {Number(row?.invoice?.due_total || 0) > 0 ? (
                            <Text style={styles.receivableDueText}>
                              Piutang: {formatRupiah(row?.invoice?.due_total || 0)} | Terbayar: {formatRupiah(row?.invoice?.paid_total || 0)}
                            </Text>
                          ) : null}
                          <Text style={styles.draftMeta}>Tanggal: {String(row?.created_at || '-')}</Text>
                          {isDraftRow ? (
                            <Text
                              style={[
                                styles.draftExpiryMeta,
                                draftExpiry?.isExpired ? styles.draftExpiryMetaExpired : null,
                              ]}
                            >
                              {draftExpiry?.label || `Auto hapus ${DRAFT_AUTO_DELETE_HOURS} jam`}
                            </Text>
                          ) : null}
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
                              {Number(row?.invoice?.due_total || 0) > 0 ? (
                                <Pressable
                                  style={[
                                    styles.receivablePayButton,
                                    !Boolean(row?.invoice?.can_pay) ? styles.draftActionDisabled : null,
                                  ]}
                                  disabled={!Boolean(row?.invoice?.can_pay)}
                                  onPress={() => handleOpenReceivablePaymentModal(row)}
                                >
                                  <Text style={styles.receivablePayButtonText}>
                                    {Boolean(row?.invoice?.can_pay) ? 'Bayar Piutang' : 'Belum Bisa Dibayar'}
                                  </Text>
                                </Pressable>
                              ) : null}
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
          ) : activeMenu === 'report' ? (
            <View style={styles.draftPanel}>
              <View style={styles.draftHeaderRow}>
                <View style={styles.draftInfo}>
                  <Text style={styles.debugTitle}>Laporan Close Order</Text>
                  <Text style={styles.debugText}>
                    Laporan harian order, pembayaran, piutang, dan pergerakan kas yang siap dicetak untuk finance.
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  <Pressable
                    style={styles.refreshButton}
                    onPress={() => loadClosingWorkspace()}
                  >
                    <Text style={styles.refreshButtonText}>{isClosingReportLoading ? 'Memuat...' : 'Refresh'}</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.filterRow}>
                <TextInput
                  value={closingReportDate}
                  onChangeText={setClosingReportDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#6c7485"
                  style={[styles.invoiceSearchInput, styles.reportDateInput]}
                />
                <Pressable style={styles.refreshButton} onPress={() => loadClosingWorkspace(closingReportDate)}>
                  <Text style={styles.refreshButtonText}>Generate</Text>
                </Pressable>
                <Pressable style={styles.refreshButton} onPress={handlePrintClosingReport}>
                  <Text style={styles.refreshButtonText}>Print Laporan</Text>
                </Pressable>
              </View>

              {isClosingReportLoading ? (
                <Text style={styles.debugText}>Sedang menyiapkan laporan close order...</Text>
              ) : closingReport ? (
                <>
                  <View style={styles.reportSectionCard}>
                    <Text style={styles.debugTitle}>Kas Masuk / Keluar Kasir</Text>
                    <Text style={styles.debugText}>
                      Catat pengeluaran mendadak, pembelian kecil, titipan uang, atau uang yang diambil dari kasir supaya laporan closing lebih jelas.
                    </Text>

                    <View style={styles.filterRow}>
                      <Pressable
                        style={[
                          styles.filterButton,
                          cashFlowTransactionType === 'expense' ? styles.filterButtonActive : null,
                        ]}
                        onPress={() => setCashFlowTransactionType('expense')}
                      >
                        <Text style={[
                          styles.filterButtonText,
                          cashFlowTransactionType === 'expense' ? styles.filterButtonTextActive : null,
                        ]}
                        >
                          Kas Keluar
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.filterButton,
                          cashFlowTransactionType === 'income' ? styles.filterButtonActive : null,
                        ]}
                        onPress={() => setCashFlowTransactionType('income')}
                      >
                        <Text style={[
                          styles.filterButtonText,
                          cashFlowTransactionType === 'income' ? styles.filterButtonTextActive : null,
                        ]}
                        >
                          Kas Masuk
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.reportSummaryGrid}>
                      <View style={styles.reportInputGroup}>
                        <Text style={styles.reportInputLabel}>Kategori Cepat</Text>
                        <View style={styles.reportChipWrap}>
                          {isCashFlowTypesLoading ? (
                            <Text style={styles.debugText}>Memuat kategori...</Text>
                          ) : quickCashFlowCategories.length > 0 ? quickCashFlowCategories.map((row) => {
                            const active = row?.typeId
                              ? Number(row.typeId) === Number(cashFlowTypeId || 0)
                              : (!selectedCashFlowType && normalizeText(cashFlowCategory) === normalizeText(row?.manualCategory || row?.label));
                            return (
                              <Pressable
                                key={String(row?.key || `cash-flow-type-${row?.label || 'type'}`)}
                                style={[styles.reportChip, active ? styles.reportChipActive : null]}
                                onPress={() => handleSelectQuickCashFlowCategory(row)}
                              >
                                <View style={styles.reportChipContent}>
                                  <Text style={[styles.reportChipText, active ? styles.reportChipTextActive : null]}>
                                    {String(row?.label || '-')}
                                  </Text>
                                  <View style={[styles.reportChipBadge, active ? styles.reportChipBadgeActive : null]}>
                                    <Text style={[styles.reportChipBadgeText, active ? styles.reportChipBadgeTextActive : null]}>
                                      {formatCashFlowSourceLabel(row?.source)}
                                    </Text>
                                  </View>
                                </View>
                              </Pressable>
                            );
                          }) : (
                            <Text style={styles.debugText}>Belum ada kategori aktif. Isi manual di bawah.</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.reportInputGroup}>
                        <Text style={styles.reportInputLabel}>Kategori Manual</Text>
                        <TextInput
                          value={selectedCashFlowType ? String(selectedCashFlowType?.name || '') : cashFlowCategory}
                          onChangeText={setCashFlowCategory}
                          editable={!selectedCashFlowType}
                          placeholder="Contoh: beli galon, ambil kas owner"
                          placeholderTextColor="#6c7485"
                          style={[
                            styles.reportInput,
                            selectedCashFlowType ? styles.reportInputReadonly : null,
                          ]}
                        />
                      </View>
                      <View style={styles.reportInputGroup}>
                        <Text style={styles.reportInputLabel}>Nominal</Text>
                        <TextInput
                          value={cashFlowAmount}
                          onChangeText={(value) => setCashFlowAmount(sanitizeCurrencyInput(value))}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#6c7485"
                          style={styles.reportInput}
                        />
                      </View>
                      <View style={styles.reportInputGroup}>
                        <Text style={styles.reportInputLabel}>Catatan</Text>
                        <TextInput
                          value={cashFlowNote}
                          onChangeText={setCashFlowNote}
                          placeholder="Contoh: beli kebutuhan mendadak / diambil untuk operasional"
                          placeholderTextColor="#6c7485"
                          multiline
                          numberOfLines={3}
                          style={[styles.reportInput, styles.reportTextarea]}
                        />
                      </View>
                    </View>

                    <View style={styles.headerActions}>
                      <Pressable
                        style={[styles.refreshButton, isCashFlowSubmitting ? styles.draftActionDisabled : null]}
                        disabled={isCashFlowSubmitting}
                        onPress={handleSubmitCashFlow}
                      >
                        <Text style={styles.refreshButtonText}>{isCashFlowSubmitting ? 'Menyimpan...' : 'Simpan Kas Masuk / Keluar'}</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.printerSecondaryButton, isCashFlowRowsLoading ? styles.draftActionDisabled : null]}
                        disabled={isCashFlowRowsLoading}
                        onPress={() => loadCashFlowRows(closingReportDate)}
                      >
                        <Text style={styles.printerSecondaryButtonText}>{isCashFlowRowsLoading ? 'Memuat...' : 'Refresh Riwayat'}</Text>
                      </Pressable>
                    </View>

                    {cashOutWarningText ? (
                      <View style={styles.reportWarningBox}>
                        <Text style={styles.reportWarningText}>{cashOutWarningText}</Text>
                      </View>
                    ) : null}

                    <View style={styles.filterRow}>
                      <Pressable
                        style={[styles.filterButton, cashFlowHistoryFilter === 'all' ? styles.filterButtonActive : null]}
                        onPress={() => setCashFlowHistoryFilter('all')}
                      >
                        <Text style={[styles.filterButtonText, cashFlowHistoryFilter === 'all' ? styles.filterButtonTextActive : null]}>
                          Semua Riwayat
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.filterButton, cashFlowHistoryFilter === 'income' ? styles.filterButtonActive : null]}
                        onPress={() => setCashFlowHistoryFilter('income')}
                      >
                        <Text style={[styles.filterButtonText, cashFlowHistoryFilter === 'income' ? styles.filterButtonTextActive : null]}>
                          Riwayat Masuk
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.filterButton, cashFlowHistoryFilter === 'expense' ? styles.filterButtonActive : null]}
                        onPress={() => setCashFlowHistoryFilter('expense')}
                      >
                        <Text style={[styles.filterButtonText, cashFlowHistoryFilter === 'expense' ? styles.filterButtonTextActive : null]}>
                          Riwayat Keluar
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.reportNestedList}>
                      {filteredCashFlowRows.length > 0 ? filteredCashFlowRows.map((row, index) => (
                        <View
                          key={`cash-flow-row-${row?.id || row?.transaction_no || index}`}
                          style={[
                            styles.reportNestedItem,
                            String(row?.transaction_type || '').toLowerCase() === 'income'
                              ? styles.cashFlowIncomeItem
                              : styles.cashFlowExpenseItem,
                          ]}
                        >
                          <View style={styles.cashFlowRowHeader}>
                            <Text
                              style={[
                                styles.reportNestedTitle,
                                String(row?.transaction_type || '').toLowerCase() === 'income'
                                  ? styles.cashFlowIncomeText
                                  : styles.cashFlowExpenseText,
                              ]}
                            >
                              {String(row?.transaction_type_label || row?.transaction_type || '-')} - {String(row?.category || '-')}
                            </Text>
                            <View style={styles.cashFlowRowBadges}>
                              <View
                                style={[
                                  styles.cashFlowTypeBadge,
                                  String(row?.transaction_type || '').toLowerCase() === 'income'
                                    ? styles.cashFlowIncomeBadge
                                    : styles.cashFlowExpenseBadge,
                                ]}
                              >
                                <Text style={styles.cashFlowTypeBadgeText}>
                                  {String(row?.transaction_type || '').toLowerCase() === 'income' ? 'Masuk' : 'Keluar'}
                                </Text>
                              </View>
                              <View style={styles.cashFlowSourceBadge}>
                                <Text style={styles.cashFlowSourceBadgeText}>
                                  {row?.type?.id ? 'Backend' : 'Manual'}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <Text style={styles.reportNestedMeta}>
                            {String(row?.occurred_at || '-')} | {formatRupiah(row?.amount || 0)} | {String(row?.transaction_no || '-')}
                          </Text>
                          {row?.note ? (
                            <Text style={styles.reportNestedMeta}>{String(row.note)}</Text>
                          ) : null}
                        </View>
                      )) : (
                        <Text style={styles.debugText}>Belum ada riwayat kas sesuai filter di tanggal ini.</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.reportSectionCard}>
                    <Text style={styles.debugTitle}>Form Closing Shift</Text>
                    <Text style={styles.debugText}>Isi nominal kas fisik dan catatan serah terima supaya laporan ke finance lebih lengkap.</Text>
                    <View style={styles.reportSummaryGrid}>
                      <View style={styles.reportInputGroup}>
                        <Text style={styles.reportInputLabel}>Saldo Awal Kas</Text>
                        <TextInput
                          value={closingOpeningCash}
                          onChangeText={(value) => setClosingOpeningCash(sanitizeCurrencyInput(value))}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#6c7485"
                          style={styles.reportInput}
                        />
                      </View>
                      <View style={styles.reportInputGroup}>
                        <Text style={styles.reportInputLabel}>Uang Fisik Akhir</Text>
                        <TextInput
                          value={closingActualCash}
                          onChangeText={(value) => setClosingActualCash(sanitizeCurrencyInput(value))}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#6c7485"
                          style={styles.reportInput}
                        />
                      </View>
                      <View style={styles.reportInputGroup}>
                        <Text style={styles.reportInputLabel}>Penerima Finance</Text>
                        <TextInput
                          value={closingFinanceRecipient}
                          editable={false}
                          placeholder={isFinanceRecipientsLoading ? 'Memuat admin keuangan...' : 'Pilih admin keuangan'}
                          placeholderTextColor="#6c7485"
                          style={styles.reportInput}
                        />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.financeRecipientPicker}>
                          {(Array.isArray(financeRecipients) ? financeRecipients : []).map((row) => {
                            const active = Number(row?.id || 0) === Number(closingFinanceRecipientId || 0);
                            return (
                              <Pressable
                                key={`finance-${row?.id || row?.name || Math.random()}`}
                                style={[styles.financeRecipientChip, active ? styles.financeRecipientChipActive : null]}
                                onPress={() => {
                                  setClosingFinanceRecipientId(Number(row?.id || 0) || null);
                                  setClosingFinanceRecipient(String(row?.name || '').trim());
                                }}
                              >
                                <Text style={[styles.financeRecipientChipText, active ? styles.financeRecipientChipTextActive : null]}>
                                  {row?.name || '-'}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>
                      <View style={styles.reportInputGroup}>
                        <Text style={styles.reportInputLabel}>Catatan Shift</Text>
                        <TextInput
                          value={closingShiftNote}
                          onChangeText={setClosingShiftNote}
                          placeholder="Catatan tambahan untuk finance"
                          placeholderTextColor="#6c7485"
                          multiline
                          numberOfLines={3}
                          style={[styles.reportInput, styles.reportTextarea]}
                        />
                      </View>
                    </View>
                    <View style={styles.reportSummaryGrid}>
                      <View style={styles.reportSummaryCard}>
                        <Text style={styles.reportSummaryLabel}>Saldo Kas Sistem</Text>
                        <Text style={styles.reportSummaryValue}>{formatRupiah(closingExpectedCashValue)}</Text>
                      </View>
                      <View style={styles.reportSummaryCard}>
                        <Text style={styles.reportSummaryLabel}>Selisih Kas Fisik</Text>
                        <Text style={[
                          styles.reportSummaryValue,
                          closingCashDifferenceValue < 0 ? styles.reportNegativeValue : null,
                          closingCashDifferenceValue > 0 ? styles.reportPositiveValue : null,
                        ]}
                        >
                          {formatRupiah(closingCashDifferenceValue)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.reportInputGroup}>
                      <Text style={styles.reportInputLabel}>Laporan Barang Reject / Rusak</Text>
                      <TextInput
                        value={damageProductSearch}
                        onChangeText={setDamageProductSearch}
                        placeholder="Cari produk rusak"
                        placeholderTextColor="#6c7485"
                        style={styles.reportInput}
                      />
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.financeRecipientPicker}>
                        {filteredDamageProductOptions.map((row) => {
                          const active = Number(row?.id || 0) === Number(selectedDamageProductId || 0);
                          return (
                            <Pressable
                              key={`damage-product-${row?.id || row?.name}`}
                              style={[styles.financeRecipientChip, active ? styles.financeRecipientChipActive : null]}
                              onPress={() => setSelectedDamageProductId(Number(row?.id || 0) || null)}
                            >
                              <Text style={[styles.financeRecipientChipText, active ? styles.financeRecipientChipTextActive : null]}>
                                {row?.name || '-'}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                      <View style={styles.reportSummaryGrid}>
                        <View style={styles.reportInputGroup}>
                          <Text style={styles.reportInputLabel}>Qty Rusak</Text>
                          <TextInput
                            value={damageQtyInput}
                            onChangeText={setDamageQtyInput}
                            keyboardType="numeric"
                            placeholder="1"
                            placeholderTextColor="#6c7485"
                            style={styles.reportInput}
                          />
                        </View>
                        <View style={styles.reportInputGroup}>
                          <Text style={styles.reportInputLabel}>Catatan Barang</Text>
                          <TextInput
                            value={damageNoteInput}
                            onChangeText={setDamageNoteInput}
                            placeholder="Contoh: reject print, sobek, warna meleset"
                            placeholderTextColor="#6c7485"
                            style={styles.reportInput}
                          />
                        </View>
                      </View>
                      <View style={styles.headerActions}>
                        <Pressable style={styles.refreshButton} onPress={handleAddDamageItem}>
                          <Text style={styles.refreshButtonText}>Tambah Barang Rusak</Text>
                        </Pressable>
                      </View>
                      <View style={styles.reportNestedList}>
                        {closingDamageItems.length > 0 ? closingDamageItems.map((row, index) => (
                          <View key={String(row?.id || `damage-row-${index}`)} style={styles.reportNestedItem}>
                            <Text style={styles.reportNestedTitle}>
                              {row?.productName || '-'} | Qty: {row?.qty || 0}
                            </Text>
                            <Text style={styles.reportNestedMeta}>
                              Estimasi nilai: {formatRupiah(row?.estimatedTotalValue || 0)}
                              {row?.auditStatus && row.auditStatus !== 'reported' ? ` | Audit: ${row.auditStatus}` : ''}
                              {row?.responsibility ? ` | Beban: ${row.responsibility}` : ''}
                            </Text>
                            <Text style={styles.reportNestedMeta}>{row?.note || '-'}</Text>
                            <Pressable
                              style={styles.deleteDraftButton}
                              onPress={() => setClosingDamageItems((prev) => prev.filter((item) => item.id !== row.id))}
                            >
                              <Text style={styles.deleteDraftButtonText}>Hapus</Text>
                            </Pressable>
                          </View>
                        )) : (
                          <Text style={styles.debugText}>Belum ada barang reject / rusak yang dilaporkan di closer ini.</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.filterRow}>
                      <Pressable
                        style={[styles.refreshButton, isClosingSubmitLoading ? styles.draftActionDisabled : null]}
                        disabled={isClosingSubmitLoading}
                        onPress={handleSubmitCloserOrder}
                      >
                        <Text style={styles.refreshButtonText}>
                          {isClosingSubmitLoading ? 'Mengirim...' : 'Kirim ke Finance'}
                        </Text>
                      </Pressable>
                      {closingRecord ? (
                        <Text style={styles.debugText}>
                          Status closer: {String(closingRecord?.status || 'submitted')}
                          {' | '}Finance: {String(closingRecord?.finance_user?.name || closingFinanceRecipient || '-')}
                          {closingRecord?.accounting_journal?.reference ? ` | Jurnal: ${closingRecord.accounting_journal.reference}` : ''}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.reportSummaryGrid}>
                    <View style={[styles.reportSummaryCard, styles.reportSummaryCardInfo]}>
                      <Text style={styles.reportSummaryLabel}>Omzet Hari Ini</Text>
                      <Text style={styles.reportSummaryValue}>{formatRupiah(closingReport?.sales?.gross_total || 0)}</Text>
                    </View>
                    <View style={[styles.reportSummaryCard, styles.reportSummaryCardInfo]}>
                      <Text style={styles.reportSummaryLabel}>Pembayaran Penjualan Hari Ini</Text>
                      <Text style={styles.reportSummaryValue}>{formatRupiah(closingReport?.sales?.payment_received_total || 0)}</Text>
                    </View>
                    <View style={[styles.reportSummaryCard, styles.reportSummaryCardAccent]}>
                      <Text style={styles.reportSummaryLabel}>Pelunasan Piutang Hari Ini</Text>
                      <Text style={styles.reportSummaryValue}>{formatRupiah(closingReport?.receivable_collections?.total || 0)}</Text>
                    </View>
                    <View style={[styles.reportSummaryCard, styles.reportSummaryCardWarning]}>
                      <Text style={styles.reportSummaryLabel}>Piutang / Outstanding</Text>
                      <Text style={styles.reportSummaryValue}>{formatRupiah(closingReport?.sales?.outstanding_total || 0)}</Text>
                    </View>
                    <View style={[styles.reportSummaryCard, styles.reportSummaryCardCash]}>
                      <Text style={styles.reportSummaryLabel}>Kas Masuk Bersih</Text>
                      <Text style={styles.reportSummaryValue}>{formatRupiah(closingReport?.closing?.net_cash_movement || 0)}</Text>
                    </View>
                  </View>

                  <View style={styles.reportSummaryGrid}>
                    <View style={[styles.reportSummaryCard, styles.reportSummaryCardCash]}>
                      <Text style={styles.reportSummaryLabel}>Cash Sales</Text>
                      <Text style={styles.reportSummaryValue}>{formatRupiah(closingPaymentMethodSummary.cash)}</Text>
                    </View>
                    <View style={[styles.reportSummaryCard, styles.reportSummaryCardNonCash]}>
                      <Text style={styles.reportSummaryLabel}>Transfer Sales</Text>
                      <Text style={styles.reportSummaryValue}>{formatRupiah(closingPaymentMethodSummary.transfer)}</Text>
                    </View>
                    <View style={[styles.reportSummaryCard, styles.reportSummaryCardNonCash]}>
                      <Text style={styles.reportSummaryLabel}>QRIS Sales</Text>
                      <Text style={styles.reportSummaryValue}>{formatRupiah(closingPaymentMethodSummary.qris)}</Text>
                    </View>
                    <View style={[styles.reportSummaryCard, styles.reportSummaryCardNonCash]}>
                      <Text style={styles.reportSummaryLabel}>Card Sales</Text>
                      <Text style={styles.reportSummaryValue}>{formatRupiah(closingPaymentMethodSummary.card)}</Text>
                    </View>
                    {closingPaymentMethodSummary.other > 0 ? (
                      <View style={[styles.reportSummaryCard, styles.reportSummaryCardWarning]}>
                        <Text style={styles.reportSummaryLabel}>Metode Lain</Text>
                        <Text style={styles.reportSummaryValue}>{formatRupiah(closingPaymentMethodSummary.other)}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.reportSummaryGrid}>
                    <View style={[styles.reportSummaryCard, styles.reportSummaryCardCashStrong]}>
                      <Text style={styles.reportSummaryLabel}>Tunai Harus Ada di Kasir</Text>
                      <Text style={styles.reportSummaryValue}>{formatRupiah(closingCashInHandSummary.physicalCashExpected)}</Text>
                    </View>
                    <View style={[styles.reportSummaryCard, styles.reportSummaryCardNonCashStrong]}>
                      <Text style={styles.reportSummaryLabel}>Non Tunai Masuk Rekening</Text>
                      <Text style={styles.reportSummaryValue}>{formatRupiah(closingNonCashSummary.total)}</Text>
                    </View>
                  </View>

                  <View style={styles.reportSectionCard}>
                    <Text style={styles.debugTitle}>Breakdown Pembayaran Omzet Hari Ini</Text>
                    {closingPaymentRows.length > 0 ? closingPaymentRows.map((row, index) => (
                      <View key={`payment-${index}-${row?.method || 'other'}`} style={styles.reportLineRow}>
                        <Text style={styles.reportLineLabel}>{humanizePaymentMethod(row?.method)} ({row?.total_tx || 0} tx)</Text>
                        <Text style={styles.reportLineValue}>{formatRupiah(row?.total_amount || 0)}</Text>
                      </View>
                    )) : (
                      <Text style={styles.debugText}>Belum ada pembayaran di tanggal ini.</Text>
                    )}
                  </View>

                  <View style={[styles.reportSectionCard, styles.reportSectionCardCash]}>
                    <Text style={styles.debugTitle}>Posisi Uang Kasir vs Rekening</Text>
                    <Text style={styles.debugText}>
                      Section ini membantu membedakan uang tunai fisik yang seharusnya ada di laci kasir dan uang non tunai yang dibayar ke rekening.
                    </Text>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Cash dari penjualan hari ini</Text>
                      <Text style={[styles.reportLineValue, styles.reportCashValue]}>{formatRupiah(closingCashInHandSummary.cashSales)}</Text>
                    </View>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Cash dari pelunasan piutang</Text>
                      <Text style={[styles.reportLineValue, styles.reportCashValue]}>{formatRupiah(closingCashInHandSummary.cashReceivable)}</Text>
                    </View>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Kas masuk lain</Text>
                      <Text style={[styles.reportLineValue, styles.reportCashValue]}>{formatRupiah(closingCashInHandSummary.cashIncomeOther)}</Text>
                    </View>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Kas keluar</Text>
                      <Text style={[styles.reportLineValue, styles.reportExpenseValue]}>{formatRupiah(closingCashInHandSummary.cashExpenseOther)}</Text>
                    </View>
                    <View style={[styles.reportLineRow, styles.reportLineRowEmphasis]}>
                      <Text style={styles.reportLineLabel}>Tunai seharusnya di kasir</Text>
                      <Text style={[styles.reportLineValue, styles.reportCashValueStrong]}>{formatRupiah(closingCashInHandSummary.physicalCashExpected)}</Text>
                    </View>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Non tunai penjualan</Text>
                      <Text style={[styles.reportLineValue, styles.reportNonCashValue]}>{formatRupiah(closingNonCashSummary.nonCashSales)}</Text>
                    </View>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Non tunai pelunasan piutang</Text>
                      <Text style={[styles.reportLineValue, styles.reportNonCashValue]}>{formatRupiah(closingNonCashSummary.nonCashReceivable)}</Text>
                    </View>
                    <View style={[styles.reportLineRow, styles.reportLineRowEmphasis]}>
                      <Text style={styles.reportLineLabel}>Total non tunai ke rekening</Text>
                      <Text style={[styles.reportLineValue, styles.reportNonCashValueStrong]}>{formatRupiah(closingNonCashSummary.total)}</Text>
                    </View>
                  </View>

                  <View style={styles.reportSectionCard}>
                    <Text style={styles.debugTitle}>Pelunasan Piutang</Text>
                    <Text style={styles.debugText}>
                      Uang masuk dari invoice lama yang dibayar hari ini. Nilai ini menambah arus kas, tetapi tidak menambah omzet hari ini.
                    </Text>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Total pelunasan piutang</Text>
                      <Text style={styles.reportLineValue}>{formatRupiah(closingReport?.receivable_collections?.total || 0)}</Text>
                    </View>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Cash pelunasan piutang</Text>
                      <Text style={styles.reportLineValue}>{formatRupiah(closingReport?.receivable_collections?.cash_total || 0)}</Text>
                    </View>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Non cash pelunasan piutang</Text>
                      <Text style={styles.reportLineValue}>{formatRupiah(closingReport?.receivable_collections?.non_cash_total || 0)}</Text>
                    </View>
                    {closingReceivableBreakdownRows.length > 0 ? closingReceivableBreakdownRows.map((row, index) => (
                      <View key={`receivable-breakdown-${index}-${row?.method || 'other'}`} style={styles.reportLineRow}>
                        <Text style={styles.reportLineLabel}>{humanizePaymentMethod(row?.method)} ({row?.total_tx || 0} tx)</Text>
                        <Text style={styles.reportLineValue}>{formatRupiah(row?.total_amount || 0)}</Text>
                      </View>
                    )) : null}
                    {closingReceivableSettlementRows.length > 0 ? (
                      <View style={styles.reportNestedList}>
                        {closingReceivableSettlementRows.map((row, index) => (
                          <View key={`receivable-settlement-${row?.id || row?.invoice_no || index}`} style={styles.reportNestedItem}>
                            <Text style={styles.reportNestedTitle}>
                              {String(row?.invoice_no || '-')} - {String(row?.customer_name || 'Pelanggan umum')}
                            </Text>
                            <Text style={styles.reportNestedMeta}>
                              Invoice: {String(row?.invoice_date || '-')} | Bayar: {String(row?.paid_at || '-')} | {humanizePaymentMethod(row?.method)}
                            </Text>
                            <Text style={styles.reportNestedMeta}>{formatRupiah(row?.amount || 0)}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.debugText}>Belum ada pelunasan piutang di tanggal ini.</Text>
                    )}
                  </View>

                  <View style={styles.reportSectionCard}>
                    <Text style={styles.debugTitle}>Status Penjualan & Piutang</Text>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Jumlah invoice</Text>
                      <Text style={styles.reportLineValue}>{closingReport?.sales?.invoice_count || 0}</Text>
                    </View>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Rata-rata transaksi</Text>
                      <Text style={styles.reportLineValue}>{formatRupiah(closingReport?.sales?.average_ticket || 0)}</Text>
                    </View>
                    {closingStatusRows.map((row, index) => (
                      <View key={`status-${index}-${row?.status || 'unknown'}`} style={styles.reportLineRow}>
                        <Text style={styles.reportLineLabel}>Status {humanizeStatusLabel(row?.status || 'unknown')}</Text>
                        <Text style={styles.reportLineValue}>{row?.total || 0}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.reportSectionCard}>
                    <Text style={styles.debugTitle}>Kas Masuk / Keluar Tambahan</Text>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Pemasukan lain</Text>
                      <Text style={styles.reportLineValue}>{formatRupiah(closingReport?.external_cash?.income_total || 0)}</Text>
                    </View>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Pengeluaran</Text>
                      <Text style={styles.reportLineValue}>{formatRupiah(closingReport?.external_cash?.expense_total || 0)}</Text>
                    </View>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Arus kas masuk bruto</Text>
                      <Text style={styles.reportLineValue}>{formatRupiah(closingReport?.closing?.gross_inflow_total || 0)}</Text>
                    </View>
                    {closingExternalRows.length > 0 ? (
                      <View style={styles.reportNestedList}>
                        {closingExternalRows.map((row, index) => (
                          <View key={`external-${row?.id || row?.transaction_no || index}`} style={styles.reportNestedItem}>
                            <Text style={styles.reportNestedTitle}>
                              {String(row?.transaction_type || '').toLowerCase() === 'expense' ? 'Pengeluaran' : 'Pemasukan'} {row?.category || '-'}
                            </Text>
                            <Text style={styles.reportNestedMeta}>
                              {String(row?.occurred_at || '-')} | {formatRupiah(row?.amount || 0)}{row?.note ? ` | ${row.note}` : ''}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.debugText}>Tidak ada catatan kas masuk/keluar tambahan.</Text>
                    )}
                  </View>

                  <View style={styles.reportSectionCard}>
                    <Text style={styles.debugTitle}>Barang Reject / Rusak</Text>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Jumlah item dilaporkan</Text>
                      <Text style={styles.reportLineValue}>{closingDamageSummary.itemCount}</Text>
                    </View>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Total qty rusak</Text>
                      <Text style={styles.reportLineValue}>{closingDamageSummary.totalQty}</Text>
                    </View>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Estimasi nilai kerusakan</Text>
                      <Text style={styles.reportLineValue}>{formatRupiah(closingDamageSummary.totalEstimatedValue)}</Text>
                    </View>
                    <View style={styles.reportLineRow}>
                      <Text style={styles.reportLineLabel}>Item yang sudah diaudit finance</Text>
                      <Text style={styles.reportLineValue}>{closingDamageSummary.auditedCount}</Text>
                    </View>
                    {closingDamageItems.length > 0 ? (
                      <View style={styles.reportNestedList}>
                        {closingDamageItems.map((row, index) => (
                          <View key={`report-damage-${row?.id || index}`} style={styles.reportNestedItem}>
                            <Text style={styles.reportNestedTitle}>
                              {index + 1}. {row?.productName || '-'} | Qty: {row?.qty || 0}
                            </Text>
                            <Text style={styles.reportNestedMeta}>
                              Estimasi nilai: {formatRupiah(row?.estimatedTotalValue || 0)}
                              {row?.auditStatus ? ` | Audit: ${humanizeStatusLabel(row.auditStatus)}` : ''}
                              {row?.responsibility ? ` | Beban: ${humanizeStatusLabel(row.responsibility)}` : ''}
                            </Text>
                            <Text style={styles.reportNestedMeta}>{row?.note || '-'}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.debugText}>Tidak ada barang reject / rusak yang ikut pada laporan close order ini.</Text>
                    )}
                  </View>

                  <View style={styles.reportSectionCard}>
                    <Text style={styles.debugTitle}>Produk Terlaris Hari Ini</Text>
                    {closingTopProducts.length > 0 ? closingTopProducts.map((row, index) => (
                      <View key={`top-product-${row?.product_id || index}`} style={styles.reportLineRow}>
                        <Text style={styles.reportLineLabel}>{index + 1}. {row?.product_name || '-'}</Text>
                        <Text style={styles.reportLineValue}>{row?.total_qty || 0} pcs | {formatRupiah(row?.total_amount || 0)}</Text>
                      </View>
                    )) : (
                      <Text style={styles.debugText}>Belum ada data produk terlaris.</Text>
                    )}
                  </View>

                </>
              ) : (
                <Text style={styles.debugText}>Belum ada laporan yang ditampilkan. Pilih tanggal lalu tekan `Generate`.</Text>
              )}
            </View>
          ) : activeMenu === 'settings' ? (
            <View style={styles.debugPanel}>
              <Text style={styles.debugTitle}>Pengaturan Printer Kasir</Text>
              <Text style={styles.debugText}>Atur printer tujuan dan ukuran kertas struk sesuai printer yang dipakai di kasir.</Text>
              <View style={styles.printerStatusRow}>
                <View
                  style={[
                    styles.printerStatusBadge,
                    printerStatusTone === 'active' ? styles.printerStatusBadgeActive : styles.printerStatusBadgeFallback,
                  ]}
                >
                  <Text style={styles.printerStatusBadgeText}>{printerStatusLabel}</Text>
                </View>
                <Text style={styles.printerStatusHint}>
                  {hasSavedPrinterProfile ? 'Cetak transaksi akan mencoba printer ini lebih dulu.' : 'Belum ada printer khusus yang dipakai.'}
                </Text>
              </View>
              <View style={styles.printerTargetCard}>
                <Text style={styles.printerTargetLabel}>Target Cetak</Text>
                <Text style={styles.printerTargetPrimary}>{printerTargetSummary.primary}</Text>
                <Text style={styles.printerTargetSecondary}>{printerTargetSummary.secondary}</Text>
              </View>
              <View style={styles.printerTargetCard}>
                <Text style={styles.printerTargetLabel}>Ukuran Kertas Aktif</Text>
                <Text style={styles.printerTargetPrimary}>{printerPaperSummary}</Text>
                <Text style={styles.printerTargetSecondary}>Pilih `58mm`, `80mm`, atau `custom` sesuai printer struk yang dipakai.</Text>
              </View>
              <Text style={styles.debugText}>{printerProfileSummary}</Text>
              <View style={styles.printerToolsCard}>
                <PrinterSettingsForm
                  value={activePrinterProfile}
                  onChange={handlePrinterProfileChange}
                  onTestPrint={handleTestPrint}
                />
              </View>
              <View style={styles.printerToolActions}>
                <Pressable style={styles.printerSecondaryButton} onPress={handleRestoreRecommendedPrinterDefaults}>
                  <Text style={styles.printerSecondaryButtonText}>Reset Form Browser</Text>
                </Pressable>
                <Pressable style={styles.printerDangerButton} onPress={confirmDisablePrinterProfile}>
                  <Text style={styles.printerDangerButtonText}>
                    {hasSavedPrinterProfile ? 'Nonaktifkan Printer Kasir' : 'Paksa Fallback Browser'}
                  </Text>
                </Pressable>
              </View>
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
                <Text style={styles.debugText}>Mode produksi hanya menampilkan pengaturan printer, tanpa panel debug developer.</Text>
              )}
            </View>
          ) : (
            <View style={styles.debugPanel}>
              <Text style={styles.debugTitle}>Menu belum tersedia.</Text>
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
            <Text style={styles.popupMessage}>Metode Bayar: {orderPreviewSnapshot.paymentMethod}</Text>
            {String(orderPreviewSnapshot.notes || '').trim() ? (
              <Text style={styles.popupMessage}>Catatan: {orderPreviewSnapshot.notes}</Text>
            ) : null}
            <View style={styles.previewBadgeRow}>
              <View
                style={[
                  styles.previewFlowBadge,
                  mapPaymentMethodToBackend(orderPreviewSnapshot.paymentMethod) === 'cash'
                    ? styles.previewFlowBadgeCash
                    : styles.previewFlowBadgeNonCash,
                ]}
              >
                <Text
                  style={[
                    styles.previewFlowBadgeText,
                    mapPaymentMethodToBackend(orderPreviewSnapshot.paymentMethod) === 'cash'
                      ? styles.previewFlowBadgeTextCash
                      : styles.previewFlowBadgeTextNonCash,
                  ]}
                >
                  {mapPaymentMethodToBackend(orderPreviewSnapshot.paymentMethod) === 'cash' ? 'Tunai Fisik' : 'Masuk Rekening'}
                </Text>
              </View>
              <View style={styles.previewTargetBadge}>
                <Text style={styles.previewTargetBadgeText}>
                  {orderPreviewSnapshot.paymentTargetName || 'Tujuan dana sesuai mapping backend'}
                </Text>
              </View>
            </View>
            <Text style={styles.popupMessage}>
              {mapPaymentMethodToBackend(orderPreviewSnapshot.paymentMethod) === 'cash'
                ? `Akan masuk ke akun kas: ${orderPreviewSnapshot.paymentTargetName || 'Sesuai mapping backend'}`
                : `Akan masuk ke akun pembayaran: ${orderPreviewSnapshot.paymentTargetName || 'Sesuai mapping backend'}`}
            </Text>

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
                style={[styles.popupButton, styles.popupButtonSecondary, isOrderPreviewSubmitting ? styles.draftActionDisabled : null]}
                disabled={isOrderPreviewSubmitting}
                onPress={() => handleOpenBankPickerFromPreview('copy_order')}
              >
                <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>
                  {isOrderPreviewSubmitting ? 'Memproses...' : 'Salin Pesanan'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.popupButton, isOrderPreviewSubmitting ? styles.draftActionDisabled : null]}
                disabled={isOrderPreviewSubmitting}
                onPress={() => handleOpenBankPickerFromPreview('copy_invoice')}
              >
                <Text style={styles.popupButtonText}>{isOrderPreviewSubmitting ? 'Memproses...' : 'Salin Invoice'}</Text>
              </Pressable>
              <Pressable
                style={[styles.popupButton, isOrderPreviewSubmitting ? styles.draftActionDisabled : null]}
                disabled={isOrderPreviewSubmitting}
                onPress={() => handleOpenBankPickerFromPreview('print')}
              >
                <Text style={styles.popupButtonText}>{isOrderPreviewSubmitting ? 'Memproses...' : 'Cetak'}</Text>
              </Pressable>
              <Pressable
                style={[styles.popupButton, styles.popupButtonSecondary, isOrderPreviewSubmitting ? styles.draftActionDisabled : null]}
                disabled={isOrderPreviewSubmitting}
                onPress={async () => {
                  setIsOrderPreviewOpen(false);
                  await handleSaveTransaction();
                }}
              >
                <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>
                  {isOrderPreviewSubmitting ? 'Memproses...' : 'Simpan Draft'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.popupButton, isOrderPreviewSubmitting ? styles.draftActionDisabled : null]}
                disabled={isOrderPreviewSubmitting}
                onPress={() => handleOpenBankPickerFromPreview('save')}
              >
                <Text style={styles.popupButtonText}>{isOrderPreviewSubmitting ? 'Memproses...' : 'Proses Order'}</Text>
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
        visible={receivablePaymentModal.visible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseReceivablePaymentModal}
      >
        <View style={styles.popupBackdrop}>
          <View style={[styles.popupCard, styles.bankPickerCard]}>
            <Text style={styles.popupTitle}>Bayar Piutang Pelanggan</Text>
            <Text style={styles.popupMessage}>
              Customer: {receivablePaymentModal.customerName}
              {receivablePaymentModal.customerPhone ? ` | ${receivablePaymentModal.customerPhone}` : ''}
            </Text>
            <Text style={styles.popupMessage}>Invoice: {receivablePaymentModal.invoiceNo || '-'}</Text>
            <Text style={styles.popupMessage}>Sisa piutang: {formatRupiah(receivablePaymentModal.dueTotal || 0)}</Text>

            <View style={styles.receivablePaymentForm}>
              <Text style={styles.reportInputLabel}>Metode Bayar</Text>
              <View style={styles.methodQuickRowWrap}>
                {PAYMENT_METHOD_LABELS.map((option) => {
                  const active = String(option) === String(receivablePaymentModal.method || '');
                  return (
                    <Pressable
                      key={`receivable-method-${option}`}
                      style={[styles.receivableMethodChip, active ? styles.receivableMethodChipActive : null]}
                      onPress={() => handleChangeReceivablePaymentMethod(option)}
                    >
                      <Text style={[styles.receivableMethodChipText, active ? styles.receivableMethodChipTextActive : null]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.receivableHelperText}>{receivablePaymentHelperText}</Text>

              <Text style={styles.reportInputLabel}>Nominal Bayar</Text>
              <TextInput
                value={receivablePaymentModal.amount}
                onChangeText={(value) => setReceivablePaymentModal((prev) => ({ ...prev, amount: sanitizeCurrencyInput(value) }))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#6c7485"
                style={styles.reportInput}
              />

              <Text style={styles.reportInputLabel}>
                {mapPaymentMethodToBackend(receivablePaymentModal.method) === 'cash' ? 'Akun Kas' : 'Akun / Rekening Tujuan'}
              </Text>
              {receivablePaymentModal.isLoadingAccounts ? (
                <View style={styles.bankPickerLoadingWrap}>
                  <ActivityIndicator size="small" color="#2f64ef" />
                  <Text style={styles.loadingMessage}>Memuat akun pembayaran...</Text>
                </View>
              ) : (
                <ScrollView style={styles.bankPickerList}>
                  {(Array.isArray(receivablePaymentModal.accountOptions) ? receivablePaymentModal.accountOptions : []).map((row, index) => {
                    const rowId = Number(row?.id || 0);
                    const active = rowId > 0 && rowId === Number(receivablePaymentModal.selectedAccountId || 0);
                    return (
                      <Pressable
                        key={`receivable-account-${rowId || index}`}
                        style={[styles.bankPickerItem, active ? styles.bankPickerItemActive : null]}
                        onPress={() => setReceivablePaymentModal((prev) => ({ ...prev, selectedAccountId: rowId }))}
                      >
                        <Text style={styles.bankPickerItemTitle}>
                          {row?.displayTitle || row?.displayName || `Akun #${rowId}`}
                        </Text>
                        {row?.displaySubtitle ? (
                          <Text style={styles.bankPickerItemMeta}>{row.displaySubtitle}</Text>
                        ) : null}
                        {row?.displayDetail ? (
                          <Text style={styles.bankPickerItemDetail}>{row.displayDetail}</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View style={styles.popupActions}>
              <Pressable
                style={[styles.popupButton, styles.popupButtonSecondary]}
                disabled={receivablePaymentModal.isSubmitting}
                onPress={handleCloseReceivablePaymentModal}
              >
                <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>Tutup</Text>
              </Pressable>
              <Pressable
                style={styles.popupButton}
                disabled={receivablePaymentModal.isSubmitting}
                onPress={handleSubmitReceivablePayment}
              >
                <Text style={styles.popupButtonText}>
                  {receivablePaymentModal.isSubmitting ? 'Memproses...' : 'Bayar'}
                </Text>
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
              {String(invoiceDetailModal.note || '').trim() ? (
                <Text style={styles.popupMessage}>Catatan: {invoiceDetailModal.note}</Text>
              ) : null}
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
                    {item?.pricingSummary?.billingGroup ? (
                      <Text style={styles.invoiceItemMeta}>Rule Sticker: {item.pricingSummary.billingGroup}{item.pricingSummary.rollWidth > 0 ? ` | Lebar Roll: ${item.pricingSummary.rollWidth} m` : ''}</Text>
                    ) : null}
                    {item?.pricingSummary?.stickerNotice ? (
                      <Text style={styles.invoiceItemMeta}>{item.pricingSummary.stickerNotice}</Text>
                    ) : null}
                    {item?.pricingSummary?.bundleActive ? (
                      <>
                        <Text style={styles.invoiceItemMeta}>Finishing: {formatRupiah(item.pricingSummary.finishingBeforeDiscount)}</Text>
                        <Text style={styles.invoiceItemMeta}>Diskon Bundle: {formatRupiah(item.pricingSummary.bundleDiscount)}</Text>
                        <Text style={styles.invoiceItemMeta}>Finishing Final: {formatRupiah(item.pricingSummary.finishingFinal)}</Text>
                        <Text style={styles.invoiceItemMeta}>Total Final: {formatRupiah(item.pricingSummary.printSubtotal || 0)} + {formatRupiah(item.pricingSummary.finishingBeforeDiscount)} - {formatRupiah(item.pricingSummary.bundleDiscount)} = {formatRupiah(item.lineTotal)}</Text>
                      </>
                    ) : null}
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
  printerToolsCard: {
    marginBottom: 10,
  },
  printerStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  printerStatusBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  printerStatusBadgeActive: {
    borderColor: '#1f7a42',
    backgroundColor: '#2f9e5a',
  },
  printerStatusBadgeFallback: {
    borderColor: '#9a6a14',
    backgroundColor: '#d49b2d',
  },
  printerStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  printerStatusHint: {
    flex: 1,
    minWidth: 180,
    fontSize: 10,
    color: '#394252',
  },
  printerTargetCard: {
    borderWidth: 1,
    borderColor: '#c7d3ef',
    backgroundColor: '#f6f8ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  printerTargetLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4b6196',
    textTransform: 'uppercase',
  },
  printerTargetPrimary: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
    color: '#173c87',
  },
  printerTargetSecondary: {
    marginTop: 2,
    fontSize: 10,
    color: '#44506a',
  },
  printerToolActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  printerSecondaryButton: {
    borderWidth: 1,
    borderColor: '#9aa3b5',
    backgroundColor: '#eef1f6',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  printerSecondaryButtonText: {
    color: '#2f3f59',
    fontWeight: '700',
    fontSize: 11,
  },
  printerDangerButton: {
    borderWidth: 1,
    borderColor: '#b63a3a',
    backgroundColor: '#d94a4a',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  printerDangerButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
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
  receivableSummaryCard: {
    borderWidth: 1,
    borderColor: '#c7d7ef',
    backgroundColor: '#f7fbff',
    padding: 10,
    marginBottom: 10,
  },
  receivableSummaryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#24426f',
    textTransform: 'uppercase',
  },
  receivableSummaryName: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#1e2d45',
  },
  receivableSummaryMeta: {
    marginTop: 3,
    fontSize: 11,
    color: '#5c6780',
  },
  receivableSummaryWarning: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 15,
    color: '#8a5d00',
    fontWeight: '700',
  },
  receivableSummaryAmount: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '800',
    color: '#1d6a3c',
  },
  receivableDueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8a6b00',
  },
  receivablePayButton: {
    borderWidth: 1,
    borderColor: '#1d7a45',
    backgroundColor: '#2d9d58',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  receivablePayButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11,
  },
  receivablePaymentForm: {
    gap: 8,
    marginTop: 8,
  },
  methodQuickRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  receivableMethodChip: {
    borderWidth: 1,
    borderColor: '#b7c1d5',
    backgroundColor: '#f4f6fb',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  receivableMethodChipActive: {
    borderColor: '#2f64ef',
    backgroundColor: '#2f64ef',
  },
  receivableMethodChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#32425c',
  },
  receivableMethodChipTextActive: {
    color: '#ffffff',
  },
  receivableHelperText: {
    fontSize: 10,
    lineHeight: 15,
    color: '#4e5b75',
  },
  reportDateInput: {
    minWidth: 160,
    marginBottom: 0,
    flexGrow: 0,
  },
  reportSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  reportSummaryCard: {
    flexGrow: 1,
    minWidth: 180,
    borderWidth: 1,
    borderColor: '#c8d0e6',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  reportSummaryCardInfo: {
    borderColor: '#c8d8f2',
    backgroundColor: '#f6f9ff',
  },
  reportSummaryCardAccent: {
    borderColor: '#d8d1ef',
    backgroundColor: '#f7f5ff',
  },
  reportSummaryCardWarning: {
    borderColor: '#e7d3a1',
    backgroundColor: '#fff8e8',
  },
  reportSummaryCardCash: {
    borderColor: '#b8dfc7',
    backgroundColor: '#f3fbf6',
  },
  reportSummaryCardCashStrong: {
    borderColor: '#78bf93',
    backgroundColor: '#e5f7eb',
  },
  reportSummaryCardNonCash: {
    borderColor: '#bfd5f5',
    backgroundColor: '#f4f8ff',
  },
  reportSummaryCardNonCashStrong: {
    borderColor: '#82aee8',
    backgroundColor: '#e8f1ff',
  },
  reportSummaryLabel: {
    fontSize: 10,
    color: '#5d6780',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  reportSummaryValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '800',
    color: '#183c88',
  },
  reportPositiveValue: {
    color: '#1f7a42',
  },
  reportNegativeValue: {
    color: '#b63838',
  },
  reportInputGroup: {
    flexGrow: 1,
    minWidth: 220,
    gap: 5,
  },
  reportInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#31415f',
  },
  reportInput: {
    borderWidth: 1,
    borderColor: '#c1cadf',
    backgroundColor: '#ffffff',
    color: '#1d2433',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  reportInputReadonly: {
    backgroundColor: '#f1f4f9',
    color: '#58627a',
  },
  reportWarningBox: {
    borderWidth: 1,
    borderColor: '#e0b35d',
    backgroundColor: '#fff7e7',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  reportWarningText: {
    color: '#8a5a0a',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  reportTextarea: {
    minHeight: 78,
    textAlignVertical: 'top',
  },
  financeRecipientPicker: {
    marginTop: 6,
  },
  financeRecipientChip: {
    borderWidth: 1,
    borderColor: '#b9c4de',
    backgroundColor: '#f3f6fc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  financeRecipientChipActive: {
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
  },
  financeRecipientChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#31415f',
  },
  financeRecipientChipTextActive: {
    color: '#ffffff',
  },
  reportChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reportChip: {
    borderWidth: 1,
    borderColor: '#b9c4de',
    backgroundColor: '#f3f6fc',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reportChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportChipActive: {
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
  },
  reportChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334261',
  },
  reportChipTextActive: {
    color: '#ffffff',
  },
  reportChipBadge: {
    borderWidth: 1,
    borderColor: '#c2cbde',
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reportChipBadgeActive: {
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  reportChipBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#58657d',
    textTransform: 'uppercase',
  },
  reportChipBadgeTextActive: {
    color: '#ffffff',
  },
  reportSectionCard: {
    borderWidth: 1,
    borderColor: '#c8d0e6',
    backgroundColor: '#ffffff',
    padding: 10,
    marginBottom: 10,
  },
  reportSectionCardCash: {
    borderColor: '#b8dfc7',
    backgroundColor: '#f7fcf8',
  },
  reportLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#edf1f8',
  },
  reportLineRowEmphasis: {
    marginTop: 2,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: '#d6dfef',
  },
  reportLineLabel: {
    flex: 1,
    fontSize: 11,
    color: '#25324d',
  },
  reportLineValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#173c87',
    textAlign: 'right',
  },
  reportCashValue: {
    color: '#1d7a45',
  },
  reportCashValueStrong: {
    color: '#116336',
  },
  reportNonCashValue: {
    color: '#205aaf',
  },
  reportNonCashValueStrong: {
    color: '#163f82',
  },
  reportExpenseValue: {
    color: '#b63838',
  },
  reportNestedList: {
    marginTop: 8,
    gap: 6,
  },
  reportNestedItem: {
    borderWidth: 1,
    borderColor: '#e1e5ef',
    backgroundColor: '#f8faff',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  cashFlowIncomeItem: {
    borderColor: '#b9dfc7',
    backgroundColor: '#f3fcf5',
  },
  cashFlowExpenseItem: {
    borderColor: '#ecc7c7',
    backgroundColor: '#fff6f6',
  },
  cashFlowRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cashFlowRowBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
  },
  reportNestedTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#20365f',
  },
  cashFlowIncomeText: {
    color: '#1f7a42',
  },
  cashFlowExpenseText: {
    color: '#b63838',
  },
  reportNestedMeta: {
    marginTop: 2,
    fontSize: 10,
    color: '#5b6780',
  },
  cashFlowTypeBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cashFlowIncomeBadge: {
    borderColor: '#1f7a42',
    backgroundColor: '#2f9e5a',
  },
  cashFlowExpenseBadge: {
    borderColor: '#b63838',
    backgroundColor: '#d94a4a',
  },
  cashFlowTypeBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cashFlowSourceBadge: {
    borderWidth: 1,
    borderColor: '#bdc6d9',
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cashFlowSourceBadgeText: {
    color: '#56627c',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reportSummaryText: {
    fontSize: 11,
    lineHeight: 18,
    color: '#1d2740',
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
  draftExpiryMeta: {
    marginTop: 3,
    fontSize: 10,
    color: '#8a5a0a',
    fontWeight: '700',
  },
  draftExpiryMetaExpired: {
    color: '#b42318',
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
  bankPickerSelectedSummary: {
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#b8c7ef',
    backgroundColor: '#eef3ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bankPickerSelectedLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3157a8',
    textTransform: 'uppercase',
  },
  bankPickerSelectedTitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
    color: '#163a85',
  },
  bankPickerSelectedMeta: {
    marginTop: 3,
    fontSize: 11,
    color: '#264577',
  },
  bankPickerSelectedDetail: {
    marginTop: 3,
    fontSize: 10,
    color: '#3f4d67',
    lineHeight: 15,
  },
  bankPickerList: {
    maxHeight: 280,
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
  bankPickerItemDetail: {
    marginTop: 3,
    fontSize: 10,
    color: '#5a5a5a',
    lineHeight: 15,
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
  previewBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    marginBottom: 6,
  },
  previewFlowBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewFlowBadgeCash: {
    borderColor: '#9ed1b1',
    backgroundColor: '#ebf8f0',
  },
  previewFlowBadgeNonCash: {
    borderColor: '#a8c6f0',
    backgroundColor: '#eef4ff',
  },
  previewFlowBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  previewFlowBadgeTextCash: {
    color: '#1d6a3c',
  },
  previewFlowBadgeTextNonCash: {
    color: '#1e4f99',
  },
  previewTargetBadge: {
    borderWidth: 1,
    borderColor: '#d4d9e6',
    backgroundColor: '#f7f9fc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  previewTargetBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#33425f',
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
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
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







































