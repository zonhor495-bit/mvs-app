import { useMemo, useState } from 'react';
import { Organization } from '../types';
import { getCashOperations, getExpenseRecords } from '../store';

export default function FinanceCashFlow({ activeOrg }: { activeOrg: Organization }) {
  const [period, setPeriod] = useState<'week' | 'month'>('month');

  const dateRange = useMemo(() => {
    const now = new Date();
    let from = new Date();

    if (period === 'week') {
      from = new Date(now);
      from.setDate(from.getDate() - 7);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    from.setHours(0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return { from: from.toISOString(), to: to.toISOString() };
  }, [period]);

  const cashOps = useMemo(() => getCashOperations(activeOrg.id), [activeOrg.id]);
  const expenses = useMemo(() => getExpenseRecords(activeOrg.id), [activeOrg.id]);

  const journal = useMemo(() => {
    const entries: Array<{
      date: string;
      type: string;
      description: string;
      amountIn: number;
      amountOut: number;
      balance: number;
    }> = [];

    let balance = 0;

    const fromTime = new Date(dateRange.from).getTime();
    const toTime = new Date(dateRange.to).getTime();

    // Add cash operations
    cashOps
      .filter(op => {
        const opTime = new Date(op.createdAt).getTime();
        return opTime >= fromTime && opTime <= toTime;
      })
      .forEach(op => {
        const amountIn = op.direction === 'income' ? op.amount : 0;
        const amountOut = op.direction === 'expense' ? op.amount : 0;
        balance += amountIn - amountOut;

        entries.push({
          date: op.createdAt.slice(0, 10),
          type: op.type,
          description: op.description || op.type,
          amountIn,
          amountOut,
          balance,
        });
      });

    // Add expenses
    expenses
      .filter(exp => {
        const expTime = new Date(exp.date).getTime();
        return expTime >= fromTime && expTime <= toTime;
      })
      .forEach(exp => {
        balance -= exp.amount;

        entries.push({
          date: exp.date.slice(0, 10),
          type: 'expense',
          description: `Расход: ${exp.category}`,
          amountIn: 0,
          amountOut: exp.amount,
          balance,
        });
      });

    return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [cashOps, expenses, dateRange]);

  const totalIncome = journal.reduce((sum, e) => sum + e.amountIn, 0);
  const totalExpense = journal.reduce((sum, e) => sum + e.amountOut, 0);
  const finalBalance = journal.length > 0 ? journal[journal.length - 1].balance : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Движение денежных средств</h2>
        <div className="flex gap-2">
          {(['week', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-sm transition ${
                period === p ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {p === 'week' && 'Неделя'}
              {p === 'month' && 'Месяц'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Приходы</div>
          <div className="text-2xl font-bold text-green-400">{totalIncome.toLocaleString()} ₸</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Расходы</div>
          <div className="text-2xl font-bold text-red-400">{totalExpense.toLocaleString()} ₸</div>
        </div>
        <div className={`bg-gradient-to-br ${finalBalance >= 0 ? 'from-green-600 to-green-800' : 'from-red-600 to-red-800'} rounded-lg p-4 border ${finalBalance >= 0 ? 'border-green-500' : 'border-red-500'}`}>
          <div className="text-sm mb-1 font-semibold">Баланс</div>
          <div className="text-2xl font-bold text-white">{finalBalance.toLocaleString()} ₸</div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Журнал операций</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left py-2 px-2 text-slate-400">Дата</th>
                <th className="text-left py-2 px-2 text-slate-400">Тип</th>
                <th className="text-left py-2 px-2 text-slate-400">Описание</th>
                <th className="text-right py-2 px-2 text-slate-400">Приход</th>
                <th className="text-right py-2 px-2 text-slate-400">Расход</th>
                <th className="text-right py-2 px-2 text-slate-400">Баланс</th>
              </tr>
            </thead>
            <tbody>
              {journal.map((entry, idx) => (
                <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700/50">
                  <td className="py-2 px-2 text-slate-300">{entry.date}</td>
                  <td className="py-2 px-2 text-slate-300">{entry.type}</td>
                  <td className="py-2 px-2 text-slate-300">{entry.description}</td>
                  <td className="py-2 px-2 text-right text-green-400 font-semibold">{entry.amountIn > 0 ? entry.amountIn.toLocaleString() : '—'}</td>
                  <td className="py-2 px-2 text-right text-red-400 font-semibold">{entry.amountOut > 0 ? entry.amountOut.toLocaleString() : '—'}</td>
                  <td className={`py-2 px-2 text-right font-semibold ${entry.balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                    {entry.balance.toLocaleString()} ₸
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
