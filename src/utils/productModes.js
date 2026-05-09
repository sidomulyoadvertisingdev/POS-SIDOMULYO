const resolveQtyOnlyProductMode = (product, productDetail = null, helpers = {}) => {
  const toSourceProduct = typeof helpers.toSourceProduct === 'function'
    ? helpers.toSourceProduct
    : ((row) => row?.sourceProduct || row?.source_product || null);
  const toSourceMeta = typeof helpers.toSourceMeta === 'function'
    ? helpers.toSourceMeta
    : ((row) => {
      const sourceProduct = toSourceProduct(row);
      const meta = sourceProduct?.meta;
      return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
    });
  const parseBooleanLoose = typeof helpers.parseBooleanLoose === 'function'
    ? helpers.parseBooleanLoose
    : ((value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      const text = String(value || '').trim().toLowerCase();
      if (['1', 'true', 'yes', 'ya', 'y', 'on', 'enabled', 'aktif'].includes(text)) return true;
      if (['0', 'false', 'no', 'tidak', 'off', 'disabled', 'nonaktif'].includes(text)) return false;
      return null;
    });
  const normalizeText = typeof helpers.normalizeText === 'function'
    ? helpers.normalizeText
    : ((value) => String(value || '').trim().toLowerCase());
  const resolveProductCalcType = typeof helpers.resolveProductCalcType === 'function'
    ? helpers.resolveProductCalcType
    : ((candidateProduct, candidateDetail = null) => {
      const rows = [
        candidateProduct,
        candidateDetail,
        toSourceProduct(candidateProduct),
        toSourceProduct(candidateDetail),
        toSourceMeta(candidateProduct),
        toSourceMeta(candidateDetail),
      ].filter(Boolean);

      for (const row of rows) {
        const value = String(row?.calc_type || row?.calculation_type || '').trim().toLowerCase();
        if (value) {
          return value;
        }
      }

      return '';
    });
  const isGroupBundleProduct = typeof helpers.isGroupBundleProduct === 'function'
    ? helpers.isGroupBundleProduct
    : ((candidateProduct, candidateDetail = null) => {
      const rows = [
        candidateProduct,
        candidateDetail,
        toSourceProduct(candidateProduct),
        toSourceProduct(candidateDetail),
        toSourceMeta(candidateProduct),
        toSourceMeta(candidateDetail),
      ].filter(Boolean);

      return rows.some((row) => {
        if (Boolean(row?.is_group_product)) {
          return true;
        }

        return Number(row?.group_component_count || 0) > 0;
      });
    });

  const rows = [
    product,
    productDetail,
    toSourceProduct(product),
    toSourceProduct(productDetail),
    toSourceMeta(product),
    toSourceMeta(productDetail),
  ].filter(Boolean);

  const explicitUnitOnly = rows
    .map((row) => parseBooleanLoose(row?.unit_only))
    .find((value) => value !== null);
  const hasStampelScope = rows.some((row) => {
    const templateScope = normalizeText(row?.template_scope);
    const productFamily = normalizeText(row?.product_family);
    const posInputMode = normalizeText(row?.pos_input_mode);
    return templateScope === 'stampel'
      || productFamily === 'stampel'
      || posInputMode === 'unit_only';
  });

  if (explicitUnitOnly === true || hasStampelScope) {
    return {
      enabled: true,
      kind: 'stampel',
      inputLabel: 'Qty / Satuan',
      statusLabel: 'Tanpa Ukuran',
      materialFallbackLabel: 'Bahan mengikuti resep stampel',
      helperText: 'Produk stampel memakai qty/satuan. Ukuran panjang, lebar, luas, dan LB Max tidak dipakai di POS.',
      displayText: 'Qty / Satuan',
    };
  }

  const productType = String(
    toSourceProduct(productDetail)?.product_type
    || toSourceProduct(product)?.product_type
    || productDetail?.product_type
    || product?.product_type
    || toSourceMeta(productDetail)?.product_type
    || toSourceMeta(product)?.product_type
    || '',
  ).trim().toLowerCase();
  const calcType = resolveProductCalcType(product, productDetail);

  if (isGroupBundleProduct(product, productDetail)) {
    const canUseBundleQtyOnly = calcType === 'unit';

    if (canUseBundleQtyOnly) {
      return {
        enabled: true,
        kind: 'bundle',
        inputLabel: 'Qty Only',
        statusLabel: 'Tanpa Ukuran',
        materialFallbackLabel: 'Paket produk',
        helperText: 'Produk paket memakai qty saja. Komponen paket mengikuti konfigurasi backend.',
        displayText: 'Qty Only',
      };
    }
  }

  if (productType === 'service' && calcType === 'unit') {
    return {
      enabled: true,
      kind: 'service',
      inputLabel: 'Qty Only',
      statusLabel: 'Tanpa Ukuran',
      materialFallbackLabel: 'Tanpa Material',
      helperText: 'Produk jasa ini memakai qty saja. Total dihitung dari harga backend x qty.',
      displayText: 'Qty Only',
    };
  }

  return {
    enabled: false,
    kind: '',
    inputLabel: '',
    statusLabel: '',
    materialFallbackLabel: '',
    helperText: '',
    displayText: '',
  };
};

module.exports = {
  resolveQtyOnlyProductMode,
};
