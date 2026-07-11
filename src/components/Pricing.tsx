import { useState } from 'react';
import { Organization, generateId } from '../types';
import { getServices, addService, updateService, deleteService, getCarTypes, addCarType, updateCarType, deleteCarType, getPrices, setPrice } from '../store';

interface PricingProps {
  activeOrg: Organization;
  userRole: 'admin' | 'manager';
}

export default function Pricing({ activeOrg, userRole }: PricingProps) {
  const [services, setServices] = useState(() => getServices(activeOrg.id));
  const [carTypes, setCarTypes] = useState(() => getCarTypes(activeOrg.id));
  const [prices, setPrices] = useState(() => getPrices(activeOrg.id));
  const [newServiceName, setNewServiceName] = useState('');
  const [newCarTypeName, setNewCarTypeName] = useState('');
  const [editingService, setEditingService] = useState<string | null>(null);
  const [editingCarType, setEditingCarType] = useState<string | null>(null);
  const [editServiceName, setEditServiceName] = useState('');
  const [editCarTypeName, setEditCarTypeName] = useState('');
  const [tab, setTab] = useState<'grid' | 'services' | 'cartypes'>('grid');

  const canEdit = userRole === 'manager';

  const refresh = () => {
    setServices(getServices(activeOrg.id));
    setCarTypes(getCarTypes(activeOrg.id));
    setPrices(getPrices(activeOrg.id));
  };

  const getPriceValue = (serviceId: string, carTypeId: string): number => {
    return prices.find(p => p.serviceId === serviceId && p.carTypeId === carTypeId)?.price || 0;
  };

  const handlePriceChange = (serviceId: string, carTypeId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    const existing = prices.find(p => p.serviceId === serviceId && p.carTypeId === carTypeId);
    if (existing) {
      existing.price = numValue;
      setPrice(existing);
    } else {
      setPrice({
        id: generateId(),
        serviceId,
        carTypeId,
        price: numValue,
        organizationId: activeOrg.id,
      });
    }
    setPrices(getPrices(activeOrg.id));
  };

  const handleAddService = () => {
    if (!newServiceName.trim()) return;
    addService({ id: generateId(), name: newServiceName.trim(), organizationId: activeOrg.id });
    setNewServiceName('');
    refresh();
  };

  const handleAddCarType = () => {
    if (!newCarTypeName.trim()) return;
    addCarType({ id: generateId(), name: newCarTypeName.trim(), organizationId: activeOrg.id });
    setNewCarTypeName('');
    refresh();
  };

  const handleDeleteService = (id: string) => {
    if (!confirm('Удалить услугу и все связанные цены?')) return;
    deleteService(id);
    refresh();
  };

  const handleDeleteCarType = (id: string) => {
    if (!confirm('Удалить тип авто и все связанные цены?')) return;
    deleteCarType(id);
    refresh();
  };

  const handleRenameService = (id: string) => {
    if (!editServiceName.trim()) { setEditingService(null); return; }
    const svc = services.find(s => s.id === id);
    if (svc) {
      updateService({ ...svc, name: editServiceName.trim() });
      refresh();
    }
    setEditingService(null);
  };

  const handleRenameCarType = (id: string) => {
    if (!editCarTypeName.trim()) { setEditingCarType(null); return; }
    const ct = carTypes.find(c => c.id === id);
    if (ct) {
      updateCarType({ ...ct, name: editCarTypeName.trim() });
      refresh();
    }
    setEditingCarType(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-white">Прайс и услуги</h1>
        <div className="flex gap-2">
          {['grid', 'services', 'cartypes'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${tab === t ? 'btn-neon' : 'text-slate-400 hover:text-white'}`}
            >
              {t === 'grid' ? '📊 Таблица' : t === 'services' ? '🔧 Услуги' : '🚗 Типы авто'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'grid' && (
        <div className="glass rounded-xl overflow-hidden animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium sticky left-0 bg-[#0a0a1a]/80 backdrop-blur z-10 min-w-40">Услуга</th>
                  {carTypes.map(ct => (
                    <th key={ct.id} className="px-4 py-3 text-center text-xs text-cyan-400 font-medium min-w-28">
                      {editingCarType === ct.id ? (
                        <input
                          type="text"
                          value={editCarTypeName}
                          onChange={e => setEditCarTypeName(e.target.value)}
                          onBlur={() => handleRenameCarType(ct.id)}
                          onKeyDown={e => e.key === 'Enter' && handleRenameCarType(ct.id)}
                          className="input-neon rounded px-2 py-1 text-xs text-center w-full"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:text-cyan-300"
                          onDoubleClick={() => { if (canEdit) { setEditingCarType(ct.id); setEditCarTypeName(ct.name); } }}
                          title={canEdit ? 'Двойной клик для редактирования' : ''}
                        >
                          {ct.name}
                        </span>
                      )}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs text-slate-400 font-medium">Удалить</th>
                </tr>
              </thead>
              <tbody>
                {services.map(svc => (
                  <tr key={svc.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3 text-slate-200 font-medium sticky left-0 bg-[#0a0a1a]/80 backdrop-blur z-10">
                      {editingService === svc.id ? (
                        <input
                          type="text"
                          value={editServiceName}
                          onChange={e => setEditServiceName(e.target.value)}
                          onBlur={() => handleRenameService(svc.id)}
                          onKeyDown={e => e.key === 'Enter' && handleRenameService(svc.id)}
                          className="input-neon rounded px-2 py-1 text-xs w-full"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:text-white"
                          onDoubleClick={() => { if (canEdit) { setEditingService(svc.id); setEditServiceName(svc.name); } }}
                          title={canEdit ? 'Двойной клик для редактирования' : ''}
                        >
                          {svc.name}
                        </span>
                      )}
                    </td>
                    {carTypes.map(ct => (
                      <td key={ct.id} className="px-2 py-3 text-center">
                        {canEdit ? (
                          <input
                            type="number"
                            value={getPriceValue(svc.id, ct.id) || ''}
                            onChange={e => handlePriceChange(svc.id, ct.id, e.target.value)}
                            className="input-neon rounded-lg px-2 py-1.5 text-xs text-center w-full max-w-24"
                            placeholder="0"
                          />
                        ) : (
                          <span className="text-cyan-400">{getPriceValue(svc.id, ct.id).toLocaleString('ru-RU')}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-3 text-center">
                      {canEdit && (
                        <button onClick={() => handleDeleteService(svc.id)} className="text-red-400/50 hover:text-red-400 transition-colors text-xs">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Add service row */}
                {canEdit && (
                  <tr className="border-b border-white/3">
                    <td className="px-4 py-3 sticky left-0 bg-[#0a0a1a]/80 backdrop-blur z-10">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newServiceName}
                          onChange={e => setNewServiceName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddService()}
                          placeholder="+ Новая услуга"
                          className="input-neon rounded px-2 py-1 text-xs flex-1"
                        />
                        <button onClick={handleAddService} className="btn-neon rounded px-3 py-1 text-xs">+</button>
                      </div>
                    </td>
                    {carTypes.map(ct => <td key={ct.id} className="px-2 py-3" />)}
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add car type */}
          {canEdit && (
            <div className="p-4 border-t border-white/5 flex items-center gap-3">
              <span className="text-xs text-slate-400">Новый тип авто:</span>
              <input
                type="text"
                value={newCarTypeName}
                onChange={e => setNewCarTypeName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCarType()}
                placeholder="Название"
                className="input-neon rounded-lg px-3 py-1.5 text-xs"
              />
              <button onClick={handleAddCarType} className="btn-neon rounded-lg px-4 py-1.5 text-xs">Добавить</button>
            </div>
          )}
        </div>
      )}

      {tab === 'services' && (
        <div className="space-y-3 animate-fadeIn">
          {services.map(svc => (
            <div key={svc.id} className="glass rounded-xl p-4 flex items-center justify-between card-hover">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 text-sm">🔧</div>
                {editingService === svc.id ? (
                  <input
                    type="text"
                    value={editServiceName}
                    onChange={e => setEditServiceName(e.target.value)}
                    onBlur={() => handleRenameService(svc.id)}
                    onKeyDown={e => e.key === 'Enter' && handleRenameService(svc.id)}
                    className="input-neon rounded px-3 py-1.5 text-sm"
                    autoFocus
                  />
                ) : (
                  <span
                    className="text-white cursor-pointer hover:text-cyan-400 transition-colors"
                    onDoubleClick={() => { if (canEdit) { setEditingService(svc.id); setEditServiceName(svc.name); } }}
                  >
                    {svc.name}
                  </span>
                )}
              </div>
              {canEdit && (
                <button onClick={() => handleDeleteService(svc.id)} className="text-red-400/50 hover:text-red-400 transition-colors text-xs">Удалить</button>
              )}
            </div>
          ))}
          {canEdit && (
            <div className="glass rounded-xl p-4 flex items-center gap-3">
              <input
                type="text"
                value={newServiceName}
                onChange={e => setNewServiceName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddService()}
                placeholder="Название новой услуги"
                className="input-neon rounded-lg px-4 py-2 text-sm flex-1"
              />
              <button onClick={handleAddService} className="btn-neon rounded-lg px-4 py-2 text-sm">Добавить</button>
            </div>
          )}
        </div>
      )}

      {tab === 'cartypes' && (
        <div className="space-y-3 animate-fadeIn">
          {carTypes.map(ct => (
            <div key={ct.id} className="glass rounded-xl p-4 flex items-center justify-between card-hover">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 text-sm">🚗</div>
                {editingCarType === ct.id ? (
                  <input
                    type="text"
                    value={editCarTypeName}
                    onChange={e => setEditCarTypeName(e.target.value)}
                    onBlur={() => handleRenameCarType(ct.id)}
                    onKeyDown={e => e.key === 'Enter' && handleRenameCarType(ct.id)}
                    className="input-neon rounded px-3 py-1.5 text-sm"
                    autoFocus
                  />
                ) : (
                  <span
                    className="text-white cursor-pointer hover:text-purple-400 transition-colors"
                    onDoubleClick={() => { if (canEdit) { setEditingCarType(ct.id); setEditCarTypeName(ct.name); } }}
                  >
                    {ct.name}
                  </span>
                )}
              </div>
              {canEdit && (
                <button onClick={() => handleDeleteCarType(ct.id)} className="text-red-400/50 hover:text-red-400 transition-colors text-xs">Удалить</button>
              )}
            </div>
          ))}
          {canEdit && (
            <div className="glass rounded-xl p-4 flex items-center gap-3">
              <input
                type="text"
                value={newCarTypeName}
                onChange={e => setNewCarTypeName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCarType()}
                placeholder="Название нового типа авто"
                className="input-neon rounded-lg px-4 py-2 text-sm flex-1"
              />
              <button onClick={handleAddCarType} className="btn-neon rounded-lg px-4 py-2 text-sm">Добавить</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
