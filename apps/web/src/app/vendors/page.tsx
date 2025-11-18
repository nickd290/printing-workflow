'use client';

import { useState, useEffect } from 'react';
import { vendorsAPI, type Vendor, type CreateVendorBody, type UpdateVendorBody } from '@/lib/api-client';
import toast from 'react-hot-toast';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateVendorBody>({
    name: '',
    email: '',
    phone: '',
    address: '',
  });

  // Load vendors
  const loadVendors = async () => {
    try {
      setLoading(true);
      setError(null);
      const filters: any = {};
      if (showActiveOnly) {
        filters.isActive = true;
      }
      if (searchTerm && searchTerm.trim().length > 0) {
        filters.search = searchTerm.trim();
      }
      console.log('📋 Loading vendors with filters:', filters);
      const data = await vendorsAPI.list(filters);
      console.log(`✅ Loaded ${data.length} vendors`);
      setVendors(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load vendors';
      console.error('❌ Failed to load vendors:', err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, [showActiveOnly, searchTerm]);

  // Open modal for create
  const handleCreate = () => {
    setEditingVendor(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
    });
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
    });
    setIsModalOpen(true);
  };

  // Submit form (create or update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let vendorName = formData.name;
      console.log('💾 Submitting vendor form:', {
        editing: !!editingVendor,
        formData: formData
      });

      if (editingVendor) {
        // Update existing vendor
        console.log(`📝 Updating vendor ${editingVendor.id}...`);
        const updated = await vendorsAPI.update(editingVendor.id, formData);
        console.log('✅ Vendor updated:', updated);
        toast.success(`Vendor "${vendorName}" updated successfully`);
      } else {
        // Create new vendor
        console.log('➕ Creating new vendor...');
        const newVendor = await vendorsAPI.create(formData);
        console.log('✅ Vendor created:', newVendor);
        vendorName = newVendor.name;
        toast.success(`Vendor "${vendorName}" created successfully`);
      }

      setIsModalOpen(false);

      // Wait for vendors list to reload before clearing the form
      console.log('🔄 Reloading vendors list...');
      await loadVendors();
      console.log('✅ Vendors list reloaded');

      // Reset form data
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save vendor';
      console.error('❌ Vendor save error:', err);
      toast.error(message);
    }
  };

  // Toggle vendor active status
  const handleToggleActive = async (vendor: Vendor) => {
    try {
      await vendorsAPI.update(vendor.id, { isActive: !vendor.isActive });
      toast.success(`Vendor ${vendor.isActive ? 'deactivated' : 'activated'}`);
      loadVendors();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update vendor';
      toast.error(message);
    }
  };

  // Delete vendor (soft delete)
  const handleDelete = async (vendor: Vendor) => {
    if (!confirm(`Are you sure you want to delete "${vendor.name}"? This will deactivate the vendor.`)) {
      return;
    }

    try {
      await vendorsAPI.delete(vendor.id);
      toast.success('Vendor deleted successfully');
      loadVendors();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete vendor';
      toast.error(message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Vendors</h1>
        <p className="text-muted-foreground">Manage third-party vendors for production routing</p>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
          {/* Search */}
          <input
            type="text"
            placeholder="Search vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary flex-1 sm:max-w-xs"
          />

          {/* Active filter */}
          <label className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg bg-card cursor-pointer hover:bg-muted transition-colors">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
            />
            <span className="text-sm text-foreground whitespace-nowrap">Active only</span>
          </label>
        </div>

        {/* Create button */}
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium whitespace-nowrap"
        >
          + Create Vendor
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
      {!loading && vendors.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {searchTerm || !showActiveOnly ? 'No vendors found' : 'No vendors yet'}
          </p>
          {!searchTerm && showActiveOnly && (
            <button
              onClick={handleCreate}
              className="text-primary hover:underline font-medium"
            >
              Create your first vendor
            </button>
          )}
        </div>
      )}

      {/* Vendors table */}
      {!loading && vendors.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Jobs
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-foreground">{vendor.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-muted-foreground">
                        {vendor.email || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-muted-foreground">
                        {vendor.phone || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          vendor.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {vendor.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-muted-foreground">
                        {vendor._count?.jobs ?? 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(vendor)}
                          className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(vendor)}
                          className="px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted rounded transition-colors"
                        >
                          {vendor.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(vendor)}
                          className="px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">
                {editingVendor ? 'Edit Vendor' : 'Create Vendor'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Vendor name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="vendor@example.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="(555) 123-4567"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Address
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="Street address, city, state, zip"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                  >
                    {editingVendor ? 'Update' : 'Create'}
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
