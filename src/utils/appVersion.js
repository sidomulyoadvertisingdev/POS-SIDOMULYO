const normalizeAppVersion = (value, fallback = '-') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const formatAppVersionLabel = (value, options = {}) => {
  const fallback = String(options?.fallback || '-').trim() || '-';
  const prefix = String(options?.prefix || '').trim();
  const raw = normalizeAppVersion(value, fallback);

  if (raw === fallback) {
    return raw;
  }

  const withV = raw.toLowerCase().startsWith('v') ? raw : `v${raw}`;
  return prefix ? `${prefix} ${withV}` : withV;
};

module.exports = {
  formatAppVersionLabel,
  normalizeAppVersion,
};
