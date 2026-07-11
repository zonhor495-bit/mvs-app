import { useEffect, useState } from 'react';
import { Organization, UserRole } from '../types';
import type { LoyaltySettings } from '../types';
import { getLoyaltySettings, saveLoyaltySettings } from '../store';

interface LoyaltySettingsProps {
  activeOrg: Organization;
  userRole: UserRole;
}

export default function LoyaltySettings({ activeOrg, userRole }: LoyaltySettingsProps) {
  const [settings, setSettings] = useState<LoyaltySettings>({
    organizationId: activeOrg.id,
    enabled: false,
    useDiscounts: true,
    useBonuses: true,
    autoVip: false,
    thresholdSilver: 10000,
    thresholdGold: 50000,
    thresholdPlatinum: 100000,
    thresholdVip: 250000,
    maxDiscountPercent: 10,
    bonusValuePerCurrencyUnit: 0.1,
    bonusValidityDays: 365,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const storeSettings = getLoyaltySettings(activeOrg.id);
    if (storeSettings) setSettings(storeSettings);
  }, [activeOrg.id]);

  const handleSave = () => {
    saveLoyaltySettings({ ...settings, organizationId: activeOrg.id });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6 space-y-4">
        <h2 className="text-2xl font-bold text-white">Настройки лояльности</h2>
        <p className="text-sm text-slate-400">Здесь настраиваются бонусы, скидки, уровни и VIP-статусы.</p>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="cursor-pointer rounded-3xl bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Система лояльности</span>
              <input type="checkbox" checked={settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })} className="scale-125" />
            </div>
            <p className="text-xs text-slate-500 mt-2">Включает всю лояльную логику в CRM.</p>
          </label>
          <label className="cursor-pointer rounded-3xl bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Использовать бонусы</span>
              <input type="checkbox" checked={settings.useBonuses} onChange={e => setSettings({ ...settings, useBonuses: e.target.checked })} className="scale-125" />
            </div>
            <p className="text-xs text-slate-500 mt-2">Если выключено, начисление и списание бонусов отключено.</p>
          </label>
          <label className="cursor-pointer rounded-3xl bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Использовать скидки</span>
              <input type="checkbox" checked={settings.useDiscounts} onChange={e => setSettings({ ...settings, useDiscounts: e.target.checked })} className="scale-125" />
            </div>
            <p className="text-xs text-slate-500 mt-2">Если выключено, скидки не доступны клиентам.</p>
          </label>
          <label className="cursor-pointer rounded-3xl bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Автоматический VIP</span>
              <input type="checkbox" checked={settings.autoVip} onChange={e => setSettings({ ...settings, autoVip: e.target.checked })} className="scale-125" />
            </div>
            <p className="text-xs text-slate-500 mt-2">Назначать VIP автоматически при достижении порога.</p>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-white/5 p-4 space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Макс скидка %</label>
            <input type="number" value={settings.maxDiscountPercent} onChange={e => setSettings({ ...settings, maxDiscountPercent: Number(e.target.value) })} className="w-full input-neon rounded-xl px-3 py-2 text-sm" min={0} max={100} />
          </div>
          <div className="rounded-3xl bg-white/5 p-4 space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Стоимость бонуса</label>
            <input type="number" value={settings.bonusValuePerCurrencyUnit} onChange={e => setSettings({ ...settings, bonusValuePerCurrencyUnit: Number(e.target.value) })} className="w-full input-neon rounded-xl px-3 py-2 text-sm" min={0} step={0.01} />
          </div>
          <div className="rounded-3xl bg-white/5 p-4 space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Срок жизни бонусов (дн.)</label>
            <input type="number" value={settings.bonusValidityDays} onChange={e => setSettings({ ...settings, bonusValidityDays: Number(e.target.value) })} className="w-full input-neon rounded-xl px-3 py-2 text-sm" min={0} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-white/5 p-4">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Silver</label>
            <input type="number" value={settings.thresholdSilver} onChange={e => setSettings({ ...settings, thresholdSilver: Number(e.target.value) })} className="w-full input-neon rounded-xl px-3 py-2 text-sm" min={0} />
          </div>
          <div className="rounded-3xl bg-white/5 p-4">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Gold</label>
            <input type="number" value={settings.thresholdGold} onChange={e => setSettings({ ...settings, thresholdGold: Number(e.target.value) })} className="w-full input-neon rounded-xl px-3 py-2 text-sm" min={0} />
          </div>
          <div className="rounded-3xl bg-white/5 p-4">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Platinum</label>
            <input type="number" value={settings.thresholdPlatinum} onChange={e => setSettings({ ...settings, thresholdPlatinum: Number(e.target.value) })} className="w-full input-neon rounded-xl px-3 py-2 text-sm" min={0} />
          </div>
          <div className="rounded-3xl bg-white/5 p-4">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">VIP</label>
            <input type="number" value={settings.thresholdVip} onChange={e => setSettings({ ...settings, thresholdVip: Number(e.target.value) })} className="w-full input-neon rounded-xl px-3 py-2 text-sm" min={0} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <button type="button" onClick={handleSave} className="btn-neon rounded-xl px-5 py-3 text-sm">Сохранить настройки</button>
          {saved && <span className="text-sm text-emerald-300">Сохранено</span>}
          {userRole !== 'manager' && userRole !== 'admin' && <span className="text-sm text-slate-500">Только менеджер и администратор могут редактировать.</span>}
        </div>
      </div>
    </div>
  );
}
