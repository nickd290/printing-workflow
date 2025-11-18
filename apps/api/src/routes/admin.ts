import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@printing-workflow/db';
import { generateInvoicePdf } from '../services/invoice.service.js';
import { generatePurchaseOrderPdf } from '../services/purchase-order.service.js';
import bcrypt from 'bcrypt';

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

  // ============================================================================
  // Customer Management
  // ============================================================================

  // POST /api/admin/customers - Create new customer company + user
  fastify.post('/customers', async (request, reply) => {
    const {
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      userName,
      userEmail,
      password,
    } = request.body as {
      companyName: string;
      companyEmail?: string;
      companyPhone?: string;
      companyAddress?: string;
      userName: string;
      userEmail: string;
      password: string;
    };

    try {
      // Validate required fields
      if (!companyName || !userName || !userEmail || !password) {
        return reply.status(400).send({
          error: 'Missing required fields: companyName, userName, userEmail, password',
        });
      }

      // Check if user email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userEmail },
      });

      if (existingUser) {
        return reply.status(400).send({
          error: `User with email ${userEmail} already exists`,
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create company first
      const company = await prisma.company.create({
        data: {
          name: companyName,
          type: 'customer',
          email: companyEmail,
          phone: companyPhone,
          address: companyAddress,
        },
      });

      // Create user with CUSTOMER role
      const user = await prisma.user.create({
        data: {
          name: userName,
          email: userEmail,
          password: hashedPassword,
          role: 'CUSTOMER',
          companyId: company.id,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          company: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              address: true,
            },
          },
        },
      });

      fastify.log.info(`✅ Created new customer: ${companyName} (${userEmail})`);

      return {
        success: true,
        message: `Customer ${companyName} created successfully`,
        customer: user,
        credentials: {
          email: userEmail,
          password, // Return plain password ONCE for user to copy
        },
      };
    } catch (error: any) {
      console.error('Error creating customer:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to create customer',
      });
    }
  });

  // GET /api/admin/customers - List all customers
  fastify.get('/customers', async (request, reply) => {
    try {
      const customers = await prisma.company.findMany({
        where: {
          type: 'customer',
        },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      return { customers, count: customers.length };
    } catch (error: any) {
      console.error('Error listing customers:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to list customers',
      });
    }
  });

  // GET /api/admin/customers/:id - Get single customer
  fastify.get('/customers/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const customer = await prisma.company.findFirst({
        where: {
          id,
          type: 'customer',
        },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });

      if (!customer) {
        return reply.status(404).send({
          error: 'Customer not found',
        });
      }

      return { customer };
    } catch (error: any) {
      console.error('Error fetching customer:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to fetch customer',
      });
    }
  });

  // PATCH /api/admin/customers/:id - Update customer
  fastify.patch('/customers/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { companyName, companyEmail, companyPhone, companyAddress } = request.body as {
        companyName?: string;
        companyEmail?: string;
        companyPhone?: string;
        companyAddress?: string;
      };

      // Verify customer exists
      const existingCustomer = await prisma.company.findFirst({
        where: {
          id,
          type: 'customer',
        },
      });

      if (!existingCustomer) {
        return reply.status(404).send({
          error: 'Customer not found',
        });
      }

      // Update customer
      const customer = await prisma.company.update({
        where: { id },
        data: {
          name: companyName,
          email: companyEmail,
          phone: companyPhone,
          address: companyAddress,
        },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Customer updated successfully',
        customer,
      };
    } catch (error: any) {
      console.error('Error updating customer:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to update customer',
      });
    }
  });

  // PATCH /api/admin/customers/:companyId/users/:userId - Update customer user
  fastify.patch('/customers/:companyId/users/:userId', async (request, reply) => {
    try {
      const { companyId, userId } = request.params as { companyId: string; userId: string };
      const { userName, userEmail, password } = request.body as {
        userName?: string;
        userEmail?: string;
        password?: string;
      };

      // Verify user belongs to company
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
        },
      });

      if (!user) {
        return reply.status(404).send({
          error: 'User not found or does not belong to this customer',
        });
      }

      // Check if email is changing and already exists
      if (userEmail && userEmail !== user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: userEmail.toLowerCase() },
        });

        if (existingUser) {
          return reply.status(400).send({
            error: `User with email ${userEmail} already exists`,
          });
        }
      }

      // Hash password if provided
      let hashedPassword;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(userName && { name: userName }),
          ...(userEmail && { email: userEmail.toLowerCase() }),
          ...(hashedPassword && { password: hashedPassword }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      return {
        success: true,
        message: 'User updated successfully',
        user: updatedUser,
      };
    } catch (error: any) {
      console.error('Error updating user:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to update user',
      });
    }
  });
};
