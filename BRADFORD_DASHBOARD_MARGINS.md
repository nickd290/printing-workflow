# Bradford Dashboard - Margin Breakdown

## 📊 Bradford's Profit Margins (Separated by Print & Paper)

For Bradford's dashboard view, their margins are split into two categories:

### Example: 50,000 pieces of 7 1/4 x 16 3/8

| Margin Type | Per 1000 (CPM) | Total for 50k |
|-------------|----------------|---------------|
| **Print Margin** | $7.135 | **$356.75** |
| **Paper Margin** | $3.0925 | **$154.63** |
| **Total Bradford Margin** | $10.2275 | **$511.38** |

---

## 💰 All 4 Sizes - Bradford Margin Breakdown

| Size | Print Margin CPM | Paper Margin CPM | Total Bradford Margin CPM |
|------|------------------|------------------|---------------------------|
| **7 1/4 x 16 3/8** | $7.135 | $3.0925 | $10.2275 |
| **8 1/2 x 17 1/2** | $9.08 | $4.072 | $13.152 |
| **9 3/4 x 22 1/8** | $7.41 | $7.1485 | $14.5585 |
| **9 3/4 x 26** | $7.41 | $11.961 | $19.371 |

---

## 🔍 How Bradford's Margins Work

### Print Margin
- Total print profit is split 50/50 between Impact Direct and Bradford
- Example: For 7 1/4 x 16 3/8, total print profit is $14.27 CPM
- Bradford gets: $7.135 CPM
- Impact Direct gets: $7.135 CPM

### Paper Margin
- Bradford supplies paper to JD Graphic
- Bradford charges more than paper costs them
- Example: For 7 1/4 x 16 3/8:
  - Paper actual cost: $15.4575 CPM (22.9 lbs × $0.675/lb)
  - Bradford charges: $18.55 CPM
  - Bradford's paper margin: $3.0925 CPM

---

## 📈 Bradford Dashboard View (50,000 pieces example)

### Size: 7 1/4 x 16 3/8

```
REVENUE
  From Impact Direct: $3,021.25

COSTS
  JD Graphic (printing): $1,737.00
  Paper (actual cost): $772.88
  Total Costs: $2,509.88

PROFIT BREAKDOWN
  Print Margin: $356.75
  Paper Margin: $154.63
  Total Profit: $511.38

  Profit Margin: 16.9%
```

---

## 🎯 What Each Entity Sees

### Impact Direct Dashboard:
- Customer payment: $3,378.00
- Payment to Bradford: $3,021.25
- **Profit: $356.75** (print margin only)

### Bradford Dashboard:
- Revenue from Impact: $3,021.25
- Payment to JD: $1,737.00
- Paper cost: $772.88
- **Print Profit: $356.75**
- **Paper Profit: $154.63**
- **Total Profit: $511.38**

### JD Graphic Dashboard:
- Revenue from Bradford: $1,737.00
- Paper: 1,145 lbs (supplied by Bradford)
- **Payment: $1,737.00** (printing only)

---

## 🧮 Formula for Bradford's Margins

```typescript
// For any job:
bradfordPrintMarginCPM = (totalPrintProfit / 2)
bradfordPaperMarginCPM = (paperCharged - paperActualCost)
bradfordTotalMarginCPM = bradfordPrintMarginCPM + bradfordPaperMarginCPM

// For 50,000 pieces:
bradfordPrintMargin = bradfordPrintMarginCPM × 50
bradfordPaperMargin = bradfordPaperMarginCPM × 50
bradfordTotalMargin = bradfordTotalMarginCPM × 50
```

---

## ✅ Implementation in Code

```typescript
interface BradfordMargins {
  printMarginCPM: number;
  paperMarginCPM: number;
  totalMarginCPM: number;
  printMarginTotal: number;
  paperMarginTotal: number;
  totalMarginTotal: number;
}

function calculateBradfordMargins(sizeId: string, quantity: number): BradfordMargins {
  const size = PRODUCT_SIZES[sizeId];
  const quantityInThousands = quantity / 1000;

  return {
    printMarginCPM: size.bradfordPrintMarginCPM,
    paperMarginCPM: size.bradfordPaperMarginCPM,
    totalMarginCPM: size.bradfordTotalMarginCPM,
    printMarginTotal: size.bradfordPrintMarginCPM * quantityInThousands,
    paperMarginTotal: size.bradfordPaperMarginCPM * quantityInThousands,
    totalMarginTotal: size.bradfordTotalMarginCPM * quantityInThousands,
  };
}
```

---

## 📊 Database Fields Needed

For Bradford's view, store these fields in the Job table:

```typescript
{
  // Bradford-specific margin tracking
  bradfordPrintMarginCPM: 7.135,
  bradfordPaperMarginCPM: 3.0925,
  bradfordTotalMarginCPM: 10.2275,

  // Totals for this job
  bradfordPrintMarginTotal: 356.75,
  bradfordPaperMarginTotal: 154.63,
  bradfordTotalMarginTotal: 511.38,

  // Paper details
  paperWeightTotal: 1145, // lbs
  paperCostTotal: 772.88,
  paperChargedTotal: 927.50
}
```

---

**Last Updated**: 2025-10-16
**Status**: Complete - Ready for Bradford dashboard implementation
