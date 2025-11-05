'use client';

import React, { useState } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, Badge, Button } from '@/components/ui';

export interface InvoiceTableProps {
  invoices: Array<{
    id: string;
    invoiceNo: string;
    jobNo: string;
    jobId: string | null;
    amount: number;
    issuedAt: string | null;
    dueAt: string | null;
    paidAt: string | null;
  }>;
  onDownloadPDF: (invoice: any) => void;
  onViewDetails: (invoice: any) => void;
  onViewJob?: (jobId: string) => void;
}

export function InvoiceTable({
  invoices,
  onDownloadPDF,
  onViewDetails,
  onViewJob,
}: InvoiceTableProps) {
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  // Determine status
  const getStatus = (invoice: any) => {
    if (invoice.paidAt) return 'paid';
    if (invoice.dueAt && new Date(invoice.dueAt) < new Date()) return 'overdue';
    return 'unpaid';
  };

  const statusConfig = {
    paid: { label: 'Paid', variant: 'success' as const },
    overdue: { label: 'Overdue', variant: 'danger' as const },
    unpaid: { label: 'Unpaid', variant: 'warning' as const },
  };

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc');
      if (sortDirection === 'desc') setSortField(null);
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort invoices
  const sortedInvoices = [...invoices].sort((a, b) => {
    if (!sortField || !sortDirection) return 0;

    let aVal: any;
    let bVal: any;

    if (sortField === 'invoiceNo' || sortField === 'jobNo') {
      aVal = a[sortField] || '';
      bVal = b[sortField] || '';
    } else if (sortField === 'amount') {
      aVal = a.amount;
      bVal = b.amount;
    } else if (sortField === 'issuedAt' || sortField === 'dueAt' || sortField === 'paidAt') {
      aVal = a[sortField] ? new Date(a[sortField]!).getTime() : 0;
      bVal = b[sortField] ? new Date(b[sortField]!).getTime() : 0;
    } else if (sortField === 'status') {
      aVal = getStatus(a);
      bVal = getStatus(b);
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="card">
      <Table>
        <TableHeader>
          <TableRow hoverable={false}>
            <TableHead
              sortable
              onSort={() => handleSort('invoiceNo')}
              sorted={sortField === 'invoiceNo' ? sortDirection : null}
            >
              Invoice #
            </TableHead>
            <TableHead
              sortable
              onSort={() => handleSort('jobNo')}
              sorted={sortField === 'jobNo' ? sortDirection : null}
            >
              Job #
            </TableHead>
            <TableHead
              sortable
              onSort={() => handleSort('amount')}
              sorted={sortField === 'amount' ? sortDirection : null}
            >
              Amount
            </TableHead>
            <TableHead
              sortable
              onSort={() => handleSort('issuedAt')}
              sorted={sortField === 'issuedAt' ? sortDirection : null}
            >
              Issued
            </TableHead>
            <TableHead
              sortable
              onSort={() => handleSort('dueAt')}
              sorted={sortField === 'dueAt' ? sortDirection : null}
            >
              Due
            </TableHead>
            <TableHead
              sortable
              onSort={() => handleSort('status')}
              sorted={sortField === 'status' ? sortDirection : null}
            >
              Status
            </TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedInvoices.length === 0 ? (
            <TableEmpty colSpan={7}>
              <svg
                className="mx-auto h-12 w-12 text-muted-foreground"
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
              <p className="text-foreground font-medium mt-2">No invoices found</p>
              <p className="text-muted-foreground text-sm">
                Your invoices will appear here once jobs are completed
              </p>
            </TableEmpty>
          ) : (
            sortedInvoices.map((invoice) => {
              const status = getStatus(invoice);
              const config = statusConfig[status];

              return (
                <TableRow key={invoice.id} onClick={() => onViewDetails(invoice)}>
                  <TableCell>
                    <div className="font-medium text-foreground">{invoice.invoiceNo}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-muted-foreground">{invoice.jobNo}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-foreground">
                      ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground">
                      {invoice.issuedAt
                        ? new Date(invoice.issuedAt).toLocaleDateString()
                        : '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground">
                      {invoice.dueAt
                        ? new Date(invoice.dueAt).toLocaleDateString()
                        : '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownloadPDF(invoice)}
                        title="Download PDF"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </Button>
                      {invoice.jobId && onViewJob && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewJob(invoice.jobId!)}
                          title="View Job"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
