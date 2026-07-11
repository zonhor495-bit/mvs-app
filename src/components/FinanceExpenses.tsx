import { useMemo, useState } from 'react';
import { Organization, ExpenseRecord, ExpenseCategory } from '../types';
import { getExpenseRecords, addExpenseRecord, getWashers } from '../store';
import { generateId } from '../types';

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['химия', 'зарплата', 'аренда', 'коммунальные', 'оборудование', 'ремонт', 'реклама', 'прочее'];

export default function FinanceExpenses({ activeOrg }: { activeOrg: Organization }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('прочее');
  const [comment, setComment] = useState('');
  const [employee, setEmployee] = useState('');

  const expenses = useMemo(() => getExpenseRecords(activeOrg.id), [activeOrg.id]);
  const washers = useMemo(() => getWashers(activeOrg.id), [activeOrg.id]);

  const handleAddExpense = () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;

    const expense: ExpenseRecord = {
      id: generateId(),
      organizationId: activeOrg.id,
      date,
      amount: Math.round(Number(amount)),
      category,
      comment,
      employeeId: washers.find(w => w.name === employee)?.id,
      employeeName: employee || undefined,
      createdAt: new Date().toISOString(),
    };

    addExpenseRecord(expense);
    setAmount('');
    setComment('');
    setEmployee('');
  };

  const totalByCategory = useMemo(() => {
    const result: Record<string, number> = {};
    EXPENSE_CATEGORIES.forEach(cat => {
      result[cat] = expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
    });
    return result;
  }, [expenses]);

  const totalExpenses = Object.values(totalByCategory).reduce((sum, val) => sum + val, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Расходы</h2>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Добавить расход</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 text-sm"
          />
          <input
            type="number"
            placeholder="Сумма"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 text-sm"
          />
          <select
            value={category}
            onChange={e => setCategory(e.target.value as ExpenseCategory)}
            className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 text-sm"
          >
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Комментарий"
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 text-sm"
          />
          <select
            value={employee}
            onChange={e => setEmployee(e.target.value)}
            className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 text-sm"
          >
            <option value="">Сотрудник</option>
            {washers.map(w => (
              <option key={w.id} value={w.name}>{w.name}</option>
            ))}
          </select>
          <button
            onClick={handleAddExpense}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 font-semibold text-sm"
          >
            Добавить
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {EXPENSE_CATEGORIES.map(cat => (
          <div key={cat} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <div className="text-xs text-slate-400 mb-1 truncate">{cat}</div>
            <div className="text-lg font-bold text-red-400">{totalByCategory[cat].toLocaleString()} ₸</div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-lg p-6 border border-red-500">
        <div className="text-sm text-red-200 mb-2">ВСЕГО РАСХОДОВ</div>
        <div className="text-4xl font-bold text-white">{totalExpenses.toLocaleString()} ₸</div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">История расходов</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left py-2 px-2 text-slate-400">Дата</th>
                <th className="text-left py-2 px-2 text-slate-400">Категория</th>
                <th className="text-left py-2 px-2 text-slate-400">Комментарий</th>
                <th className="text-left py-2 px-2 text-slate-400">Сотрудник</th>
                <th className="text-right py-2 px-2 text-slate-400">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {expenses.slice(0, 30).map(exp => (
                <tr key={exp.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                  <td className="py-2 px-2 text-slate-300">{exp.date.slice(0, 10)}</td>
                  <td className="py-2 px-2 text-slate-300">{exp.category}</td>
                  <td className="py-2 px-2 text-slate-300">{exp.comment || '—'}</td>
                  <td className="py-2 px-2 text-slate-300">{exp.employeeName || '—'}</td>
                  <td className="py-2 px-2 text-right text-red-400 font-semibold">{exp.amount.toLocaleString()} ₸</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
