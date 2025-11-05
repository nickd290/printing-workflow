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
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
      {/* Late Jobs */}
      <div className="group relative overflow-hidden bg-gradient-to-br from-red-950/40 to-red-900/20 border border-red-800/30 rounded-xl p-5 shadow-lg hover:shadow-xl hover:shadow-red-500/10 transition-all duration-300 hover:-translate-y-0.5">
        <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-all duration-300"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            {stats.late > 0 && (
              <span className="animate-pulse w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </div>
          <div className="text-3xl font-bold text-white mb-1">{stats.late}</div>
          <div className="text-sm text-red-300/80 font-medium">Late Jobs</div>
        </div>
      </div>

      {/* Urgent Jobs */}
      <div className="group relative overflow-hidden bg-gradient-to-br from-orange-950/40 to-orange-900/20 border border-orange-800/30 rounded-xl p-5 shadow-lg hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-0.5">
        <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 rounded-full blur-2xl group-hover:bg-orange-500/10 transition-all duration-300"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {stats.urgent > 0 && (
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
            )}
          </div>
          <div className="text-3xl font-bold text-white mb-1">{stats.urgent}</div>
          <div className="text-sm text-orange-300/80 font-medium">Urgent (0-2 days)</div>
        </div>
      </div>

      {/* Proof Needed */}
      <div className="group relative overflow-hidden bg-gradient-to-br from-yellow-950/40 to-yellow-900/20 border border-yellow-800/30 rounded-xl p-5 shadow-lg hover:shadow-xl hover:shadow-yellow-500/10 transition-all duration-300 hover:-translate-y-0.5">
        <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/5 rounded-full blur-2xl group-hover:bg-yellow-500/10 transition-all duration-300"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{stats.proofNeeded}</div>
          <div className="text-sm text-yellow-300/80 font-medium">Proof Needed</div>
        </div>
      </div>

      {/* In Production */}
      <div className="group relative overflow-hidden bg-gradient-to-br from-blue-950/40 to-blue-900/20 border border-blue-800/30 rounded-xl p-5 shadow-lg hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-0.5">
        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all duration-300"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{stats.inProduction}</div>
          <div className="text-sm text-blue-300/80 font-medium">In Production</div>
        </div>
      </div>

      {/* Completed */}
      <div className="group relative overflow-hidden bg-gradient-to-br from-green-950/40 to-green-900/20 border border-green-800/30 rounded-xl p-5 shadow-lg hover:shadow-xl hover:shadow-green-500/10 transition-all duration-300 hover:-translate-y-0.5">
        <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/5 rounded-full blur-2xl group-hover:bg-green-500/10 transition-all duration-300"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{stats.completed}</div>
          <div className="text-sm text-green-300/80 font-medium">Completed</div>
        </div>
      </div>
    </div>
  );
}
