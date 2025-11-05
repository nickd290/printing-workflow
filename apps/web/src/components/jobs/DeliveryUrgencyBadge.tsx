'use client';

interface DeliveryUrgencyBadgeProps {
  deliveryDate: string | null | undefined;
  completedAt?: string | null;
  className?: string;
}

export function DeliveryUrgencyBadge({ deliveryDate, completedAt, className = '' }: DeliveryUrgencyBadgeProps) {
  if (!deliveryDate || completedAt) {
    return null; // Don't show if no delivery date or job is completed
  }

  const now = new Date();
  const delivery = new Date(deliveryDate);
  const daysUntil = Math.ceil((delivery.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Determine urgency level
  let urgency: 'late' | 'urgent' | 'warning' | 'normal';
  let bgColor: string;
  let textColor: string;
  let borderColor: string;
  let icon: JSX.Element;

  if (daysUntil < 0) {
    // LATE (overdue)
    urgency = 'late';
    bgColor = 'bg-red-100';
    textColor = 'text-red-800';
    borderColor = 'border-red-300';
    icon = (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    );
  } else if (daysUntil <= 2) {
    // URGENT (0-2 days)
    urgency = 'urgent';
    bgColor = 'bg-red-100';
    textColor = 'text-red-800';
    borderColor = 'border-red-300';
    icon = (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  } else if (daysUntil <= 7) {
    // WARNING (3-7 days)
    urgency = 'warning';
    bgColor = 'bg-yellow-100';
    textColor = 'text-yellow-800';
    borderColor = 'border-yellow-300';
    icon = (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
    );
  } else {
    // NORMAL (8+ days)
    urgency = 'normal';
    bgColor = 'bg-green-100';
    textColor = 'text-green-800';
    borderColor = 'border-green-300';
    icon = (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  }

  // Format the message
  let message: string;
  if (daysUntil < 0) {
    const daysLate = Math.abs(daysUntil);
    message = `${daysLate} day${daysLate === 1 ? '' : 's'} overdue`;
  } else if (daysUntil === 0) {
    message = 'Due today';
  } else if (daysUntil === 1) {
    message = 'Due tomorrow';
  } else {
    message = `${daysUntil} days until delivery`;
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border ${bgColor} ${textColor} ${borderColor} ${className}`}
      title={`Delivery date: ${delivery.toLocaleDateString()}`}
    >
      {icon}
      <span className="text-xs font-semibold whitespace-nowrap">{message}</span>
    </div>
  );
}

// Helper function to get urgency level (for sorting/filtering)
export function getDeliveryUrgency(deliveryDate: string | null | undefined, completedAt?: string | null): number {
  if (!deliveryDate || completedAt) return 999; // Not urgent if no date or completed

  const now = new Date();
  const delivery = new Date(deliveryDate);
  const daysUntil = Math.ceil((delivery.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return -1; // Late (highest priority)
  if (daysUntil <= 2) return 0;  // Urgent
  if (daysUntil <= 7) return 1;  // Warning
  return 2; // Normal
}
