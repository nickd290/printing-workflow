import { test, expect } from '@playwright/test';

test.describe('Quote to Job Workflow', () => {
  test('Customer creates quote request, approves, and creates job with auto-PO', async ({ page, request }) => {
    // Step 1: Navigate to quotes page
    await page.goto('/quotes');
    await expect(page.locator('h1')).toContainText('Quotes');

    // Step 2: Customer pastes specs
    const specsText = `Need 5000 business cards
Size: 3.5 x 2 inches
Full color 4/4
16pt cardstock
UV coating
Rush delivery needed`;

    await page.locator('textarea[placeholder*="Paste email"]').fill(specsText);

    // Step 3: AI parses specs
    await page.locator('button:has-text("Parse with AI")').click();

    // Wait for parsing to complete
    await expect(page.locator('input[value*="5000"]')).toBeVisible({ timeout: 10000 });

    // Verify parsed specs
    await expect(page.locator('input[value*="3.5 x 2"]')).toBeVisible();
    await expect(page.locator('input[value*="16pt"]')).toBeVisible();
    await expect(page.locator('input[value*="4/4"]')).toBeVisible();

    // Step 4: Create quote request
    await page.locator('button:has-text("Create Quote Request")').click();

    // Fill in quote modal
    await page.locator('select').first().selectOption('Demo Customer Inc');
    await page.locator('input[placeholder="0.00"]').fill('150.00');

    // Submit quote
    await page.locator('button:has-text("Create Quote")').click();

    // Verify success notification
    await expect(page.locator('text=Quote request created successfully')).toBeVisible({ timeout: 5000 });

    // Step 5: Verify quote appears in table
    await expect(page.locator('table').locator('td:has-text("PENDING")')).toBeVisible();

    // Step 6: Get quote ID from API
    const quotesResponse = await request.get('http://localhost:3001/api/quotes');
    expect(quotesResponse.ok()).toBeTruthy();
    const quotesData = await quotesResponse.json();
    const latestQuote = quotesData.quotes[0];
    expect(latestQuote).toBeDefined();

    const quoteRequestId = latestQuote.id;

    // Step 7: Broker creates quote from quote request (via API)
    const createQuoteResponse = await request.post('http://localhost:3001/api/quotes', {
      data: {
        quoteRequestId: quoteRequestId,
        lines: [
          {
            description: '5000 Business Cards - 16pt cardstock, 4/4 color, UV coating',
            quantity: 5000,
            unitPrice: 0.03,
            total: 150.00,
          },
        ],
        subtotal: 150.00,
        tax: 0,
        total: 150.00,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Rush delivery as requested',
      },
    });
    expect(createQuoteResponse.ok()).toBeTruthy();
    const quote = await createQuoteResponse.json();

    // Step 8: Approve quote
    const approveResponse = await request.post(`http://localhost:3001/api/quotes/${quote.id}/approve`);
    expect(approveResponse.ok()).toBeTruthy();

    // Step 9: Create job from quote
    const createJobResponse = await request.post(`http://localhost:3001/api/jobs/from-quote/${quote.id}`);
    expect(createJobResponse.ok()).toBeTruthy();
    const job = await createJobResponse.json();

    // Step 10: Verify job number format J-YYYY-NNNNNN
    expect(job.jobNo).toMatch(/^J-\d{4}-\d{6}$/);

    // Step 11: Verify job total matches quote
    expect(parseFloat(job.customerTotal)).toBe(150.00);

    // Step 12: Wait for auto-PO creation (async worker)
    await page.waitForTimeout(2000);

    // Step 13: Verify Impact→Bradford PO was auto-created
    const posResponse = await request.get(`http://localhost:3001/api/purchase-orders?jobId=${job.id}`);
    expect(posResponse.ok()).toBeTruthy();
    const posData = await posResponse.json();

    expect(posData.purchaseOrders).toHaveLength(1);
    const autoPO = posData.purchaseOrders[0];

    // Step 14: Verify 80/20 split
    expect(parseFloat(autoPO.vendorAmount)).toBe(120.00); // 80% of $150
    expect(parseFloat(autoPO.marginAmount)).toBe(30.00);  // 20% of $150

    // Verify origin and target companies
    expect(autoPO.originCompany.name).toBe('Impact Direct');
    expect(autoPO.targetCompany.name).toBe('Bradford');

    // Step 15: Navigate to job detail page and verify
    await page.goto(`/jobs/${job.id}`);
    await expect(page.locator('h1')).toContainText(job.jobNo);

    // Click on Purchase Orders tab
    await page.locator('button:has-text("Purchase Orders")').click();

    // Verify PO is displayed
    await expect(page.locator('text=Impact Direct → Bradford')).toBeVisible();
    await expect(page.locator('text=$120.00')).toBeVisible();
    await expect(page.locator('text=Margin: $30.00')).toBeVisible();
  });
});
