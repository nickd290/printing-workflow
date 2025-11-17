'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { useUser } from '@/contexts/UserContext';
import { InvoiceCard } from '@/components/customer/InvoiceCard';
import { InvoiceTable } from '@/components/customer/InvoiceTable';
import { InvoiceDetailModal } from '@/components/customer/InvoiceDetailModal';
import { JobDetailModal } from '@/components/JobDetailModal';
import { MetricCard, Button, CardSkeleton, TableSkeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Invoice {
  id: string;
  invoiceNo: string;
  jobNo: string;
  jobId: string | null;
  toCompany?: string;
  fromCompany?: string;
  toCompanyId: string;
  fromCompanyId: string;
  amount: number;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
}

export default function InvoicesPage() {
  const router = useRouter();
  const { user, isCustomer, loading: authLoading } = useUser();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'all' | '30' | '60' | '90' | 'year'>('all');

  // Auth check
  useEffect(() => {
    if (!authLoading && (!user || !isCustomer)) {
      router.push('/login');
    }
  }, [user, isCustomer, authLoading, router]);

  // Load invoices
  useEffect(() => {
    if (user && isCustomer) {
      fetchInvoices();
    }
  }, [user, isCustomer]);

  const fetchInvoices = async () => {
    if (!user?.companyId) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/invoices?toCompanyId=${user.companyId}`);
      if (!response.ok) throw new Error('Failed to fetch invoices');

      const data = await response.json();

      const transformedInvoices = data.invoices.map((inv: any) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        jobNo: inv.job?.jobNo || 'N/A',
        jobId: inv.jobId || null,
        toCompany: inv.toCompany?.name || 'Unknown',
        fromCompany: inv.fromCompany?.name || 'Unknown',
        toCompanyId: inv.toCompanyId,
        fromCompanyId: inv.fromCompanyId,
        amount: parseFloat(inv.amount.toString()),
        issuedAt: inv.issuedAt,
        dueAt: inv.dueAt,
        paidAt: inv.paidAt,
      }));

      setInvoices(transformedInvoices);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  // Get invoice status
  const getInvoiceStatus = (invoice: Invoice) => {
    if (invoice.paidAt) return 'paid';
    if (invoice.dueAt && new Date(invoice.dueAt) < new Date()) return 'overdue';
    return 'unpaid';
  };

  // Filter and search invoices
  const filteredInvoices = useMemo(() => {
    let result = [...invoices];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((inv) => getInvoiceStatus(inv) === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.invoiceNo.toLowerCase().includes(query) ||
          inv.jobNo.toLowerCase().includes(query) ||
          inv.amount.toString().includes(query)
      );
    }

    // Date range filter
    if (dateRange !== 'all') {
      const days = {
        '30': 30,
        '60': 60,
        '90': 90,
        'year': 365,
      }[dateRange];

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      result = result.filter((inv) => {
        if (!inv.issuedAt) return false;
        return new Date(inv.issuedAt) >= cutoffDate;
      });
    }

    return result;
  }, [invoices, statusFilter, searchQuery, dateRange]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const paid = invoices
      .filter((inv) => inv.paidAt)
      .reduce((sum, inv) => sum + inv.amount, 0);
    const outstanding = total - paid;

    return { total, paid, outstanding };
  }, [invoices]);

  // Handle PDF download
  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      toast.loading('Downloading invoice PDF...', { id: 'download-pdf' });
      const response = await fetch(`${API_URL}/api/invoices/${invoice.id}/pdf`);

      if (!response.ok) throw new Error('Failed to download PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.invoiceNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('PDF downloaded successfully!', { id: 'download-pdf' });
    } catch (error) {
      console.error('Failed to download PDF:', error);
      toast.error('Failed to download PDF', { id: 'download-pdf' });
    }
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="spinner h-12 w-12 mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCustomer) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground tracking-tight mb-2">
            My Invoices
          </h1>
          <p className="text-muted-foreground">View and download your invoices</p>
        </div>

        {/* Summary Stats */}
        {!loading && invoices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <MetricCard
              title="Total Invoiced"
              value={`$${stats.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              variant="info"
              icon={
                <svg className="w-6 h-6 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              }
            />
            <MetricCard
              title="Paid"
              value={`$${stats.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              variant="success"
              icon={
                <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
            />
            <MetricCard
              title="Outstanding"
              value={`$${stats.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              variant="warning"
              icon={
                <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />
          </div>
        )}

        {/* Filters and View Toggle */}
        {!loading && invoices.length > 0 && (
          <div className="card p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by Invoice #, Job #, or Amount..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input w-full"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="input w-full lg:w-48"
              >
                <option value="all">All Statuses</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>

              {/* Date Range */}
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="input w-full lg:w-48"
              >
                <option value="all">All Time</option>
                <option value="30">Last 30 Days</option>
                <option value="60">Last 60 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="year">Last Year</option>
              </select>

              {/* View Toggle */}
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'card' ? 'primary' : 'ghost'}
                  size="md"
                  onClick={() => setViewMode('card')}
                  title="Card View"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'primary' : 'ghost'}
                  size="md"
                  onClick={() => setViewMode('table')}
                  title="Table View"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </Button>
              </div>
            </div>

            {/* Results count */}
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredInvoices.length} of {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="card p-6">
              <TableSkeleton rows={8} columns={7} />
            </div>
          )
        ) : invoices.length === 0 ? (
          <div className="empty-state card p-12">
            <svg
              className="mx-auto h-16 w-16 text-muted-foreground mb-4"
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
            <p className="text-lg font-medium text-foreground mb-2">No invoices yet</p>
            <p className="text-sm text-muted-foreground">
              Your invoices will appear here once jobs are completed
            </p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="empty-state card p-12">
            <svg
              className="mx-auto h-16 w-16 text-muted-foreground mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="text-lg font-medium text-foreground mb-2">No results found</p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters or search query
            </p>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredInvoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                onDownloadPDF={handleDownloadPDF}
                onViewDetails={(inv) => setSelectedInvoice(inv)}
                onViewJob={(jobId) => setSelectedJobId(jobId)}
              />
            ))}
          </div>
        ) : (
          <InvoiceTable
            invoices={filteredInvoices}
            onDownloadPDF={handleDownloadPDF}
            onViewDetails={(inv) => setSelectedInvoice(inv)}
            onViewJob={(jobId) => setSelectedJobId(jobId)}
          />
        )}
      </div>

      {/* Invoice Detail Modal */}
      <InvoiceDetailModal
        invoice={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onDownloadPDF={handleDownloadPDF}
        onViewJob={(jobId) => {
          setSelectedInvoice(null);
          setSelectedJobId(jobId);
        }}
      />

      {/* Job Detail Modal */}
      {selectedJobId && (
        <JobDetailModal
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}
    </div>
  );
}
