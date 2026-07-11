import { useState, useMemo } from 'react';
import { Organization, Washer, ShiftStatus, generateId, WasherCurrentStatus } from '../types';
import { getWasherShiftDaysForDate, addWasherShiftDay, addOrUpdateWasherCurrentStatus } from '../store';
import { format } from 'date-fns';

interface ShiftStartModalProps {
  activeOrg: Organization;
  washers: Washer[];
  onClose: () => void;
}

export default function ShiftStartModal({ activeOrg, washers, onClose }: ShiftStartModalProps) {
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const today = format(new Date(), 'dd MMMM yyyy');
  
  const existingShifts = useMemo(() => {
    return getWasherShiftDaysForDate(activeOrg.id, dateStr);
  }, [activeOrg.id, dateStr]);

  const [statuses, setStatuses] = useState<Record<string, ShiftStatus>>(() => {
    const initial: Record<string, ShiftStatus> = {};
    washers.forEach(w => {
      const existing = existingShifts.find(s => s.washerId === w.id);
      initial[w.id] = existing?.status || 'absent';
    });
    return initial;
  });

  const handleStatusChange = (washerId: string, status: ShiftStatus) => {
    setStatuses(prev => ({ ...prev, [washerId]: status }));
  };

  const handleSave = () => {
    const now = new Date().toISOString();
    washers.forEach(w => {
      const status = statuses[w.id] || 'absent';
      const existing = existingShifts.find(s => s.washerId === w.id);
      
      addWasherShiftDay({
        id: existing?.id || generateId(),
        washerId: w.id,
        washerName: w.name,
        organizationId: activeOrg.id,
        date: dateStr,
        status,
        startedAt: status === 'working' ? now : undefined,
        endedAt: existing?.endedAt,
      });

      const currentStatus: WasherCurrentStatus = {
        id: generateId(),
        washerId: w.id,
        organizationId: activeOrg.id,
        date: dateStr,
        status: status === 'working' ? 'free' : status,
        currentBoxId: status === 'working' ? w.primaryBoxId : undefined,
        updatedAt: now,
      };

      addOrUpdateWasherCurrentStatus(currentStatus);
    });
    onClose();
  };

  const workingCount = Object.values(statuses).filter(s => s === 'working').length;
  const statusLabels: Record<ShiftStatus, string> = {
    working: 'Работает',
    absent: 'Отсутствует',
    vacation: 'Выходной',
    sick: 'Больничный',
  };
  const statusColors: Record<ShiftStatus, string> = {
    working: 'bg-green-500/10 border-green-500/30 text-green-400',
    absent: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
    vacation: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    sick: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
      <div
        className="modal-panel rounded-2xl p-6 w-full max-w-md mx-4 animate-fadeIn neon-glow"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white mb-1">📅 Начало рабочего дня</h2>
        <p className="text-xs text-slate-400 mb-4">{today}</p>

        <div className="space-y-3 mb-6 max-h-80 overflow-y-auto pr-1">
          {washers.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Сотрудников не добавлено</p>
          ) : (
            washers.map(w => (
              <div key={w.id} className="p-3 rounded-lg bg-white/3 border border-white/5">
                <p className="text-sm font-medium text-white mb-2">{w.name}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['working', 'absent', 'vacation', 'sick'] as ShiftStatus[]).map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleStatusChange(w.id, status)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        statuses[w.id] === status
                          ? statusColors[status]
                          : 'bg-white/2 border-white/5 text-slate-500 hover:border-white/15 hover:text-slate-400'
                      }`}
                    >
                      {statusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10 mb-4 text-xs text-slate-400">
          💡 На смене: <span className="text-cyan-400 font-semibold">{workingCount}</span> сотрудников
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="btn-neon rounded-lg px-6 py-2 text-sm font-medium"
          >
            Начать смену
          </button>
        </div>
      </div>
    </div>
  );
}
