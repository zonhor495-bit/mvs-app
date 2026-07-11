import { useState, useMemo } from 'react';
import { Organization } from '../types';
import { getWorkerTimelogsForWasher, calcWasherAnalytics, getWashers } from '../store';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface WasherAnalyticsProps {
  activeOrg: Organization;
  washerId?: string;
}

const COLORS = ['#10b981', '#fbbf24', '#f87171'];

export default function WasherAnalytics({ activeOrg, washerId: initialWasherId }: WasherAnalyticsProps) {
  const washers = useMemo(() => getWashers(activeOrg.id), [activeOrg.id]);
  const [washerId, setWasherId] = useState(initialWasherId || washers[0]?.id || '');
  const [periodDays, setPeriodDays] = useState(30);

  const washer = useMemo(() => washers.find(w => w.id === washerId), [washers, washerId]);
  
  const toDate = format(new Date(), 'yyyy-MM-dd');
  const fromDate = format(subDays(new Date(), periodDays), 'yyyy-MM-dd');
  
  const timelogs = useMemo(() => {
    if (!washerId) return [];
    return getWorkerTimelogsForWasher(activeOrg.id, washerId, fromDate, toDate);
  }, [activeOrg.id, washerId, fromDate, toDate]);

  const analytics = useMemo(() => {
    if (!washerId) return null;
    return calcWasherAnalytics(washerId, fromDate, toDate, activeOrg.id);
  }, [washerId, fromDate, toDate, activeOrg.id]);

  // Данные за дни для графика
  const dailyData = useMemo(() => {
    const data: Record<string, { date: string; orders: number; earnings: number; minutes: number }> = {};
    timelogs.forEach(log => {
      if (!data[log.date]) {
        data[log.date] = { date: log.date, orders: 0, earnings: 0, minutes: 0 };
      }
      data[log.date].orders += 1;
      data[log.date].earnings += log.washerShare;
      data[log.date].minutes += log.durationMinutes || 0;
    });
    return Object.values(data).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  }, [timelogs]);

  // Распределение по степеням загрязнения
  const dirtLevelData = useMemo(() => {
    if (!analytics) return [];
    return [
      { name: 'Лёгкие', value: analytics.lightCarsCount, color: '#10b981' },
      { name: 'Средние', value: analytics.mediumCarsCount, color: '#fbbf24' },
      { name: 'Сложные', value: analytics.heavyCarsCount, color: '#f87171' },
    ].filter(d => d.value > 0);
  }, [analytics]);

  if (!washer) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-white">Нет данных</h1>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">👤 Аналитика сотрудника</h1>
          <p className="text-sm text-slate-400 mt-1">{washer.name}</p>
        </div>
        <div className="flex gap-3">
          <select
            value={washerId}
            onChange={e => setWasherId(e.target.value)}
            className="input-neon rounded-lg px-4 py-2 text-sm"
          >
            {washers.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <select
            value={periodDays}
            onChange={e => setPeriodDays(Number(e.target.value))}
            className="input-neon rounded-lg px-4 py-2 text-sm"
          >
            <option value={7}>7 дней</option>
            <option value={14}>14 дней</option>
            <option value={30}>30 дней</option>
            <option value={90}>90 дней</option>
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-5 card-hover">
          <p className="text-xs text-slate-400 mb-1">Автомобилей</p>
          <p className="text-3xl font-bold text-cyan-400">{analytics?.totalCarsCount || 0}</p>
          <p className="text-xs text-slate-500 mt-1">{analytics?.totalOrdersCount || 0} заказов</p>
        </div>

        <div className="glass rounded-xl p-5 card-hover">
          <p className="text-xs text-slate-400 mb-1">Заработок</p>
          <p className="text-3xl font-bold text-green-400">
            {((analytics?.totalEarnings || 0) / 1000).toFixed(1)}k
          </p>
          <p className="text-xs text-slate-500 mt-1">{activeOrg.currency}</p>
        </div>

        <div className="glass rounded-xl p-5 card-hover">
          <p className="text-xs text-slate-400 mb-1">Рабочие часы</p>
          <p className="text-3xl font-bold text-purple-400">
            {Math.round((analytics?.totalWorkMinutes || 0) / 60)}ч
          </p>
          <p className="text-xs text-slate-500 mt-1">{(analytics?.totalWorkMinutes || 0) % 60}м</p>
        </div>

        <div className="glass rounded-xl p-5 card-hover">
          <p className="text-xs text-slate-400 mb-1">Среднее время</p>
          <p className="text-3xl font-bold text-amber-400">
            {analytics?.averageOrderTime || 0}м
          </p>
          <p className="text-xs text-slate-500 mt-1">на заказ</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily chart */}
        <div className="lg:col-span-2 glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Заказы последние 14 дней</h3>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(date: string) => format(new Date(date), 'dd')}
                />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10,10,26,0.9)',
                    border: '1px solid rgba(0,212,255,0.2)',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                  }}
                />
                <Bar dataKey="orders" fill="#00d4ff" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-500">
              Нет данных
            </div>
          )}
        </div>

        {/* Dirt level pie */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Распределение по загрязнению</h3>
          {dirtLevelData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={dirtLevelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {dirtLevelData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10,10,26,0.9)',
                    border: '1px solid rgba(0,212,255,0.2)',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-500">
              Нет данных
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {dirtLevelData.map((d, i) => (
              <div key={i} className="text-xs flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-slate-400">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional stats */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Дополнительные показатели</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">Совместные заказы</p>
            <p className="text-lg font-bold text-cyan-400">{analytics?.coworkOrdersCount || 0}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Средний заработок/день</p>
            <p className="text-lg font-bold text-green-400">
              {timelogs.length > 0
                ? ((analytics?.totalEarnings || 0) / Math.ceil((analytics?.totalWorkMinutes || 1) / 480)).toLocaleString('ru-RU')
                : '0'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Легких авто</p>
            <p className="text-lg font-bold text-green-500">{analytics?.lightCarsCount || 0}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Сложных авто</p>
            <p className="text-lg font-bold text-red-400">{analytics?.heavyCarsCount || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
