import React, { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { generateId, Service } from '../types';
import { MVS_SERVICES_LIBRARY } from '../services-library';
import PriceSetup from './PriceSetup';

type SetupStep = 'mode' | 'services' | 'prices' | 'organization';
type SetupMode = 'template' | 'manual';

interface FirstRunWizardProps {
  user: any;
  onLogout: () => void;
  onComplete: (payload: {
    washName: string;
    ownerName: string;
    timezone: string;
    currency: string;
    language: string;
    services: Service[];
  }) => void;
}

function libraryToService(item: typeof MVS_SERVICES_LIBRARY[number]): Service {
  return {
    id: item.id,
    name: item.name,
    organizationId: '',
    category: item.category,
    description: item.description,
    popularity: 0,
    fromLibrary: true,
    price: 0,
  };
}

export const FirstRunWizard: React.FC<FirstRunWizardProps> = ({ user, onLogout, onComplete }) => {
  const [step, setStep] = useState<SetupStep>('mode');
  const [mode, setMode] = useState<SetupMode>('template');
  const [search, setSearch] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customServices, setCustomServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [selectedServicesSnapshot, setSelectedServicesSnapshot] = useState<Service[]>([]);
  const [washName, setWashName] = useState('');
  const [ownerName, setOwnerName] = useState(user?.name || '');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Almaty');
  const [currency, setCurrency] = useState('тг');
  const [language, setLanguage] = useState('ru');

  const libraryServices = useMemo(() => MVS_SERVICES_LIBRARY.map(libraryToService), []);
  const allSelectableServices = useMemo(() => (mode === 'template' ? [...libraryServices, ...customServices] : [...customServices]), [mode, libraryServices, customServices]);
  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mode === 'template' ? libraryServices : customServices;
    return (mode === 'template' ? libraryServices : customServices).filter(service =>
      service.name.toLowerCase().includes(q) ||
      (service.description || '').toLowerCase().includes(q) ||
      (service.category || '').toLowerCase().includes(q)
    );
  }, [mode, libraryServices, customServices, search]);

  const selectedServices = useMemo(() => allSelectableServices.filter(service => selectedServiceIds.has(service.id)), [allSelectableServices, selectedServiceIds]);

  const startMode = (nextMode: SetupMode) => {
    setMode(nextMode);
    setStep('services');
    setSelectedServiceIds(new Set());
    setCustomServices([]);
    setSelectedServicesSnapshot([]);
    setSearch('');
  };

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId); else next.add(serviceId);
      return next;
    });
  };

  const addCustomService = () => {
    const name = customName.trim();
    if (!name) return;

    const service: Service = {
      id: generateId(),
      name,
      organizationId: '',
      description: customDescription.trim() || undefined,
      popularity: 0,
      fromLibrary: false,
      price: Math.max(0, Math.round(Number(customPrice) || 0)),
    };

    setCustomServices(prev => [...prev, service]);
    setSelectedServiceIds(prev => new Set(prev).add(service.id));
    setCustomName('');
    setCustomPrice('');
    setCustomDescription('');
  };

  const handlePricesSet = (updatedServices: Service[]) => {
    setSelectedServicesSnapshot(updatedServices);
    setStep('organization');
  };

  const handleSubmit = () => {
    if (!washName.trim()) return;
    onComplete({
      washName,
      ownerName,
      timezone,
      currency,
      language,
      services: selectedServicesSnapshot,
    });
  };

  if (step === 'mode') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 grid-bg flex items-center justify-center p-6">
        <div className="w-full max-w-3xl glass-strong rounded-2xl p-8 neon-glow">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Первоначальная настройка</h1>
              <p className="text-sm text-slate-400 mt-1">Выберите способ быстрого старта</p>
            </div>
            <button onClick={onLogout} className="text-xs text-slate-500 hover:text-red-400">Выйти</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => startMode('template')} className="text-left rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 hover:bg-cyan-500/10 hover:border-cyan-500/40 transition">
              <p className="text-cyan-300 font-semibold text-lg mb-2">Использовать шаблон MVS</p>
              <p className="text-sm text-slate-300">Автоматически откроется библиотека услуг, затем настройка цен.</p>
            </button>
            <button onClick={() => startMode('manual')} className="text-left rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 hover:border-white/20 transition">
              <p className="text-white font-semibold text-lg mb-2">Настроить вручную</p>
              <p className="text-sm text-slate-300">Добавляйте только свои услуги и сразу задавайте им цену.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'services') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 grid-bg p-6">
        <div className="max-w-6xl mx-auto glass-strong rounded-2xl p-8 neon-glow">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Выбор услуг</h1>
              <p className="text-sm text-slate-400 mt-1">
                {mode === 'template'
                  ? 'Отметьте только те услуги, которые используете. Можно добавить свою услугу, если её нет в библиотеке.'
                  : 'Добавляйте свои услуги и сразу отмечайте их для установки цен.'}
              </p>
            </div>
            <button onClick={onLogout} className="text-xs text-slate-500 hover:text-red-400">Выйти</button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-4">
              {mode === 'template' && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 mb-3 text-cyan-300">
                    <Search className="w-4 h-4" />
                    <h2 className="font-semibold">Библиотека услуг MVS</h2>
                  </div>
                  <input value={search} onChange={e => setSearch(e.target.value)} className="w-full input-neon rounded-lg px-4 py-3 text-sm mb-4" placeholder="🔍 Найти услугу..." />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[540px] overflow-y-auto pr-1">
                    {filteredServices.map(service => {
                      const checked = selectedServiceIds.has(service.id);
                      return (
                        <button key={service.id} type="button" onClick={() => toggleService(service.id)} className={`rounded-xl border px-4 py-3 text-left transition ${checked ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-white/10 bg-slate-900/30 hover:bg-white/5'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">{service.name}</p>
                              <p className="text-xs text-slate-500 mt-1">{service.description}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${checked ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-slate-400'}`}>
                              {checked ? 'Выбрано' : 'Добавить'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {mode === 'manual' && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h2 className="font-semibold text-white mb-3">Свои услуги</h2>
                  <p className="text-sm text-slate-400 mb-4">Добавьте услуги, которые используете, затем продолжите к настройке цен.</p>
                  <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                    {customServices.length === 0 ? (
                      <div className="text-sm text-slate-500 py-10 text-center">Пока нет добавленных услуг</div>
                    ) : customServices.map(service => {
                      const checked = selectedServiceIds.has(service.id);
                      return (
                        <button key={service.id} type="button" onClick={() => toggleService(service.id)} className={`w-full rounded-xl border px-4 py-3 text-left transition ${checked ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-white/10 bg-slate-900/30 hover:bg-white/5'}`}>
                          <p className="font-medium text-white">{service.name}</p>
                          {service.description && <p className="text-xs text-slate-500 mt-1">{service.description}</p>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 mb-3 text-purple-300">
                  <Plus className="w-4 h-4" />
                  <h2 className="font-semibold">Добавить свою услугу</h2>
                </div>
                <div className="space-y-3">
                  <input value={customName} onChange={e => setCustomName(e.target.value)} className="w-full input-neon rounded-lg px-4 py-3 text-sm" placeholder="Название" />
                  <input value={customPrice} onChange={e => setCustomPrice(e.target.value)} type="number" className="w-full input-neon rounded-lg px-4 py-3 text-sm" placeholder="Цена" min={0} />
                  <input value={customDescription} onChange={e => setCustomDescription(e.target.value)} className="w-full input-neon rounded-lg px-4 py-3 text-sm" placeholder="Описание (необязательно)" />
                  <button onClick={addCustomService} className="w-full btn-neon rounded-lg px-4 py-3 text-sm font-medium">Добавить свою услугу</button>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h2 className="font-semibold text-white mb-3">Выбрано услуг: {selectedServices.length}</h2>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {selectedServices.length === 0 ? (
                    <div className="text-sm text-slate-500 py-4">Пока ничего не выбрано</div>
                  ) : selectedServices.map(service => (
                    <div key={service.id} className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2">
                      <p className="text-sm text-white font-medium">{service.name}</p>
                      {service.description && <p className="text-xs text-slate-500 mt-1">{service.description}</p>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('mode')} className="px-5 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition">Назад</button>
                <button onClick={() => { setSelectedServicesSnapshot(selectedServices.map(service => ({ ...service, id: generateId() }))); setStep('prices'); }} disabled={selectedServices.length === 0} className="flex-1 btn-neon rounded-lg px-5 py-3 text-sm font-medium disabled:opacity-50">К настройке цен</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'prices') {
    return <PriceSetup services={selectedServicesSnapshot} onPricesSet={handlePricesSet} onSkip={() => setStep('organization')} />;
  }

  return (
    <div className="h-full min-h-full flex items-center justify-center grid-bg bg-slate-950 text-slate-100 relative overflow-hidden">
      <div className="relative z-10 w-full max-w-2xl px-6 animate-fadeIn">
        <div className="glass-strong rounded-2xl p-8 neon-glow">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Информация об автомойке</h1>
              <p className="text-sm text-slate-400 mt-1">Заполните основные данные</p>
            </div>
            <button onClick={onLogout} className="text-xs text-slate-500 hover:text-red-400">Выйти</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-400 mb-2">Название автомойки</label>
              <input value={washName} onChange={e => setWashName(e.target.value)} className="w-full input-neon rounded-lg px-4 py-3 text-sm" placeholder="Например, Aqua Drive" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Владелец</label>
              <input value={ownerName} onChange={e => setOwnerName(e.target.value)} className="w-full input-neon rounded-lg px-4 py-3 text-sm" placeholder="Имя владельца" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Часовой пояс</label>
              <input value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full input-neon rounded-lg px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Валюта</label>
              <input value={currency} onChange={e => setCurrency(e.target.value)} className="w-full input-neon rounded-lg px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Язык</label>
              <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full input-neon rounded-lg px-4 py-3 text-sm">
                <option value="ru">Русский</option>
                <option value="kk">Қазақша</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setStep('prices')} className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition">Назад к ценам</button>
            <button onClick={handleSubmit} disabled={!washName.trim()} className="btn-neon rounded-lg px-6 py-3 text-sm font-semibold disabled:opacity-50">Создать автомойку</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirstRunWizard;
