import { useEffect, useMemo, useState, memo } from 'react';
import { format, differenceInDays, isAfter, subDays } from 'date-fns';
import { Organization, UserRole } from '../types';
import { getClients, getVehicles, getCRMOverview } from '../store';
import ClientCard from './ClientCard';
import { cn } from '../utils/cn';
import { exportClientsList, exportRecommendations } from '../utils/crmExport';
import PaginationControl from './PaginationControl';
import { calculatePagination } from '../utils/pagination';

const filterOptions = [
  { key: 'all', label: 'Все' },
  { key: 'vip', label: 'VIP' },
  { key: 'discount', label: 'Со скидкой' },
  { key: 'bonus', label: 'С бонусами' },
  { key: 'new', label: 'Новые' },
  { key: 'lost', label: 'Потерянные' },
  { key: 'regular', label: 'Постоянные' },
] as const;

const sortOptions = [
  { key: 'name', label: 'Имя' },
  { key: 'visits', label: 'Посещений' },
  { key: 'spent', label: 'Потрачено' },
  { key: 'lastVisit', label: 'Последний визит' },
  { key: 'crmScore', label: 'CRM Score' },
] as const;

type FilterKey = (typeof filterOptions)[number]['key'];
type SortKey = (typeof sortOptions)[number]['key'];

interface ClientsProps {
  activeOrg: Organization;
  userRole: UserRole;
}

export default memo(function Clients({ activeOrg, userRole }: ClientsProps) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const clients = useMemo(() => getClients(activeOrg.id), [activeOrg.id, refreshTick]);
  const vehicles = useMemo(() => getVehicles(activeOrg.id), [activeOrg.id, refreshTick]);
  const crmOverview = useMemo(() => getCRMOverview(activeOrg.id), [activeOrg.id, refreshTick]);

  const vehiclesByClientId = useMemo(() => {
    const map = new Map<string, string[]>();
    vehicles.forEach(vehicle => {
      const key = vehicle.clientId;
      const plates = map.get(key);
      const normalized = vehicle.licensePlate?.toLowerCase() || '';
      if (plates) {
        plates.push(normalized);
      } else {
        map.set(key, [normalized]);
      }
    });
    return map;
  }, [vehicles]);

  const avgClientSpent = useMemo(() => {
    return clients.length
      ? Math.round(clients.reduce((sum, client) => sum + (client.totalSpent || 0), 0) / clients.length)
      : 0;
  }, [clients]);

  const crmRecommendations = useMemo(() => {
    const recommendations: Array<{ clientName: string; title: string; description: string; priority: number }> = [];
    const now = Date.now();

    clients.forEach(client => {
      const lastVisit = client.lastVisitAt ? new Date(client.lastVisitAt).getTime() : 0;
      const daysAgo = lastVisit ? Math.round((now - lastVisit) / (1000 * 60 * 60 * 24)) : undefined;
      const totalVisits = client.totalVisits || 0;
      const totalSpent = client.totalSpent || 0;

      if (totalVisits >= 10) {
        recommendations.push({
          clientName: client.fullName,
          priority: 80,
          title: 'Долго лоялен',
          description: `Клиент посетил ${totalVisits} раз. Рекомендуется предложить постоянную скидку.`,
        });
      }

      if (daysAgo !== undefined) {
        if (daysAgo >= 90) {
          recommendations.push({
            clientName: client.fullName,
            priority: 95,
            title: 'Не приезжал 90+ дней',
            description: `Последний визит ${daysAgo} дней назад. Необходимо вернуть клиента.`,
          });
        } else if (daysAgo >= 60) {
          recommendations.push({
            clientName: client.fullName,
            priority: 80,
            title: 'Не приезжал 60+ дней',
            description: `Последний визит ${daysAgo} дней назад. Запустите напоминание.`,
          });
        } else if (daysAgo >= 30) {
          recommendations.push({
            clientName: client.fullName,
            priority: 70,
            title: 'Не приезжал 30+ дней',
            description: `Последний визит ${daysAgo} дней назад. Рекомендуется связаться.`,
          });
        }
      }

      if (totalSpent > avgClientSpent * 1.5 && totalSpent > 0) {
        recommendations.push({
          clientName: client.fullName,
          priority: 85,
          title: 'Высокие траты',
          description: `Клиент тратит больше среднего (${totalSpent}). Рассмотрите VIP/акцию.`,
        });
      }

      if (totalVisits >= 5 && totalVisits < 10) {
        recommendations.push({
          clientName: client.fullName,
          priority: 60,
          title: 'Становится постоянным',
          description: 'Клиент регулярно посещает мойку. Рассмотрите программу лояльности.',
        });
      }
    });

    return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 6);
  }, [clients, avgClientSpent]);

  useEffect(() => {
    const handle = () => setRefreshTick(t => t + 1);
    window.addEventListener('wd-store-changed', handle);
    return () => window.removeEventListener('wd-store-changed', handle);
  }, []);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients
      .filter(client => {
        if (!query) return true;
        const phone = client.phone?.toLowerCase() || '';
        const plates = vehiclesByClientId.get(client.id) || [];
        const matchesVehicle = plates.some(plate => plate.includes(query));
        return client.fullName.toLowerCase().includes(query) || phone.includes(query) || matchesVehicle;
      })
      .filter(client => {
        switch (filter) {
          case 'vip':
            return client.isVip;
          case 'discount':
            return (client.discountPercent || 0) > 0;
          case 'bonus':
            return (client.bonusPoints || 0) > 0;
          case 'new':
            return client.createdAt && isAfter(new Date(client.createdAt), subDays(new Date(), 30));
          case 'lost':
            return !client.lastVisitAt || !isAfter(new Date(client.lastVisitAt), subDays(new Date(), 90));
          case 'regular':
            return (client.totalVisits || 0) >= 5;
          default:
            return true;
        }
      })
      .sort((a, b) => {
        const multiplier = sortDirection === 'asc' ? 1 : -1;
        switch (sortKey) {
          case 'name':
            return multiplier * a.fullName.localeCompare(b.fullName);
          case 'visits':
            return multiplier * ((a.totalVisits || 0) - (b.totalVisits || 0));
          case 'spent':
            return multiplier * ((a.totalSpent || 0) - (b.totalSpent || 0));
          case 'lastVisit':
            return multiplier * ((new Date(a.lastVisitAt || 0).getTime() || 0) - (new Date(b.lastVisitAt || 0).getTime() || 0));
          case 'crmScore':
            return multiplier * ((a.crmScore || 0) - (b.crmScore || 0));
          default:
            return 0;
        }
      });
  }, [clients, vehicles, search, filter, sortKey, sortDirection]);

  useEffect(() => {
    if (!selectedClientId && filteredClients.length > 0) {
      setSelectedClientId(filteredClients[0].id);
    }
  }, [filteredClients, selectedClientId]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, sortKey, sortDirection]);

  const selectedClient = filteredClients.find(c => c.id === selectedClientId) || filteredClients[0] || null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Клиенты</h1>
          <p className="text-slate-400 text-sm">Управление клиентской базой, история, лояльность и рекомендации.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportClientsList(activeOrg, filteredClients, vehicles, 'csv')} className="btn-neon rounded-xl px-4 py-2 text-sm">CSV</button>
          <button type="button" onClick={() => exportClientsList(activeOrg, filteredClients, vehicles, 'xlsx')} className="btn-neon rounded-xl px-4 py-2 text-sm">Excel</button>
          <button type="button" onClick={() => exportClientsList(activeOrg, filteredClients, vehicles, 'pdf')} className="btn-neon rounded-xl px-4 py-2 text-sm">PDF</button>
          <button type="button" onClick={() => exportRecommendations(activeOrg, crmRecommendations, 'csv')} className="btn-neon rounded-xl px-4 py-2 text-sm">Реком. CSV</button>
          <button type="button" onClick={() => exportRecommendations(activeOrg, crmRecommendations, 'xlsx')} className="btn-neon rounded-xl px-4 py-2 text-sm">Реком. Excel</button>
          <button type="button" onClick={() => exportRecommendations(activeOrg, crmRecommendations, 'pdf')} className="btn-neon rounded-xl px-4 py-2 text-sm">Реком. PDF</button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass rounded-3xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Всего клиентов</p>
          <p className="text-3xl font-bold text-white">{clients.length}</p>
        </div>
        <div className="glass rounded-3xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Новые</p>
          <p className="text-3xl font-bold text-white">{crmOverview.newClients.length}</p>
        </div>
        <div className="glass rounded-3xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Потерянные</p>
          <p className="text-3xl font-bold text-white">{crmOverview.lostClients.length}</p>
        </div>
        <div className="glass rounded-3xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">VIP</p>
          <p className="text-3xl font-bold text-white">{crmOverview.vipClients.length}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass rounded-3xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">С бонусами</p>
          <p className="text-3xl font-bold text-white">{crmOverview.clientsWithBonuses.length}</p>
        </div>
        <div className="glass rounded-3xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Со скидкой</p>
          <p className="text-3xl font-bold text-white">{crmOverview.clientsWithDiscounts.length}</p>
        </div>
        <div className="glass rounded-3xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Рекомендации</p>
          <p className="text-3xl font-bold text-white">{crmRecommendations.length}</p>
        </div>
        <div className="glass rounded-3xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Средний чек</p>
          <p className="text-3xl font-bold text-white">{Math.round(clients.reduce((sum, c) => sum + (c.averageCheck || 0), 0) / Math.max(1, clients.length)).toLocaleString('ru-RU')}</p>
        </div>
      </div>

      <div className="glass rounded-3xl p-5">
        <h2 className="text-base font-semibold text-white mb-3">Рекомендации</h2>
        {crmRecommendations.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {crmRecommendations.slice(0, 6).map((rec, index) => (
              <div key={`${rec.clientName}-${index}`} className="rounded-3xl bg-white/5 p-4">
                <p className="text-sm text-slate-400 mb-2">{rec.clientName}</p>
                <p className="text-white font-semibold">{rec.title}</p>
                <p className="text-sm text-slate-300 mt-2">{rec.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Рекомендаций пока нет.</p>
        )}
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Клиенты</h1>
          <p className="text-slate-400 text-sm">Управление клиентской базой, история, лояльность и рекомендации.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону, госномеру"
            className="input-neon rounded-xl px-4 py-3 text-sm w-full sm:w-80"
          />
          <button
            type="button"
            onClick={() => setSearch('')}
            className="btn-neon text-sm rounded-xl px-4 py-3"
          >Очистить</button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={cn(
                'text-xs px-3 py-2 rounded-full border transition-colors',
                filter === option.key
                  ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-200'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-xs text-slate-400">Сортировать:</label>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="input-neon rounded-xl px-3 py-2 text-sm"
          >
            {sortOptions.map(option => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortDirection(dir => (dir === 'asc' ? 'desc' : 'asc'))}
            className="btn-neon rounded-xl px-3 py-2 text-sm"
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_2fr] gap-4">
        <div className="glass rounded-3xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Найдено клиентов</p>
              <h2 className="text-3xl font-bold text-white">{filteredClients.length}</h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Выбрано</p>
              <p className="text-lg font-semibold text-white">{selectedClient?.fullName || '—'}</p>
            </div>
          </div>
          
          {/* Pagination control above table */}
          {filteredClients.length > 0 && (
            <div className="border-b border-white/10 pb-3">
              <PaginationControl
                currentPage={currentPage}
                totalPages={Math.ceil(filteredClients.length / pageSize)}
                onPageChange={setCurrentPage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                totalItems={filteredClients.length}
              />
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-[0.2em]">
                  <th className="py-3 pr-3">Клиент</th>
                  <th className="py-3 pr-3">Телефон</th>
                  <th className="py-3 pr-3">Госномер</th>
                  <th className="py-3 pr-3">Визиты</th>
                  <th className="py-3 pr-3">Потрачено</th>
                  <th className="py-3 pr-3">Последний визит</th>
                  <th className="py-3 pr-3">Статус</th>
                  <th className="py-3 pr-3">CRM Score</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const { items: paginatedClients } = calculatePagination(
                    filteredClients,
                    pageSize,
                    currentPage
                  );
                  if (paginatedClients.length === 0) {
                    return (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          {filteredClients.length === 0 ? 'Клиенты не найдены по заданным фильтрам.' : 'Нет клиентов на этой странице.'}
                        </td>
                      </tr>
                    );
                  }
                  return paginatedClients.map(client => {
                    const plate = vehiclesByClientId.get(client.id)?.[0] || '-';
                    const lastVisit = client.lastVisitAt ? format(new Date(client.lastVisitAt), 'dd.MM.yyyy') : '—';
                    const lastVisitDays = client.lastVisitAt ? differenceInDays(new Date(), new Date(client.lastVisitAt)) : undefined;
                    const statusLabel = lastVisitDays === undefined ? 'Никогда' : lastVisitDays >= 90 ? '90+ дн.' : lastVisitDays >= 60 ? '60+ дн.' : lastVisitDays >= 30 ? '30+ дн.' : 'Активен';
                    return (
                      <tr
                        key={client.id}
                        onClick={() => setSelectedClientId(client.id)}
                        className={cn(
                          'border-t border-white/5 cursor-pointer transition-colors',
                          selectedClient?.id === client.id ? 'bg-cyan-500/10' : 'hover:bg-white/5'
                        )}
                      >
                        <td className="py-3 pr-3 font-medium text-white">{client.fullName}</td>
                        <td className="py-3 pr-3 text-slate-300">{client.phone || '—'}</td>
                        <td className="py-3 pr-3 text-slate-300">{plate}</td>
                        <td className="py-3 pr-3 text-slate-300">{client.totalVisits || 0}</td>
                        <td className="py-3 pr-3 text-slate-300">{(client.totalSpent || 0).toLocaleString('ru-RU')} {activeOrg.currency}</td>
                        <td className="py-3 pr-3 text-slate-300">{lastVisit}</td>
                        <td className="py-3 pr-3 text-slate-300">{statusLabel}</td>
                        <td className="py-3 pr-3 font-semibold text-cyan-300">{client.crmScore || 0}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
          
          {/* Pagination control below table */}
          {filteredClients.length > 0 && (
            <div className="border-t border-white/10 pt-3">
              <PaginationControl
                currentPage={currentPage}
                totalPages={Math.ceil(filteredClients.length / pageSize)}
                onPageChange={setCurrentPage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                totalItems={filteredClients.length}
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {selectedClient ? (
            <ClientCard
              activeOrg={activeOrg}
              client={selectedClient}
              userRole={userRole}
              onSelectClient={setSelectedClientId}
            />
          ) : (
            <div className="glass rounded-3xl p-6 text-center text-slate-400">
              Выберите клиента из списка для просмотра карточки.
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
