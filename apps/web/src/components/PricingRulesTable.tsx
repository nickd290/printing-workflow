'use client';

interface PricingRule {
  id: string;
  sizeName: string;
  baseCPM: number;
  printCPM: number;
  paperWeightPer1000: number | null;
  paperCostPerLb: number | null;
  paperCPM: number | null;
  rollSize: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PricingRulesTableProps {
  rules: PricingRule[];
  onEdit: (rule: PricingRule) => void;
  onDelete: (id: string) => void;
}

export function PricingRulesTable({ rules, onEdit, onDelete }: PricingRulesTableProps) {
  if (rules.length === 0) {
    return (
      <div className="card">
        <div className="p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p className="mt-4 text-lg font-medium text-foreground">No pricing rules yet</p>
          <p className="mt-2 text-sm text-muted-foreground">Get started by creating your first pricing rule</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="table-header">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Base CPM</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Print CPM</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Paper CPM</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Paper Weight</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Roll Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {rules.map((rule) => (
              <tr key={rule.id} className="table-row">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-bold text-foreground">{rule.sizeName}</div>
                  {rule.notes && (
                    <div className="text-xs text-muted-foreground mt-1 max-w-xs truncate">
                      {rule.notes}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  ${Number(rule.baseCPM).toFixed(2)}/M
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-orange-600">
                  ${Number(rule.printCPM).toFixed(2)}/M
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                  {rule.paperCPM ? `$${Number(rule.paperCPM).toFixed(2)}/M` : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {rule.paperWeightPer1000 ? (
                    <>
                      {Number(rule.paperWeightPer1000).toFixed(2)} lbs/M
                      {rule.paperCostPerLb && (
                        <div className="text-xs text-muted-foreground">
                          @ ${Number(rule.paperCostPerLb).toFixed(3)}/lb
                        </div>
                      )}
                    </>
                  ) : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {rule.rollSize ? `${rule.rollSize}"` : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {rule.isActive ? (
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(rule)}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(rule.id)}
                      className="text-red-600 hover:text-red-900 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="px-6 py-4 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Total: {rules.length} pricing {rules.length === 1 ? 'rule' : 'rules'}
          </span>
          <span className="text-muted-foreground">
            Active: {rules.filter(r => r.isActive).length} |
            Inactive: {rules.filter(r => !r.isActive).length}
          </span>
        </div>
      </div>
    </div>
  );
}
