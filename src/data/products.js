export const productCatalog = [
  {
    id: 1,
    name: 'Banner',
    pricingType: 'area',
    calcUnit: 'm2',
    basePrice: 45000,
    requiresProduction: true,
    requiresDesign: false,
  },
  {
    id: 2,
    name: 'Buku',
    pricingType: 'page',
    calcUnit: 'unit',
    basePrice: 1200,
    requiresProduction: true,
    requiresDesign: false,
  },
  {
    id: 3,
    name: 'Brosur',
    pricingType: 'sheet',
    calcUnit: 'unit',
    basePrice: 850,
    requiresProduction: true,
    requiresDesign: false,
  },
];

export const finishingOptions = ['Laminasi', 'Tanpa Laminasi'];

export const materialOptions = [
  { id: 101, name: 'Art Paper' },
  { id: 102, name: 'Vinyl' },
];

export const finishingMultiplier = {
  Laminasi: 1.12,
  'Tanpa Laminasi': 1,
};

export const materialMultiplier = {
  'Art Paper': 1,
  Vinyl: 1.25,
};

export default productCatalog;
