'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ModalType = 'job' | 'purchaseOrder' | 'invoice';

interface BaseData {
  id: string;
}

interface JobData extends BaseData {
  jobNo: string;
  customerPONumber?: string;
  status: string;
  customerTotal: string | number;
  customer: { name: string; id: string } | string;
  purchaseOrders?: any[];
  customerPOFile?: string | null;
}

interface PurchaseOrderData extends BaseData {
  jobId?: string | null;
  job?: { jobNo?: string; customerPONumber?: string };
  status: string;
  vendorAmount: string | number;
  pdfUrl?: string | null;
  originCompany: { name: string };
  targetCompany: { name: string };
}

interface InvoiceData extends BaseData {
  invoiceNo: string;
  jobId?: string | null;
  job?: { jobNo?: string; customerPONumber?: string };
  amount: string | number;
  paidAt?: Date | null;
  pdfUrl?: string | null;
  fromCompany: { name: string };
  toCompany?: { name: string };
}

interface FinancialActionModalProps {
  type: ModalType;
  data: JobData | PurchaseOrderData | InvoiceData | null;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (actionType: string, data?: any) => void;
}

export function FinancialActionModal({ type, data, isOpen, onClose, onAction }: FinancialActionModalProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  if (!isOpen || !data) return null;

  const handleAction = async (actionType: string, actionData?: any) => {
    setProcessing(true);
    try {
      if (onAction) {
        await onAction(actionType, actionData);
      }
    } finally {
      setProcessing(false);
    }
  };

  const renderJobActions = (jobData: JobData) => {
    const customerName = typeof jobData.customer === 'string' ? jobData.customer : jobData.customer.name;

    return (
      <>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Information</h3>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Job Number</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">{jobData.jobNo}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer PO#</dt>
              <dd className="mt-1 text-sm text-gray-900">{jobData.customerPONumber || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer</dt>
              <dd className="mt-1 text-sm text-gray-900">{customerName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {jobData.status.replace(/_/g, ' ')}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Total Amount</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                ${Number(jobData.customerTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </dd>
            </div>
            {jobData.purchaseOrders && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Purchase Orders</dt>
                <dd className="mt-1 text-sm text-gray-900">{jobData.purchaseOrders.length} PO(s)</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                router.push(`/jobs/${jobData.jobNo}`);
                onClose();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors text-sm"
            >
              View Job Details
            </button>

            {jobData.customerPOFile && (
              <button
                onClick={() => handleAction('download-customer-po', { url: jobData.customerPOFile })}
                disabled={processing}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium transition-colors text-sm disabled:opacity-50"
              >
                Download Customer PO
              </button>
            )}

            <button
              onClick={() => handleAction('export-job', jobData)}
              disabled={processing}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium transition-colors text-sm disabled:opacity-50"
            >
              Export Job Data
            </button>

            {jobData.purchaseOrders && jobData.purchaseOrders.length > 0 && (
              <button
                onClick={() => handleAction('view-pos', jobData)}
                disabled={processing}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium transition-colors text-sm disabled:opacity-50"
              >
                View Purchase Orders
              </button>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderPurchaseOrderActions = (poData: PurchaseOrderData) => {
    return (
      <>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase Order Information</h3>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">PO ID</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">PO-{poData.id.slice(0, 8)}</dd>
            </div>
            {poData.job?.jobNo && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Job Number</dt>
                <dd className="mt-1 text-sm text-blue-600 font-medium">{poData.job.jobNo}</dd>
              </div>
            )}
            {poData.job?.customerPONumber && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Customer PO#</dt>
                <dd className="mt-1 text-sm text-gray-900">{poData.job.customerPONumber}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">From</dt>
              <dd className="mt-1 text-sm text-gray-900">{poData.originCompany.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">To</dt>
              <dd className="mt-1 text-sm text-gray-900">{poData.targetCompany.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Amount</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                ${Number(poData.vendorAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {poData.status}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {poData.job?.jobNo && (
              <button
                onClick={() => {
                  router.push(`/jobs/${poData.job?.jobNo}`);
                  onClose();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors text-sm"
              >
                View Job Details
              </button>
            )}

            {poData.pdfUrl && (
              <button
                onClick={() => handleAction('download-po-pdf', { url: poData.pdfUrl })}
                disabled={processing}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium transition-colors text-sm disabled:opacity-50"
              >
                Download PO PDF
              </button>
            )}

            <button
              onClick={() => handleAction('update-po-status', poData)}
              disabled={processing}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium transition-colors text-sm disabled:opacity-50"
            >
              Update Status
            </button>

            <button
              onClick={() => handleAction('edit-po', poData)}
              disabled={processing}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium transition-colors text-sm disabled:opacity-50"
            >
              Edit PO Details
            </button>
          </div>
        </div>
      </>
    );
  };

  const renderInvoiceActions = (invoiceData: InvoiceData) => {
    return (
      <>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Information</h3>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Invoice Number</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">{invoiceData.invoiceNo}</dd>
            </div>
            {invoiceData.job?.jobNo && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Job Number</dt>
                <dd className="mt-1 text-sm text-blue-600 font-medium">{invoiceData.job.jobNo}</dd>
              </div>
            )}
            {invoiceData.job?.customerPONumber && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Customer PO#</dt>
                <dd className="mt-1 text-sm text-gray-900">{invoiceData.job.customerPONumber}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">From</dt>
              <dd className="mt-1 text-sm text-gray-900">{invoiceData.fromCompany.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">To</dt>
              <dd className="mt-1 text-sm text-gray-900">{invoiceData.toCompany?.name || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Amount</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                ${Number(invoiceData.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Payment Status</dt>
              <dd className="mt-1">
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                  invoiceData.paidAt ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {invoiceData.paidAt ? 'PAID' : 'UNPAID'}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {invoiceData.job?.jobNo && (
              <button
                onClick={() => {
                  router.push(`/jobs/${invoiceData.job?.jobNo}`);
                  onClose();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors text-sm"
              >
                View Job Details
              </button>
            )}

            {invoiceData.pdfUrl ? (
              <button
                onClick={() => handleAction('download-invoice-pdf', { url: invoiceData.pdfUrl })}
                disabled={processing}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium transition-colors text-sm disabled:opacity-50"
              >
                Download Invoice PDF
              </button>
            ) : (
              <button
                onClick={() => handleAction('generate-invoice-pdf', invoiceData)}
                disabled={processing}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium transition-colors text-sm disabled:opacity-50"
              >
                Generate PDF
              </button>
            )}

            {!invoiceData.paidAt && (
              <button
                onClick={() => handleAction('mark-paid', invoiceData)}
                disabled={processing}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium transition-colors text-sm disabled:opacity-50"
              >
                Mark as Paid
              </button>
            )}

            <button
              onClick={() => handleAction('edit-invoice', invoiceData)}
              disabled={processing}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium transition-colors text-sm disabled:opacity-50"
            >
              Edit Invoice
            </button>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {type === 'job' && 'Job Actions'}
            {type === 'purchaseOrder' && 'Purchase Order Actions'}
            {type === 'invoice' && 'Invoice Actions'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {type === 'job' && renderJobActions(data as JobData)}
          {type === 'purchaseOrder' && renderPurchaseOrderActions(data as PurchaseOrderData)}
          {type === 'invoice' && renderInvoiceActions(data as InvoiceData)}
        </div>
      </div>
    </div>
  );
}
