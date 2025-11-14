'use client';

import Link from 'next/link';
import { useState } from 'react';

interface Job {
  id: string;
  jobNo: string;
  customerPONumber?: string;
  customer: { name: string } | string;
  sizeName?: string;
  quantity?: number;
  customerTotal: number;
  customerCPM?: number;
  bradfordPrintMargin?: number;
  bradfordPaperMargin?: number;
  bradfordTotalMargin?: number;
  status: string;
  createdAt: string;
}

interface GroupedJobsTableProps {
  jobs: Job[];
  isInternalTeam: boolean;
}

interface CustomerGroup {
  customerName: string;
  jobs: Job[];
  totalValue: number;
  totalMargin: number;
}

export function GroupedJobsTable({ jobs, isInternalTeam }: GroupedJobsTableProps) {
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  const getCustomerName = (customer: Job['customer']): string => {
    if (typeof customer === 'string') return customer;
    return customer?.name || 'Unknown';
  };

  // Group jobs by customer
  const customerGroups: CustomerGroup[] = Object.values(
    jobs.reduce((acc, job) => {
      const customerName = getCustomerName(job.customer);
      if (!acc[customerName]) {
        acc[customerName] = {
          customerName,
          jobs: [],
          totalValue: 0,
          totalMargin: 0,
        };
      }
      acc[customerName].jobs.push(job);
      acc[customerName].totalValue += Number(job.customerTotal);
      acc[customerName].totalMargin += Number(job.bradfordTotalMargin || 0);
      return acc;
    }, {} as Record<string, CustomerGroup>)
  ).sort((a, b) => a.customerName.localeCompare(b.customerName));

  const toggleCustomer = (customerName: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerName)) {
      newExpanded.delete(customerName);
    } else {
      newExpanded.add(customerName);
    }
    setExpandedCustomers(newExpanded);
  };

  const toggleAll = () => {
    if (expandedCustomers.size === customerGroups.length) {
      setExpandedCustomers(new Set());
    } else {
      setExpandedCustomers(new Set(customerGroups.map(g => g.customerName)));
    }
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Jobs Grouped by Customer</h2>
        <button
          onClick={toggleAll}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {expandedCustomers.size === customerGroups.length ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <div className="divide-y divide-gray-200">
        {customerGroups.map((group) => {
          const isExpanded = expandedCustomers.has(group.customerName);

          return (
            <div key={group.customerName} className="border-b border-gray-200 last:border-b-0">
              {/* Customer Header */}
              <button
                onClick={() => toggleCustomer(group.customerName)}
                className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900">{group.customerName}</h3>
                    <p className="text-sm text-gray-600">
                      {group.jobs.length} {group.jobs.length === 1 ? 'job' : 'jobs'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total Value</p>
                    <p className="text-lg font-bold text-gray-900">${group.totalValue.toFixed(2)}</p>
                  </div>
                  {isInternalTeam && group.totalMargin > 0 && (
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total Margin</p>
                      <p className="text-lg font-bold text-green-600">${group.totalMargin.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </button>

              {/* Jobs Table */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer PO#
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Job No
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Size
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Qty
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        {isInternalTeam && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Margin Breakdown
                          </th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {group.jobs.map((job) => (
                        <tr key={job.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                            {job.customerPONumber || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <Link href={`/jobs/${job.id}`}>{job.jobNo}</Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {job.sizeName || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {job.quantity ? job.quantity.toLocaleString() : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex flex-col">
                              <span>${Number(job.customerTotal).toFixed(2)}</span>
                              {job.customerCPM && (
                                <span className="text-xs text-gray-500 font-normal">
                                  ${Number(job.customerCPM).toFixed(2)}/M
                                </span>
                              )}
                            </div>
                          </td>
                          {isInternalTeam && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {job.bradfordTotalMargin ? (
                                <div className="text-gray-700">
                                  <div className="font-semibold text-green-700">
                                    ${Number(job.bradfordTotalMargin).toFixed(2)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Print: ${Number(job.bradfordPrintMargin || 0).toFixed(2)} | Paper: ${Number(job.bradfordPaperMargin || 0).toFixed(2)}
                                  </div>
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {job.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(job.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <Link href={`/jobs/${job.id}`} className="text-blue-600 hover:text-blue-900">
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {customerGroups.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No jobs found
        </div>
      )}
    </div>
  );
}
