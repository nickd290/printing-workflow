import { prisma } from '@printing-workflow/db';

/**
 * Vendor Service
 * Handles CRUD operations for third-party vendors
 */

export async function createVendor(data: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}) {
  // Validate required fields
  if (!data.name || data.name.trim().length === 0) {
    throw new Error('Vendor name is required');
  }

  // Validate email format if provided
  if (data.email && !isValidEmail(data.email)) {
    throw new Error('Invalid email format');
  }

  const vendor = await prisma.vendor.create({
    data: {
      name: data.name.trim(),
      email: data.email?.trim(),
      phone: data.phone?.trim(),
      address: data.address?.trim(),
      isActive: true,
    },
  });

  return vendor;
}

export async function getVendorById(id: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      jobs: {
        select: {
          id: true,
          jobNo: true,
          status: true,
          vendorAmount: true,
          bradfordCut: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!vendor) {
    throw new Error('Vendor not found');
  }

  return vendor;
}

export async function listVendors(filters?: {
  isActive?: boolean;
  search?: string;
}) {
  const where: any = {};

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { email: { contains: filters.search } },
    ];
  }

  const vendors = await prisma.vendor.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { jobs: true },
      },
    },
  });

  return vendors;
}

export async function updateVendor(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    isActive?: boolean;
  }
) {
  // Verify vendor exists
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Vendor not found');
  }

  // Validate email format if provided
  if (data.email && !isValidEmail(data.email)) {
    throw new Error('Invalid email format');
  }

  // Validate name if provided
  if (data.name !== undefined && data.name.trim().length === 0) {
    throw new Error('Vendor name cannot be empty');
  }

  const vendor = await prisma.vendor.update({
    where: { id },
    data: {
      name: data.name?.trim(),
      email: data.email?.trim(),
      phone: data.phone?.trim(),
      address: data.address?.trim(),
      isActive: data.isActive,
    },
  });

  return vendor;
}

export async function deleteVendor(id: string) {
  // Check if vendor exists
  const existing = await prisma.vendor.findUnique({
    where: { id },
    include: {
      _count: { select: { jobs: true } },
    },
  });

  if (!existing) {
    throw new Error('Vendor not found');
  }

  // Prevent deletion if vendor has active jobs
  if (existing._count.jobs > 0) {
    throw new Error(
      `Cannot delete vendor with ${existing._count.jobs} associated jobs. Deactivate instead.`
    );
  }

  // Soft delete - mark as inactive instead of hard delete
  const vendor = await prisma.vendor.update({
    where: { id },
    data: { isActive: false },
  });

  return vendor;
}

// Helper function to validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
