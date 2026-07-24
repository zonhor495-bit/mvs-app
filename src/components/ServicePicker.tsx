import { useMemo, useState } from 'react';
import { Check, Search, X, Star } from 'lucide-react';
import { PriceEntry, Service } from '../types';

interface ServicePickerProps {
  services: Service[];
  prices: PriceEntry[];
  carTypeId: string;
  selectedServices: Set<string>;
  onToggleService: (serviceId: string) => void;
  onRemoveService?: (serviceId: string) => void;
  title?: string;
}

export default function ServicePicker({
  services,
  prices,
  carTypeId,
  selectedServices,
  onToggleService,
  onRemoveService,
  title = 'Услуги',
}: ServicePickerProps) {
  const [search, setSearch] = useState('');

  const topServices = useMemo(() => {
    return [...services]
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 10);
  }, [services]);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return services;
    return services.filter(service => service.name.toLowerCase().includes(query));
  }, [services, search]);

  const getServicePrice = (serviceId: string) => {
    const price = prices.find(entry => entry.serviceId === serviceId && entry.carTypeId === carTypeId);
    const service = services.find(item => item.id === serviceId);
    return price?.price ?? service?.price ?? 0;
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <label className="block text-xs text-slate-400">{title} *</label>
        <span className="text-[10px] text-slate-500">1 клик для выбора</span>
      </div>

      {selectedServices.size > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {Array.from(selectedServices).map(serviceId => {
            const service = services.find(item => item.id === serviceId);
            if (!service) return null;
            const price = getServicePrice(serviceId);
            return (
              <span
                key={serviceId}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200"
              >
                <Check className="w-3 h-3" />
                <span>{service.name}</span>
                <span className="text-cyan-400">{price ? `${price.toLocaleString('ru-RU')} ₸` : '—'}</span>
                <button
                  type="button"
                  onClick={() => onRemoveService ? onRemoveService(serviceId) : onToggleService(serviceId)}
                  className="ml-1 text-cyan-200/70 hover:text-white"
                  title="Удалить услугу"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-white/5 bg-white/3 p-3 mb-3">
        <div className="flex items-center gap-2 mb-3 text-amber-300">
          <Star className="w-4 h-4" />
          <h3 className="text-sm font-semibold">ТОП-10 самых популярных услуг</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {topServices.map(service => {
            const checked = selectedServices.has(service.id);
            const price = getServicePrice(service.id);
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => onToggleService(service.id)}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${checked ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-white/5 bg-slate-900/30 hover:bg-white/5'}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-amber-300">⭐</span>
                  <span className="text-sm text-slate-100 truncate">{service.name}</span>
                </span>
                <span className="text-xs text-cyan-300 shrink-0">{price ? `${price.toLocaleString('ru-RU')} ₸` : '—'}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Найти услугу..."
          className="w-full input-neon rounded-lg pl-10 pr-4 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
        {filteredServices.map(service => {
          const checked = selectedServices.has(service.id);
          const price = getServicePrice(service.id);
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onToggleService(service.id)}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${checked ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-white/5 bg-white/3 hover:bg-white/5'}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Check className={`w-3.5 h-3.5 shrink-0 ${checked ? 'text-cyan-300' : 'text-transparent'}`} />
                <span className="text-sm text-slate-200 truncate">{service.name}</span>
              </span>
              <span className="text-xs text-cyan-300 shrink-0">{price ? `${price.toLocaleString('ru-RU')} ₸` : '—'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
