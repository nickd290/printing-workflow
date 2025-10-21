'use client';

import { BradfordSidebar } from '@/components/BradfordSidebar';
import { useState, useEffect } from 'react';
import { purchaseOrdersAPI, invoicesAPI, jobsAPI } from '@/lib/api-client';
import toast, { Toaster } from 'react-hot-toast';

export default function InvoicesPOsPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'pos'>('invoices');

  // Create PO state
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [selectedJobForPO, setSelectedJobForPO] = useState('');
  const [newPOAmount, setNewPOAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit states
  const [editingPOId, setEditingPOId] = useState<string | null>(null);
  const [editPOData, setEditPOData] = useState({ vendorAmount: '', status: '' });
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editInvoiceData, setEditInvoiceData] = useState({ amount: '', status: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [posData, invoicesData, jobsData] = await Promise.all([
        purchaseOrdersAPI.list(),
        invoicesAPI.list(),
        jobsAPI.list(),
      ]);

      // Filter Bradford POs
      const bradfordPOs = posData.purchaseOrders.filter((po: any) =>
        po.targetCompany?.id === 'bradford' || po.originCompany?.id === 'bradford'
      );

      // Filter Bradford invoices
      const bradfordInvoices = invoicesData.invoices.filter((inv: any) =>
        inv.fromCompany?.id === 'bradford' || inv.toCompany?.id === 'bradford'
      );

      // Filter Bradford jobs (jobs with POs to/from Bradford)
      const bradfordJobs = jobsData.jobs.filter((job: any) =>
        job.purchaseOrders?.some((po: any) =>
          po.targetCompany?.id === 'bradford' || po.originCompany?.id === 'bradford'
        )
      );

      setPurchaseOrders(bradfordPOs);
      setInvoices(bradfordInvoices);
      setJobs(bradfordJobs);
      setError(null);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load invoices and POs. Make sure the API is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePO = async () => {
    if (!selectedJobForPO || !newPOAmount) {
      toast.error('Please select a job and enter an amount');
      return;
    }

    const job = jobs.find(j => j.id === selectedJobForPO);
    if (!job) return;

    // Find the incoming PO from Impact Direct to get the original amount
    const incomingPO = job.purchaseOrders?.find((po: any) => po.targetCompany?.id === 'bradford');
    const originalAmount = incomingPO ? Number(incomingPO.vendorAmount) : Number(job.customerTotal);
    const vendorAmount = parseFloat(newPOAmount);
    const marginAmount = originalAmount - vendorAmount;

    setSaving(true);
    try {
      await fetch('http://localhost:3001/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originCompanyId: 'bradford',
          targetCompanyId: 'jd-graphic',
          jobId: selectedJobForPO,
          originalAmount,
          vendorAmount,
          marginAmount,
        }),
      });

      toast.success('Purchase order created to JD Graphic!');
      setShowCreatePO(false);
      setSelectedJobForPO('');
      setNewPOAmount('');
      await loadData();
    } catch (err) {
      console.error('Failed to create PO:', err);
      toast.error('Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  };

  const handleEditPO = (po: any) => {
    setEditingPOId(po.id);
    setEditPOData({
      vendorAmount: po.vendorAmount.toString(),
      status: po.status,
    });
  };

  const handleSavePO = async (poId: string) => {
    setSaving(true);
    try {
      await fetch(`http://localhost:3001/api/purchase-orders/${poId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorAmount: parseFloat(editPOData.vendorAmount),
          status: editPOData.status,
        }),
      });
      toast.success('Purchase order updated!');
      setEditingPOId(null);
      await loadData();
    } catch (err) {
      console.error('Failed to update PO:', err);
      toast.error('Failed to update purchase order');
    } finally {
      setSaving(false);
    }
  };

  const handleEditInvoice = (invoice: any) => {
    setEditingInvoiceId(invoice.id);
    setEditInvoiceData({
      amount: invoice.amount.toString(),
      status: invoice.status,
    });
  };

  const handleSaveInvoice = async (invoiceId: string) => {
    setSaving(true);
    try {
      await fetch(`http://localhost:3001/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(editInvoiceData.amount),
          status: editInvoiceData.status,
        }),
      });
      toast.success('Invoice updated!');
      setEditingInvoiceId(null);
      await loadData();
    } catch (err) {
      console.error('Failed to update invoice:', err);
      toast.error('Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  const totalPOAmount = purchaseOrders.reduce((sum, po) => sum + Number(po.vendorAmount), 0);
  const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const paidInvoices = invoices.filter((inv) => inv.status === 'PAID');
  const unpaidInvoices = invoices.filter((inv) => inv.status !== 'PAID');

  return (
    <div className="flex h-screen bg-gray-50">
      <BradfordSidebar />
      <Toaster position="top-right" />

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Invoices & Purchase Orders</h1>
            <p className="mt-2 text-sm text-gray-600">
              Track and manage all financial documents
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold">Error:</span> {error}
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading data...</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Invoices</p>
                      <p className="text-3xl font-bold text-indigo-600 mt-2">{invoices.length}</p>
                      <p className="text-sm text-gray-600 mt-2">
                        ${totalInvoiceAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <div className="flex gap-4 mt-2">
                        <p className="text-xs text-green-600">{paidInvoices.length} paid</p>
                        <p className="text-xs text-yellow-600">{unpaidInvoices.length} unpaid</p>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Purchase Orders</p>
                      <p className="text-3xl font-bold text-yellow-600 mt-2">{purchaseOrders.length}</p>
                      <p className="text-sm text-gray-600 mt-2">
                        ${totalPOAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab('invoices')}
                      className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                        activeTab === 'invoices'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Invoices ({invoices.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('pos')}
                      className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                        activeTab === 'pos'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Purchase Orders ({purchaseOrders.length})
                    </button>
                  </div>
                </div>

                {/* Invoices Table */}
                {activeTab === 'invoices' && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer PO#</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {invoices.map((invoice) => {
                          const statusColor =
                            invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                            invoice.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800';
                          const isEditing = editingInvoiceId === invoice.id;

                          return (
                            <tr key={invoice.id} className={isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                {invoice.invoiceNo}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {invoice.job?.customerPONumber || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {invoice.fromCompany?.name || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {invoice.toCompany?.name || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editInvoiceData.amount}
                                    onChange={(e) => setEditInvoiceData({ ...editInvoiceData, amount: e.target.value })}
                                    className="w-32 px-2 py-1 border border-blue-300 rounded text-sm"
                                  />
                                ) : (
                                  `$${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {isEditing ? (
                                  <select
                                    value={editInvoiceData.status}
                                    onChange={(e) => setEditInvoiceData({ ...editInvoiceData, status: e.target.value })}
                                    className="px-2 py-1 border border-blue-300 rounded text-xs"
                                  >
                                    <option value="DRAFT">DRAFT</option>
                                    <option value="SENT">SENT</option>
                                    <option value="PAID">PAID</option>
                                    <option value="OVERDUE">OVERDUE</option>
                                    <option value="CANCELLED">CANCELLED</option>
                                  </select>
                                ) : (
                                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                                    {invoice.status}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(invoice.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {isEditing ? (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleSaveInvoice(invoice.id)}
                                      disabled={saving}
                                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                    >
                                      {saving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={() => setEditingInvoiceId(null)}
                                      disabled={saving}
                                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleEditInvoice(invoice)}
                                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                  >
                                    Edit
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {invoices.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <p>No invoices found</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Purchase Orders Table */}
                {activeTab === 'pos' && (
                  <div>
                    {/* Create PO Button */}
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Purchase Orders</h3>
                        <p className="text-xs text-gray-500 mt-1">Manage POs to/from Bradford</p>
                      </div>
                      {!showCreatePO && (
                        <button
                          onClick={() => setShowCreatePO(true)}
                          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Create PO to JD Graphic
                        </button>
                      )}
                    </div>

                    {/* Create PO Form */}
                    {showCreatePO && (
                      <div className="px-6 py-4 bg-green-50 border-b border-green-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">New Purchase Order → JD Graphic</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Select Job *</label>
                            <select
                              value={selectedJobForPO}
                              onChange={(e) => setSelectedJobForPO(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Select a job --</option>
                              {jobs.map((job) => {
                                const incomingPO = job.purchaseOrders?.find((po: any) => po.targetCompany?.id === 'bradford');
                                const alreadyHasOutgoing = job.purchaseOrders?.some((po: any) => po.originCompany?.id === 'bradford');
                                return (
                                  <option key={job.id} value={job.id} disabled={!incomingPO || alreadyHasOutgoing}>
                                    {job.customerPONumber || job.jobNo} (Job: {job.jobNo}) - ${incomingPO ? Number(incomingPO.vendorAmount).toLocaleString() : 'N/A'}
                                    {alreadyHasOutgoing && ' (PO already created)'}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Vendor Amount (to JD) *</label>
                            <input
                              type="number"
                              step="0.01"
                              value={newPOAmount}
                              onChange={(e) => setNewPOAmount(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                              placeholder="0.00"
                            />
                            {selectedJobForPO && newPOAmount && (() => {
                              const job = jobs.find(j => j.id === selectedJobForPO);
                              const incomingPO = job?.purchaseOrders?.find((po: any) => po.targetCompany?.id === 'bradford');
                              const incoming = incomingPO ? Number(incomingPO.vendorAmount) : 0;
                              const outgoing = parseFloat(newPOAmount);
                              const margin = incoming - outgoing;
                              return (
                                <p className={`text-xs mt-1 ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  Margin: ${margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={handleCreatePO}
                            disabled={saving || !selectedJobForPO || !newPOAmount}
                            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
                          >
                            {saving ? 'Creating...' : 'Create PO'}
                          </button>
                          <button
                            onClick={() => {
                              setShowCreatePO(false);
                              setSelectedJobForPO('');
                              setNewPOAmount('');
                            }}
                            disabled={saving}
                            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO #</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Margin</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {purchaseOrders.map((po) => {
                          const originalAmount = Number(po.originalAmount || 0);
                          const vendorAmount = Number(po.vendorAmount);
                          const margin = originalAmount - vendorAmount;
                          const isEditing = editingPOId === po.id;

                          return (
                            <tr key={po.id} className={isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                PO-{po.id.slice(0, 8)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {po.originCompany?.name || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {po.targetCompany?.name || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ${originalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editPOData.vendorAmount}
                                    onChange={(e) => setEditPOData({ ...editPOData, vendorAmount: e.target.value })}
                                    className="w-32 px-2 py-1 border border-blue-300 rounded text-sm"
                                  />
                                ) : (
                                  `$${vendorAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                                ${margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {isEditing ? (
                                  <select
                                    value={editPOData.status}
                                    onChange={(e) => setEditPOData({ ...editPOData, status: e.target.value })}
                                    className="px-2 py-1 border border-blue-300 rounded text-xs"
                                  >
                                    <option value="PENDING">PENDING</option>
                                    <option value="CONFIRMED">CONFIRMED</option>
                                    <option value="RECEIVED">RECEIVED</option>
                                    <option value="CANCELLED">CANCELLED</option>
                                  </select>
                                ) : (
                                  <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {po.status}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(po.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {isEditing ? (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleSavePO(po.id)}
                                      disabled={saving}
                                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                    >
                                      {saving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={() => setEditingPOId(null)}
                                      disabled={saving}
                                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleEditPO(po)}
                                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                  >
                                    Edit
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {purchaseOrders.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <p>No purchase orders found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
