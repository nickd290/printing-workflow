import React from 'react';
import { Button } from './Button';
import {
  NoJobsIllustration,
  NoFilesIllustration,
  NoProofsIllustration,
  NoSearchResultsIllustration,
  ErrorIllustration,
} from './EmptyStateIllustrations';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`}>
      {illustration && (
        <div className="mb-6 text-muted-foreground/40 flex justify-center">
          {illustration}
        </div>
      )}
      {!illustration && icon && (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant="primary"
          className="mt-6"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Specific empty states for common scenarios with modern illustrations
export function NoJobsFound({ onCreateJob }: { onCreateJob?: () => void }) {
  return (
    <EmptyState
      illustration={<NoJobsIllustration className="text-muted-foreground" />}
      title="No jobs found"
      description="Get started by creating your first print job or adjust your search filters."
      action={onCreateJob ? {
        label: 'Create Job',
        onClick: onCreateJob,
      } : undefined}
    />
  );
}

export function NoFilesFound({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyState
      illustration={<NoFilesIllustration className="text-muted-foreground" />}
      title="No files uploaded"
      description="Upload artwork files to get started with this job."
      action={onUpload ? {
        label: 'Upload Files',
        onClick: onUpload,
      } : undefined}
    />
  );
}

export function NoProofsFound({ onUploadProof }: { onUploadProof?: () => void }) {
  return (
    <EmptyState
      illustration={<NoProofsIllustration className="text-muted-foreground" />}
      title="No proofs uploaded"
      description="Upload a proof for customer review and approval."
      action={onUploadProof ? {
        label: 'Upload Proof',
        onClick: onUploadProof,
      } : undefined}
    />
  );
}

export function SearchNoResults({ query }: { query: string }) {
  return (
    <EmptyState
      illustration={<NoSearchResultsIllustration className="text-muted-foreground" />}
      title="No results found"
      description={`We couldn't find anything matching "${query}". Try adjusting your search.`}
    />
  );
}

export function GenericError({
  title = 'Something went wrong',
  description = 'An error occurred while loading this content. Please try again.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      illustration={<ErrorIllustration className="text-danger" />}
      title={title}
      description={description}
      action={onRetry ? {
        label: 'Try Again',
        onClick: onRetry,
      } : undefined}
    />
  );
}
