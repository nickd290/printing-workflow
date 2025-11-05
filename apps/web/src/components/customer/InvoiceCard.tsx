'use client';

import React from 'react';
import { Card, Badge, Button } from '@/components/ui';

export interface InvoiceCardProps {
  invoice: {
    id: string;
    invoiceNo: string;
    jobNo: string;
    jobId: string | null;
    amount: number;
    issuedAt: string | null;
    dueAt: string | null;
    paidAt: string | null;
  };
  onDownloadPDF: (invoice: any) => void;
  onViewDetails: (invoice: any) => void;
  onViewJob?: (jobId: string) => void;
}

export function InvoiceCard({
  invoice,
  onDownloadPDF,
  onViewDetails,
  onViewJob,
}: InvoiceCardProps) {
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

  return (
    <Card
      variant="hover"
      className={`transition-smooth ${
        status === 'overdue' ? 'gradient-danger' : ''
      }`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-lg font-bold text-foreground">
                {invoice.invoiceNo}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Job: {invoice.jobNo}
            </p>
          </div>
          <Badge variant={config.variant} icon={<span>{config.icon}</span>}>
            {config.label}
          </Badge>
        </div>

        {/* Amount */}
        <div className="mb-6">
          <div className="text-3xl font-bold text-foreground tracking-tight">
            ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Dates */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center gap-2 text-sm">
            <svg
              className="w-4 h-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-muted-foreground">Issued:</span>
            <span className="text-foreground font-medium">
              {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : '-'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <svg
              className="w-4 h-4 text-muted-foreground"
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
            <span className="text-muted-foreground">Due:</span>
            <span className="text-foreground font-medium">
              {invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString() : '-'}
            </span>
          </div>
          {invoice.paidAt && (
            <div className="flex items-center gap-2 text-sm">
              <svg
                className="w-4 h-4 text-success"
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
              <span className="text-muted-foreground">Paid:</span>
              <span className="text-success font-medium">
                {new Date(invoice.paidAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
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
            PDF
          </Button>
          {invoice.jobId && onViewJob && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewJob(invoice.jobId!)}
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
              Job
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onViewDetails(invoice)}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          >
            Details
          </Button>
        </div>
      </div>
    </Card>
  );
}
