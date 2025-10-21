import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@printing-workflow/db';
import { generateInvoicePdf } from '../services/invoice.service.js';
import { generatePurchaseOrderPdf } from '../services/purchase-order.service.js';

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/pdfs/missing - Get lists of invoices and POs without PDFs
  fastify.get('/pdfs/missing', async (request, reply) => {
    try {
      // Find invoices without PDFs
      const invoicesWithoutPdfs = await prisma.invoice.findMany({
        where: {
          pdfFileId: null,
        },
        include: {
          job: true,
          toCompany: true,
          fromCompany: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Find purchase orders without PDFs
      const purchaseOrdersWithoutPdfs = await prisma.purchaseOrder.findMany({
        where: {
          pdfFileId: null,
        },
        include: {
          job: true,
          originCompany: true,
          targetCompany: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        invoices: invoicesWithoutPdfs.map((invoice) => ({
          id: invoice.id,
          invoiceNo: invoice.invoiceNo,
          amount: invoice.amount,
          status: invoice.status,
          jobNo: invoice.job?.jobNo,
          toCompany: invoice.toCompany.name,
          fromCompany: invoice.fromCompany.name,
          createdAt: invoice.createdAt,
        })),
        purchaseOrders: purchaseOrdersWithoutPdfs.map((po) => ({
          id: po.id,
          poNumber: po.poNumber || `PO-${po.id.slice(0, 8)}`,
          vendorAmount: po.vendorAmount,
          status: po.status,
          jobNo: po.job?.jobNo,
          originCompany: po.originCompany.name,
          targetCompany: po.targetCompany.name,
          createdAt: po.createdAt,
        })),
        summary: {
          totalInvoicesWithoutPdfs: invoicesWithoutPdfs.length,
          totalPurchaseOrdersWithoutPdfs: purchaseOrdersWithoutPdfs.length,
        },
      };
    } catch (error: any) {
      console.error('Error fetching missing PDFs:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to fetch missing PDFs',
      });
    }
  });

  // POST /api/admin/pdfs/generate-missing - Bulk generate all missing PDFs
  fastify.post('/pdfs/generate-missing', async (request, reply) => {
    const { type } = request.body as {
      type?: 'invoices' | 'purchase-orders' | 'all';
    };

    const generateType = type || 'all';

    try {
      const results = {
        invoices: { success: 0, failed: 0, errors: [] as string[] },
        purchaseOrders: { success: 0, failed: 0, errors: [] as string[] },
      };

      // Generate invoice PDFs
      if (generateType === 'invoices' || generateType === 'all') {
        const invoicesWithoutPdfs = await prisma.invoice.findMany({
          where: {
            pdfFileId: null,
          },
          select: {
            id: true,
            invoiceNo: true,
          },
        });

        console.log(`[Admin] Generating PDFs for ${invoicesWithoutPdfs.length} invoices...`);

        for (const invoice of invoicesWithoutPdfs) {
          try {
            await generateInvoicePdf(invoice.id);
            results.invoices.success++;
            console.log(`[Admin] ✓ Generated PDF for invoice ${invoice.invoiceNo}`);
          } catch (error: any) {
            results.invoices.failed++;
            const errorMsg = `Invoice ${invoice.invoiceNo}: ${error.message}`;
            results.invoices.errors.push(errorMsg);
            console.error(`[Admin] ✗ Failed to generate PDF for invoice ${invoice.invoiceNo}:`, error);
          }
        }
      }

      // Generate purchase order PDFs
      if (generateType === 'purchase-orders' || generateType === 'all') {
        const posWithoutPdfs = await prisma.purchaseOrder.findMany({
          where: {
            pdfFileId: null,
          },
          select: {
            id: true,
            poNumber: true,
          },
        });

        console.log(`[Admin] Generating PDFs for ${posWithoutPdfs.length} purchase orders...`);

        for (const po of posWithoutPdfs) {
          try {
            await generatePurchaseOrderPdf(po.id);
            results.purchaseOrders.success++;
            const poNum = po.poNumber || `PO-${po.id.slice(0, 8)}`;
            console.log(`[Admin] ✓ Generated PDF for PO ${poNum}`);
          } catch (error: any) {
            results.purchaseOrders.failed++;
            const poNum = po.poNumber || `PO-${po.id.slice(0, 8)}`;
            const errorMsg = `PO ${poNum}: ${error.message}`;
            results.purchaseOrders.errors.push(errorMsg);
            console.error(`[Admin] ✗ Failed to generate PDF for PO ${poNum}:`, error);
          }
        }
      }

      const totalSuccess = results.invoices.success + results.purchaseOrders.success;
      const totalFailed = results.invoices.failed + results.purchaseOrders.failed;

      console.log(`[Admin] Bulk PDF generation complete: ${totalSuccess} succeeded, ${totalFailed} failed`);

      return {
        success: true,
        message: `Generated ${totalSuccess} PDFs successfully, ${totalFailed} failed`,
        results,
      };
    } catch (error: any) {
      console.error('Error in bulk PDF generation:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to generate PDFs',
      });
    }
  });
};
