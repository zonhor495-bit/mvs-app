import { useMemo } from 'react';
import { Washer, WasherCurrentStatus, WasherShiftDay, Order, Box, WorkerTimelog } from '../types';
import { format } from 'date-fns';

interface AttendanceTableProps {
  washers: Washer[];
  currentStatuses: WasherCurrentStatus[];
  shiftDaysToday: WasherShiftDay[];
  boxes: Box[];
  todayLogsByWasherId: Map<string, WorkerTimelog[]>;
  activeOrderByWasherId: Map<string, Order>;
  onWorkerClick?: (washer: Washer) => void;
}

const WORKER_STATUS_CLASSES: Record<string, string> = {
  free: 'bg-green-500/10 border-green-500/20 text-green-400',
  working: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
  break: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  absent: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
  vacation: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  sick: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
};

const WORKER_STATUS_LABELS: Record<string, string> = {
  free: 'Свободен',
  working: 'В работе',
  break: 'Перерыв',
  absent: 'Отсутствует',
  vacation: 'Выходной',
  sick: 'Больничный',
};

export default function AttendanceTable({
  washers,
  currentStatuses,
  shiftDaysToday,
  boxes,
  todayLogsByWasherId,
  activeOrderByWasherId,
  onWorkerClick,
}: AttendanceTableProps) {
  const statusByWasherId = useMemo(
    () => new Map(currentStatuses.filter(s => s.date === format(new Date(), 'yyyy-MM-dd')).map(s => [s.washerId, s])),
    [currentStatuses]
  );

  const shiftDayByWasherId = useMemo(
    () => new Map(shiftDaysToday.map(day => [day.washerId, day])),
    [shiftDaysToday]
  );

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white">👥 Присутствие сотрудников сегодня</h3>
        <p className="text-xs text-slate-500 mt-1">{format(new Date(), 'dd MMMM yyyy')}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Сотрудник</th>
              <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Статус</th>
              <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Бокс</th>
              <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Начало</th>
              <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Конец</th>
              <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Длительность</th>
              <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Машин</th>
              <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Доход</th>
              <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Активный заказ</th>
              <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Действие</th>
            </tr>
          </thead>
          <tbody>
            {washers.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">Нет сотрудников</td>
              </tr>
            ) : (
              washers.map(washer => {
                const status = statusByWasherId.get(washer.id);
                const shiftDay = shiftDayByWasherId.get(washer.id);
                const activeOrder = activeOrderByWasherId.get(washer.id);
                const todayLogs = todayLogsByWasherId.get(washer.id) || [];
                const carsCount = todayLogs.length;
                const earnings = todayLogs.reduce((sum: number, log: WorkerTimelog) => sum + log.washerShare, 0);
                const statusValue = status?.status || (shiftDay?.status === 'working' ? 'free' : 'absent');
                const statusClass = WORKER_STATUS_CLASSES[statusValue] || WORKER_STATUS_CLASSES.absent;
                const box = boxes.find(boxItem => boxItem.id === status?.currentBoxId || washer.primaryBoxId);
                const startedAt = shiftDay?.startedAt ? shiftDay.startedAt.split('T')[1]?.slice(0, 5) : '—';
                const endedAt = shiftDay?.endedAt ? shiftDay.endedAt.split('T')[1]?.slice(0, 5) : '—';
                const duration = shiftDay?.startedAt && shiftDay?.endedAt
                  ? `${Math.max(0, Math.round((new Date(shiftDay.endedAt).getTime() - new Date(shiftDay.startedAt).getTime()) / 60000))} мин`
                  : '—';
                const activeOrderLabel = activeOrder ? `${activeOrder.licensePlate}` : '—';

                return (
                  <tr
                    key={washer.id}
                    className="border-b border-white/3 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => onWorkerClick?.(washer)}
                  >
                    <td className="px-4 py-3 text-white font-semibold">{washer.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] px-2 py-1 rounded-full border ${statusClass}`}>
                        {WORKER_STATUS_LABELS[statusValue]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-300">{box?.name || status?.currentBoxId || washer.primaryBoxId || '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-300">{startedAt}</td>
                    <td className="px-4 py-3 text-center text-slate-300">{endedAt}</td>
                    <td className="px-4 py-3 text-center text-slate-300">{duration}</td>
                    <td className="px-4 py-3 text-center text-cyan-400 font-semibold">{carsCount || '—'}</td>
                    <td className="px-4 py-3 text-center text-green-400 font-semibold">{carsCount ? `${earnings} ₽` : '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-300">{activeOrderLabel}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onWorkerClick?.(washer)}
                        className="text-xs px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                      >
                        Профиль
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
