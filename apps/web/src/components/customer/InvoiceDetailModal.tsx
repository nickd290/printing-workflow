'use client';

import React from 'react';
import { Card, Badge, Button } from '@/components/ui';

export interface InvoiceDetailModalProps {
  invoice: {
    id: string;
    invoiceNo: string;
    jobNo: string;
    jobId: string | null;
    toCompany?: string;
    fromCompany?: string;
    amount: number;
    issuedAt: string | null;
    dueAt: string | null;
    paidAt: string | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onDownloadPDF: (invoice: any) => void;
  onViewJob?: (jobId: string) => void;
}

export function InvoiceDetailModal({
  invoice,
  isOpen,
  onClose,
  onDownloadPDF,
  onViewJob,
}: InvoiceDetailModalProps) {
  if (!isOpen || !invoice) return null;

  // Determine status
  const getStatus = () => {
    if (invoice.paidAt) return 'paid';
    if (invoice.dueAt && new Date(invoice.dueAt) < new Date()) return 'overdue';
    return 'unpaid';
  };

  const status = getStatus();

  const statusConfig = {
    paid: { label: 'Paid', variant: 'success' as const, icon: '✓' },
    overdue: { label: 'Overdue', variant: 'danger' as const, icon: '!' },
    unpaid: { label: 'Unpaid', variant: 'warning' as const, icon: '⏱' },
  };

  const config = statusConfig[status];

  // Calculate days until/past due
  const getDaysInfo = () => {
    if (!invoice.dueAt) return null;
    const dueDate = new Date(invoice.dueAt);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return { type: 'until', days: diffDays };
    } else if (diffDays < 0) {
      return { type: 'past', days: Math.abs(diffDays) };
    }
    return { type: 'today', days: 0 };
  };

  const daysInfo = getDaysInfo();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground mb-1">
              {invoice.invoiceNo}
            </h2>
            <p className="text-sm text-muted-foreground">
              Invoice Details
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={config.variant} icon={<span>{config.icon}</span>}>
              {config.label}
            </Badge>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <svg
                className="w-5 h-5 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Amount Section */}
          <Card>
            <div className="p-6">
              <div className="text-sm text-muted-foreground mb-2">Total Amount</div>
              <div className="text-4xl font-bold text-foreground">
                ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </Card>

          {/* Payment Status */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Payment Status
              </h3>
              <div className="space-y-4">
                {status === 'paid' && invoice.paidAt ? (
                  <div className="gradient-success rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg
                        className="w-5 h-5 text-success"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="font-semibold text-success">Payment Received</span>
                    </div>
                    <p className="text-sm text-foreground">
                      Paid on {new Date(invoice.paidAt).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                ) : status === 'overdue' ? (
                  <div className="gradient-danger rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg
                        className="w-5 h-5 text-danger"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="font-semibold text-danger">Payment Overdue</span>
                    </div>
                    <p className="text-sm text-foreground">
                      {daysInfo && daysInfo.type === 'past' && (
                        <>Overdue by {daysInfo.days} {daysInfo.days === 1 ? 'day' : 'days'}</>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="gradient-warning rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg
                        className="w-5 h-5 text-warning"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="font-semibold text-warning">Payment Pending</span>
                    </div>
                    <p className="text-sm text-foreground">
                      {daysInfo && daysInfo.type === 'until' && (
                        <>Due in {daysInfo.days} {daysInfo.days === 1 ? 'day' : 'days'}</>
                      )}
                      {daysInfo && daysInfo.type === 'today' && <>Due today</>}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Invoice Information */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Invoice Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Job Number</div>
                  <div className="text-sm font-medium text-foreground">{invoice.jobNo}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Invoice Number</div>
                  <div className="text-sm font-medium text-foreground">{invoice.invoiceNo}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Issued Date</div>
                  <div className="text-sm font-medium text-foreground">
                    {invoice.issuedAt
                      ? new Date(invoice.issuedAt).toLocaleDateString()
                      : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Due Date</div>
                  <div className="text-sm font-medium text-foreground">
                    {invoice.dueAt
                      ? new Date(invoice.dueAt).toLocaleDateString()
                      : '-'}
                  </div>
                </div>
                {invoice.fromCompany && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">From</div>
                    <div className="text-sm font-medium text-foreground">{invoice.fromCompany}</div>
                  </div>
                )}
                {invoice.toCompany && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">To</div>
                    <div className="text-sm font-medium text-foreground">{invoice.toCompany}</div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 p-6 border-t border-border">
          {invoice.jobId && onViewJob && (
            <Button
              variant="secondary"
              onClick={() => {
                onViewJob(invoice.jobId!);
                onClose();
              }}
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              }
            >
              View Job
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => onDownloadPDF(invoice)}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
          >
            Download PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
