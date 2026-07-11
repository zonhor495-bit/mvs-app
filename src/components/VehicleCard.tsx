import { format } from 'date-fns';
import { Vehicle, Order } from '../types';
import { exportVehicleCsv, exportVehicleExcel, exportVehiclePdf } from '../utils/crmExport';

interface VehicleCardProps {
  vehicle: Vehicle;
  orders: Order[];
  currency: string;
  ownerName?: string;
  organizationId?: string;
}

export default function VehicleCard({ vehicle, orders, currency, ownerName, organizationId }: VehicleCardProps) {
  const visits = orders.length;
  const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const lastVisit = orders.length > 0 ? format(new Date(orders[0].completedAt || orders[0].createdAt), 'dd.MM.yyyy') : '—';
  const popularServices = Array.from(
    orders.flatMap(order => order.services.map(service => service.serviceName)).reduce((map, serviceName) => {
      map.set(serviceName, (map.get(serviceName) || 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const sortedOrders = orders.slice().sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());

  return (
    <div className="glass rounded-3xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Автомобиль {vehicle.licensePlate}</h2>
          <p className="text-sm text-slate-400">
            {vehicle.make || 'Марка'} {vehicle.model || 'Модель'}{vehicle.year ? ` · ${vehicle.year}` : ''}{vehicle.color ? ` · ${vehicle.color}` : ''}
          </p>
          {vehicle.vin && <p className="text-xs text-slate-500 mt-1">VIN: {vehicle.vin}</p>}
          {vehicle.comment && <p className="text-xs text-slate-500 mt-1">{vehicle.comment}</p>}
        </div>
        {organizationId && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => exportVehicleCsv({ id: organizationId, name: '', currency, createdAt: '' }, vehicle, orders, ownerName)} className="btn-neon rounded-xl px-3 py-2 text-sm">CSV</button>
            <button type="button" onClick={() => exportVehicleExcel({ id: organizationId, name: '', currency, createdAt: '' }, vehicle, orders, ownerName)} className="btn-neon rounded-xl px-3 py-2 text-sm">Excel</button>
            <button type="button" onClick={() => exportVehiclePdf({ id: organizationId, name: '', currency, createdAt: '' }, vehicle, orders, ownerName)} className="btn-neon rounded-xl px-3 py-2 text-sm">PDF</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-3xl bg-white/5 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Последний визит</p>
          <p className="text-white font-semibold">{lastVisit}</p>
        </div>
        <div className="rounded-3xl bg-white/5 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Визиты</p>
          <p className="text-white font-semibold">{visits}</p>
        </div>
        <div className="rounded-3xl bg-white/5 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Потрачено</p>
          <p className="text-white font-semibold">{totalSpent.toLocaleString('ru-RU')} {currency}</p>
        </div>
        <div className="rounded-3xl bg-white/5 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Популярные услуги</p>
          <p className="text-white font-semibold">{popularServices.join(', ') || '—'}</p>
        </div>
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="text-base font-semibold text-white mb-4">История посещений</h3>
        {sortedOrders.length > 0 ? (
          <div className="space-y-3">
            {sortedOrders.map(order => (
              <div key={order.id} className="rounded-3xl bg-white/5 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-slate-300">{format(new Date(order.completedAt || order.createdAt), 'dd.MM.yyyy')}</p>
                    <p className="text-xs text-slate-500">{order.services.map(s => s.serviceName).join(', ') || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">{order.totalAmount.toLocaleString('ru-RU')} {currency}</p>
                    <p className="text-xs text-slate-500">{order.washerName || 'Мойщик не указан'}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-300">
                  <div>
                    <p className="text-slate-500">Бокс</p>
                    <p>{order.boxName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Статус</p>
                    <p>{order.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">По этому автомобилю ещё нет заказов.</p>
        )}
      </div>
    </div>
  );
}
