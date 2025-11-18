import { prisma } from '@printing-workflow/db';

/**
 * Company Service
 * Handles CRUD operations for companies (primarily customers)
 */

export async function createCompany(data: {
  name: string;
  type: string;
  email?: string;
  phone?: string;
  address?: string;
}) {
  // Validate required fields
  if (!data.name || data.name.trim().length === 0) {
    throw new Error('Company name is required');
  }

  if (!data.type || data.type.trim().length === 0) {
    throw new Error('Company type is required');
  }

  // Validate type
  const validTypes = ['customer', 'broker', 'manufacturer'];
  if (!validTypes.includes(data.type)) {
    throw new Error('Company type must be one of: customer, broker, manufacturer');
  }

  // Validate email format if provided
  if (data.email && !isValidEmail(data.email)) {
    throw new Error('Invalid email format');
  }

  const company = await prisma.company.create({
    data: {
      name: data.name.trim(),
      type: data.type,
      email: data.email?.trim(),
      phone: data.phone?.trim(),
      address: data.address?.trim(),
    },
  });

  return company;
}

export async function getCompanyById(id: string) {
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: { isPrimary: 'desc' },
      },
      jobsAsCustomer: {
        select: {
          id: true,
          jobNo: true,
          status: true,
          customerTotal: true,
        },
        where: {
          deletedAt: null, // Only show active jobs
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          jobsAsCustomer: true,
          users: true,
        },
      },
    },
  });

  if (!company) {
    throw new Error('Company not found');
  }

  return company;
}

export async function listCompanies(filters?: {
  type?: string;
  search?: string;
}) {
  const where: any = {};

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const companies = await prisma.company.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          jobsAsCustomer: true,
          users: true,
          contacts: true,
        },
      },
      contacts: {
        where: { isPrimary: true },
        take: 1,
      },
    },
  });

  return companies;
}

export async function updateCompany(
  id: string,
  data: {
    name?: string;
    type?: string;
    email?: string;
    phone?: string;
    address?: string;
  }
) {
  // Verify company exists
  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Company not found');
  }

  // Validate type if provided
  if (data.type) {
    const validTypes = ['customer', 'broker', 'manufacturer'];
    if (!validTypes.includes(data.type)) {
      throw new Error('Company type must be one of: customer, broker, manufacturer');
    }
  }

  // Validate email format if provided
  if (data.email && !isValidEmail(data.email)) {
    throw new Error('Invalid email format');
  }

  // Validate name if provided
  if (data.name !== undefined && data.name.trim().length === 0) {
    throw new Error('Company name cannot be empty');
  }

  const company = await prisma.company.update({
    where: { id },
    data: {
      name: data.name?.trim(),
      type: data.type,
      email: data.email?.trim(),
      phone: data.phone?.trim(),
      address: data.address?.trim(),
    },
  });

  return company;
}

export async function deleteCompany(id: string) {
  // Check if company exists
  const existing = await prisma.company.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          jobsAsCustomer: true,
          users: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error('Company not found');
  }

  // Prevent deletion if company has associated data
  if (existing._count.jobsAsCustomer > 0) {
    throw new Error(
      `Cannot delete company with ${existing._count.jobsAsCustomer} associated jobs.`
    );
  }

  if (existing._count.users > 0) {
    throw new Error(
      `Cannot delete company with ${existing._count.users} associated users.`
    );
  }

  // Hard delete if no associated data
  await prisma.company.delete({
    where: { id },
  });

  return { success: true };
}

// Helper function to validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
