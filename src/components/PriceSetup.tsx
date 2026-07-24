import React, { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Service } from '../types';

interface PriceSetupProps {
  services: Service[];
  onPricesSet: (updatedServices: Service[]) => void;
  onSkip?: () => void;
  onAddService?: (service: Service) => void;
}

export const PriceSetup: React.FC<PriceSetupProps> = ({
  services,
  onPricesSet,
  onSkip,
  onAddService,
}) => {
  const [localServices, setLocalServices] = useState<Service[]>(services.map(s => ({
    ...s,
    price: (s as any).price || 0,
  })));
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDescription, setNewServiceDescription] = useState('');

  const handlePriceChange = (serviceId: string, price: string) => {
    setLocalServices(prev =>
      prev.map(s =>
        s.id === serviceId
          ? { ...s, price: parseInt(price) || 0 }
          : s
      )
    );
  };

  const handleDelete = (serviceId: string) => {
    setDeleteConfirm(serviceId);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      setLocalServices(prev => prev.filter(s => s.id !== deleteConfirm));
      setDeleteConfirm(null);
    }
  };

  const handleComplete = () => {
    onPricesSet(localServices);
  };

  const handleAddCustomService = () => {
    const name = newServiceName.trim();
    if (!name) return;

    const service: Service = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      organizationId: '',
      price: Math.max(0, Number(newServicePrice) || 0),
      description: newServiceDescription.trim() || undefined,
      popularity: 0,
      fromLibrary: false,
    };

    const next = [...localServices, service];
    setLocalServices(next);
    onAddService?.(service);
    setNewServiceName('');
    setNewServicePrice('');
    setNewServiceDescription('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Настройка цен</h1>
          <p className="text-slate-400">Установите цены для каждой услуги</p>
        </div>

        {/* Services List */}
        <div className="bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden mb-8">
          <div className="divide-y divide-white/10">
            {localServices.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                Нет услуг для настройки
              </div>
            ) : (
              localServices.map(service => (
                <div
                  key={service.id}
                  className="p-4 hover:bg-white/5 transition flex items-center justify-between group"
                >
                  <div className="flex-1 pr-4">
                    <p className="text-white font-medium">{service.name}</p>
                    {service.description && <p className="text-xs text-slate-500 mt-1">{service.description}</p>}
                  </div>

                  <div className="flex items-center gap-3 ml-4">
                    <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                      <input
                        type="number"
                        value={(service as any).price || 0}
                        onChange={e => handlePriceChange(service.id, e.target.value)}
                        placeholder="0"
                        className="w-24 bg-transparent text-white text-right focus:outline-none"
                        min="0"
                      />
                      <span className="text-slate-400">₸</span>
                    </div>

                    <button
                      onClick={() => handleDelete(service.id)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition opacity-0 group-hover:opacity-100"
                      title="Удалить услугу"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-white/10 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-4 text-cyan-300">
            <Plus className="w-4 h-4" />
            <h3 className="font-semibold">Добавить свою услугу</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={newServiceName} onChange={e => setNewServiceName(e.target.value)} className="input-neon rounded-lg px-4 py-3 text-sm" placeholder="Название" />
            <input value={newServicePrice} onChange={e => setNewServicePrice(e.target.value)} type="number" className="input-neon rounded-lg px-4 py-3 text-sm" placeholder="Цена" />
            <input value={newServiceDescription} onChange={e => setNewServiceDescription(e.target.value)} className="input-neon rounded-lg px-4 py-3 text-sm" placeholder="Описание" />
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={handleAddCustomService} className="btn-neon rounded-lg px-5 py-2 text-sm font-medium">Добавить</button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-sm">
              <h3 className="text-lg font-semibold text-white mb-4">Удалить услугу?</h3>
              <p className="text-slate-400 mb-6">
                {localServices.find(s => s.id === deleteConfirm)?.name}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition"
                >
                  Отмена
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition"
                >
                  Да, удалить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {onSkip && (
            <button
              onClick={onSkip}
              className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition"
            >
              Пропустить
            </button>
          )}
          <button
            onClick={handleComplete}
            className="flex-1 px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition"
          >
            Сохранить цены
          </button>
        </div>
      </div>
    </div>
  );
};

export default PriceSetup;
