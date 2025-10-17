import { test, expect } from '@playwright/test';

test.describe('Purchase Order Chain Workflow', () => {
  test('Create job → auto-PO #1 → webhook → auto-PO #2', async ({ page, request }) => {
    // Step 1: Create a direct job via API
    const createJobResponse = await request.post('http://localhost:3001/api/jobs/direct', {
      data: {
        customerId: 'demo-customer',
        specs: {
          paper: '16pt cardstock',
          size: '3.5x2',
          quantity: 5000,
          colors: '4/4',
          finishing: 'UV coating',
        },
        customerTotal: 100.00,
      },
    });
    expect(createJobResponse.ok()).toBeTruthy();
    const job = await createJobResponse.json();

    // Step 2: Wait for auto-PO creation (async worker)
    await page.waitForTimeout(2000);

    // Step 3: Verify Impact→Bradford PO was auto-created (PO #1)
    const posResponse = await request.get(`http://localhost:3001/api/purchase-orders?jobId=${job.id}`);
    expect(posResponse.ok()).toBeTruthy();
    const posData = await posResponse.json();

    expect(posData.purchaseOrders.length).toBeGreaterThanOrEqual(1);
    const autoPO1 = posData.purchaseOrders.find(
      (po: any) => po.originCompany.name === 'Impact Direct' && po.targetCompany.name === 'Bradford'
    );

    expect(autoPO1).toBeDefined();
    expect(parseFloat(autoPO1.vendorAmount)).toBe(80.00); // 80% of $100
    expect(parseFloat(autoPO1.marginAmount)).toBe(20.00); // 20% of $100

    // Step 4: Simulate Bradford webhook with estimateNumber and componentId
    const webhookPayload = {
      estimateNumber: 'EST-2025-12345',
      componentId: 'COMP-ABC-001',
      jobNumber: job.jobNo,
      status: 'accepted',
      pricing: {
        subtotal: 80.00,
        tax: 0,
        total: 80.00,
      },
      delivery: {
        estimatedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        method: 'ground',
      },
      pdfUrl: 'https://bradford.example.com/pos/EST-2025-12345.pdf',
    };

    const webhookResponse = await request.post('http://localhost:3001/api/webhooks/bradford-po', {
      data: webhookPayload,
    });
    expect(webhookResponse.ok()).toBeTruthy();

    // Step 5: Wait for webhook processing
    await page.waitForTimeout(1000);

    // Step 6: Verify Bradford→JD PO was auto-created (PO #2)
    // Refresh POs list
    const posResponse2 = await request.get(`http://localhost:3001/api/purchase-orders?jobId=${job.id}`);
    expect(posResponse2.ok()).toBeTruthy();
    const posData2 = await posResponse2.json();

    // Should now have 2 POs for this job
    expect(posData2.purchaseOrders.length).toBeGreaterThanOrEqual(2);

    // Find Bradford→JD PO
    const autoPO2 = posData2.purchaseOrders.find(
      (po: any) => po.originCompany.name === 'Bradford' && po.targetCompany.name === 'JD Graphic'
    );

    expect(autoPO2).toBeDefined();

    // Step 7: Verify PO #2 is linked by componentId
    expect(autoPO2.externalRef).toBe('COMP-ABC-001');

    // Step 8: Verify PO #2 amounts (60% of original $100)
    expect(parseFloat(autoPO2.vendorAmount)).toBe(60.00); // 60% to JD Graphic
    expect(parseFloat(autoPO2.marginAmount)).toBe(20.00); // 20% margin kept by Bradford

    // Step 9: Navigate to job detail page
    await page.goto(`/jobs/${job.id}`);
    await expect(page.locator('h1')).toContainText(job.jobNo);

    // Step 10: Click on Purchase Orders tab
    await page.locator('button:has-text("Purchase Orders")').click();

    // Step 11: Verify both POs are displayed in UI
    await expect(page.locator('text=Impact Direct → Bradford')).toBeVisible();
    await expect(page.locator('text=Bradford → JD Graphic')).toBeVisible();

    // Step 12: Verify money flow in UI
    // PO #1: $80.00 to Bradford (margin: $20.00)
    await expect(page.locator('text=$80.00').first()).toBeVisible();
    await expect(page.locator('text=Margin: $20.00').first()).toBeVisible();

    // PO #2: $60.00 to JD Graphic (margin: $20.00)
    await expect(page.locator('text=$60.00')).toBeVisible();

    // Step 13: Verify total money flow:
    // Customer pays Impact: $100.00
    // Impact pays Bradford: $80.00 (keeps $20.00)
    // Bradford pays JD: $60.00 (keeps $20.00)
    // JD receives: $60.00

    const allPOs = posData2.purchaseOrders;
    const totalVendorPaid = allPOs.reduce((sum: number, po: any) => sum + parseFloat(po.vendorAmount), 0);
    const totalMarginKept = allPOs.reduce((sum: number, po: any) => sum + parseFloat(po.marginAmount), 0);

    expect(totalVendorPaid).toBe(140.00); // $80 + $60
    expect(totalMarginKept).toBe(40.00);  // $20 + $20

    // Total paid out ($140) + total margin ($40) should equal customer total ($100)
    // Note: This validation depends on how POs are structured in your business logic
  });

  test('Webhook with missing componentId should still create PO', async ({ page, request }) => {
    // Step 1: Create a job
    const createJobResponse = await request.post('http://localhost:3001/api/jobs/direct', {
      data: {
        customerId: 'demo-customer',
        specs: { paper: '16pt', size: '3.5x2', quantity: 1000, colors: '4/4' },
        customerTotal: 50.00,
      },
    });
    expect(createJobResponse.ok()).toBeTruthy();
    const job = await createJobResponse.json();

    // Step 2: Wait for auto-PO #1
    await page.waitForTimeout(2000);

    // Step 3: Send webhook without componentId
    const webhookPayload = {
      estimateNumber: 'EST-2025-99999',
      jobNumber: job.jobNo,
      status: 'accepted',
      pricing: { subtotal: 40.00, tax: 0, total: 40.00 },
    };

    const webhookResponse = await request.post('http://localhost:3001/api/webhooks/bradford-po', {
      data: webhookPayload,
    });
    expect(webhookResponse.ok()).toBeTruthy();

    // Step 4: Verify PO was still created, using estimateNumber as fallback
    await page.waitForTimeout(1000);

    const posResponse = await request.get(`http://localhost:3001/api/purchase-orders?jobId=${job.id}`);
    expect(posResponse.ok()).toBeTruthy();
    const posData = await posResponse.json();

    const bradfordPO = posData.purchaseOrders.find(
      (po: any) => po.externalRef === 'EST-2025-99999'
    );

    expect(bradfordPO).toBeDefined();
  });
});
