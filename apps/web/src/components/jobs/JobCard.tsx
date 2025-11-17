'use client';

import React from 'react';
import { StatusBadge } from '../ui/Badge';

export interface JobCardProps {
  job: {
    id: string;
    jobNo: string;
    customerPONumber?: string | null;
    customer?: { name: string } | string;
    sizeName?: string | null;
    quantity?: number | null;
    customerTotal?: number | null;
    customerCPM?: number | null;
    bradfordTotal?: number | null;
    bradfordTotalCPM?: number | null;
    bradfordTotalMargin?: number | null;
    impactMargin?: number | null;
    impactMarginCPM?: number | null;
    jdTotal?: number | null;
    printCPM?: number | null;
    paperCostTotal?: number | null;
    paperCostCPM?: number | null;
    paperWeightTotal?: number | null;
    status: string;
    createdAt?: string | Date;
  };
  onClick?: () => void;
  variant?: 'bradford' | 'impact';
}

export function JobCard({ job, onClick, variant = 'bradford' }: JobCardProps) {
  // Determine status color for border
  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'border-l-success';
      case 'IN_PRODUCTION':
        return 'border-l-info';
      case 'PENDING':
        return 'border-l-warning';
      case 'CANCELLED':
        return 'border-l-danger';
      default:
        return 'border-l-muted-foreground';
    }
  };

  // Determine urgency/late status (mock - you can add real logic)
  const isLate = false; // TODO: Add real late detection logic
  const isUrgent = false; // TODO: Add real urgency detection logic

  const customerName = typeof job.customer === 'string'
    ? job.customer
    : job.customer?.name || 'Unknown Customer';

  return (
    <div
      onClick={onClick}
      className={`
        group relative bg-card border border-border rounded-lg p-5
        cursor-pointer transition-all duration-200 hover:shadow-lg
        hover:-translate-y-1 border-l-4 ${getStatusBorderColor(job.status)}
        ${isLate ? 'ring-2 ring-danger ring-opacity-50' : ''}
        ${isUrgent ? 'ring-2 ring-warning ring-opacity-50' : ''}
      `}
    >
      {/* Header: Customer & PO */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground truncate">
            {customerName}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-primary font-medium">
              {job.customerPONumber || '—'}
            </span>
            <span className="text-xs text-data-label">•</span>
            <span className="text-xs text-foreground font-semibold">
              Job: {job.jobNo}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="ml-3">
          <StatusBadge status={job.status} />
        </div>
      </div>

      {/* Product Details */}
      <div className="grid grid-cols-2 gap-2 mb-4 pb-4 border-b border-border">
        <div>
          <p className="text-xs text-data-label uppercase tracking-wide">Size</p>
          <p className="text-sm font-medium text-foreground mt-0.5">
            {job.sizeName || '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-data-label uppercase tracking-wide">Quantity</p>
          <p className="text-sm font-medium text-foreground mt-0.5">
            {job.quantity ? Number(job.quantity).toLocaleString('en-US') : '—'}
          </p>
        </div>
      </div>

      {/* Financial Information */}
      {variant === 'bradford' ? (
        <div className="grid grid-cols-2 gap-3">
          {/* Customer Total */}
          <div>
            <p className="text-xs text-data-label uppercase tracking-wide mb-1">Customer Total</p>
            <p className="text-lg font-bold text-primary">
              ${job.customerTotal ? Number(job.customerTotal).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
            </p>
            {job.customerCPM && (
              <p className="text-xs text-data-label">
                ${Number(job.customerCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
              </p>
            )}
          </div>

          {/* Margin */}
          <div>
            <p className="text-xs text-data-label uppercase tracking-wide mb-1">Margin</p>
            <p className="text-lg font-bold text-success">
              ${job.bradfordTotalMargin ? Number(job.bradfordTotalMargin).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {/* Revenue */}
          <div>
            <p className="text-xs text-data-label uppercase tracking-wide mb-1">Revenue</p>
            <p className="text-lg font-bold text-primary">
              ${job.customerTotal ? Number(job.customerTotal).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
            </p>
            {job.customerCPM && (
              <p className="text-xs text-data-label">
                ${Number(job.customerCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
              </p>
            )}
          </div>

          {/* Impact Margin */}
          <div>
            <p className="text-xs text-data-label uppercase tracking-wide mb-1">Impact Margin</p>
            <p className="text-lg font-bold text-success">
              ${job.impactMargin ? Number(job.impactMargin).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
            </p>
            {job.impactMarginCPM && (
              <p className="text-xs text-data-label">
                ${Number(job.impactMarginCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
              </p>
            )}
          </div>
        </div>
      )}

      {/* Date (footer) */}
      {job.createdAt && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <p className="text-xs text-data-label">
            Created {new Date(job.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </p>
        </div>
      )}

      {/* Hover Indicator */}
      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
