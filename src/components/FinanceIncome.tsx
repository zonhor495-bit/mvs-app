import { useMemo, useState } from 'react';
import { Organization } from '../types';
import { calculateCashSummary, getOrders } from '../store';

export default function FinanceIncome({ activeOrg }: { activeOrg: Organization }) {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'quarter' | 'year'>('month');
  
  const orders = useMemo(() => getOrders(activeOrg.id).filter(o => o.status === 'completed'), [activeOrg.id]);
  
  const dateRange = useMemo(() => {
    const now = new Date();
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let from = new Date();

    switch (period) {
      case 'today':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
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

  const income = useMemo(() => {
    const summary = calculateCashSummary(activeOrg.id, dateRange.from, dateRange.to);
    return {
      cash: summary.cashIncome || 0,
      card: summary.cardIncome || 0,
      kaspi: summary.kaspiIncome || 0,
      qr: summary.qrIncome || 0,
      transfer: summary.transferIncome || 0,
      mixed: summary.mixedIncome || 0,
      other: summary.otherIncome || 0,
      total: summary.income || 0,
    };
  }, [activeOrg.id, dateRange]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Доходы</h2>
        <div className="flex gap-2">
          {(['today', 'week', 'month', 'quarter', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-sm transition ${
                period === p ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {p === 'today' && 'Сегодня'}
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
          <div className="text-sm text-slate-400 mb-1">Наличные</div>
          <div className="text-2xl font-bold text-green-400">{income.cash.toLocaleString()} ₸</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Банковская карта</div>
          <div className="text-2xl font-bold text-blue-400">{income.card.toLocaleString()} ₸</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Kaspi QR</div>
          <div className="text-2xl font-bold text-purple-400">{income.kaspi.toLocaleString()} ₸</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">QR</div>
          <div className="text-2xl font-bold text-yellow-400">{income.qr.toLocaleString()} ₸</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Переводы</div>
          <div className="text-2xl font-bold text-orange-400">{income.transfer.toLocaleString()} ₸</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Смешанная оплата</div>
          <div className="text-2xl font-bold text-indigo-400">{income.mixed.toLocaleString()} ₸</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Прочие</div>
          <div className="text-2xl font-bold text-slate-400">{income.other.toLocaleString()} ₸</div>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-lg p-4 border border-green-500">
          <div className="text-sm text-green-200 mb-1 font-semibold">ИТОГО ДОХОД</div>
          <div className="text-3xl font-bold text-white">{income.total.toLocaleString()} ₸</div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Детализация заказов</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left py-2 px-2 text-slate-400">Дата</th>
                <th className="text-left py-2 px-2 text-slate-400">Номер заказа</th>
                <th className="text-left py-2 px-2 text-slate-400">Услуги</th>
                <th className="text-left py-2 px-2 text-slate-400">Способ оплаты</th>
                <th className="text-right py-2 px-2 text-slate-400">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 20).map(order => (
                <tr key={order.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                  <td className="py-2 px-2 text-slate-300">{order.completedAt?.slice(0, 10) || order.createdAt.slice(0, 10)}</td>
                  <td className="py-2 px-2 text-slate-300">{order.orderNumber || order.id.slice(0, 8)}</td>
                  <td className="py-2 px-2 text-slate-300">{order.services.map(s => s.serviceName).join(', ')}</td>
                  <td className="py-2 px-2 text-slate-300">{order.paymentMethod || '—'}</td>
                  <td className="py-2 px-2 text-right text-green-400 font-semibold">{order.totalAmount.toLocaleString()} ₸</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
