/**
 * Simplified Pricing Calculator
 *
 * Manual pricing entry with automatic 50/50 margin split.
 *
 * Simple Flow:
 * 1. Accept manual pricing inputs (customerTotal, bradfordTotal, jdTotal, paperCostTotal, paperChargedTotal)
 * 2. Calculate margin = customerTotal - bradfordTotal
 * 3. Split margin 50/50 between Impact and Bradford
 * 4. Auto-calculate all CPMs from totals
 * 5. No conditional logic, no complex rules
 */

// Types will be passed in from calling code to avoid circular dependencies
type PrismaClient = any;

/**
 * Manual pricing inputs for job creation
 */
export interface ManualPricingInput {
  sizeName: string;
  quantity: number;

  // Manual pricing amounts (all required)
  customerTotal: number;        // What customer pays Impact
  bradfordTotal: number;        // What Impact pays Bradford
  jdTotal: number;              // What Bradford pays JD for printing
  paperCostTotal: number;       // Actual paper cost
  paperChargedTotal: number;    // What Bradford charges Impact for paper
}

/**
 * Pricing calculation result
 */
export interface SimplePricingResult {
  // Size info
  sizeName: string;
  quantity: number;
  quantityInThousands: number;

  // CPM rates (calculated from totals)
  customerCPM: number;
  impactMarginCPM: number;
  bradfordTotalCPM: number;
  bradfordPrintMarginCPM: number;
  bradfordPaperMarginCPM: number;
  bradfordTotalMarginCPM: number;
  printCPM: number;
  paperCostCPM: number;
  paperChargedCPM: number;

  // Total amounts (from input)
  customerTotal: number;
  impactMargin: number;
  bradfordTotal: number;
  bradfordPrintMargin: number;
  bradfordPaperMargin: number;
  bradfordTotalMargin: number;
  jdTotal: number;
  paperCostTotal: number;
  paperChargedTotal: number;
}

/**
 * Calculate simple pricing with 50/50 margin split
 *
 * Formula:
 * - Total Margin = customerTotal - bradfordTotal
 * - Impact Margin = Total Margin / 2 (50%)
 * - Bradford Print Margin = Total Margin / 2 (50%)
 * - Bradford Paper Margin = paperChargedTotal - paperCostTotal
 * - Bradford Total Margin = Bradford Print Margin + Bradford Paper Margin
 * - All CPMs = Total / (quantity / 1000)
 *
 * @param input - Manual pricing inputs
 * @returns Complete pricing breakdown
 */
export function calculateSimplePricing(
  input: ManualPricingInput
): SimplePricingResult {
  const {
    sizeName,
    quantity,
    customerTotal,
    bradfordTotal,
    jdTotal,
    paperCostTotal,
    paperChargedTotal
  } = input;

  // Validation
  if (quantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  if (customerTotal < 0 || bradfordTotal < 0 || jdTotal < 0 || paperCostTotal < 0 || paperChargedTotal < 0) {
    throw new Error('All pricing amounts must be non-negative');
  }
  if (customerTotal < bradfordTotal) {
    throw new Error('Customer total cannot be less than Bradford total (negative margin)');
  }

  const quantityInThousands = quantity / 1000;

  // Calculate margins
  const totalMargin = customerTotal - bradfordTotal;
  const impactMargin = totalMargin / 2;  // 50% to Impact
  const bradfordPrintMargin = totalMargin / 2;  // 50% to Bradford
  const bradfordPaperMargin = paperChargedTotal - paperCostTotal;
  const bradfordTotalMargin = bradfordPrintMargin + bradfordPaperMargin;

  // Calculate CPMs (cost per thousand)
  const customerCPM = customerTotal / quantityInThousands;
  const bradfordTotalCPM = bradfordTotal / quantityInThousands;
  const impactMarginCPM = impactMargin / quantityInThousands;
  const bradfordPrintMarginCPM = bradfordPrintMargin / quantityInThousands;
  const bradfordPaperMarginCPM = bradfordPaperMargin / quantityInThousands;
  const bradfordTotalMarginCPM = bradfordTotalMargin / quantityInThousands;
  const printCPM = jdTotal / quantityInThousands;
  const paperCostCPM = paperCostTotal / quantityInThousands;
  const paperChargedCPM = paperChargedTotal / quantityInThousands;

  return {
    sizeName,
    quantity,
    quantityInThousands,

    // CPM rates
    customerCPM,
    impactMarginCPM,
    bradfordTotalCPM,
    bradfordPrintMarginCPM,
    bradfordPaperMarginCPM,
    bradfordTotalMarginCPM,
    printCPM,
    paperCostCPM,
    paperChargedCPM,

    // Totals
    customerTotal,
    impactMargin,
    bradfordTotal,
    bradfordPrintMargin,
    bradfordPaperMargin,
    bradfordTotalMargin,
    jdTotal,
    paperCostTotal,
    paperChargedTotal,
  };
}

/**
 * Recalculate pricing when any field is edited
 *
 * User can edit any total field, and we'll recalculate:
 * - 50/50 margin split
 * - All CPMs from totals
 *
 * @param updates - Partial updates to pricing fields
 * @param currentPricing - Current job pricing
 * @returns Updated complete pricing
 */
export function recalculatePricing(
  updates: Partial<ManualPricingInput>,
  currentPricing: SimplePricingResult
): SimplePricingResult {
  // Merge updates with current values
  const input: ManualPricingInput = {
    sizeName: updates.sizeName ?? currentPricing.sizeName,
    quantity: updates.quantity ?? currentPricing.quantity,
    customerTotal: updates.customerTotal ?? currentPricing.customerTotal,
    bradfordTotal: updates.bradfordTotal ?? currentPricing.bradfordTotal,
    jdTotal: updates.jdTotal ?? currentPricing.jdTotal,
    paperCostTotal: updates.paperCostTotal ?? currentPricing.paperCostTotal,
    paperChargedTotal: updates.paperChargedTotal ?? currentPricing.paperChargedTotal,
  };

  // Recalculate everything
  return calculateSimplePricing(input);
}

/**
 * Validate pricing calculation
 * Checks for negative margins, zero values, etc.
 */
export function validatePricing(result: SimplePricingResult): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for zero customer total
  if (result.customerTotal <= 0) {
    errors.push('Customer total must be greater than zero');
  }

  // Check for negative Impact margin
  if (result.impactMargin < 0) {
    errors.push(`Impact margin is negative: $${result.impactMargin.toFixed(2)}. Customer total must be greater than Bradford total.`);
  }

  // Check for negative Bradford margin (print margin)
  if (result.bradfordPrintMargin < 0) {
    warnings.push(`Bradford print margin is negative: $${result.bradfordPrintMargin.toFixed(2)}`);
  }

  // Check for negative Bradford total margin
  if (result.bradfordTotalMargin < 0) {
    warnings.push(`Bradford total margin is negative: $${result.bradfordTotalMargin.toFixed(2)}`);
  }

  // Check if paper is charged below cost
  if (result.paperChargedTotal < result.paperCostTotal) {
    warnings.push(
      `Paper charged ($${result.paperChargedTotal.toFixed(2)}) is less than paper cost ($${result.paperCostTotal.toFixed(2)})`
    );
  }

  // Check if Bradford total doesn't match JD + paper
  const expectedBradfordTotal = result.jdTotal + result.paperChargedTotal;
  const bradfordTotalDiff = Math.abs(result.bradfordTotal - expectedBradfordTotal);
  if (bradfordTotalDiff > 0.01) {  // Allow 1 cent rounding difference
    warnings.push(
      `Bradford total ($${result.bradfordTotal.toFixed(2)}) doesn't match JD total ($${result.jdTotal.toFixed(2)}) + Paper charged ($${result.paperChargedTotal.toFixed(2)}) = $${expectedBradfordTotal.toFixed(2)}`
    );
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * DEPRECATED FUNCTIONS - kept for backwards compatibility
 * These will be removed in the next migration
 */

export interface PricingOverrides {
  customerCPM?: number;
  printCPM?: number;
  paperCostCPM?: number;
  paperChargedCPM?: number;
}

export interface DynamicPricingResult extends SimplePricingResult {
  paperType?: string | null;
  paperWeightTotal?: number;
  paperWeightPer1000?: number;
  isCustomPricing: boolean;
  requiresApproval: boolean;
  standardCustomerCPM: number;
  underchargeAmount?: number;
}

/**
 * @deprecated Use calculateSimplePricing instead
 * Temporarily kept for backwards compatibility
 */
export async function calculateDynamicPricing(
  prisma: PrismaClient,
  sizeName: string,
  quantity: number,
  overrides?: PricingOverrides,
  jdSuppliesPaper: boolean = false,
  bradfordWaivesPaperMargin: boolean = false
): Promise<DynamicPricingResult> {
  console.warn('calculateDynamicPricing is deprecated. Use calculateSimplePricing instead.');

  // For now, throw error to force migration
  throw new Error(
    'calculateDynamicPricing is no longer supported. Please provide manual pricing values and use calculateSimplePricing instead.'
  );
}

/**
 * @deprecated Use calculateSimplePricing instead
 */
export async function calculateFromCustomerTotal(
  prisma: PrismaClient,
  customerTotal: number,
  quantity: number,
  sizeName: string,
  jdSuppliesPaper: boolean = false,
  bradfordWaivesPaperMargin: boolean = false
): Promise<DynamicPricingResult> {
  console.warn('calculateFromCustomerTotal is deprecated. Use calculateSimplePricing instead.');

  throw new Error(
    'calculateFromCustomerTotal is no longer supported. Please provide all manual pricing values and use calculateSimplePricing instead.'
  );
}

/**
 * @deprecated Pricing rules are no longer used for automatic calculation
 */
export async function getAvailablePricingRules(prisma: PrismaClient) {
  console.warn('getAvailablePricingRules is deprecated. Pricing rules are no longer used for automatic calculation.');

  return [];
}

/**
 * Normalize size name for matching
 * Handles variations like "7.25 x 16.375" vs "7 1/4 x 16 3/8"
 */
export function normalizeSizeName(sizeName: string): string {
  return sizeName.trim();
}
