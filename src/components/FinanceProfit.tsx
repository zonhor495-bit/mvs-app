import { useMemo, useState } from 'react';
import { Organization } from '../types';
import { calculateIncome, calculateExpenses, calculateProfit } from '../store';

export default function FinanceProfit({ activeOrg }: { activeOrg: Organization }) {
  const [period, setPeriod] = useState<'day' | 'month' | 'quarter' | 'year'>('month');

  const dateRange = useMemo(() => {
    const now = new Date();
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let from = new Date();

    switch (period) {
      case 'day':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
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
  const profit = useMemo(() => calculateProfit(activeOrg.id, dateRange.from, dateRange.to), [activeOrg.id, dateRange]);

  const profitPercent = income > 0 ? Math.round((profit / income) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Прибыль</h2>
        <div className="flex gap-2">
          {(['day', 'month', 'quarter', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-sm transition ${
                period === p ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {p === 'day' && 'День'}
              {p === 'month' && 'Месяц'}
              {p === 'quarter' && 'Квартал'}
              {p === 'year' && 'Год'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="text-sm text-slate-400 mb-2">Доходы</div>
          <div className="text-3xl font-bold text-green-400">{income.toLocaleString()} ₸</div>
          <div className="text-xs text-slate-500 mt-2">Период: {dateRange.from.slice(0, 10)} – {dateRange.to.slice(0, 10)}</div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="text-sm text-slate-400 mb-2">Расходы</div>
          <div className="text-3xl font-bold text-red-400">{expenses.toLocaleString()} ₸</div>
          <div className="text-xs text-slate-500 mt-2">{Math.round((expenses / income) * 100 || 0)}% от доходов</div>
        </div>

        <div className={`bg-gradient-to-br ${profit >= 0 ? 'from-green-600 to-green-800' : 'from-red-600 to-red-800'} rounded-lg p-6 border ${profit >= 0 ? 'border-green-500' : 'border-red-500'}`}>
          <div className="text-sm mb-2 font-semibold">Чистая прибыль</div>
          <div className="text-3xl font-bold text-white">{profit.toLocaleString()} ₸</div>
          <div className="text-sm mt-2 font-semibold">{profitPercent}% рентабельность</div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Аналитика</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center pb-3 border-b border-slate-700">
            <span className="text-slate-400">Сумма на 1 заказ (средний чек)</span>
            <span className="text-white font-semibold">~{income > 0 ? Math.round(income / Math.max(1, income / 1000)) : 0} ₸</span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-slate-700">
            <span className="text-slate-400">Доля расходов</span>
            <span className="text-white font-semibold">{Math.round((expenses / (income || 1)) * 100)}%</span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-slate-700">
            <span className="text-slate-400">Доля прибыли</span>
            <span className={`font-semibold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{profitPercent}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Доход на расход</span>
            <span className="text-white font-semibold">{expenses > 0 ? (income / expenses).toFixed(2) : '∞'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
