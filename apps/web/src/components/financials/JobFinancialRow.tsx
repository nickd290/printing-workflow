'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Package, DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { JobEditModal } from '@/components/jobs/JobEditModal';
import { PricingBreakdown } from '@/components/PricingBreakdown';

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
  quantity?: number;
  sizeName?: string;
  customerTotal: number;
  customerCPM?: number;
  bradfordTotal?: number | string;
  bradfordTotalCPM?: number;
  bradfordTotalMargin?: number;
  bradfordPaperMargin?: number;
  jdTotal?: number | string;
  printCPM?: number;
  impactMargin?: number | string;
  impactMarginCPM?: number;
  paperCostTotal?: number;
  paperCostCPM?: number;
  paperWeightTotal?: number;
  paperWeightPer1000?: number;
  jdSuppliesPaper?: boolean | number;
  bradfordWaivesPaperMargin?: boolean | number;
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
  isAdmin?: boolean;
  onReloadData?: () => void;
}

export function JobFinancialRow({
  job,
  onViewJob,
  onMarkInvoicePaid,
  selectedInvoiceIds = new Set(),
  onInvoiceSelectionChange,
  isAdmin = false,
  onReloadData
}: JobFinancialRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  // Helper to safely parse number values (handles string|number|null|undefined)
  const parseAmount = (value: number | string | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? 0 : num;
  };

  const bradfordPayAmount = parseAmount(job.bradfordTotal);
  const jdPayAmount = parseAmount(job.jdTotal);
  const impactProfitAmount = parseAmount(job.impactMargin);
  const profitMarginPercent = job.customerTotal > 0
    ? (impactProfitAmount / job.customerTotal) * 100
    : 0;

  return (
    <div className="border-b border-gray-200 hover:bg-gray-50">
      {/* Main Row */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer overflow-x-auto"
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
        <div className="min-w-[100px] flex-shrink-0">
          <span className="font-semibold text-gray-900 text-sm">{job.jobNo}</span>
        </div>

        {/* Customer PO# */}
        <div className="min-w-[120px] flex-shrink-0">
          <span className="text-sm text-gray-700">{job.customerPONumber || 'N/A'}</span>
        </div>

        {/* Size - Hidden on screens < 1280px */}
        <div className="min-w-[130px] flex-shrink-0 hidden xl:block">
          <span className="text-sm text-gray-700">{job.sizeName || 'N/A'}</span>
        </div>

        {/* Quantity - Hidden on screens < 1280px */}
        <div className="min-w-[90px] flex-shrink-0 text-right hidden xl:block">
          <span className="text-sm text-gray-900">
            {job.quantity?.toLocaleString() || 'N/A'}
          </span>
        </div>

        {/* Impact Charge */}
        <div className="min-w-[110px] flex-shrink-0 text-right">
          <div className="text-xs text-gray-500">Impact Charge</div>
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-gray-900">
              ${job.customerTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {job.customerCPM && (
              <span className="text-xs text-gray-500 font-normal">
                ${Number(job.customerCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
              </span>
            )}
          </div>
        </div>

        {/* Bradford Pay - Hidden on screens < 1024px */}
        <div className="min-w-[110px] flex-shrink-0 text-right hidden lg:block">
          <div className="text-xs text-gray-500">Bradford Pay</div>
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-gray-900">
              ${bradfordPayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {job.bradfordTotalCPM && (
              <span className="text-xs text-gray-500 font-normal">
                ${Number(job.bradfordTotalCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
              </span>
            )}
          </div>
        </div>

        {/* JD Pay - Hidden on screens < 1024px */}
        <div className="min-w-[110px] flex-shrink-0 text-right hidden lg:block">
          <div className="text-xs text-gray-500">JD Pay</div>
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-gray-900">
              ${jdPayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {job.printCPM && (
              <span className="text-xs text-gray-500 font-normal">
                ${Number(job.printCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
              </span>
            )}
          </div>
        </div>

        {/* Impact Profit */}
        <div className="min-w-[110px] flex-shrink-0 text-right">
          <div className="text-xs text-gray-500">Impact Profit</div>
          <span className="text-sm font-semibold text-green-600">
            ${impactProfitAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Profit Margin % */}
        <div className="min-w-[90px] flex-shrink-0 text-right">
          <div className="text-xs text-gray-500">Margin %</div>
          <span className={`text-sm font-semibold ${profitMarginPercent >= 20 ? 'text-green-600' : profitMarginPercent >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
            {profitMarginPercent.toFixed(1)}%
          </span>
        </div>

        {/* Payment Status */}
        <div className="min-w-[130px] flex-shrink-0">
          <div className={`flex items-center gap-2 ${paymentStatus.color}`}>
            {PaymentIcon && <PaymentIcon className="h-4 w-4" />}
            <span className="font-medium text-sm">{paymentStatus.label}</span>
          </div>
        </div>

        {/* Document Counts - Hidden on screens < 1280px */}
        <div className="flex items-center gap-3 min-w-[100px] flex-shrink-0 hidden xl:flex">
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
          {/* Pricing Breakdown Section */}
          <div className="ml-9 mb-6">
            <PricingBreakdown job={job} userRole="BROKER_ADMIN" />
          </div>

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

          {/* Action Buttons */}
          <div className="mt-4 ml-9 flex gap-3">
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditModalOpen(true);
                }}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Job
              </button>
            )}
            {onViewJob && (
              <button
                onClick={() => onViewJob(job.id)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
              >
                View Full Job Details
              </button>
            )}
          </div>
        </div>
      )}

      {/* Job Edit Modal */}
      {isEditModalOpen && (
        <JobEditModal
          job={job}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={async () => {
            console.log('[JobFinancialRow] Reloading data after save...');
            if (onReloadData) {
              await onReloadData();
            }
            console.log('[JobFinancialRow] Data reloaded successfully');
          }}
        />
      )}
    </div>
  );
}
