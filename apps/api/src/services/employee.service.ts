import { prisma } from '@printing-workflow/db';

/**
 * Employee Service
 * Handles CRUD operations for employees (formerly contacts)
 */

export async function createEmployee(data: {
  companyId: string;
  name: string;
  email: string;
  phone?: string;
  position?: string;
  isPrimary?: boolean;
}) {
  // Validate required fields
  if (!data.companyId || data.companyId.trim().length === 0) {
    throw new Error('Company ID is required');
  }

  if (!data.name || data.name.trim().length === 0) {
    throw new Error('Employee name is required');
  }

  if (!data.email || data.email.trim().length === 0) {
    throw new Error('Employee email is required');
  }

  // Validate email format
  if (!isValidEmail(data.email)) {
    throw new Error('Invalid email format');
  }

  // Verify company exists
  const company = await prisma.company.findUnique({
    where: { id: data.companyId },
  });

  if (!company) {
    throw new Error('Company not found');
  }

  // If this employee is marked as primary, unset any existing primary employee
  if (data.isPrimary) {
    await prisma.employee.updateMany({
      where: {
        companyId: data.companyId,
        isPrimary: true,
      },
      data: {
        isPrimary: false,
      },
    });
  }

  const employee = await prisma.employee.create({
    data: {
      companyId: data.companyId,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim(),
      position: data.position?.trim(),
      isPrimary: data.isPrimary || false,
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return employee;
}

export async function getEmployeeById(id: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      jobs: {
        select: {
          id: true,
          jobNo: true,
          status: true,
          description: true,
          createdAt: true,
        },
        where: {
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 10, // Limit to recent 10 jobs
      },
      _count: {
        select: {
          jobs: true,
        },
      },
    },
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  return employee;
}

export async function listEmployees(filters?: {
  companyId?: string;
  search?: string;
  isPrimary?: boolean;
}) {
  const where: any = {};

  if (filters?.companyId) {
    where.companyId = filters.companyId;
  }

  if (filters?.isPrimary !== undefined) {
    where.isPrimary = filters.isPrimary;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { position: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const employees = await prisma.employee.findMany({
    where,
    include: {
      company: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      _count: {
        select: {
          jobs: true,
        },
      },
    },
    orderBy: [
      { isPrimary: 'desc' }, // Primary employees first
      { name: 'asc' },
    ],
  });

  return employees;
}

export async function updateEmployee(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    position?: string;
    isPrimary?: boolean;
  }
) {
  // Verify employee exists
  const existingEmployee = await prisma.employee.findUnique({
    where: { id },
    select: { companyId: true },
  });

  if (!existingEmployee) {
    throw new Error('Employee not found');
  }

  // Validate email format if provided
  if (data.email && !isValidEmail(data.email)) {
    throw new Error('Invalid email format');
  }

  // If setting as primary, unset any existing primary employee in same company
  if (data.isPrimary) {
    await prisma.employee.updateMany({
      where: {
        companyId: existingEmployee.companyId,
        isPrimary: true,
        id: { not: id }, // Don't update the current employee
      },
      data: {
        isPrimary: false,
      },
    });
  }

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.email !== undefined) updateData.email = data.email.trim().toLowerCase();
  if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
  if (data.position !== undefined) updateData.position = data.position?.trim() || null;
  if (data.isPrimary !== undefined) updateData.isPrimary = data.isPrimary;

  const employee = await prisma.employee.update({
    where: { id },
    data: updateData,
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return employee;
}

export async function deleteEmployee(id: string) {
  // Verify employee exists
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      companyId: true,
      _count: {
        select: {
          jobs: true,
        },
      },
    },
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  // Check if employee has associated jobs
  if (employee._count.jobs > 0) {
    throw new Error(
      `Cannot delete employee with ${employee._count.jobs} associated job(s). ` +
      'Please reassign jobs to another employee first.'
    );
  }

  await prisma.employee.delete({
    where: { id },
  });

  return { success: true, message: 'Employee deleted successfully' };
}

// Helper function to validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
