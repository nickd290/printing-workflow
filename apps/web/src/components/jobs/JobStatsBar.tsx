'use client';

interface JobStatsBarProps {
  stats: {
    late: number;
    urgent: number;
    proofNeeded: number;
    inProduction: number;
    completed: number;
  };
}

export function JobStatsBar({ stats }: JobStatsBarProps) {
  return (
    <div className="stats-bar mb-8">
      {/* Late Jobs */}
      <div className="stat-item">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-danger" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="stat-label">Late Jobs</div>
          {stats.late > 0 && (
            <span className="animate-pulse w-1.5 h-1.5 bg-danger rounded-full ml-auto"></span>
          )}
        </div>
        <div className="stat-value text-danger">{stats.late}</div>
      </div>

      <div className="stat-divider" />

      {/* Urgent Jobs */}
      <div className="stat-item">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="stat-label">Urgent (0-2 days)</div>
          {stats.urgent > 0 && (
            <span className="w-1.5 h-1.5 bg-warning rounded-full ml-auto"></span>
          )}
        </div>
        <div className="stat-value text-warning">{stats.urgent}</div>
      </div>

      <div className="stat-divider" />

      {/* Proof Needed */}
      <div className="stat-item">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="stat-label">Proof Needed</div>
        </div>
        <div className="stat-value text-info">{stats.proofNeeded}</div>
      </div>

      <div className="stat-divider" />

      {/* In Production */}
      <div className="stat-item">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <div className="stat-label">In Production</div>
        </div>
        <div className="stat-value text-primary">{stats.inProduction}</div>
      </div>

      <div className="stat-divider" />

      {/* Completed */}
      <div className="stat-item">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-value text-success">{stats.completed}</div>
      </div>
    </div>
  );
}
