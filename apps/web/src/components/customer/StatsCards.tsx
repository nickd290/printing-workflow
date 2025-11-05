'use client';

interface StatsCardsProps {
  jobs: any[];
}

export function StatsCards({ jobs }: StatsCardsProps) {
  const stats = {
    total: jobs.length,
    awaitingProof: jobs.filter(j => j.status === 'READY_FOR_PROOF').length,
    inProduction: jobs.filter(j => j.status === 'IN_PRODUCTION' || j.status === 'PROOF_APPROVED').length,
    completed: jobs.filter(j => j.status === 'COMPLETED').length,
  };

  const cards = [
    {
      title: 'Active Orders',
      value: stats.total,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-blue-100',
      textColor: 'text-blue-600',
    },
    {
      title: 'Awaiting Proof',
      value: stats.awaitingProof,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      gradient: 'from-yellow-500 to-orange-500',
      bgGradient: 'from-yellow-50 to-orange-100',
      textColor: 'text-orange-600',
    },
    {
      title: 'In Production',
      value: stats.inProduction,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
      gradient: 'from-purple-500 to-indigo-600',
      bgGradient: 'from-purple-50 to-indigo-100',
      textColor: 'text-indigo-600',
    },
    {
      title: 'Completed',
      value: stats.completed,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-green-500 to-emerald-600',
      bgGradient: 'from-green-50 to-emerald-100',
      textColor: 'text-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden group cursor-pointer"
        >
          <div className={`h-2 bg-gradient-to-r ${card.gradient}`}></div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg bg-gradient-to-br ${card.bgGradient} group-hover:scale-110 transition-transform duration-300`}>
                <div className={card.textColor}>
                  {card.icon}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${card.textColor}`}>
                  {card.value}
                </div>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600">{card.title}</h3>
          </div>
        </div>
      ))}
    </div>
  );
}
