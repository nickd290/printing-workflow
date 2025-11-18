'use client';

import { useState, useEffect } from 'react';
import { adminAPI, type CreateCustomerBody, type UpdateCustomerBody, type CustomerResponse } from '@/lib/api-client';
import toast from 'react-hot-toast';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date;
  }>;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateCustomerBody>({
    companyName: '',
    companyEmail: '',
    companyPhone: '',
    companyAddress: '',
    userName: '',
    userEmail: '',
    password: '',
  });

  // Load customers
  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminAPI.listCustomers();
      setCustomers(data.customers);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load customers';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Open modal for create
  const handleCreate = () => {
    setEditingCustomer(null);
    setFormData({
      companyName: '',
      companyEmail: '',
      companyPhone: '',
      companyAddress: '',
      userName: '',
      userEmail: '',
      password: '',
    });
    setCreatedCredentials(null);
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      companyName: customer.name,
      companyEmail: customer.email || '',
      companyPhone: customer.phone || '',
      companyAddress: customer.address || '',
      userName: '',
      userEmail: '',
      password: '',
    });
    setCreatedCredentials(null);
    setIsModalOpen(true);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingCustomer) {
      // Edit mode
      await handleEditSubmit();
    } else {
      // Create mode
      try {
        const result: CustomerResponse = await adminAPI.createCustomer(formData);
        toast.success(result.message);

        // Store credentials to display to admin
        setCreatedCredentials(result.credentials);

        // Reload customers list
        await loadCustomers();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create customer';
        toast.error(message);
      }
    }
  };

  // Submit edit
  const handleEditSubmit = async () => {
    if (!editingCustomer) return;

    try {
      const updateData: UpdateCustomerBody = {
        companyName: formData.companyName,
        companyEmail: formData.companyEmail,
        companyPhone: formData.companyPhone,
        companyAddress: formData.companyAddress,
      };

      const result = await adminAPI.updateCustomer(editingCustomer.id, updateData);
      toast.success(result.message);

      // Reload customers list
      await loadCustomers();

      // Close modal
      handleCloseModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update customer';
      toast.error(message);
    }
  };

  // Close modal and clear credentials
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCreatedCredentials(null);
  };

  // Copy credentials to clipboard
  const handleCopyCredentials = () => {
    if (createdCredentials) {
      const text = `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`;
      navigator.clipboard.writeText(text);
      toast.success('Credentials copied to clipboard');
    }
  };

  // Filter customers by search
  const filteredCustomers = customers.filter((customer) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      customer.email?.toLowerCase().includes(searchLower) ||
      customer.users.some((user) =>
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      )
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Customer Management</h1>
        <p className="text-muted-foreground">Create and manage customer accounts</p>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto">
          {/* Search */}
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full sm:max-w-xs"
          />
        </div>

        {/* Create button */}
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium whitespace-nowrap"
        >
          + Create Customer
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
      {!loading && filteredCustomers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {searchTerm ? 'No customers found' : 'No customers yet'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleCreate}
              className="text-primary hover:underline font-medium"
            >
              Create your first customer
            </button>
          )}
        </div>
      )}

      {/* Customers table */}
      {!loading && filteredCustomers.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Primary User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCustomers.map((customer) => {
                  const primaryUser = customer.users[0];
                  return (
                    <tr key={customer.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-foreground">{customer.name}</div>
                        {customer.email && (
                          <div className="text-xs text-muted-foreground">{customer.email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-foreground">
                          {primaryUser?.name || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-muted-foreground">
                          {primaryUser?.email || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-muted-foreground">
                          {customer.phone || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-muted-foreground">
                          {primaryUser ? new Date(primaryUser.createdAt).toLocaleDateString() : '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-muted-foreground">
                          {customer.users.length}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="text-primary hover:underline text-sm font-medium"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for Create */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {!createdCredentials ? (
                <>
                  <h2 className="text-xl font-bold text-foreground mb-4">
                    {editingCustomer ? 'Edit Customer' : 'Create New Customer'}
                  </h2>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Company Information Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider border-b border-border pb-2">
                        Company Information
                      </h3>

                      {/* Company Name */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Company Name <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
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
                          value={formData.companyEmail}
                          onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
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
                            value={formData.companyPhone}
                            onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
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
                            value={formData.companyAddress}
                            onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="123 Main St, City, State"
                          />
                        </div>
                      </div>
                    </div>

                    {/* User Information Section - Only show in create mode */}
                    {!editingCustomer && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider border-b border-border pb-2">
                          Primary User Account
                        </h3>

                        {/* User Name */}
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            User Name <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.userName}
                            onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="John Doe"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* User Email */}
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              User Email <span className="text-destructive">*</span>
                            </label>
                            <input
                              type="email"
                              required
                              value={formData.userEmail}
                              onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="john@acme.com"
                            />
                          </div>

                          {/* Password */}
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              Password <span className="text-destructive">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="Enter password"
                            />
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Password will be hashed and stored securely. Make sure to copy the credentials after creation.
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                      >
                        {editingCustomer ? 'Update Customer' : 'Create Customer'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-foreground mb-4">
                    Customer Created Successfully!
                  </h2>

                  <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6">
                    <p className="text-sm font-medium text-foreground mb-3">
                      Copy these credentials and send them to the customer:
                    </p>
                    <div className="space-y-2 font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="text-foreground font-semibold">{createdCredentials.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Password:</span>
                        <span className="text-foreground font-semibold">{createdCredentials.password}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Important:</strong> This password will only be shown once. Make sure to copy it now.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleCopyCredentials}
                      className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                    >
                      Copy Credentials
                    </button>
                    <button
                      onClick={handleCloseModal}
                      className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
