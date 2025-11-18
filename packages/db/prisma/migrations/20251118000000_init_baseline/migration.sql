-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'BROKER_ADMIN', 'BRADFORD_ADMIN');

-- CreateEnum
CREATE TYPE "QuoteRequestStatus" AS ENUM ('PENDING', 'QUOTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RoutingType" AS ENUM ('BRADFORD_JD', 'THIRD_PARTY_VENDOR');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'IN_PRODUCTION', 'READY_FOR_PROOF', 'PROOF_APPROVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('ARTWORK', 'DATA_FILE', 'PROOF', 'INVOICE', 'PO_PDF');

-- CreateEnum
CREATE TYPE "ProofStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('PO_UPDATE', 'INVOICE_UPDATE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('QUOTE_READY', 'PROOF_READY', 'PROOF_APPROVED', 'SHIPMENT_SCHEDULED', 'INVOICE_SENT', 'PO_CREATED', 'JOB_READY_FOR_PRODUCTION', 'JOB_SUBMITTED_CONFIRMATION');

-- CreateEnum
CREATE TYPE "WebhookSource" AS ENUM ('ZAPIER', 'BRADFORD', 'EMAIL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "password" TEXT,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "QuoteRequestStatus" NOT NULL DEFAULT 'PENDING',
    "specs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "jobNo" TEXT NOT NULL,
    "quoteId" TEXT,
    "customerId" TEXT NOT NULL,
    "routingType" "RoutingType" NOT NULL DEFAULT 'BRADFORD_JD',
    "vendorId" TEXT,
    "vendorAmount" DECIMAL(65,30),
    "bradfordCut" DECIMAL(65,30),
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "description" TEXT,
    "specs" JSONB NOT NULL,
    "sizeId" TEXT,
    "sizeName" TEXT,
    "quantity" INTEGER,
    "customerCPM" DECIMAL(65,30),
    "impactMarginCPM" DECIMAL(65,30),
    "bradfordTotalCPM" DECIMAL(65,30),
    "bradfordPrintMarginCPM" DECIMAL(65,30),
    "bradfordPaperMarginCPM" DECIMAL(65,30),
    "bradfordTotalMarginCPM" DECIMAL(65,30),
    "printCPM" DECIMAL(65,30),
    "paperCostCPM" DECIMAL(65,30),
    "paperChargedCPM" DECIMAL(65,30),
    "customerTotal" DECIMAL(65,30) NOT NULL,
    "impactCustomerTotal" DECIMAL(65,30),
    "impactMargin" DECIMAL(65,30),
    "bradfordTotal" DECIMAL(65,30),
    "bradfordPrintMargin" DECIMAL(65,30),
    "bradfordPaperMargin" DECIMAL(65,30),
    "bradfordTotalMargin" DECIMAL(65,30),
    "jdTotal" DECIMAL(65,30),
    "paperCostTotal" DECIMAL(65,30),
    "paperChargedTotal" DECIMAL(65,30),
    "paperType" TEXT,
    "paperWeightTotal" DECIMAL(65,30),
    "paperWeightPer1000" DECIMAL(65,30),
    "jdSuppliesPaper" BOOLEAN NOT NULL DEFAULT false,
    "bradfordWaivesPaperMargin" BOOLEAN NOT NULL DEFAULT false,
    "deliveryDate" TIMESTAMP(3),
    "mailDate" TIMESTAMP(3),
    "inHomesDate" TIMESTAMP(3),
    "packingSlipNotes" TEXT,
    "customerPONumber" TEXT,
    "customerPOFile" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "requiredArtworkCount" INTEGER,
    "requiredDataFileCount" INTEGER,
    "artworkSectionComplete" BOOLEAN NOT NULL DEFAULT false,
    "dataFilesSectionComplete" BOOLEAN NOT NULL DEFAULT false,
    "isReadyForProduction" BOOLEAN NOT NULL DEFAULT false,
    "submittedForProductionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobActivity" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedByRole" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "kind" "FileKind" NOT NULL,
    "jobId" TEXT,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proof" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ProofStatus" NOT NULL DEFAULT 'PENDING',
    "fileId" TEXT NOT NULL,
    "adminNotes" TEXT,
    "adminComments" TEXT,
    "shareToken" TEXT,
    "shareExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofApproval" (
    "id" TEXT NOT NULL,
    "proofId" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "comments" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "originCompanyId" TEXT NOT NULL,
    "targetCompanyId" TEXT,
    "targetVendorId" TEXT,
    "jobId" TEXT,
    "originalAmount" DECIMAL(65,30) NOT NULL,
    "vendorAmount" DECIMAL(65,30) NOT NULL,
    "vendorCPM" DECIMAL(65,30),
    "marginAmount" DECIMAL(65,30) NOT NULL,
    "bradfordCutPaid" BOOLEAN DEFAULT false,
    "bradfordCutPaidDate" TIMESTAMP(3),
    "bradfordPaymentNotes" TEXT,
    "poNumber" TEXT,
    "referencePONumber" TEXT,
    "externalRef" TEXT,
    "pdfFileId" TEXT,
    "status" "POStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "toCompanyId" TEXT NOT NULL,
    "fromCompanyId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "pdfFileId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "trigger" "SyncTrigger" NOT NULL,
    "purchaseOrderId" TEXT,
    "invoiceId" TEXT,
    "jobId" TEXT,
    "field" TEXT NOT NULL,
    "oldValue" DECIMAL(65,30),
    "newValue" DECIMAL(65,30) NOT NULL,
    "changedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "trackingNo" TEXT,
    "weight" DECIMAL(65,30),
    "boxes" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentRecipient" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleShipment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "trackingNo" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientAddress" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "jobId" TEXT,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "source" "WebhookSource" NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperInventory" (
    "id" TEXT NOT NULL,
    "rollType" TEXT NOT NULL,
    "rollWidth" INTEGER NOT NULL,
    "paperPoint" INTEGER NOT NULL,
    "paperType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "weightPerRoll" DECIMAL(65,30),
    "reorderPoint" INTEGER,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperTransaction" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "jobId" TEXT,
    "notes" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "sizeName" TEXT NOT NULL,
    "baseCPM" DECIMAL(65,30) NOT NULL,
    "printCPM" DECIMAL(65,30) NOT NULL,
    "jdInvoicePerM" DECIMAL(65,30),
    "paperWeightPer1000" DECIMAL(65,30),
    "paperCostPerLb" DECIMAL(65,30),
    "paperCPM" DECIMAL(65,30),
    "paperChargedCPM" DECIMAL(65,30),
    "paperMarkupPercent" DECIMAL(65,30),
    "rollSize" INTEGER,
    "bradfordInvoicePerM" DECIMAL(65,30),
    "impactInvoicePerM" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "Vendor_name_idx" ON "Vendor"("name");

-- CreateIndex
CREATE INDEX "Vendor_isActive_idx" ON "Vendor"("isActive");

-- CreateIndex
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");

-- CreateIndex
CREATE INDEX "QuoteRequest_customerId_idx" ON "QuoteRequest"("customerId");

-- CreateIndex
CREATE INDEX "QuoteRequest_status_idx" ON "QuoteRequest"("status");

-- CreateIndex
CREATE INDEX "Quote_quoteRequestId_idx" ON "Quote"("quoteRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobNo_key" ON "Job"("jobNo");

-- CreateIndex
CREATE INDEX "Job_customerId_idx" ON "Job"("customerId");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_jobNo_idx" ON "Job"("jobNo");

-- CreateIndex
CREATE INDEX "Job_vendorId_idx" ON "Job"("vendorId");

-- CreateIndex
CREATE INDEX "Job_routingType_idx" ON "Job"("routingType");

-- CreateIndex
CREATE INDEX "Job_deletedAt_idx" ON "Job"("deletedAt");

-- CreateIndex
CREATE INDEX "JobActivity_jobId_idx" ON "JobActivity"("jobId");

-- CreateIndex
CREATE INDEX "JobActivity_createdAt_idx" ON "JobActivity"("createdAt");

-- CreateIndex
CREATE INDEX "File_jobId_idx" ON "File"("jobId");

-- CreateIndex
CREATE INDEX "File_kind_idx" ON "File"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Proof_shareToken_key" ON "Proof"("shareToken");

-- CreateIndex
CREATE INDEX "Proof_jobId_idx" ON "Proof"("jobId");

-- CreateIndex
CREATE INDEX "Proof_shareToken_idx" ON "Proof"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "Proof_jobId_version_key" ON "Proof"("jobId", "version");

-- CreateIndex
CREATE INDEX "ProofApproval_proofId_idx" ON "ProofApproval"("proofId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_originCompanyId_idx" ON "PurchaseOrder"("originCompanyId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_targetCompanyId_idx" ON "PurchaseOrder"("targetCompanyId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_targetVendorId_idx" ON "PurchaseOrder"("targetVendorId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_jobId_idx" ON "PurchaseOrder"("jobId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_externalRef_idx" ON "PurchaseOrder"("externalRef");

-- CreateIndex
CREATE INDEX "PurchaseOrder_poNumber_idx" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_referencePONumber_idx" ON "PurchaseOrder"("referencePONumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");

-- CreateIndex
CREATE INDEX "Invoice_jobId_idx" ON "Invoice"("jobId");

-- CreateIndex
CREATE INDEX "Invoice_toCompanyId_idx" ON "Invoice"("toCompanyId");

-- CreateIndex
CREATE INDEX "Invoice_fromCompanyId_idx" ON "Invoice"("fromCompanyId");

-- CreateIndex
CREATE INDEX "SyncLog_purchaseOrderId_idx" ON "SyncLog"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "SyncLog_invoiceId_idx" ON "SyncLog"("invoiceId");

-- CreateIndex
CREATE INDEX "SyncLog_jobId_idx" ON "SyncLog"("jobId");

-- CreateIndex
CREATE INDEX "SyncLog_createdAt_idx" ON "SyncLog"("createdAt");

-- CreateIndex
CREATE INDEX "Shipment_jobId_idx" ON "Shipment"("jobId");

-- CreateIndex
CREATE INDEX "Shipment_trackingNo_idx" ON "Shipment"("trackingNo");

-- CreateIndex
CREATE INDEX "ShipmentRecipient_shipmentId_idx" ON "ShipmentRecipient"("shipmentId");

-- CreateIndex
CREATE INDEX "SampleShipment_jobId_idx" ON "SampleShipment"("jobId");

-- CreateIndex
CREATE INDEX "SampleShipment_trackingNo_idx" ON "SampleShipment"("trackingNo");

-- CreateIndex
CREATE INDEX "Notification_jobId_idx" ON "Notification"("jobId");

-- CreateIndex
CREATE INDEX "Notification_recipient_idx" ON "Notification"("recipient");

-- CreateIndex
CREATE INDEX "WebhookEvent_source_idx" ON "WebhookEvent"("source");

-- CreateIndex
CREATE INDEX "WebhookEvent_processed_idx" ON "WebhookEvent"("processed");

-- CreateIndex
CREATE INDEX "PaperInventory_companyId_idx" ON "PaperInventory"("companyId");

-- CreateIndex
CREATE INDEX "PaperInventory_rollType_idx" ON "PaperInventory"("rollType");

-- CreateIndex
CREATE INDEX "PaperTransaction_inventoryId_idx" ON "PaperTransaction"("inventoryId");

-- CreateIndex
CREATE INDEX "PaperTransaction_jobId_idx" ON "PaperTransaction"("jobId");

-- CreateIndex
CREATE INDEX "PaperTransaction_createdAt_idx" ON "PaperTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PricingRule_sizeName_key" ON "PricingRule"("sizeName");

-- CreateIndex
CREATE INDEX "PricingRule_sizeName_idx" ON "PricingRule"("sizeName");

-- CreateIndex
CREATE INDEX "PricingRule_isActive_idx" ON "PricingRule"("isActive");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobActivity" ADD CONSTRAINT "JobActivity_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proof" ADD CONSTRAINT "Proof_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proof" ADD CONSTRAINT "Proof_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofApproval" ADD CONSTRAINT "ProofApproval_proofId_fkey" FOREIGN KEY ("proofId") REFERENCES "Proof"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_originCompanyId_fkey" FOREIGN KEY ("originCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_targetCompanyId_fkey" FOREIGN KEY ("targetCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_targetVendorId_fkey" FOREIGN KEY ("targetVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_pdfFileId_fkey" FOREIGN KEY ("pdfFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_toCompanyId_fkey" FOREIGN KEY ("toCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_fromCompanyId_fkey" FOREIGN KEY ("fromCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_pdfFileId_fkey" FOREIGN KEY ("pdfFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentRecipient" ADD CONSTRAINT "ShipmentRecipient_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentRecipient" ADD CONSTRAINT "ShipmentRecipient_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleShipment" ADD CONSTRAINT "SampleShipment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperTransaction" ADD CONSTRAINT "PaperTransaction_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "PaperInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

