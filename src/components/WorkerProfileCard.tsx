import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { downloadWorkbook } from '../utils/excelUtils';
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  isWithinInterval,
} from 'date-fns';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Washer,
  WasherCurrentStatus,
  WasherShiftDay,
  WorkerTimelog,
  Shift,
  Order,
} from '../types';

interface WorkerProfileCardProps {
  washer: Washer;
  currentStatus?: WasherCurrentStatus;
  shiftDays: WasherShiftDay[];
  timelogs: WorkerTimelog[];
  salaryShifts: Shift[];
  orders: Order[];
  onClose: () => void;
}

interface Note {
  id: string;
  text: string;
  createdAt: string;
}

function money(n: number) {
  return Math.round(n).toLocaleString('ru-RU');
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}ч ${mins}м`;
}

export default function WorkerProfileCard({
  washer,
  currentStatus,
  shiftDays,
  timelogs,
  salaryShifts,
  orders,
  onClose,
}: WorkerProfileCardProps) {
  const [tab, setTab] = useState<'profile' | 'shifts' | 'salary' | 'orders' | 'analytics' | 'notes'>('profile');
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState('');
  const [shiftFilter, setShiftFilter] = useState<'today' | 'week' | 'month' | 'all'>('month');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`worker-notes-${washer.id}`);
      if (saved) {
        setNotes(JSON.parse(saved));
      }
    } catch {
      setNotes([]);
    }
  }, [washer.id]);

  useEffect(() => {
    localStorage.setItem(`worker-notes-${washer.id}`, JSON.stringify(notes));
  }, [notes, washer.id]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const monthStart = startOfMonth(new Date());

  const todayTimelogs = useMemo(
    () => timelogs.filter(log => log.date === today && log.washerId === washer.id),
    [timelogs, washer.id, today]
  );

  const weekTimelogs = useMemo(
    () => timelogs.filter(log => log.washerId === washer.id && isWithinInterval(parseISO(log.date), { start: weekStart, end: weekEnd })),
    [timelogs, washer.id, weekStart, weekEnd]
  );

  const monthTimelogs = useMemo(
    () => timelogs.filter(log => log.washerId === washer.id && log.date >= format(monthStart, 'yyyy-MM-dd')),
    [timelogs, washer.id, monthStart]
  );

  const totalTimelogs = useMemo(
    () => timelogs.filter(log => log.washerId === washer.id),
    [timelogs, washer.id]
  );

  const stats = useMemo(() => {
    const sum = (logs: WorkerTimelog[]) => logs.reduce((acc, log) => acc + log.washerShare, 0);
    const sumTime = (logs: WorkerTimelog[]) => logs.reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
    return {
      today: {
        cars: todayTimelogs.length,
        earnings: sum(todayTimelogs),
        avgCheck: todayTimelogs.length ? sum(todayTimelogs) / todayTimelogs.length : 0,
        avgTime: todayTimelogs.length ? sumTime(todayTimelogs) / todayTimelogs.length : 0,
      },
      week: {
        cars: weekTimelogs.length,
        earnings: sum(weekTimelogs),
        avgCheck: weekTimelogs.length ? sum(weekTimelogs) / weekTimelogs.length : 0,
        avgTime: weekTimelogs.length ? sumTime(weekTimelogs) / weekTimelogs.length : 0,
      },
      month: {
        cars: monthTimelogs.length,
        earnings: sum(monthTimelogs),
        avgCheck: monthTimelogs.length ? sum(monthTimelogs) / monthTimelogs.length : 0,
        avgTime: monthTimelogs.length ? sumTime(monthTimelogs) / monthTimelogs.length : 0,
      },
      total: {
        cars: totalTimelogs.length,
        earnings: sum(totalTimelogs),
        avgCheck: totalTimelogs.length ? sum(totalTimelogs) / totalTimelogs.length : 0,
        avgTime: totalTimelogs.length ? sumTime(totalTimelogs) / totalTimelogs.length : 0,
      },
      efficiency: todayTimelogs.length && sumTime(todayTimelogs) > 0 ? (todayTimelogs.length / sumTime(todayTimelogs)) * 100 : 0,
      load: monthTimelogs.length ? (sumTime(monthTimelogs) / (monthTimelogs.length * 60)) * 100 : 0,
    };
  }, [todayTimelogs, weekTimelogs, monthTimelogs, totalTimelogs]);

  const shiftsWithMeta = useMemo(() => {
    const shiftsByDate = new Map(shiftDays.map(day => [day.date, day]));
    return salaryShifts
      .filter(shift => shift.washerId === washer.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(shift => {
        const day = shiftsByDate.get(shift.date);
        const startedAt = day?.startedAt;
        const endedAt = day?.endedAt;
        const durationMinutes = startedAt && endedAt ? Math.round((parseISO(endedAt).getTime() - parseISO(startedAt).getTime()) / 60000) : undefined;
        return {
          ...shift,
          status: day?.status || 'working',
          startedAt,
          endedAt,
          durationMinutes,
          earned: shift.dailyRate + shift.bonus - shift.penalty,
        };
      });
  }, [salaryShifts, shiftDays, washer.id]);

  const filteredShifts = useMemo(() => {
    const range = (() => {
      if (shiftFilter === 'today') {
        const current = new Date();
        return { start: current, end: current };
      }
      if (shiftFilter === 'week') {
        return { start: weekStart, end: weekEnd };
      }
      if (shiftFilter === 'month') {
        return { start: monthStart, end: new Date() };
      }
      return null;
    })();
    if (!range) return shiftsWithMeta;
    return shiftsWithMeta.filter(shift => isWithinInterval(parseISO(shift.date), { start: range.start, end: range.end }));
  }, [shiftFilter, shiftsWithMeta, weekStart, weekEnd, monthStart]);

  const salaryTotals = useMemo(() => {
    const monthShifts = shiftsWithMeta.filter(shift => shift.date >= format(monthStart, 'yyyy-MM-dd'));
    const weekShifts = shiftsWithMeta.filter(shift => isWithinInterval(parseISO(shift.date), { start: weekStart, end: weekEnd }));
    const todayShifts = shiftsWithMeta.filter(shift => shift.date === today);
    const sum = (shifts: typeof shiftsWithMeta) => shifts.reduce((acc, shift) => acc + shift.earned, 0);
    const sumBonus = (shifts: typeof shiftsWithMeta) => shifts.reduce((acc, shift) => acc + shift.bonus, 0);
    const sumPenalty = (shifts: typeof shiftsWithMeta) => shifts.reduce((acc, shift) => acc + shift.penalty, 0);
    return {
      today: {
        earned: sum(todayShifts),
        bonus: sumBonus(todayShifts),
        penalty: sumPenalty(todayShifts),
      },
      week: {
        earned: sum(weekShifts),
        bonus: sumBonus(weekShifts),
        penalty: sumPenalty(weekShifts),
      },
      month: {
        earned: sum(monthShifts),
        bonus: sumBonus(monthShifts),
        penalty: sumPenalty(monthShifts),
      },
      total: {
        earned: sum(shiftsWithMeta),
        bonus: sumBonus(shiftsWithMeta),
        penalty: sumPenalty(shiftsWithMeta),
      },
    };
  }, [shiftsWithMeta, monthStart, weekStart, weekEnd, today]);

  const ordersHistory = useMemo(
    () => orders
      .filter(order => order.washerId === washer.id || order.washerIds?.includes(washer.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20),
    [orders, washer.id]
  );

  const earningsData = useMemo(() => {
    const map = new Map<string, { date: string; earnings: number; cars: number }>();
    totalTimelogs.forEach(log => {
      if (!map.has(log.date)) map.set(log.date, { date: log.date, earnings: 0, cars: 0 });
      const item = map.get(log.date)!;
      item.earnings += log.washerShare;
      item.cars += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  }, [totalTimelogs]);

  const exportProfileAsPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${washer.name} — профиль`, 14, 18);

    autoTable(doc, {
      startY: 26,
      head: [['Поле', 'Значение']],
      body: [
        ['Имя', washer.name],
        ['Телефон', washer.phone || '—'],
        ['Дата приема', format(parseISO(washer.createdAt), 'dd.MM.yyyy')],
        ['Статус', currentStatus?.status || '—'],
        ['Сегодня машин', stats.today.cars.toString()],
        ['Сегодня доход', money(stats.today.earnings)],
        ['Сегодня выплата', money(salaryTotals.today.earned)],
        ['Сегодня бонус', `+${money(salaryTotals.today.bonus)}`],
        ['Сегодня штраф', `-${money(salaryTotals.today.penalty)}`],
        ['Месяц машин', stats.month.cars.toString()],
        ['Месяц доход', money(stats.month.earnings)],
        ['Месяц выплата', money(salaryTotals.month.earned)],
        ['Месяц бонус', `+${money(salaryTotals.month.bonus)}`],
        ['Месяц штраф', `-${money(salaryTotals.month.penalty)}`],
        ['Средний чек', stats.month.cars ? money(stats.month.avgCheck) : '—'],
        ['Среднее время', stats.month.avgTime ? `${Math.round(stats.month.avgTime)} мин` : '—'],
        ['Рейтинг', `${stats.efficiency.toFixed(1)}%`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [14, 165, 233] },
      styles: { fontSize: 10 },
    });

    doc.save(`${washer.name.replace(/\s+/g, '_')}_profile.pdf`);
  };

  const exportProfileAsExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Профиль');

    worksheet.addRows([
      ['Поле', 'Значение'],
      ['Имя', washer.name],
      ['Телефон', washer.phone || '—'],
      ['Дата приема', format(parseISO(washer.createdAt), 'dd.MM.yyyy')],
      ['Статус', currentStatus?.status || '—'],
      ['Сегодня машин', stats.today.cars.toString()],
      ['Сегодня доход', money(stats.today.earnings)],
      ['Месяц машин', stats.month.cars.toString()],
      ['Месяц доход', money(stats.month.earnings)],
      ['Средний чек', stats.month.cars ? money(stats.month.avgCheck) : '—'],
      ['Среднее время', stats.month.avgTime ? `${Math.round(stats.month.avgTime)} мин` : '—'],
      ['Рейтинг', `${stats.efficiency.toFixed(1)}%`],
    ]);

    await downloadWorkbook(workbook, `${washer.name.replace(/\s+/g, '_')}_profile.xlsx`);
  };

  const exportProfileAsCSV = () => {
    const rows = [
      ['Поле', 'Значение'],
      ['Имя', washer.name],
      ['Телефон', washer.phone || '—'],
      ['Дата приема', format(parseISO(washer.createdAt), 'dd.MM.yyyy')],
      ['Статус', currentStatus?.status || '—'],
      ['Сегодня машин', stats.today.cars.toString()],
      ['Сегодня доход', money(stats.today.earnings)],
      ['Сегодня выплата', money(salaryTotals.today.earned)],
      ['Сегодня бонус', `+${money(salaryTotals.today.bonus)}`],
      ['Сегодня штраф', `-${money(salaryTotals.today.penalty)}`],
      ['Месяц машин', stats.month.cars.toString()],
      ['Месяц доход', money(stats.month.earnings)],
      ['Месяц выплата', money(salaryTotals.month.earned)],
      ['Месяц бонус', `+${money(salaryTotals.month.bonus)}`],
      ['Месяц штраф', `-${money(salaryTotals.month.penalty)}`],
      ['Средний чек', stats.month.cars ? money(stats.month.avgCheck) : '—'],
      ['Среднее время', stats.month.avgTime ? `${Math.round(stats.month.avgTime)} мин` : '—'],
      ['Рейтинг', `${stats.efficiency.toFixed(1)}%`],
    ];
    const csv = rows.map(row => row.map(value => `"${value}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${washer.name.replace(/\s+/g, '_')}_profile.csv`;
    link.click();
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    const note: Note = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: noteText.trim(),
      createdAt: new Date().toISOString(),
    };
    setNotes(prev => [note, ...prev]);
    setNoteText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
      <div
        className="modal-panel rounded-2xl p-6 w-full max-w-6xl mx-4 animate-fadeIn neon-glow max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">{washer.name}</h2>
            <p className="text-sm text-slate-400 mt-1">{washer.phone || 'Телефон не указан'}</p>
            <p className="text-xs text-slate-500 mt-2">Принят: {format(parseISO(washer.createdAt), 'dd.MM.yyyy')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportProfileAsPDF} className="btn-neon rounded-lg px-4 py-2 text-sm">PDF</button>
            <button onClick={exportProfileAsExcel} className="btn-neon rounded-lg px-4 py-2 text-sm">Excel</button>
            <button onClick={exportProfileAsCSV} className="btn-neon rounded-lg px-4 py-2 text-sm">CSV</button>
            <button onClick={onClose} className="text-slate-300 hover:text-white text-xl">✕</button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-white/10 overflow-x-auto pb-4">
          {(['profile', 'shifts', 'salary', 'orders', 'analytics', 'notes'] as const).map(item => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === item ? 'btn-neon' : 'text-slate-400 hover:text-white'}`}
            >
              {item === 'profile' && 'Общая информация'}
              {item === 'shifts' && 'Смены'}
              {item === 'salary' && 'Зарплата'}
              {item === 'orders' && 'Заказы'}
              {item === 'analytics' && 'Аналитика'}
              {item === 'notes' && 'Заметки'}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[220px,1fr] gap-4">
              <div className="glass rounded-xl p-5">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-3xl bg-slate-800 flex items-center justify-center text-4xl text-cyan-400">
                    {washer.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Статус</p>
                    <p className="text-lg font-semibold text-white">{currentStatus?.status || 'Не в смене'}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass rounded-xl p-5">
                  <p className="text-xs text-slate-400 mb-2">Телефон</p>
                  <p className="text-white">{washer.phone || '—'}</p>
                </div>
                <div className="glass rounded-xl p-5">
                  <p className="text-xs text-slate-400 mb-2">Дата приема</p>
                  <p className="text-white">{format(parseISO(washer.createdAt), 'dd.MM.yyyy')}</p>
                </div>
                <div className="glass rounded-xl p-5">
                  <p className="text-xs text-slate-400 mb-2">Основной бокс</p>
                  <p className="text-white">{washer.primaryBoxId || '—'}</p>
                </div>
                <div className="glass rounded-xl p-5">
                  <p className="text-xs text-slate-400 mb-2">Текущий бокс</p>
                  <p className="text-white">{currentStatus?.currentBoxId || washer.primaryBoxId || '—'}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="glass rounded-xl p-5">
                <p className="text-xs text-slate-400 mb-2">Сегодня машин</p>
                <p className="text-3xl font-bold text-cyan-400">{stats.today.cars}</p>
              </div>
              <div className="glass rounded-xl p-5">
                <p className="text-xs text-slate-400 mb-2">Доход сегодня</p>
                <p className="text-3xl font-bold text-green-400">{money(stats.today.earnings)}</p>
              </div>
              <div className="glass rounded-xl p-5">
                <p className="text-xs text-slate-400 mb-2">Доход месяц</p>
                <p className="text-3xl font-bold text-purple-400">{money(stats.month.earnings)}</p>
              </div>
              <div className="glass rounded-xl p-5">
                <p className="text-xs text-slate-400 mb-2">Средний чек</p>
                <p className="text-3xl font-bold text-amber-400">{stats.month.cars ? money(stats.month.avgCheck) : '—'}</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'shifts' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">История смен</h3>
                <p className="text-xs text-slate-500">Фильтр по периоду</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['today', 'week', 'month', 'all'] as const).map(option => (
                  <button
                    key={option}
                    onClick={() => setShiftFilter(option)}
                    className={`text-xs px-3 py-2 rounded-lg ${shiftFilter === option ? 'btn-neon' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                  >
                    {option === 'today' ? 'Сегодня' : option === 'week' ? 'Неделя' : option === 'month' ? 'Месяц' : 'Все'}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3 text-left text-xs text-slate-400">Дата</th>
                      <th className="px-4 py-3 text-left text-xs text-slate-400">Начало</th>
                      <th className="px-4 py-3 text-left text-xs text-slate-400">Конец</th>
                      <th className="px-4 py-3 text-left text-xs text-slate-400">Длительность</th>
                      <th className="px-4 py-3 text-left text-xs text-slate-400">Машин</th>
                      <th className="px-4 py-3 text-left text-xs text-slate-400">Доход</th>
                      <th className="px-4 py-3 text-left text-xs text-slate-400">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShifts.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Нет смен за выбранный период</td></tr>
                    ) : (
                      filteredShifts.map(shift => (
                        <tr key={shift.id} className="border-b border-white/5">
                          <td className="px-4 py-3 text-white">{shift.date}</td>
                          <td className="px-4 py-3 text-slate-300">{shift.startedAt ? format(parseISO(shift.startedAt), 'HH:mm') : '—'}</td>
                          <td className="px-4 py-3 text-slate-300">{shift.endedAt ? format(parseISO(shift.endedAt), 'HH:mm') : '—'}</td>
                          <td className="px-4 py-3 text-slate-300">{shift.durationMinutes ? formatDuration(shift.durationMinutes) : '—'}</td>
                          <td className="px-4 py-3 text-slate-300">{shift.ordersCompleted}</td>
                          <td className="px-4 py-3 text-green-400">{money(shift.earned)}</td>
                          <td className="px-4 py-3 text-cyan-400">{shift.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'salary' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="glass rounded-xl p-5">
                <p className="text-xs text-slate-400 mb-2">Сегодня</p>
                <p className="text-3xl font-bold text-cyan-400">{money(salaryTotals.today.earned)}</p>
                <p className="text-xs text-slate-500">Бонус +{money(salaryTotals.today.bonus)} / Штраф -{money(salaryTotals.today.penalty)}</p>
              </div>
              <div className="glass rounded-xl p-5">
                <p className="text-xs text-slate-400 mb-2">Неделя</p>
                <p className="text-3xl font-bold text-green-400">{money(salaryTotals.week.earned)}</p>
                <p className="text-xs text-slate-500">Бонус +{money(salaryTotals.week.bonus)} / Штраф -{money(salaryTotals.week.penalty)}</p>
              </div>
              <div className="glass rounded-xl p-5">
                <p className="text-xs text-slate-400 mb-2">Месяц</p>
                <p className="text-3xl font-bold text-purple-400">{money(salaryTotals.month.earned)}</p>
                <p className="text-xs text-slate-500">Бонус +{money(salaryTotals.month.bonus)} / Штраф -{money(salaryTotals.month.penalty)}</p>
              </div>
              <div className="glass rounded-xl p-5">
                <p className="text-xs text-slate-400 mb-2">Всего</p>
                <p className="text-3xl font-bold text-amber-400">{money(salaryTotals.total.earned)}</p>
                <p className="text-xs text-slate-500">Бонус +{money(salaryTotals.total.bonus)} / Штраф -{money(salaryTotals.total.penalty)}</p>
              </div>
            </div>

            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">История выплат</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-2 text-left text-xs text-slate-400">Дата</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-400">Доход</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-400">Бонус</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-400">Штраф</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftsWithMeta.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Нет истории выплат</td></tr>
                    ) : (
                      shiftsWithMeta.map(shift => (
                        <tr key={shift.id} className="border-b border-white/5">
                          <td className="px-4 py-2 text-white">{shift.date}</td>
                          <td className="px-4 py-2 text-right text-green-400">{money(shift.earned)}</td>
                          <td className="px-4 py-2 text-right text-cyan-400">+{money(shift.bonus)}</td>
                          <td className="px-4 py-2 text-right text-red-400">-{money(shift.penalty)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-3">
            {ordersHistory.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Нет заказов</p>
            ) : (
              ordersHistory.map(order => (
                <div key={order.id} className="glass rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <p className="font-semibold text-white">{order.licensePlate}</p>
                      <p className="text-xs text-slate-400">{format(parseISO(order.createdAt), 'dd.MM.yyyy HH:mm')}</p>
                    </div>
                    <p className="text-cyan-400 font-bold">{money(order.totalAmount)}</p>
                  </div>
                  <p className="text-xs text-slate-300">{order.services.map(service => service.serviceName).join(', ')}</p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'analytics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="glass rounded-xl p-5">
                <p className="text-xs text-slate-400 mb-2">Сегодня машин</p>
                <p className="text-3xl font-bold text-cyan-400">{stats.today.cars}</p>
              </div>
              <div className="glass rounded-xl p-5">
                <p className="text-xs text-slate-400 mb-2">Доход за неделю</p>
                <p className="text-3xl font-bold text-green-400">{money(stats.week.earnings)}</p>
              </div>
              <div className="glass rounded-xl p-5">
                <p className="text-xs text-slate-400 mb-2">Средний чек</p>
                <p className="text-3xl font-bold text-purple-400">{stats.month.cars ? money(stats.month.avgCheck) : '—'}</p>
              </div>
              <div className="glass rounded-xl p-5">
                <p className="text-xs text-slate-400 mb-2">Загрузка</p>
                <p className="text-3xl font-bold text-amber-400">{Math.round(stats.load)}%</p>
              </div>
            </div>

            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Доходы за последние 30 дней</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={earningsData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', color: '#e2e8f0' }} />
                    <Line type="monotone" dataKey="earnings" stroke="#06b6d4" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Количество машин</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={earningsData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', color: '#e2e8f0' }} />
                    <Bar dataKey="cars" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div className="space-y-4">
            <div className="glass rounded-xl p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Заметки</p>
                  <p className="text-xs text-slate-500">Сохраняются в localStorage</p>
                </div>
                <button onClick={addNote} className="btn-neon rounded-lg px-4 py-2 text-sm">Добавить заметку</button>
              </div>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                className="mt-4 w-full rounded-2xl bg-slate-950/40 p-3 text-sm text-white"
                rows={4}
                placeholder="Напишите заметку..."
              />
            </div>
            {notes.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Нет заметок</p>
            ) : (
              <div className="space-y-3">
                {notes.map(note => (
                  <div key={note.id} className="glass rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-sm text-white">{format(parseISO(note.createdAt), 'dd.MM.yyyy HH:mm')}</p>
                      <button onClick={() => setNotes(prev => prev.filter(item => item.id !== note.id))} className="text-xs text-rose-400 hover:text-rose-300">Удалить</button>
                    </div>
                    <p className="text-slate-200 text-sm whitespace-pre-line">{note.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
