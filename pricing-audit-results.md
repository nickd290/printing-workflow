# Pricing System Audit Results
**Date:** 2025-11-14
**Total Jobs:** 20
**Total Pricing Rules:** 19

## Critical Issues Found

### 1. Pricing Rule Data Issues

#### Missing `impactInvoicePerM` (Customer Rate)
Most pricing rules are missing the `impactInvoicePerM` field which should contain the actual customer rate. Only 8 out of 19 rules have this populated.

**Rules with impactInvoicePerM:**
- 6 x 9: 32.64
- 6 x11: 38.16
- 7 1/4 x 16 3/8: 37.1
- 8 1/2 x 17 1/2: 48.86
- 9 3/4 x 22 1/8: 85.82
- 9 3/4 x 26: 97.2

**Rules missing impactInvoicePerM:** 13 rules

### 2. Invalid Data: baseCPM = 0
- **Rule:** "7 1/4 x 16 3/8"
- **Issue:** baseCPM is 0, should be positive
- **Impact:** Would cause division by zero or invalid calculations

### 3. Backwards Pricing Chain
- **Rule:** "6 x 9"
- **Data:** jdInvoicePerM=10, bradfordInvoicePerM=34.7, impactInvoicePerM=32.64
- **Issue:** impactInvoicePerM (32.64) < bradfordInvoicePerM (34.7)
- **Problem:** Customer is charged LESS than what Bradford pays, resulting in negative margin

### 4. Duplicate/Inconsistent Fields
Multiple rules have both `printCPM` and `jdInvoicePerM` populated:
- These should represent the same value (what JD charges)
- Having both creates confusion about which to use

## Job Analysis

### Margin Flags Usage
- **Normal (50/50):** 19 jobs (95%)
- **JD Supplies Paper (10/10):** 0 jobs (0%)
- **Bradford Waives Paper:** 1 job (5%)

### Jobs with Bradford Waives Paper Flag
- **J-2025-216133:** 9 3/4 x 26, 248081 qty
  - customerCPM: 95.77
  - impactMarginCPM: 1.52 (very low, expected behavior)
  - bradfordTotalMarginCPM: 8.16

## Pricing Rule Field Population

| Field | Populated | Missing | Percentage |
|-------|-----------|---------|------------|
| printCPM | 19 | 0 | 100% |
| paperCPM | 15 | 4 | 79% |
| paperChargedCPM | 11 | 8 | 58% |
| jdInvoicePerM | 6 | 13 | 32% |
| bradfordInvoicePerM | 6 | 13 | 32% |
| impactInvoicePerM | 8 | 11 | 42% |

## Recommendations Priority

### CRITICAL (Fix Now)
1. Fix `baseCPM = 0` for "7 1/4 x 16 3/8" rule
2. Fix backwards pricing for "6 x 9" rule (impactInvoicePerM should be > bradfordInvoicePerM)
3. Populate missing `impactInvoicePerM` values for all rules
4. Fix code to use `impactInvoicePerM` instead of `bradfordInvoicePerM` for customer rate

### HIGH
5. Standardize field naming (choose `printCPM` OR `jdInvoicePerM`, not both)
6. Populate missing `jdInvoicePerM` and `bradfordInvoicePerM` values
7. Add validation to prevent: negative prices, backwards pricing chains

### MEDIUM
8. Recalculate existing jobs if pricing was incorrect
9. Add data integrity constraints to schema
10. Create UI to manage all pricing fields properly

## Next Steps
1. Create data migration script to populate missing fields
2. Fix critical bugs in pricing-calculator.ts
3. Update UI components to show correct values
4. Add comprehensive tests
