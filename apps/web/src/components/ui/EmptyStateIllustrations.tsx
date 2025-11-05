import React from 'react';

interface IllustrationProps {
  className?: string;
}

/**
 * Modern minimalist empty state illustrations
 * Designed for clean, professional aesthetic
 */

export const NoJobsIllustration: React.FC<IllustrationProps> = ({ className = '' }) => (
  <svg
    width="200"
    height="200"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Stacked documents with minimalist style */}
    <g opacity="0.15">
      <rect x="60" y="90" width="80" height="60" rx="4" fill="currentColor" />
    </g>
    <g opacity="0.25">
      <rect x="50" y="70" width="100" height="80" rx="4" fill="currentColor" />
    </g>
    <g opacity="0.4">
      <rect x="40" y="50" width="120" height="100" rx="4" fill="currentColor" />
      <line x1="60" y1="70" x2="120" y2="70" stroke="white" strokeWidth="2" opacity="0.5" />
      <line x1="60" y1="85" x2="140" y2="85" stroke="white" strokeWidth="2" opacity="0.5" />
      <line x1="60" y1="100" x2="110" y2="100" stroke="white" strokeWidth="2" opacity="0.5" />
    </g>
  </svg>
);

export const NoFilesIllustration: React.FC<IllustrationProps> = ({ className = '' }) => (
  <svg
    width="200"
    height="200"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Minimalist folder */}
    <g opacity="0.2">
      <path
        d="M50 80 L50 150 C50 154 52 156 56 156 L144 156 C148 156 150 154 150 150 L150 90 C150 86 148 84 144 84 L100 84 L90 74 L56 74 C52 74 50 76 50 80 Z"
        fill="currentColor"
      />
    </g>
    <g opacity="0.4">
      <path
        d="M40 70 L40 140 C40 144 42 146 46 146 L134 146 C138 146 140 144 140 140 L140 80 C140 76 138 74 134 74 L90 74 L80 64 L46 64 C42 64 40 66 40 70 Z"
        fill="currentColor"
      />
    </g>
  </svg>
);

export const NoDataIllustration: React.FC<IllustrationProps> = ({ className = '' }) => (
  <svg
    width="200"
    height="200"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Minimalist chart/graph */}
    <g opacity="0.15">
      <rect x="50" y="100" width="20" height="50" rx="2" fill="currentColor" />
      <rect x="80" y="80" width="20" height="70" rx="2" fill="currentColor" />
      <rect x="110" y="90" width="20" height="60" rx="2" fill="currentColor" />
      <rect x="140" y="70" width="20" height="80" rx="2" fill="currentColor" />
    </g>
    <line x1="40" y1="150" x2="170" y2="150" stroke="currentColor" strokeWidth="2" opacity="0.3" />
    <line x1="40" y1="50" x2="40" y2="150" stroke="currentColor" strokeWidth="2" opacity="0.3" />
  </svg>
);

export const NoInvoicesIllustration: React.FC<IllustrationProps> = ({ className = '' }) => (
  <svg
    width="200"
    height="200"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Minimalist receipt/invoice */}
    <g opacity="0.3">
      <rect x="60" y="40" width="80" height="120" rx="4" fill="currentColor" />
      <line x1="75" y1="60" x2="125" y2="60" stroke="white" strokeWidth="2" opacity="0.6" />
      <line x1="75" y1="75" x2="125" y2="75" stroke="white" strokeWidth="2" opacity="0.6" />
      <line x1="75" y1="90" x2="105" y2="90" stroke="white" strokeWidth="2" opacity="0.6" />
      <line x1="75" y1="110" x2="125" y2="110" stroke="white" strokeWidth="2" opacity="0.8" />
      <line x1="75" y1="125" x2="125" y2="125" stroke="white" strokeWidth="2" opacity="0.8" />
    </g>
  </svg>
);

export const NoSearchResultsIllustration: React.FC<IllustrationProps> = ({ className = '' }) => (
  <svg
    width="200"
    height="200"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Minimalist magnifying glass */}
    <g opacity="0.3">
      <circle cx="85" cy="85" r="35" stroke="currentColor" strokeWidth="6" />
      <line x1="110" y1="110" x2="140" y2="140" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    </g>
    <line x1="75" y1="85" x2="95" y2="85" stroke="currentColor" strokeWidth="3" opacity="0.4" />
    <line x1="85" y1="75" x2="85" y2="95" stroke="currentColor" strokeWidth="3" opacity="0.4" />
  </svg>
);

export const NoProofsIllustration: React.FC<IllustrationProps> = ({ className = '' }) => (
  <svg
    width="200"
    height="200"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Minimalist image placeholder */}
    <g opacity="0.3">
      <rect x="50" y="50" width="100" height="100" rx="8" fill="currentColor" />
      <circle cx="75" cy="80" r="12" fill="white" opacity="0.5" />
      <path d="M50 130 L75 100 L100 120 L125 90 L150 110 L150 150 L50 150 Z" fill="white" opacity="0.3" />
    </g>
  </svg>
);

export const ErrorIllustration: React.FC<IllustrationProps> = ({ className = '' }) => (
  <svg
    width="200"
    height="200"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Minimalist alert triangle */}
    <g opacity="0.3">
      <path
        d="M100 50 L150 140 L50 140 Z"
        stroke="currentColor"
        strokeWidth="4"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <line x1="100" y1="80" x2="100" y2="110" stroke="white" strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="125" r="3" fill="white" />
    </g>
  </svg>
);

export const SuccessIllustration: React.FC<IllustrationProps> = ({ className = '' }) => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Minimalist checkmark in circle */}
    <circle cx="60" cy="60" r="40" stroke="currentColor" strokeWidth="4" opacity="0.3" />
    <path
      d="M40 60 L52 72 L80 44"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.6"
    />
  </svg>
);

export const LoadingIllustration: React.FC<IllustrationProps> = ({ className = '' }) => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} animate-spin`}
  >
    {/* Minimalist loading spinner */}
    <circle
      cx="60"
      cy="60"
      r="40"
      stroke="currentColor"
      strokeWidth="4"
      opacity="0.2"
    />
    <path
      d="M60 20 C82.091 20 100 37.909 100 60"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      opacity="0.8"
    />
  </svg>
);

export default {
  NoJobs: NoJobsIllustration,
  NoFiles: NoFilesIllustration,
  NoData: NoDataIllustration,
  NoInvoices: NoInvoicesIllustration,
  NoSearchResults: NoSearchResultsIllustration,
  NoProofs: NoProofsIllustration,
  Error: ErrorIllustration,
  Success: SuccessIllustration,
  Loading: LoadingIllustration,
};
