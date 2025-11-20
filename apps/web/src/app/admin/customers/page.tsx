'use client';

import React, { useState, useEffect } from 'react';
import { companiesAPI, employeesAPI, type Company, type Employee } from '@/lib/api-client';
import toast from 'react-hot-toast';

// Extend Company to include employees
interface CompanyWithEmployees extends Company {
  employees?: Employee[];
}

export default function CustomersPage() {
  const [companies, setCompanies] = useState<CompanyWithEmployees[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCompanyIds, setExpandedCompanyIds] = useState<Set<string>>(new Set());
  const [loadingEmployees, setLoadingEmployees] = useState<Set<string>>(new Set());

  // Company modal state
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyFormData, setCompanyFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });

  // Employee modal state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    isPrimary: false,
  });

  // Load companies (customers)
  const loadCompanies = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await companiesAPI.list({ type: 'customer' });
      setCompanies(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load companies';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Load employees for a specific company
  const loadEmployeesForCompany = async (companyId: string) => {
    try {
      setLoadingEmployees((prev) => new Set(prev).add(companyId));
      const employees = await employeesAPI.list({ companyId });

      // Update the company with its employees
      setCompanies((prev) =>
        prev.map((company) =>
          company.id === companyId ? { ...company, employees } : company
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load employees';
      toast.error(message);
    } finally {
      setLoadingEmployees((prev) => {
        const next = new Set(prev);
        next.delete(companyId);
        return next;
      });
    }
  };

  // Toggle company expansion
  const toggleCompanyExpansion = async (companyId: string) => {
    const isExpanded = expandedCompanyIds.has(companyId);

    if (isExpanded) {
      // Collapse
      setExpandedCompanyIds((prev) => {
        const next = new Set(prev);
        next.delete(companyId);
        return next;
      });
    } else {
      // Expand and load employees if not already loaded
      setExpandedCompanyIds((prev) => new Set(prev).add(companyId));

      const company = companies.find((c) => c.id === companyId);
      if (company && !company.employees) {
        await loadEmployeesForCompany(companyId);
      }
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  // Company modal handlers
  const handleCreateCompany = () => {
    setEditingCompany(null);
    setCompanyFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
    });
    setIsCompanyModalOpen(true);
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setCompanyFormData({
      name: company.name,
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
    });
    setIsCompanyModalOpen(true);
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCompany) {
        // Update existing company
        await companiesAPI.update(editingCompany.id, companyFormData);
        toast.success('Company updated successfully');
      } else {
        // Create new company
        await companiesAPI.create({
          ...companyFormData,
          type: 'customer',
        });
        toast.success('Company created successfully');
      }

      // Reload companies
      await loadCompanies();
      setIsCompanyModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to ${editingCompany ? 'update' : 'create'} company`;
      toast.error(message);
    }
  };

  // Employee modal handlers
  const handleAddEmployee = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setEditingEmployee(null);
    setEmployeeFormData({
      name: '',
      email: '',
      phone: '',
      position: '',
      isPrimary: false,
    });
    setIsEmployeeModalOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedCompanyId(employee.companyId);
    setEditingEmployee(employee);
    setEmployeeFormData({
      name: employee.name,
      email: employee.email,
      phone: employee.phone || '',
      position: employee.position || '',
      isPrimary: employee.isPrimary,
    });
    setIsEmployeeModalOpen(true);
  };

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCompanyId) {
      toast.error('No company selected');
      return;
    }

    try {
      if (editingEmployee) {
        // Update existing employee
        await employeesAPI.update(editingEmployee.id, employeeFormData);
        toast.success('Employee updated successfully');
      } else {
        // Create new employee
        await employeesAPI.create({
          companyId: selectedCompanyId,
          ...employeeFormData,
        });
        toast.success('Employee added successfully');
      }

      // Reload employees for this company
      await loadEmployeesForCompany(selectedCompanyId);
      setIsEmployeeModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to ${editingEmployee ? 'update' : 'add'} employee`;
      toast.error(message);
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(`Are you sure you want to delete employee "${employee.name}"?`)) {
      return;
    }

    try {
      await employeesAPI.delete(employee.id);
      toast.success('Employee deleted successfully');

      // Reload employees for this company
      await loadEmployeesForCompany(employee.companyId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete employee';
      toast.error(message);
    }
  };

  // Filter companies by search
  const filteredCompanies = companies.filter((company) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      company.name.toLowerCase().includes(searchLower) ||
      company.email?.toLowerCase().includes(searchLower) ||
      company.employees?.some((employee) =>
        employee.name.toLowerCase().includes(searchLower) ||
        employee.email.toLowerCase().includes(searchLower)
      )
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Customer Management</h1>
        <p className="text-muted-foreground">Manage customer companies and employees</p>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto">
          {/* Search */}
          <input
            type="text"
            placeholder="Search companies and employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full sm:max-w-xs"
          />
        </div>

        {/* Create button */}
        <button
          onClick={handleCreateCompany}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium whitespace-nowrap"
        >
          + Add Company
        </button>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredCompanies.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {searchTerm ? 'No companies found' : 'No companies yet'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleCreateCompany}
              className="text-primary hover:underline font-medium"
            >
              Add your first company
            </button>
          )}
        </div>
      )}

      {/* Companies table */}
      {!loading && filteredCompanies.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-8"></th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Employees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Jobs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCompanies.map((company) => {
                  const isExpanded = expandedCompanyIds.has(company.id);
                  const isLoadingEmployees = loadingEmployees.has(company.id);

                  return (
                    <React.Fragment key={company.id}>
                      {/* Company Row */}
                      <tr className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleCompanyExpansion(company.id)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-foreground">{company.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-muted-foreground">
                            {company.email || '—'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-muted-foreground">
                            {company.phone || '—'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-muted-foreground">
                            {company._count?.employees || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-muted-foreground">
                            {company._count?.jobsAsCustomer || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleEditCompany(company)}
                            className="text-primary hover:underline text-sm font-medium"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Employees Section */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 bg-muted/20">
                            {isLoadingEmployees ? (
                              <div className="flex items-center justify-center py-4">
                                <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
                              </div>
                            ) : company.employees && company.employees.length > 0 ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-semibold text-foreground">Employees</h4>
                                  <button
                                    onClick={() => handleAddEmployee(company.id)}
                                    className="text-sm text-primary hover:underline"
                                  >
                                    + Add Employee
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {company.employees.map((employee) => (
                                    <div
                                      key={employee.id}
                                      className="flex items-center justify-between p-3 bg-card border border-border rounded-lg"
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-foreground">{employee.name}</span>
                                          {employee.isPrimary && (
                                            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                                              Primary
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {employee.email}
                                          {employee.position && <> • {employee.position}</>}
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleEditEmployee(employee)}
                                          className="text-sm text-primary hover:underline"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDeleteEmployee(employee)}
                                          className="text-sm text-destructive hover:underline"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <p className="text-sm text-muted-foreground mb-2">No employees yet</p>
                                <button
                                  onClick={() => handleAddEmployee(company.id)}
                                  className="text-sm text-primary hover:underline"
                                >
                                  Add first employee
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Company Modal */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">
                {editingCompany ? 'Edit Company' : 'Add Company'}
              </h2>

              <form onSubmit={handleCompanySubmit} className="space-y-4">
                {/* Company Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Company Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={companyFormData.name}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Acme Corporation"
                  />
                </div>

                {/* Company Email */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Company Email
                  </label>
                  <input
                    type="email"
                    value={companyFormData.email}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="info@acme.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Company Phone */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={companyFormData.phone}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  {/* Company Address */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={companyFormData.address}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="123 Main St, City, State"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsCompanyModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                  >
                    {editingCompany ? 'Update Company' : 'Create Company'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">
                {editingEmployee ? 'Edit Employee' : 'Add Employee'}
              </h2>

              <form onSubmit={handleEmployeeSubmit} className="space-y-4">
                {/* Employee Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Employee Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={employeeFormData.name}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="John Doe"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Employee Email */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Email <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={employeeFormData.email}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="john@company.com"
                    />
                  </div>

                  {/* Employee Phone */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={employeeFormData.phone}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                {/* Employee Position */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Position / Title
                  </label>
                  <input
                    type="text"
                    value={employeeFormData.position}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, position: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Marketing Manager"
                  />
                </div>

                {/* Primary Contact Checkbox */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={employeeFormData.isPrimary}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, isPrimary: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <label htmlFor="isPrimary" className="text-sm text-foreground">
                    Set as primary contact
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEmployeeModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                  >
                    {editingEmployee ? 'Update Employee' : 'Add Employee'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
