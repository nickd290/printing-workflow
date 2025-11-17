/**
 * Dynamic Pricing Calculator
 *
 * Loads pricing rules from the database and calculates job pricing
 * with support for manual overrides and undercharge detection.
 *
 * Pricing Flow:
 * 1. Load PricingRule from database by sizeName
 * 2. Apply manual overrides if provided
 * 3. Calculate Bradford base cost = JD invoice + paper charged
 * 4. Calculate margin pool = customer revenue - Bradford base cost
 * 5. Split margin 50/50 between Impact and Bradford
 * 6. Bradford total = base cost + Bradford's margin share + paper markup
 * 7. Check undercharge: if quoted < agreed baseline, flag for approval
 */

// Types will be passed in from calling code to avoid circular dependencies
type PrismaClient = any;
type PricingRule = any;

/**
 * Manual override parameters for pricing calculation
 */
export interface PricingOverrides {
  customerCPM?: number;        // Override customer price per M
  printCPM?: number;            // Override JD print cost per M
  paperCostCPM?: number;        // Override paper cost per M
  paperChargedCPM?: number;     // Override paper charge per M
}

/**
 * Dynamic pricing calculation result
 */
export interface DynamicPricingResult {
  // Size info
  sizeName: string;
  quantity: number;
  quantityInThousands: number;

  // CPM rates
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
  bradfordPrintMargin: number;
  bradfordPaperMargin: number;
  bradfordTotalMargin: number;
  jdTotal: number;
  paperCostTotal: number;
  paperChargedTotal: number;

  // Paper details (optional from PricingRule)
  paperType?: string | null;
  paperWeightTotal?: number;
  paperWeightPer1000?: number;

  // Metadata
  isCustomPricing: boolean;      // True if overrides were applied
  requiresApproval: boolean;     // True if undercharge detected
  standardCustomerCPM: number;   // The agreed baseline rate from grid
  underchargeAmount?: number;    // How much below standard rate
}

/**
 * Calculate dynamic pricing from database pricing rules
 *
 * @param prisma - Prisma client instance
 * @param sizeName - Size name (e.g., "7 1/4 x 16 3/8")
 * @param quantity - Total quantity
 * @param overrides - Optional manual overrides
 * @returns Pricing calculation result
 */
export async function calculateDynamicPricing(
  prisma: PrismaClient,
  sizeName: string,
  quantity: number,
  overrides?: PricingOverrides,
  jdSuppliesPaper: boolean = false,
  bradfordWaivesPaperMargin: boolean = false
): Promise<DynamicPricingResult> {
  // Load pricing rule from database
  const pricingRule = await prisma.pricingRule.findUnique({
    where: { sizeName, isActive: true },
  });

  if (!pricingRule) {
    throw new Error(
      `No pricing rule found for size "${sizeName}". Admin input required.`
    );
  }

  const quantityInThousands = quantity / 1000;

  // Get base values from database or use overrides
  // printCPM = what Bradford pays JD for printing (jdInvoicePerM in CSV)
  const printCPM = overrides?.printCPM ?? Number(pricingRule.jdInvoicePerM || pricingRule.printCPM);
  const paperCostCPM = overrides?.paperCostCPM ?? Number(pricingRule.paperCPM || 0);

  // When JD supplies paper, no Bradford markup on paper
  let paperChargedCPM = overrides?.paperChargedCPM ?? Number(pricingRule.paperChargedCPM || 0);
  if (jdSuppliesPaper) {
    paperChargedCPM = paperCostCPM; // No markup when JD supplies paper
  }

  // Calculate paper markup (let instead of const so it can be updated in special modes)
  let paperMarkupCPM = paperChargedCPM - paperCostCPM;

  // Standard customer rate = what Impact charges customer (impactInvoicePerM in CSV)
  // This is the baseline rate that the customer should be charged
  const standardCustomerCPM = Number(pricingRule.impactInvoicePerM || 0);

  // Baseline minimum rate for undercharge detection
  const minimumCustomerCPM = standardCustomerCPM;

  // Actual customer price (use override or standard)
  const customerCPM = overrides?.customerCPM ?? standardCustomerCPM;

  // Calculate margins based on paper supply and waiver flags
  let impactMarginCPM: number;
  let bradfordPrintMarginCPM: number;
  let bradfordBaseCostCPM: number;
  let bradfordTotalCPM: number;
  let bradfordTotalMarginCPM: number;
  let jdTotalCPM: number;

  if (jdSuppliesPaper) {
    // JD supplies paper: Pure percentage split (10% Impact, 10% Bradford, 80% JD)
    // Example: $1000 customer → $100 Impact (10%), $900 to Bradford, Bradford keeps $100 (10%), $800 to JD

    // Impact's margin = 10% of customer total
    impactMarginCPM = customerCPM * 0.10;

    // Bradford receives 90% of customer total (customer - Impact's 10%)
    bradfordTotalCPM = customerCPM * 0.90;

    // Bradford's margin = 10% of customer total
    bradfordPrintMarginCPM = customerCPM * 0.10;

    // JD receives 80% of customer total (Bradford's 90% - Bradford's 10%)
    jdTotalCPM = customerCPM * 0.80;

    // Bradford's base cost is what they pay to JD (80% of customer)
    bradfordBaseCostCPM = jdTotalCPM;

    // Bradford's total margin = their 10% only (no paper markup when JD supplies)
    bradfordTotalMarginCPM = bradfordPrintMarginCPM;
  } else if (bradfordWaivesPaperMargin) {
    // Bradford Waives Paper Margin: 50/50 split of total margin, no paper markup
    // Bradford charges paper at cost (no markup)
    paperChargedCPM = paperCostCPM;
    paperMarkupCPM = 0; // Recalculate: no markup when waived

    // JD receives print cost
    jdTotalCPM = printCPM;

    // Total margin = customer revenue - JD print cost - paper cost
    const totalMarginCPM = customerCPM - printCPM - paperCostCPM;

    // 50/50 split of total margin
    impactMarginCPM = totalMarginCPM / 2;
    bradfordPrintMarginCPM = totalMarginCPM / 2;

    // Bradford's base cost = JD print + paper at cost (no markup)
    bradfordBaseCostCPM = printCPM + paperCostCPM;

    // Bradford's total = base cost + their margin share
    bradfordTotalCPM = bradfordBaseCostCPM + bradfordPrintMarginCPM;

    // Bradford's total margin = print margin only (no paper markup when waived)
    bradfordTotalMarginCPM = bradfordPrintMarginCPM;
  } else {
    // Bradford supplies paper: 50/50 margin split (standard logic)
    // Bradford's base cost = JD print + paper charged (with markup)
    bradfordBaseCostCPM = printCPM + paperChargedCPM;

    // Calculate margin pool: remaining profit after Bradford's full cost
    // This is split 50/50, while Bradford also keeps the paper markup separately
    const marginPoolCPM = customerCPM - bradfordBaseCostCPM;

    // 50/50 margin split of the remaining pool between Impact and Bradford
    impactMarginCPM = marginPoolCPM / 2;
    bradfordPrintMarginCPM = marginPoolCPM / 2;

    // Bradford's total = base cost + their margin share
    bradfordTotalCPM = bradfordBaseCostCPM + bradfordPrintMarginCPM;

    // Bradford's total margin = print margin + paper markup
    bradfordTotalMarginCPM = bradfordPrintMarginCPM + paperMarkupCPM;

    // JD receives actual print cost for 50/50 split
    jdTotalCPM = printCPM;
  }

  // Calculate totals
  const customerTotal = customerCPM * quantityInThousands;
  const impactMargin = impactMarginCPM * quantityInThousands;
  const bradfordTotal = bradfordTotalCPM * quantityInThousands;
  const bradfordPrintMargin = bradfordPrintMarginCPM * quantityInThousands;
  const bradfordPaperMargin = paperMarkupCPM * quantityInThousands;
  const bradfordTotalMargin = bradfordTotalMarginCPM * quantityInThousands;
  const jdTotal = jdTotalCPM * quantityInThousands;
  const paperCostTotal = paperCostCPM * quantityInThousands;
  const paperChargedTotal = paperChargedCPM * quantityInThousands;

  // Check for undercharge (quoted below minimum baseline)
  // If there's a minimum rate defined, check against it; otherwise check against standard
  const underchargeThreshold = minimumCustomerCPM > 0 ? minimumCustomerCPM : standardCustomerCPM;
  const requiresApproval = customerCPM < underchargeThreshold;
  const underchargeAmount = requiresApproval
    ? (underchargeThreshold - customerCPM) * quantityInThousands
    : undefined;

  // Check if custom pricing was used
  const isCustomPricing = !!(
    overrides?.customerCPM ||
    overrides?.printCPM ||
    overrides?.paperCostCPM ||
    overrides?.paperChargedCPM
  );

  // Calculate paper weight if available
  const paperWeightPer1000 = pricingRule.paperWeightPer1000
    ? Number(pricingRule.paperWeightPer1000)
    : undefined;
  const paperWeightTotal = paperWeightPer1000
    ? paperWeightPer1000 * quantityInThousands
    : undefined;

  return {
    sizeName,
    quantity,
    quantityInThousands,

    // CPM rates
    customerCPM,
    impactMarginCPM,
    bradfordTotalCPM,
    bradfordPrintMarginCPM,
    bradfordPaperMarginCPM: paperMarkupCPM,
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

    // Paper details
    paperType: null, // TODO: Add paperType to PricingRule schema
    paperWeightTotal,
    paperWeightPer1000,

    // Metadata
    isCustomPricing,
    requiresApproval,
    standardCustomerCPM,
    underchargeAmount,
  };
}

/**
 * Calculate Bradford and JD totals from a given customer total (reverse calculation)
 *
 * This function is used when you have the customerTotal already set (from a quote)
 * and need to calculate the Bradford/JD split based on pricing rules.
 *
 * @param prisma - Prisma client instance
 * @param customerTotal - The total price charged to the customer
 * @param quantity - The quantity ordered
 * @param sizeName - The size name to use for pricing rule lookup
 * @param jdSuppliesPaper - Whether JD supplies paper (10/10 split instead of 50/50)
 * @returns Complete pricing breakdown with all CPMs and totals
 */
export async function calculateFromCustomerTotal(
  prisma: PrismaClient,
  customerTotal: number,
  quantity: number,
  sizeName: string,
  jdSuppliesPaper: boolean = false,
  bradfordWaivesPaperMargin: boolean = false
): Promise<DynamicPricingResult> {
  // Calculate customer CPM from the given total
  const quantityInThousands = quantity / 1000;
  const customerCPM = customerTotal / quantityInThousands;

  // Use the existing calculateDynamicPricing with customerCPM override
  const overrides: PricingOverrides = {
    customerCPM: customerCPM,
  };

  return await calculateDynamicPricing(
    prisma,
    sizeName,
    quantity,
    overrides,
    jdSuppliesPaper,
    bradfordWaivesPaperMargin
  );
}

/**
 * Get all active pricing rules for size selection
 *
 * @param prisma - Prisma client instance
 */
export async function getAvailablePricingRules(prisma: PrismaClient) {
  const rules = await prisma.pricingRule.findMany({
    where: { isActive: true },
    orderBy: { sizeName: 'asc' },
  });

  return rules.map((rule: PricingRule) => ({
    sizeName: rule.sizeName,
    baseCPM: Number(rule.baseCPM),
    impactInvoicePerM: Number(rule.impactInvoicePerM || 0),
    rollSize: rule.rollSize,
  }));
}

/**
 * Normalize size name for matching
 * Handles variations like "7.25 x 16.375" vs "7 1/4 x 16 3/8"
 */
export function normalizeSizeName(sizeName: string): string {
  // For now, just trim and return as-is
  // TODO: Add decimal/fraction conversion if needed
  return sizeName.trim();
}

/**
 * Validate pricing calculation
 * Checks for negative margins, zero values, etc.
 */
export function validatePricing(result: DynamicPricingResult): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for negative customer total
  if (result.customerTotal <= 0) {
    errors.push('Customer total must be greater than zero');
  }

  // Check for negative margins
  if (result.impactMargin < 0) {
    warnings.push(`Impact margin is negative: $${result.impactMargin.toFixed(2)}`);
  }

  if (result.bradfordTotalMargin < 0) {
    warnings.push(`Bradford total margin is negative: $${result.bradfordTotalMargin.toFixed(2)}`);
  }

  // Check if undercharged
  if (result.requiresApproval) {
    warnings.push(
      `Price is below standard rate by $${result.underchargeAmount?.toFixed(2)}. Requires approval.`
    );
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}
