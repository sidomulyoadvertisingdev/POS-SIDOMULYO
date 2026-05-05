const defaultNormalizeText = (value) => String(value || '').trim().toLowerCase();
const defaultToLabel = (...candidates) => {
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }
  return '';
};

const hasA3Token = (value) => {
  const text = defaultNormalizeText(value).replace(/\s+/g, ' ');
  return /\ba3\s*\+/.test(text) || text.includes('a3 plus') || text.includes('a3plus');
};

const buildProductPickerTree = (rows, helpers = {}) => {
  const normalizeText = helpers.normalizeText || defaultNormalizeText;
  const toLabel = helpers.toLabel || defaultToLabel;
  const normalizeCategoryName = helpers.normalizeCategoryName || (() => 'Tanpa Kategori');
  const normalizeSubCategoryName = helpers.normalizeSubCategoryName || (() => 'Tanpa Sub Kategori');
  const toSourceProduct = helpers.toSourceProduct || ((row) => row?.source_product || row?.sourceProduct || null);
  const normalizeProductFamilyName = helpers.normalizeProductFamilyName || ((row) => row?.name || '');
  const normalizeVariantName = helpers.normalizeVariantName || ((row) => row?.name || '');
  const safeRows = Array.isArray(rows) ? rows : [];
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
    const familyName = toLabel(
      row?.source_parent_product_name,
      sourceProduct?.name,
      row?.source_product_name,
      row?.parent_product_name,
      normalizeProductFamilyName(row),
      normalizeVariantName(row),
      'Produk',
    );
    const hasFamilyRelationHint = [
      row?.source_parent_product_id,
      sourceProduct?.id,
      row?.parent_product_id,
      row?.parent_id,
      row?.source_parent_product_name,
      row?.source_product_name,
      row?.parent_product_name,
      row?.base_product_name,
      row?.parent_name,
    ].some((value) => String(value || '').trim() !== '');
    const familyId = Number(
      row?.source_parent_product_id
      || row?.parent_product_id
      || row?.parent_id
      || row?.source_product_id
      || sourceProduct?.parent_product_id
      || sourceProduct?.id
      || row?.product_id
      || row?.id
      || 0
    );
    const familyNameKey = normalizeText(familyName);
    const unscopedFamilyKey = familyId > 0 && (!hasFamilyRelationHint || !familyNameKey)
      ? `family:${familyId}`
      : `family:${familyNameKey || familyId || JSON.stringify(row || {})}`;
    const baseForClassification = sourceProduct && typeof sourceProduct === 'object'
      ? { ...row, ...sourceProduct, source_product: sourceProduct, sourceProduct }
      : row;
    const path = ensureCategoryPath(baseForClassification, unscopedFamilyKey);
    const scopedFamilyKey = `${path.subCategoryKey}::${unscopedFamilyKey}`;

    let familyNode = familyMap.get(scopedFamilyKey);
    if (!familyNode) {
      familyNode = {
        key: scopedFamilyKey,
        name: familyName,
        variants: [],
        _variantKeys: new Set(),
        _subCategoryKey: path.subCategoryKey,
      };
      path.subCategory.products.push(familyNode);
      familyMap.set(scopedFamilyKey, familyNode);
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

  safeRows.forEach((row) => {
    const { familyNode, familyId, sourceProduct } = ensureFamilyNode(row);
    const nestedVariants = Array.isArray(row?.variants) ? row.variants : [];

    if (nestedVariants.length > 0) {
      nestedVariants.forEach((variant, idx) => {
        attachVariant(familyNode, variant, row, familyId, sourceProduct, idx);
      });
      return;
    }

    const rowId = Number(row?.id || 0);
    const isLikelyVariant = Boolean(
      row?.source_is_variant === true
      || Number(row?.source_parent_product_id || 0) > 0
      || (familyId > 0 && rowId > 0 && familyId !== rowId)
    );

    if (isLikelyVariant) {
      attachVariant(familyNode, row, row, familyId, sourceProduct, 0);
    } else if (familyNode.variants.length === 0) {
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
};

module.exports = {
  buildProductPickerTree,
  hasA3Token,
};
