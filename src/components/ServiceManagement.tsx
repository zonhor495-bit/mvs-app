import { useMemo, useState } from 'react';
import { Trash2, Plus, Library, Pencil } from 'lucide-react';
import { Organization, Service, generateId } from '../types';
import { MVS_SERVICES_LIBRARY } from '../services-library';
import { getCarTypes, getOrders, getPrices, getServices, addService, deleteService, setPrice, updateService } from '../store';

interface ServiceManagementProps {
  activeOrg: Organization;
}

export default function ServiceManagement({ activeOrg }: ServiceManagementProps) {
  const [services, setServices] = useState<Service[]>(() => getServices(activeOrg.id));
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [editTarget, setEditTarget] = useState<Service | null>(null);
  const [search, setSearch] = useState('');

  const carTypes = useMemo(() => getCarTypes(activeOrg.id), [activeOrg.id]);
  const prices = useMemo(() => getPrices(activeOrg.id), [activeOrg.id, services]);
  const orders = useMemo(() => getOrders(activeOrg.id), [activeOrg.id, services]);
  const existingNames = useMemo(() => new Set(services.map(service => service.name.toLowerCase())), [services]);

  const serviceStats = useMemo(() => {
    const stats = new Map<string, { count: number; revenue: number }>();
    orders.forEach(order => {
      if (order.status !== 'completed') return;
      order.services.forEach(item => {
        const current = stats.get(item.serviceId) || { count: 0, revenue: 0 };
        current.count += 1;
        current.revenue += Number(item.price || 0);
        stats.set(item.serviceId, current);
      });
    });
    return stats;
  }, [orders]);

  const refresh = () => setServices(getServices(activeOrg.id));

  const handleAddFromLibrary = (libraryName: string, category?: string) => {
    if (existingNames.has(libraryName.toLowerCase())) return;

    const service: Service = {
      id: generateId(),
      name: libraryName,
      organizationId: activeOrg.id,
      category,
      popularity: 0,
      fromLibrary: true,
    };

    addService(service);
    refresh();
  };

  const handleAddCustom = () => {
    const name = customName.trim();
    const price = Math.max(0, Math.round(Number(customPrice) || 0));
    if (!name) return;
    if (existingNames.has(name.toLowerCase())) return;

    const service: Service = {
      id: generateId(),
      name,
      organizationId: activeOrg.id,
      description: customDescription.trim() || undefined,
      popularity: 0,
      fromLibrary: false,
      price,
    };

    addService(service);
    if (carTypes.length > 0) {
      carTypes.forEach(carType => {
        setPrice({
          id: generateId(),
          organizationId: activeOrg.id,
          serviceId: service.id,
          carTypeId: carType.id,
          price,
        });
      });
    }

    setCustomName('');
    setCustomPrice('');
    setCustomDescription('');
    refresh();
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteService(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  };

  const handleEditSave = () => {
    if (!editTarget) return;
    const nextPrice = Math.max(0, Number(customPrice) || 0);
    const nextService: Service = {
      ...editTarget,
      name: editTarget.name.trim() || editTarget.name,
      description: customDescription.trim() || editTarget.description,
      price: nextPrice,
    };
    updateService(nextService);
    if (carTypes.length > 0) {
      carTypes.forEach(carType => {
        setPrice({
          id: generateId(),
          organizationId: activeOrg.id,
          serviceId: nextService.id,
          carTypeId: carType.id,
          price: nextPrice,
        });
      });
    }
    setEditTarget(null);
    refresh();
  };

  const filteredLibrary = MVS_SERVICES_LIBRARY.filter(item => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="glass rounded-xl p-6 neon-glow">
        <h2 className="text-xl font-semibold text-white mb-2">🧩 Услуги автомойки</h2>
        <p className="text-xs text-slate-400 mb-4">Выбирайте услуги из библиотеки MVS или добавляйте свои. Повторные услуги скрыты автоматически.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/3 p-4">
            <div className="flex items-center gap-2 mb-3 text-cyan-300">
              <Library className="w-4 h-4" />
              <h3 className="font-semibold">Выбрать из библиотеки MVS</h3>
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full input-neon rounded-lg px-4 py-2 text-sm mb-3"
              placeholder="Поиск по библиотеке..."
            />
            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
              {filteredLibrary.map(item => {
                const exists = existingNames.has(item.name.toLowerCase());
                return (
                  <button
                    key={item.id}
                    disabled={exists}
                    onClick={() => handleAddFromLibrary(item.name, item.category)}
                    className={`w-full flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition border ${exists ? 'border-white/5 bg-white/2 text-slate-500 cursor-not-allowed' : 'border-white/10 bg-slate-900/40 hover:bg-cyan-500/10 hover:border-cyan-500/30 text-white'}`}
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-[11px] text-slate-500 uppercase tracking-wide">{item.category}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${exists ? 'bg-slate-700 text-slate-400' : 'bg-cyan-500/10 text-cyan-300'}`}>
                      {exists ? 'Есть в системе' : '+ Добавить'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/3 p-4">
            <div className="flex items-center gap-2 mb-3 text-purple-300">
              <Plus className="w-4 h-4" />
              <h3 className="font-semibold">Добавить свою услугу</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Название</label>
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="w-full input-neon rounded-lg px-4 py-2 text-sm"
                  placeholder="Например: Защитная полировка"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Цена</label>
                <input
                  type="number"
                  value={customPrice}
                  onChange={e => setCustomPrice(e.target.value)}
                  className="w-full input-neon rounded-lg px-4 py-2 text-sm"
                  placeholder="0"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Описание</label>
                <input
                  value={customDescription}
                  onChange={e => setCustomDescription(e.target.value)}
                  className="w-full input-neon rounded-lg px-4 py-2 text-sm"
                  placeholder="Необязательно"
                />
              </div>
              <button
                onClick={handleAddCustom}
                disabled={!customName.trim()}
                className="w-full btn-neon rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Текущие услуги автомойки</h3>
        <div className="space-y-2">
          {services.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center">Услуг пока нет</div>
          ) : (
            services.map(service => {
              const servicePrices = prices.filter(price => price.serviceId === service.id);
              const displayPrice = servicePrices[0]?.price ?? service.price ?? 0;
              const stats = serviceStats.get(service.id) || { count: 0, revenue: 0 };
              return (
                <div key={service.id} className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-white/3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium">{service.name}</p>
                    {service.description && <p className="text-xs text-slate-500 mt-1">{service.description}</p>}
                    <p className="text-xs text-slate-500">
                      {service.fromLibrary ? 'Из библиотеки MVS' : 'Своя услуга'}
                      {service.category ? ` • ${service.category}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">Использований: {stats.count} • Выручка: {stats.revenue.toLocaleString('ru-RU')} ₸</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-cyan-300">{displayPrice.toLocaleString('ru-RU')} ₸</span>
                    <button
                      onClick={() => {
                        setEditTarget(service);
                        setCustomPrice(String(displayPrice));
                        setCustomDescription(service.description || '');
                      }}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-300 transition"
                      title="Редактировать"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(service)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition"
                      title="Удалить услугу"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-panel rounded-2xl p-6 w-full max-w-sm animate-fadeIn" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white">Удалить услугу?</h3>
            <p className="text-sm text-slate-400 mt-2">{deleteTarget.name}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white"
              >
                Отмена
              </button>
              <button onClick={handleDelete} className="btn-danger rounded-lg px-5 py-2 text-sm font-medium">
                Да
              </button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="modal-panel rounded-2xl p-6 w-full max-w-md animate-fadeIn" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white">Редактировать услугу</h3>
            <div className="mt-4 space-y-3">
              <input value={editTarget.name} onChange={e => setEditTarget(prev => prev ? { ...prev, name: e.target.value } : prev)} className="w-full input-neon rounded-lg px-4 py-3 text-sm" placeholder="Название" />
              <input value={customDescription} onChange={e => setCustomDescription(e.target.value)} className="w-full input-neon rounded-lg px-4 py-3 text-sm" placeholder="Описание" />
              <input value={customPrice} onChange={e => setCustomPrice(e.target.value)} type="number" className="w-full input-neon rounded-lg px-4 py-3 text-sm" placeholder="Цена" min={0} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditTarget(null)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white">Отмена</button>
              <button onClick={handleEditSave} className="btn-neon rounded-lg px-5 py-2 text-sm font-medium">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
