const CUSTOMER_PHONE_CONFLICT_MESSAGE = 'Data customer sudah ada di backend. Silakan pilih customer yang sudah terdaftar.';
const CUSTOMER_PHONE_INVALID_MESSAGE = 'Nomor handphone harus memakai format 08xxxxxxxxxx, +628xxxxxxxxxx, atau 628xxxxxxxxxx.';

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const stripPhoneFormatting = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const cleaned = text.replace(/[\s().-]/g, '');
  if (!cleaned) {
    return '';
  }

  if (/[^0-9+]/.test(cleaned)) {
    return null;
  }

  const plusCount = (cleaned.match(/\+/g) || []).length;
  if (plusCount > 1 || (cleaned.includes('+') && !cleaned.startsWith('+'))) {
    return null;
  }

  return cleaned;
};

const normalizeIndonesianPhone = (value, options = {}) => {
  const allowEmpty = options?.allowEmpty !== false;
  const cleaned = stripPhoneFormatting(value);

  if (cleaned === null) {
    throw new Error(CUSTOMER_PHONE_INVALID_MESSAGE);
  }

  if (!cleaned) {
    if (allowEmpty) {
      return null;
    }
    throw new Error('Nomor handphone wajib diisi.');
  }

  if (/^08\d{8,13}$/.test(cleaned)) {
    return `62${cleaned.slice(1)}`;
  }

  if (/^\+628\d{8,13}$/.test(cleaned)) {
    return cleaned.slice(1);
  }

  if (/^628\d{8,13}$/.test(cleaned)) {
    return cleaned;
  }

  throw new Error(CUSTOMER_PHONE_INVALID_MESSAGE);
};

const getCustomerPhoneSearchFragments = (value) => {
  const cleaned = stripPhoneFormatting(value);
  if (!cleaned) {
    return [];
  }

  if (cleaned === null) {
    return [];
  }

  const digits = cleaned.replace(/^\+/, '');
  const fragments = new Set();

  if (digits) {
    fragments.add(digits);
  }
  if (digits.startsWith('08') && digits.length > 2) {
    fragments.add(`62${digits.slice(1)}`);
  }
  if (digits.startsWith('628') && digits.length > 3) {
    fragments.add(`0${digits.slice(2)}`);
  }

  return Array.from(fragments).filter((fragment) => fragment.length >= 3);
};

const matchesCustomerSearch = (customer, keyword) => {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) {
    return true;
  }

  const name = normalizeText(customer?.name || '');
  if (name.includes(normalizedKeyword)) {
    return true;
  }

  const phone = String(customer?.phone || '').trim();
  if (!phone) {
    return false;
  }

  if (normalizeText(phone).includes(normalizedKeyword)) {
    return true;
  }

  return getCustomerPhoneSearchFragments(keyword)
    .some((fragment) => phone.includes(fragment));
};

const isCustomerPhoneConflictError = (error) => {
  const status = Number(error?.status || 0);
  if (status !== 409) {
    return false;
  }

  const phoneErrors = Array.isArray(error?.body?.errors?.phone) ? error.body.errors.phone : [];
  const firstPhoneError = normalizeText(phoneErrors[0] || '');
  const message = normalizeText(error?.message || '');

  return firstPhoneError.includes('data customer sudah ada di backend')
    || message.includes('data customer sudah ada di backend')
    || phoneErrors.length > 0;
};

module.exports = {
  CUSTOMER_PHONE_CONFLICT_MESSAGE,
  CUSTOMER_PHONE_INVALID_MESSAGE,
  getCustomerPhoneSearchFragments,
  isCustomerPhoneConflictError,
  matchesCustomerSearch,
  normalizeIndonesianPhone,
};
