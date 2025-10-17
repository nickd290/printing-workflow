import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Proof Approval Workflow', () => {
  test('Upload proof v1, request changes, upload v2, approve', async ({ page, request }) => {
    // Step 1: Create a test job via API
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
        customerTotal: 150.00,
      },
    });
    expect(createJobResponse.ok()).toBeTruthy();
    const job = await createJobResponse.json();

    // Step 2: Upload a test file (proof v1)
    const testFilePath = path.join(__dirname, '../public/test-proof.pdf');

    // Create a mock PDF file for testing
    const mockPDF = Buffer.from('%PDF-1.4\nTest Proof PDF Content');

    const uploadResponse = await request.post('http://localhost:3001/api/files/upload', {
      multipart: {
        file: {
          name: 'business-cards-v1.pdf',
          mimeType: 'application/pdf',
          buffer: mockPDF,
        },
        kind: 'PROOF',
        jobId: job.id,
      },
    });
    expect(uploadResponse.ok()).toBeTruthy();
    const uploadedFile = await uploadResponse.json();

    // Step 3: Create proof v1 from uploaded file
    const createProofResponse = await request.post(`http://localhost:3001/api/proofs/${job.id}/upload`, {
      data: {
        fileId: uploadedFile.id,
      },
    });
    expect(createProofResponse.ok()).toBeTruthy();
    const proofV1 = await createProofResponse.json();

    // Verify proof version is 1
    expect(proofV1.version).toBe(1);
    expect(proofV1.status).toBe('PENDING');

    // Step 4: Navigate to job detail page
    await page.goto(`/jobs/${job.id}`);
    await expect(page.locator('h1')).toContainText(job.jobNo);

    // Step 5: Click on Proofs tab
    await page.locator('button:has-text("Proofs")').click();

    // Verify proof v1 is displayed
    await expect(page.locator('text=Version 1')).toBeVisible();
    await expect(page.locator('text=PENDING')).toBeVisible();

    // Step 6: Customer requests changes with comment
    await page.locator('button:has-text("Request Changes")').first().click();

    // Fill in comments
    const changeComment = 'Please adjust logo size - make it 20% larger';
    await page.locator('textarea[placeholder*="describe the changes"]').fill(changeComment);

    // Submit changes request
    await page.locator('button:has-text("Submit Changes")').click();

    // Wait for modal to close
    await expect(page.locator('textarea[placeholder*="describe the changes"]')).not.toBeVisible();

    // Step 7: Verify proof status updated to CHANGES_REQUESTED
    await page.reload();
    await page.locator('button:has-text("Proofs")').click();
    await expect(page.locator('text=CHANGES REQUESTED')).toBeVisible();

    // Verify comment is displayed
    await expect(page.locator(`text=${changeComment}`)).toBeVisible();

    // Step 8: Broker uploads proof v2 (via API)
    const mockPDF2 = Buffer.from('%PDF-1.4\nTest Proof v2 PDF Content - Logo adjusted');

    const uploadResponse2 = await request.post('http://localhost:3001/api/files/upload', {
      multipart: {
        file: {
          name: 'business-cards-v2.pdf',
          mimeType: 'application/pdf',
          buffer: mockPDF2,
        },
        kind: 'PROOF',
        jobId: job.id,
      },
    });
    expect(uploadResponse2.ok()).toBeTruthy();
    const uploadedFile2 = await uploadResponse2.json();

    const createProofV2Response = await request.post(`http://localhost:3001/api/proofs/${job.id}/upload`, {
      data: {
        fileId: uploadedFile2.id,
      },
    });
    expect(createProofV2Response.ok()).toBeTruthy();
    const proofV2 = await createProofV2Response.json();

    // Verify proof version is 2
    expect(proofV2.version).toBe(2);
    expect(proofV2.status).toBe('PENDING');

    // Step 9: Reload page and verify v2 is visible
    await page.reload();
    await page.locator('button:has-text("Proofs")').click();
    await expect(page.locator('text=Version 2')).toBeVisible();

    // Step 10: Customer approves proof v2
    // Find the approve button for v2 (should be the first PENDING proof)
    await page.locator('button:has-text("Approve")').first().click();

    // Confirm approval in modal
    await expect(page.locator('text=Are you sure you want to approve Version 2')).toBeVisible();
    await page.locator('button:has-text("Approve Proof")').click();

    // Wait for modal to close
    await page.waitForTimeout(1000);

    // Step 11: Verify proof status updated to APPROVED
    await page.reload();
    await page.locator('button:has-text("Proofs")').click();
    await expect(page.locator('text=Version 2').locator('..').locator('text=APPROVED')).toBeVisible();

    // Verify approve button is no longer visible for v2
    await expect(page.locator('text=Version 2').locator('..').locator('button:has-text("Approve")')).not.toBeVisible();

    // Step 12: Verify job status was updated via API
    const jobResponse = await request.get(`http://localhost:3001/api/jobs/${job.id}`);
    expect(jobResponse.ok()).toBeTruthy();
    const updatedJob = await jobResponse.json();

    // Job status should have progressed after proof approval
    expect(updatedJob.status).toBe('PROOF_APPROVED');
  });
});
