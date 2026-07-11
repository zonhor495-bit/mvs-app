import { useMemo, useState } from 'react';
import { Organization } from '../types';
import { calculateIncome, calculateExpenses, getExpenseRecords, getPayrollRecords } from '../store';

export default function FinanceAnalytics({ activeOrg }: { activeOrg: Organization }) {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  const dateRange = useMemo(() => {
    const now = new Date();
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let from = new Date();

    switch (period) {
      case 'week':
        from = new Date(now);
        from.setDate(from.getDate() - 7);
        from.setHours(0, 0, 0, 0);
        break;
      case 'month':
        from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
      case 'quarter':
        from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1, 0, 0, 0, 0);
        break;
      case 'year':
        from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        break;
    }

    return { from: from.toISOString(), to: to.toISOString() };
  }, [period]);

  const income = useMemo(() => calculateIncome(activeOrg.id, dateRange.from, dateRange.to), [activeOrg.id, dateRange]);
  const expenses = useMemo(() => calculateExpenses(activeOrg.id, dateRange.from, dateRange.to), [activeOrg.id, dateRange]);
  const profit = income - expenses;

  const expensesByCategory = useMemo(() => {
    const records = getExpenseRecords(activeOrg.id)
      .filter(e => {
        const eTime = new Date(e.date).getTime();
        const fromTime = new Date(dateRange.from).getTime();
        const toTime = new Date(dateRange.to).getTime();
        return eTime >= fromTime && eTime <= toTime;
      });

    const result: Record<string, number> = {};
    records.forEach(r => {
      result[r.category] = (result[r.category] || 0) + r.amount;
    });
    return result;
  }, [activeOrg.id, dateRange]);

  const payrolls = useMemo(() => {
    return getPayrollRecords(activeOrg.id).filter(p => {
      const pTime = new Date(p.createdAt).getTime();
      const fromTime = new Date(dateRange.from).getTime();
      const toTime = new Date(dateRange.to).getTime();
      return pTime >= fromTime && pTime <= toTime;
    });
  }, [activeOrg.id, dateRange]);

  const payrollByEmployee: Record<string, number> = {};
  payrolls.forEach(p => {
    payrollByEmployee[p.employeeName] = (payrollByEmployee[p.employeeName] || 0) + p.accrued;
  });

  const profitPercent = income > 0 ? Math.round((profit / income) * 100) : 0;
  const expensePercent = Math.round((expenses / income) * 100) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Финансовая аналитика</h2>
        <div className="flex gap-2">
          {(['week', 'month', 'quarter', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-sm transition ${
                period === p ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {p === 'week' && 'Неделя'}
              {p === 'month' && 'Месяц'}
              {p === 'quarter' && 'Квартал'}
              {p === 'year' && 'Год'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-2">Доходы</div>
          <div className="text-2xl font-bold text-green-400">{income.toLocaleString()} ₸</div>
          <div className="text-xs text-slate-500 mt-1">Период: {dateRange.from.slice(0, 10)}</div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-2">Расходы</div>
          <div className="text-2xl font-bold text-red-400">{expenses.toLocaleString()} ₸</div>
          <div className="text-xs text-slate-500 mt-1">{expensePercent}% от доходов</div>
        </div>

        <div className={`bg-gradient-to-br ${profit >= 0 ? 'from-green-600 to-green-800' : 'from-red-600 to-red-800'} rounded-lg p-4 border ${profit >= 0 ? 'border-green-500' : 'border-red-500'}`}>
          <div className="text-sm mb-2 font-semibold">Прибыль</div>
          <div className="text-2xl font-bold text-white">{profit.toLocaleString()} ₸</div>
          <div className="text-xs mt-1">{profitPercent}% рентабельность</div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-2">Зарплаты (начислено)</div>
          <div className="text-2xl font-bold text-blue-400">{payrolls.reduce((sum, p) => sum + p.accrued, 0).toLocaleString()} ₸</div>
          <div className="text-xs text-slate-500 mt-1">{payrolls.length} записей</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Расходы по категориям</h3>
          <div className="space-y-3">
            {Object.entries(expensesByCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([category, amount]) => (
                <div key={category}>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400 text-sm">{category}</span>
                    <span className="text-white font-semibold">{amount.toLocaleString()} ₸</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-600"
                      style={{ width: `${Math.min(100, (amount / expenses) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Зарплаты по сотрудникам</h3>
          <div className="space-y-3">
            {Object.entries(payrollByEmployee)
              .sort((a, b) => b[1] - a[1])
              .map(([name, amount]) => (
                <div key={name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400 text-sm">{name}</span>
                    <span className="text-white font-semibold">{amount.toLocaleString()} ₸</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{ width: `${Math.min(100, (amount / (payrolls.reduce((sum, p) => sum + p.accrued, 0) || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Структура доходов и расходов</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth="20"
                    strokeDasharray={`${(income / (income + expenses) * 100 * 2.51) || 0} 251`}
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="20"
                    strokeDasharray={`251 251`}
                    strokeDashoffset={`-${(income / (income + expenses) * 100 * 2.51) || 0}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">{Math.round((income / (income + expenses)) * 100)}%</div>
                    <div className="text-xs text-slate-400">доходов</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="flex items-center"><span className="w-3 h-3 bg-green-500 rounded-full mr-2" />Доходы</span>
                <span className="font-semibold">{income.toLocaleString()} ₸</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center"><span className="w-3 h-3 bg-red-500 rounded-full mr-2" />Расходы</span>
                <span className="font-semibold">{expenses.toLocaleString()} ₸</span>
              </div>
            </div>
          </div>

          <div>
            <div className="h-40 flex items-end gap-2 justify-around mb-4">
              <div className="text-center flex flex-col items-center">
                <div
                  className="w-12 bg-green-600 rounded-t"
                  style={{ height: `${Math.max(20, (income / Math.max(income, expenses)) * 100)}px` }}
                />
                <span className="text-xs text-slate-400 mt-2">Доходы</span>
              </div>
              <div className="text-center flex flex-col items-center">
                <div
                  className="w-12 bg-red-600 rounded-t"
                  style={{ height: `${Math.max(20, (expenses / Math.max(income, expenses)) * 100)}px` }}
                />
                <span className="text-xs text-slate-400 mt-2">Расходы</span>
              </div>
              <div className="text-center flex flex-col items-center">
                <div
                  className={`w-12 rounded-t ${profit >= 0 ? 'bg-green-600' : 'bg-red-600'}`}
                  style={{ height: `${Math.max(20, (Math.abs(profit) / Math.max(income, expenses)) * 100)}px` }}
                />
                <span className="text-xs text-slate-400 mt-2">Прибыль</span>
              </div>
            </div>
            <div className="text-center text-sm text-slate-400">
              Сравнение показателей на {dateRange.from.slice(0, 10)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
