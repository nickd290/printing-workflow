import React from 'react';

export interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full border-collapse ${className}`}>
        {children}
      </table>
    </div>
  );
}

export interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function TableHeader({ children, className = '' }: TableHeaderProps) {
  return (
    <thead className={`table-header ${className}`}>
      {children}
    </thead>
  );
}

export interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function TableBody({ children, className = '' }: TableBodyProps) {
  return (
    <tbody className={className}>
      {children}
    </tbody>
  );
}

export interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function TableRow({ children, className = '', onClick, hoverable = true }: TableRowProps) {
  const hoverClass = hoverable ? 'table-row' : 'border-b border-border';
  const clickClass = onClick ? 'cursor-pointer' : '';

  return (
    <tr
      className={`${hoverClass} ${clickClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
  sortable?: boolean;
  onSort?: () => void;
  sorted?: 'asc' | 'desc' | null;
}

export function TableHead({
  children,
  className = '',
  sortable = false,
  onSort,
  sorted = null,
}: TableHeadProps) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider ${
        sortable ? 'cursor-pointer select-none hover:text-foreground' : ''
      } ${className}`}
      onClick={sortable ? onSort : undefined}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortable && (
          <span className="text-muted-foreground">
            {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'}
          </span>
        )}
      </div>
    </th>
  );
}

export interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}

export function TableCell({ children, className = '', colSpan }: TableCellProps) {
  return (
    <td
      className={`px-4 py-3 text-sm text-foreground ${className}`}
      colSpan={colSpan}
    >
      {children}
    </td>
  );
}

// Empty state for tables
export interface TableEmptyProps {
  children: React.ReactNode;
  colSpan: number;
  className?: string;
}

export function TableEmpty({ children, colSpan, className = '' }: TableEmptyProps) {
  return (
    <TableRow hoverable={false}>
      <TableCell colSpan={colSpan} className={`text-center py-12 ${className}`}>
        <div className="empty-state">
          {children}
        </div>
      </TableCell>
    </TableRow>
  );
}

// Pagination component for tables
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  // Show max 7 pages with ellipsis
  const visiblePages = () => {
    if (totalPages <= 7) return pages;

    if (currentPage <= 4) {
      return [...pages.slice(0, 5), '...', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', ...pages.slice(totalPages - 5)];
    }

    return [
      1,
      '...',
      currentPage - 1,
      currentPage,
      currentPage + 1,
      '...',
      totalPages,
    ];
  };

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <p className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="btn btn-ghost px-3 py-1 text-sm"
        >
          Previous
        </button>

        {visiblePages().map((page, index) => (
          <React.Fragment key={index}>
            {page === '...' ? (
              <span className="px-2 text-muted-foreground">...</span>
            ) : (
              <button
                onClick={() => onPageChange(page as number)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  currentPage === page
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                {page}
              </button>
            )}
          </React.Fragment>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="btn btn-ghost px-3 py-1 text-sm"
        >
          Next
        </button>
      </div>
    </div>
  );
}
