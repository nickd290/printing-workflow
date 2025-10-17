# Printing Workflow - Pricing Structure

## 📐 The 4 Standard Sizes

### Self Mailers - Coated Matte 7pt (98# Stock)

| Size | Customer Price | Impact Profit | Bradford Profit | JD Payment | Paper Cost |
|------|---------------|---------------|-----------------|------------|------------|
| **7 1/4 x 16 3/8** | $67.56 CPM | $7.135 CPM | $7.135 CPM | $34.74 CPM | $18.55 CPM |
| **8 1/2 x 17 1/2** | $81.00 CPM | $9.08 CPM | $9.08 CPM | $38.41 CPM | $24.43 CPM |
| **9 3/4 x 22 1/8** | $106.91 CPM | $7.41 CPM | $7.41 CPM | $49.18 CPM | $42.91 CPM |
| **9 3/4 x 26** | $112.60 CPM | $7.41 CPM | $7.41 CPM | $49.18 CPM | $48.60 CPM |

CPM = Cost Per Thousand pieces

---

## 💰 Money Flow Example (7 1/4 x 16 3/8 size)

**Customer orders 50,000 pieces:**

```
CUSTOMER → IMPACT DIRECT
  Orders: 50,000 pieces @ $67.56/1000
  Total: $3,378.00

IMPACT DIRECT → BRADFORD
  Pays: 50,000 pieces @ $60.425/1000
  Total: $3,021.25
  PROFIT: $356.75 (Impact Direct keeps this)

BRADFORD → JD GRAPHIC + PAPER
  Manufacturing: 50,000 @ $34.74/1000 = $1,737.00 (to JD Graphic)
  Paper Supply: 50,000 @ $18.55/1000 = $927.50 (Bradford supplies)
  Total Cost: $2,664.50
  PROFIT: $356.75 (Bradford keeps this)

JD GRAPHIC
  Receives: $1,737.00 for printing
  Paper: Supplied by Bradford (1,145 lbs @ $18.55/1000 = 22.9 lbs/thousand)
```

---

## 📊 Profit Distribution

**For every $67.56 charged to customer:**
- **Impact Direct**: $7.135 (10.6% margin)
- **Bradford**: $7.135 (11.8% of their $60.425)
- **JD Graphic**: $34.74 (printing labor)
- **Bradford's Paper**: $18.55 (material cost)

**Total Revenue**: $67.56
**Total Costs**: $53.29 (JD + Paper)
**Total Profit**: $14.27 (Impact + Bradford)

---

## 🧾 Paper Specifications

| Size | Paper Weight (lbs/1000) | Paper $/lb | Paper CPM | Paper Type |
|------|------------------------|------------|-----------|------------|
| 7 1/4 x 16 3/8 | 22.9 lbs | $0.675 | $18.55 | Coated Matte 7pt (98# Stock) |
| 8 1/2 x 17 1/2 | 30.16 lbs | $0.675 | $24.43 | Coated Matte 7pt (98# Stock) |
| 9 3/4 x 22 1/8 | 52.98 lbs | $0.675 | $42.91 | Coated Matte 7pt (98# Stock) |
| 9 3/4 x 26 | 54.28 lbs | $0.675 | $48.60 | Coated Matte 7pt (98# Stock) |

**Note**: Bradford supplies paper to JD Graphic. We track the weight and cost Bradford charges, but not Bradford's internal paper supplier.

---

## 🔄 Purchase Order Flow

### PO #1: Impact Direct → Bradford
**Amount**: Customer price × 0.8944 (to give Bradford $60.425 per thousand)
- Includes: Paper supply + Manufacturing cost + Bradford's margin
- Example: 50,000 @ $67.56 = $3,378 → Bradford gets $3,021.25

### PO #2: Bradford → JD Graphic
**Amount**: Printing only (no paper in this PO value)
- JD gets: $34.74 per thousand for printing labor
- Example: 50,000 @ $34.74 = $1,737.00
- **Paper**: Bradford supplies 1,145 lbs separately (not in PO dollar amount)

---

## 🎨 Size Selection UI

When creating a job, customer selects:
1. **Size** (dropdown with 4 options)
2. **Quantity** (in thousands or pieces)
3. **Paper type** (auto-selected based on size)

System automatically calculates:
- Customer total
- Impact Direct's payment to Bradford
- Bradford's payment to JD
- Paper weight needed
- All profit margins

---

## 📋 Job Specs Structure

```typescript
{
  size: "7 1/4 x 16 3/8",
  quantity: 50000,
  paperType: "Coated Matte 7pt (98# Stock)",
  paperWeight: 22.9, // lbs per thousand
  paperCostCPM: 18.55,
  printCostCPM: 34.74,
  customerCPM: 67.56,
  impactMarginCPM: 7.135,
  bradfordMarginCPM: 7.135
}
```

---

## 🚀 Implementation Notes

1. **CPM Everywhere**: All costs stored and displayed as "per thousand pieces"
2. **Paper Tracking**: Weight and cost, but not Bradford's supplier details
3. **Auto-Calculate**: Select size → all pricing auto-fills
4. **Margin Protection**: Impact and Bradford margins are consistent
5. **Quantity Flexibility**: Accept quantity in pieces, calculate CPM totals

---

**Last Updated**: 2025-10-16
**Source**: Third Party Production Costs.xlsx (Pricing tab)
