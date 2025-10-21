/**
 * Pricing Structure for Third-Party Production
 * All costs are in CPM (Cost Per Thousand pieces)
 */

export interface ProductSize {
  id: string;
  name: string;
  description: string;
  paperType: string;
  paperWeightLbsPer1000: number;
  paperCostPerLb: number;
  paperCostCPM: number; // Actual paper cost
  paperChargedCPM: number; // What Bradford charges for paper
  paperMarginCPM: number; // Bradford's paper profit
  printCPM: number; // What JD Graphic gets for printing
  customerCPM: number; // What customer pays
  impactMarginCPM: number; // Impact Direct's profit
  bradfordPrintMarginCPM: number; // Bradford's print profit
  bradfordPaperMarginCPM: number; // Bradford's paper profit
  bradfordTotalMarginCPM: number; // Total Bradford profit
  bradfordTotalCPM: number; // What Impact Direct pays Bradford
}

export const PRODUCT_SIZES: Record<string, ProductSize> = {
  'SM_7_25_16_375': {
    id: 'SM_7_25_16_375',
    name: '7 1/4 x 16 3/8',
    description: 'Self Mailer - Coated Matte 7pt (98# Stock)',
    paperType: 'Coated Matte 7pt (98# Stock)',
    paperWeightLbsPer1000: 22.9,
    paperCostPerLb: 0.675,
    paperCostCPM: 15.4575, // Actual paper cost (22.9 × 0.675)
    paperChargedCPM: 18.55, // What Bradford charges
    paperMarginCPM: 3.0925, // Paper profit (18.55 - 15.4575)
    printCPM: 34.74, // JD Graphic's payment
    customerCPM: 67.56,
    impactMarginCPM: 7.135,
    bradfordPrintMarginCPM: 7.135, // Bradford's print profit
    bradfordPaperMarginCPM: 3.0925, // Bradford's paper profit
    bradfordTotalMarginCPM: 10.2275, // Total Bradford profit (7.135 + 3.0925)
    bradfordTotalCPM: 60.425, // What Bradford receives from Impact
  },
  'SM_8_5_17_5': {
    id: 'SM_8_5_17_5',
    name: '8 1/2 x 17 1/2',
    description: 'Self Mailer - Coated Matte 7pt (98# Stock)',
    paperType: 'Coated Matte 7pt (98# Stock)',
    paperWeightLbsPer1000: 30.16,
    paperCostPerLb: 0.675,
    paperCostCPM: 20.358, // Actual paper cost (30.16 × 0.675)
    paperChargedCPM: 24.43, // What Bradford charges
    paperMarginCPM: 4.072, // Paper profit (24.43 - 20.358)
    printCPM: 38.41, // JD Graphic's payment
    customerCPM: 81.00,
    impactMarginCPM: 9.08,
    bradfordPrintMarginCPM: 9.08, // Bradford's print profit
    bradfordPaperMarginCPM: 4.072, // Bradford's paper profit
    bradfordTotalMarginCPM: 13.152, // Total Bradford profit (9.08 + 4.072)
    bradfordTotalCPM: 71.92, // What Bradford receives from Impact
  },
  'SM_9_75_22_125': {
    id: 'SM_9_75_22_125',
    name: '9 3/4 x 22 1/8',
    description: 'Self Mailer - Coated Matte 7pt (98# Stock)',
    paperType: 'Coated Matte 7pt (98# Stock)',
    paperWeightLbsPer1000: 52.98,
    paperCostPerLb: 0.675,
    paperCostCPM: 35.7615, // Actual paper cost (52.98 × 0.675)
    paperChargedCPM: 42.91, // What Bradford charges
    paperMarginCPM: 7.1485, // Paper profit (42.91 - 35.7615)
    printCPM: 49.18, // JD Graphic's payment
    customerCPM: 106.91,
    impactMarginCPM: 7.41,
    bradfordPrintMarginCPM: 7.41, // Bradford's print profit
    bradfordPaperMarginCPM: 7.1485, // Bradford's paper profit
    bradfordTotalMarginCPM: 14.5585, // Total Bradford profit (7.41 + 7.1485)
    bradfordTotalCPM: 99.50, // What Bradford receives from Impact
  },
  'SM_9_75_26': {
    id: 'SM_9_75_26',
    name: '9 3/4 x 26',
    description: 'Self Mailer - Coated Matte 7pt (98# Stock)',
    paperType: 'Coated Matte 7pt (98# Stock)',
    paperWeightLbsPer1000: 54.28,
    paperCostPerLb: 0.675,
    paperCostCPM: 36.639, // Actual paper cost (54.28 × 0.675)
    paperChargedCPM: 48.60, // What Bradford charges
    paperMarginCPM: 11.961, // Paper profit (48.60 - 36.639)
    printCPM: 49.18, // JD Graphic's payment
    customerCPM: 112.60,
    impactMarginCPM: 7.41,
    bradfordPrintMarginCPM: 7.41, // Bradford's print profit
    bradfordPaperMarginCPM: 11.961, // Bradford's paper profit
    bradfordTotalMarginCPM: 19.371, // Total Bradford profit (7.41 + 11.961)
    bradfordTotalCPM: 105.19, // What Bradford receives from Impact
  },
  'PC_6_9': {
    id: 'PC_6_9',
    name: '6 x 9',
    description: 'Postcard - 9pt Cover Stock',
    paperType: '9pt Gloss Cover / 9pt Matte Cover',
    paperWeightLbsPer1000: 20,
    paperCostPerLb: 0.675,
    paperCostCPM: 13.5, // Actual paper cost (20 × 0.675)
    paperChargedCPM: 15.55, // What Bradford charges
    paperMarginCPM: 2.05, // Paper profit (15.55 - 13.5)
    printCPM: 10.00, // JD Graphic's payment
    customerCPM: 35.00,
    impactMarginCPM: 4.725,
    bradfordPrintMarginCPM: 4.725, // Bradford's print profit
    bradfordPaperMarginCPM: 2.05, // Bradford's paper profit
    bradfordTotalMarginCPM: 6.775, // Total Bradford profit (4.725 + 2.05)
    bradfordTotalCPM: 30.275, // What Bradford receives from Impact
  },
  'PC_6_11': {
    id: 'PC_6_11',
    name: '6 x 11',
    description: 'Postcard - 9pt Cover Stock',
    paperType: '9pt Gloss Cover / 9pt Matte Cover',
    paperWeightLbsPer1000: 24,
    paperCostPerLb: 0.675,
    paperCostCPM: 16.2, // Actual paper cost (24 × 0.675)
    paperChargedCPM: 18.89, // What Bradford charges
    paperMarginCPM: 2.69, // Paper profit (18.89 - 16.2)
    printCPM: 12.00, // JD Graphic's payment
    customerCPM: 39.00,
    impactMarginCPM: 4.055,
    bradfordPrintMarginCPM: 4.055, // Bradford's print profit
    bradfordPaperMarginCPM: 2.69, // Bradford's paper profit
    bradfordTotalMarginCPM: 6.745, // Total Bradford profit (4.055 + 2.69)
    bradfordTotalCPM: 34.945, // What Bradford receives from Impact
  },
};

/**
 * Customer-specific product pricing
 * For customers like Flood and ABT who have unique product configurations
 */
export interface CustomerProduct {
  id: string;
  customerId: string;
  name: string;
  description: string;
  components: Array<{
    name: string;
    cpm: number;
  }>;
  totalCPM: number;
}

// Flood Brothers Products
export const FLOOD_PRODUCTS: Record<string, CustomerProduct> = {
  'FLOOD_STANDARD_30K': {
    id: 'FLOOD_STANDARD_30K',
    customerId: 'flood',
    name: 'Standard Mailing (30,000)',
    description: 'Complete mailing service with envelope, printing, lettershop, and postage',
    components: [
      { name: '#10 OE - 2c', cpm: 34.62 },
      { name: '#9 Reply OE 1c', cpm: 27.42 },
      { name: 'Digital Print Invoices - 4/1', cpm: 38.95 },
      { name: 'Lettershop', cpm: 31.0 },
      { name: 'Presort', cpm: 36.0 },
      { name: 'Postage', cpm: 620.0 },
    ],
    totalCPM: 788.0, // Sum of all components
  },
};

// ABT Warranty Products
export const ABT_PRODUCTS: Record<string, CustomerProduct> = {
  'ABT_STANDARD_15K': {
    id: 'ABT_STANDARD_15K',
    customerId: 'abt',
    name: 'Standard Mailing (15,000)',
    description: 'Complete mailing service with envelope, printing, lettershop, inserts, and postage',
    components: [
      { name: '#10 OE - 2c', cpm: 43.23 },
      { name: 'Digital Print Invoices - 4/1', cpm: 37.06 },
      { name: 'Lettershop', cpm: 31.0 },
      { name: 'Inserts', cpm: 60.0 },
      { name: 'MM Postage', cpm: 430.0 },
    ],
    totalCPM: 601.29, // Sum of all components
  },
};

export const PRODUCT_SIZE_ARRAY = Object.values(PRODUCT_SIZES);

/**
 * Calculate job pricing based on size and quantity
 */
export interface JobPricing {
  sizeId: string;
  sizeName: string;
  quantity: number;
  quantityInThousands: number;

  // Per thousand (CPM) rates
  customerCPM: number;
  impactMarginCPM: number;
  bradfordTotalCPM: number;
  bradfordPrintMarginCPM: number;
  bradfordPaperMarginCPM: number;
  bradfordTotalMarginCPM: number;
  printCPM: number;
  paperCostCPM: number;
  paperChargedCPM: number;

  // Total amounts
  customerTotal: number;
  impactMargin: number;
  bradfordTotal: number;
  bradfordPrintMargin: number; // Bradford's print profit
  bradfordPaperMargin: number; // Bradford's paper profit
  bradfordTotalMargin: number; // Total Bradford profit
  jdTotal: number;
  paperCostTotal: number; // Actual paper cost
  paperChargedTotal: number; // What Bradford charges for paper

  // Paper details
  paperType: string;
  paperWeightTotal: number; // Total lbs for the job
  paperWeightPer1000: number;
}

export function calculateJobPricing(
  sizeId: string,
  quantity: number
): JobPricing {
  const size = PRODUCT_SIZES[sizeId];
  if (!size) {
    throw new Error(`Invalid size ID: ${sizeId}`);
  }

  const quantityInThousands = quantity / 1000;

  return {
    sizeId: size.id,
    sizeName: size.name,
    quantity,
    quantityInThousands,

    // CPM rates
    customerCPM: size.customerCPM,
    impactMarginCPM: size.impactMarginCPM,
    bradfordTotalCPM: size.bradfordTotalCPM,
    bradfordPrintMarginCPM: size.bradfordPrintMarginCPM,
    bradfordPaperMarginCPM: size.bradfordPaperMarginCPM,
    bradfordTotalMarginCPM: size.bradfordTotalMarginCPM,
    printCPM: size.printCPM,
    paperCostCPM: size.paperCostCPM,
    paperChargedCPM: size.paperChargedCPM,

    // Total amounts
    customerTotal: size.customerCPM * quantityInThousands,
    impactMargin: size.impactMarginCPM * quantityInThousands,
    bradfordTotal: size.bradfordTotalCPM * quantityInThousands,
    bradfordPrintMargin: size.bradfordPrintMarginCPM * quantityInThousands,
    bradfordPaperMargin: size.bradfordPaperMarginCPM * quantityInThousands,
    bradfordTotalMargin: size.bradfordTotalMarginCPM * quantityInThousands,
    jdTotal: size.printCPM * quantityInThousands,
    paperCostTotal: size.paperCostCPM * quantityInThousands,
    paperChargedTotal: size.paperChargedCPM * quantityInThousands,

    // Paper details
    paperType: size.paperType,
    paperWeightTotal: size.paperWeightLbsPer1000 * quantityInThousands,
    paperWeightPer1000: size.paperWeightLbsPer1000,
  };
}

/**
 * Get all available sizes for selection
 */
export function getAvailableSizes() {
  return PRODUCT_SIZE_ARRAY.map(size => ({
    id: size.id,
    name: size.name,
    description: size.description,
    customerCPM: size.customerCPM,
  }));
}

/**
 * Custom pricing calculation with flexible customer pricing
 * Allows custom customer price while keeping Bradford cost fixed
 * Automatically calculates 50/50 margin split
 */
export interface CustomJobPricing extends JobPricing {
  isCustomPricing: boolean;
  isLoss: boolean; // True if custom price < Bradford cost
  lossAmount: number; // Amount of loss if below cost
  standardCustomerPrice: number; // Original standard price
}

export function calculateCustomPricing(
  sizeId: string,
  quantity: number,
  customCustomerPrice?: number
): CustomJobPricing {
  const size = PRODUCT_SIZES[sizeId];
  if (!size) {
    throw new Error(`Invalid size ID: ${sizeId}`);
  }

  const quantityInThousands = quantity / 1000;
  const standardPricing = calculateJobPricing(sizeId, quantity);

  // If no custom price provided, return standard pricing
  if (customCustomerPrice === undefined || customCustomerPrice === null) {
    return {
      ...standardPricing,
      isCustomPricing: false,
      isLoss: false,
      lossAmount: 0,
      standardCustomerPrice: standardPricing.customerTotal,
    };
  }

  // Bradford's fixed cost = JD print cost + Bradford's paper charge
  // This includes Bradford's paper markup but NOT their share of the margin
  const bradfordBaseCostCPM = size.printCPM + size.paperChargedCPM;
  const bradfordBaseCostTotal = bradfordBaseCostCPM * quantityInThousands;

  // Calculate new margin based on custom customer price
  const totalMargin = customCustomerPrice - bradfordBaseCostTotal;
  const isLoss = totalMargin < 0;
  const lossAmount = isLoss ? Math.abs(totalMargin) : 0;

  // 50/50 split of margin
  const impactMargin = totalMargin / 2;
  const bradfordMargin = totalMargin / 2;

  // What Impact pays Bradford = Bradford base cost + Bradford's margin share
  const bradfordTotal = bradfordBaseCostTotal + bradfordMargin;

  // Calculate CPM values
  const customerCPM = customCustomerPrice / quantityInThousands;
  const impactMarginCPM = impactMargin / quantityInThousands;
  const bradfordMarginCPM = bradfordMargin / quantityInThousands;
  const bradfordTotalCPM = bradfordTotal / quantityInThousands;

  return {
    sizeId: size.id,
    sizeName: size.name,
    quantity,
    quantityInThousands,

    // CPM rates (custom)
    customerCPM,
    impactMarginCPM,
    bradfordTotalCPM,
    bradfordPrintMarginCPM: bradfordMarginCPM, // Bradford's share of margin
    bradfordPaperMarginCPM: size.paperMarginCPM, // Paper markup stays same
    bradfordTotalMarginCPM: bradfordMarginCPM + size.paperMarginCPM, // Total Bradford profit
    printCPM: size.printCPM,
    paperCostCPM: size.paperCostCPM,
    paperChargedCPM: size.paperChargedCPM,

    // Total amounts (custom)
    customerTotal: customCustomerPrice,
    impactMargin,
    bradfordTotal,
    bradfordPrintMargin: bradfordMargin, // Bradford's share of margin
    bradfordPaperMargin: size.paperMarginCPM * quantityInThousands, // Paper markup
    bradfordTotalMargin: bradfordMargin + (size.paperMarginCPM * quantityInThousands), // Total
    jdTotal: size.printCPM * quantityInThousands,
    paperCostTotal: size.paperCostCPM * quantityInThousands,
    paperChargedTotal: size.paperChargedCPM * quantityInThousands,

    // Paper details
    paperType: size.paperType,
    paperWeightTotal: size.paperWeightLbsPer1000 * quantityInThousands,
    paperWeightPer1000: size.paperWeightLbsPer1000,

    // Custom pricing metadata
    isCustomPricing: true,
    isLoss,
    lossAmount,
    standardCustomerPrice: standardPricing.customerTotal,
  };
}

/**
 * Get Bradford's base cost (without margin split)
 * This is the fixed cost that doesn't change with custom pricing
 */
export function getBradfordBaseCost(sizeId: string): {
  cpm: number;
  description: string;
} {
  const size = PRODUCT_SIZES[sizeId];
  if (!size) {
    throw new Error(`Invalid size ID: ${sizeId}`);
  }

  const bradfordBaseCostCPM = size.printCPM + size.paperChargedCPM;

  return {
    cpm: bradfordBaseCostCPM,
    description: `JD Print ($${size.printCPM}) + Bradford Paper ($${size.paperChargedCPM})`,
  };
}
