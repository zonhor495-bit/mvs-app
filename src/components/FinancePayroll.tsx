import { useMemo, useState } from 'react';
import { Organization, PayrollRecord } from '../types';
import { getPayrollRecords, getWashers, markPayrollAsPaid, addPayrollRecord } from '../store';
import { generateId } from '../types';

export default function FinancePayroll({ activeOrg }: { activeOrg: Organization }) {
  const [selectedWasher, setSelectedWasher] = useState('');
  const [periodFrom, setPeriodFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [periodTo, setPeriodTo] = useState(new Date().toISOString().slice(0, 10));
  const [percent, setPercent] = useState('45');

  const washers = useMemo(() => getWashers(activeOrg.id), [activeOrg.id]);
  const payrolls = useMemo(() => getPayrollRecords(activeOrg.id), [activeOrg.id]);

  const handleCreatePayroll = () => {
    if (!selectedWasher || !periodFrom || !periodTo || !percent) return;
    
    const washer = washers.find(w => w.id === selectedWasher);
    if (!washer) return;

    const record: PayrollRecord = {
      id: generateId(),
      organizationId: activeOrg.id,
      employeeId: selectedWasher,
      employeeName: washer.name,
      periodFrom,
      periodTo,
      completedWorksCount: 0, // TODO: calculate from orders
      revenue: 0, // TODO: calculate from orders
      percent: Number(percent),
      accrued: 0, // TODO: calculate
      paid: 0,
      createdAt: new Date().toISOString(),
    };

    addPayrollRecord(record);
    setSelectedWasher('');
    setPercent('45');
  };

  const handleMarkPaid = (payrollId: string) => {
    markPayrollAsPaid(payrollId, activeOrg.id);
  };

  const unpaidPayrolls = payrolls.filter(p => !p.paidAt);
  const totalAccrued = unpaidPayrolls.reduce((sum, p) => sum + p.accrued, 0);
  const totalPaid = payrolls.filter(p => p.paidAt).reduce((sum, p) => sum + p.paid, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Зарплаты</h2>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Создать начисление</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <select
            value={selectedWasher}
            onChange={e => setSelectedWasher(e.target.value)}
            className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 text-sm"
          >
            <option value="">Выберите сотрудника</option>
            {washers.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          <input
            type="date"
            value={periodFrom}
            onChange={e => setPeriodFrom(e.target.value)}
            className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 text-sm"
          />
          <input
            type="date"
            value={periodTo}
            onChange={e => setPeriodTo(e.target.value)}
            className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 text-sm"
          />
          <input
            type="number"
            placeholder="Процент"
            value={percent}
            onChange={e => setPercent(e.target.value)}
            className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 text-sm"
          />
          <button
            onClick={handleCreatePayroll}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 font-semibold text-sm"
          >
            Создать
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">К выплате</div>
          <div className="text-2xl font-bold text-yellow-400">{totalAccrued.toLocaleString()} ₸</div>
          <div className="text-xs text-slate-500 mt-1">{unpaidPayrolls.length} начислений</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Выплачено</div>
          <div className="text-2xl font-bold text-green-400">{totalPaid.toLocaleString()} ₸</div>
          <div className="text-xs text-slate-500 mt-1">{payrolls.filter(p => p.paidAt).length} выплат</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Всего начислено</div>
          <div className="text-2xl font-bold text-blue-400">{(totalAccrued + totalPaid).toLocaleString()} ₸</div>
          <div className="text-xs text-slate-500 mt-1">{payrolls.length} записей</div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">История начислений</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left py-2 px-2 text-slate-400">Сотрудник</th>
                <th className="text-left py-2 px-2 text-slate-400">Период</th>
                <th className="text-right py-2 px-2 text-slate-400">Начислено</th>
                <th className="text-center py-2 px-2 text-slate-400">Процент</th>
                <th className="text-center py-2 px-2 text-slate-400">Статус</th>
                <th className="text-center py-2 px-2 text-slate-400">Действие</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.slice(0, 50).map(payroll => (
                <tr key={payroll.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                  <td className="py-2 px-2 text-slate-300">{payroll.employeeName}</td>
                  <td className="py-2 px-2 text-slate-300">{payroll.periodFrom.slice(0, 10)} – {payroll.periodTo.slice(0, 10)}</td>
                  <td className="py-2 px-2 text-right text-slate-300 font-semibold">{payroll.accrued.toLocaleString()} ₸</td>
                  <td className="py-2 px-2 text-center text-slate-300">{payroll.percent}%</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${payroll.paidAt ? 'bg-green-700 text-green-200' : 'bg-yellow-700 text-yellow-200'}`}>
                      {payroll.paidAt ? 'Выплачена' : 'К выплате'}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    {!payroll.paidAt && (
                      <button
                        onClick={() => handleMarkPaid(payroll.id)}
                        className="text-blue-400 hover:text-blue-300 text-xs font-semibold"
                      >
                        Выплатить
                      </button>
                    )}
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
