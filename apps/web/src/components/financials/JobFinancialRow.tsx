'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Package, DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNo: string;
  fromCompany: { name: string };
  toCompany: { name: string };
  amount: number;
  paidAt: Date | null;
  dueAt: Date | null;
  createdAt: Date;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  originCompany: { name: string };
  targetCompany: { name: string };
  vendorAmount: number;
  originalAmount: number;
  status: string;
}

interface Job {
  id: string;
  jobNo: string;
  customer: { name: string };
  customerPONumber?: string;
  customerTotal: number;
  status: string;
  createdAt: Date;
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
}

interface JobFinancialRowProps {
  job: Job;
  onViewJob?: (jobId: string) => void;
  onMarkInvoicePaid?: (invoiceId: string) => void;
  selectedInvoiceIds?: Set<string>;
  onInvoiceSelectionChange?: (invoiceId: string, selected: boolean) => void;
}

export function JobFinancialRow({
  job,
  onViewJob,
  onMarkInvoicePaid,
  selectedInvoiceIds = new Set(),
  onInvoiceSelectionChange
}: JobFinancialRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper to compute payment status
  const getPaymentStatus = (invoice: Invoice) => {
    if (invoice.paidAt) return { status: 'paid', label: 'Paid', color: 'text-green-600 bg-green-50' };
    if (invoice.dueAt && new Date(invoice.dueAt) < new Date())
      return { status: 'overdue', label: 'Overdue', color: 'text-red-600 bg-red-50' };
    return { status: 'unpaid', label: 'Unpaid', color: 'text-yellow-600 bg-yellow-50' };
  };

  // Compute overall job payment status
  const getJobPaymentStatus = () => {
    const invoices = job.invoices || [];
    if (invoices.length === 0) return { label: 'No Invoices', color: 'text-gray-500', icon: Clock };

    const paidCount = invoices.filter(inv => inv.paidAt).length;

    if (paidCount === invoices.length)
      return { label: 'All Paid', color: 'text-green-600', icon: CheckCircle };
    if (paidCount > 0)
      return { label: 'Partially Paid', color: 'text-yellow-600', icon: Clock };

    const hasOverdue = invoices.some(inv =>
      inv.dueAt && new Date(inv.dueAt) < new Date() && !inv.paidAt
    );

    if (hasOverdue) return { label: 'Overdue', color: 'text-red-600', icon: AlertCircle };
    return { label: 'Unpaid', color: 'text-yellow-600', icon: Clock };
  };

  const paymentStatus = getJobPaymentStatus();
  const PaymentIcon = paymentStatus.icon;

  return (
    <div className="border-b border-gray-200 hover:bg-gray-50">
      {/* Main Row */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand/Collapse Icon */}
        <button className="flex-shrink-0 p-1 hover:bg-gray-200 rounded">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-600" />
          )}
        </button>

        {/* Job Number */}
        <div className="min-w-[140px]">
          <span className="font-semibold text-gray-900">{job.jobNo}</span>
        </div>

        {/* Customer */}
        <div className="flex-1 min-w-[200px]">
          <span className="text-gray-700">{job.customer.name}</span>
          {job.customerPONumber && (
            <span className="ml-2 text-sm text-gray-500">PO: {job.customerPONumber}</span>
          )}
        </div>

        {/* Amount */}
        <div className="min-w-[120px] text-right">
          <span className="text-lg font-semibold text-gray-900">
            ${job.customerTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Payment Status */}
        <div className="min-w-[140px]">
          <div className={`flex items-center gap-2 ${paymentStatus.color}`}>
            {PaymentIcon && <PaymentIcon className="h-4 w-4" />}
            <span className="font-medium">{paymentStatus.label}</span>
          </div>
        </div>

        {/* Document Counts */}
        <div className="flex items-center gap-4 min-w-[140px]">
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <FileText className="h-4 w-4" />
            <span>{job.invoices?.length || 0}</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Package className="h-4 w-4" />
            <span>{job.purchaseOrders?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Expanded View - Invoices and POs */}
      {isExpanded && (
        <div className="bg-white border-t border-gray-100 px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 ml-9">
            {/* Invoices Section */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoices ({job.invoices?.length || 0})
              </h4>
              {(job.invoices?.length || 0) === 0 ? (
                <p className="text-sm text-gray-500 italic">No invoices yet</p>
              ) : (
                <div className="space-y-2">
                  {(job.invoices || []).map((invoice) => {
                    const status = getPaymentStatus(invoice);
                    const isSelected = selectedInvoiceIds.has(invoice.id);
                    return (
                      <div
                        key={invoice.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        {/* Checkbox for selection */}
                        {onInvoiceSelectionChange && (
                          <div className="flex items-center pr-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                onInvoiceSelectionChange(invoice.id, e.target.checked);
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </div>
                        )}

                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{invoice.invoiceNo}</div>
                          <div className="text-sm text-gray-600">
                            {invoice.fromCompany.name} → {invoice.toCompany.name}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">
                            ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                          {!invoice.paidAt && onMarkInvoicePaid && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkInvoicePaid(invoice.id);
                              }}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Mark Paid
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Purchase Orders Section */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Purchase Orders ({job.purchaseOrders?.length || 0})
              </h4>
              {(job.purchaseOrders?.length || 0) === 0 ? (
                <p className="text-sm text-gray-500 italic">No purchase orders yet</p>
              ) : (
                <div className="space-y-2">
                  {(job.purchaseOrders || []).map((po) => (
                    <div
                      key={po.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{po.poNumber}</div>
                        <div className="text-sm text-gray-600">
                          {po.originCompany.name} → {po.targetCompany.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">
                          ${po.vendorAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {po.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* View Job Button */}
          {onViewJob && (
            <div className="mt-4 ml-9">
              <button
                onClick={() => onViewJob(job.id)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                View Full Job Details
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
