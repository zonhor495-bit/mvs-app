import { useEffect, useMemo, useState } from 'react';
import { format, differenceInDays, isSameMonth, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Client, Organization, UserRole, Vehicle, generateId } from '../types';
import { getVehicles, getOrders, addVehicle, updateClient, updateVehicle, deleteVehicle, getLoyaltySettings, accrueBonus, spendBonus, refundBonus, cancelBonusOperation, setClientDiscount, setClientVip, getActionLogs, addActionLog, getClientRecommendationsStructured } from '../store';
import VehicleCard from './VehicleCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { exportClientCsv, exportClientExcel, exportClientPdf } from '../utils/crmExport';

interface ClientCardProps {
  activeOrg: Organization;
  client: Client;
  userRole: UserRole;
  onSelectClient: (id: string | null) => void;
}

const tabs = ['main', 'cars', 'visits', 'preferences', 'analytics', 'loyalty', 'notes'] as const;

type ClientTab = (typeof tabs)[number];

export default function ClientCard({ activeOrg, client, userRole, onSelectClient }: ClientCardProps) {
  const [tab, setTab] = useState<ClientTab>('main');
  const [refreshTick, setRefreshTick] = useState(0);
  const [fullNameDraft, setFullNameDraft] = useState(client.fullName);
  const [phoneDraft, setPhoneDraft] = useState(client.phone || '');
  const [notesDraft, setNotesDraft] = useState(client.notes || '');
  const [infoSaved, setInfoSaved] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [bonusReason, setBonusReason] = useState('');
  const [cancelBonusId, setCancelBonusId] = useState('');
  const [discountValue, setDiscountValue] = useState(client.discountPercent || 0);
  const [discountReason, setDiscountReason] = useState('');
  const [vipReason, setVipReason] = useState('');
  const [vehicleForm, setVehicleForm] = useState<Partial<Vehicle>>({ licensePlate: '', make: '', model: '', year: '', color: '', vin: '', comment: '' });
  const [vehicleFormError, setVehicleFormError] = useState('');
  const [isCreatingVehicle, setIsCreatingVehicle] = useState(false);

  const vehicles = useMemo(() => getVehicles(activeOrg.id).filter(v => v.clientId === client.id), [activeOrg.id, client.id, refreshTick]);
  const vehicleIds = useMemo(() => new Set(vehicles.map(v => v.id)), [vehicles]);
  const orders = useMemo(() => getOrders(activeOrg.id).filter(o => o.clientId === client.id || (o.vehicleId && vehicleIds.has(o.vehicleId))), [activeOrg.id, client.id, vehicleIds, refreshTick]);
  const ordersByVehicleId = useMemo(() => {
    const map = new Map();
    for (const order of orders) {
      if (order.vehicleId) {
        const list = map.get(order.vehicleId) || [];
        list.push(order);
        map.set(order.vehicleId, list);
      }
    }
    return map;
  }, [orders]);
  const ordersByPlate = useMemo(() => {
    const map = new Map();
    for (const order of orders) {
      const plate = (order.licensePlate || '').toLowerCase();
      if (!plate) continue;
      const list = map.get(plate) || [];
      list.push(order);
      map.set(plate, list);
    }
    return map;
  }, [orders]);
  const loyaltySettings = getLoyaltySettings(activeOrg.id) || {
    organizationId: activeOrg.id,
    enabled: false,
    useDiscounts: true,
    useBonuses: true,
    autoVip: false,
    thresholdSilver: 0,
    thresholdGold: 0,
    thresholdPlatinum: 0,
    thresholdVip: 0,
    maxDiscountPercent: 0,
    bonusValuePerCurrencyUnit: 0,
    bonusValidityDays: 0,
  };

  useEffect(() => {
    const handleStoreChanged = () => setRefreshTick(t => t + 1);
    window.addEventListener('wd-store-changed', handleStoreChanged);
    return () => window.removeEventListener('wd-store-changed', handleStoreChanged);
  }, []);

  useEffect(() => {
    setFullNameDraft(client.fullName);
    setPhoneDraft(client.phone || '');
    setNotesDraft(client.notes || '');
    setDiscountValue(client.discountPercent || 0);
    setInfoSaved(false);
  }, [client]);

  const actionLogs = useMemo(() => {
    return getActionLogs(activeOrg.id)
      .filter(log => log.targetType === 'client' && log.targetId === client.id)
      .slice(-5)
      .reverse();
  }, [activeOrg.id, client.id, refreshTick]);
  const recommendations = useMemo(() => getClientRecommendationsStructured(activeOrg.id, client.id), [activeOrg.id, client.id, refreshTick]);

  const handleSaveClientInfo = () => {
    const changes: Record<string, { oldValue: any; newValue: any }> = {};
    if (client.fullName !== fullNameDraft) changes.fullName = { oldValue: client.fullName, newValue: fullNameDraft };
    if ((client.phone || '') !== phoneDraft) changes.phone = { oldValue: client.phone || '', newValue: phoneDraft };
    if ((client.notes || '') !== notesDraft) changes.notes = { oldValue: client.notes || '', newValue: notesDraft };
    if (Object.keys(changes).length === 0) return;

    const updated: Client = {
      ...client,
      fullName: fullNameDraft || client.fullName,
      phone: phoneDraft || undefined,
      notes: notesDraft || undefined,
    };
    updateClient(updated);
    addActionLog({
      id: generateId(),
      organizationId: activeOrg.id,
      performedBy: userRole === 'manager' ? 'Управляющий' : 'Администратор',
      action: 'modify_client',
      targetType: 'client',
      targetId: client.id,
      targetName: updated.fullName,
      changes,
      description: 'Изменены данные клиента',
      createdAt: new Date().toISOString(),
    });
    refreshClient();
    setInfoSaved(true);
    window.setTimeout(() => setInfoSaved(false), 2000);
  };

  const historyOrders = useMemo(() => {
    return orders.slice().sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());
  }, [orders]);

  const favoriteWashers = useMemo(() => {
    const counts = new Map<string, number>();
    orders.forEach(o => { if (o.washerName) counts.set(o.washerName, (counts.get(o.washerName) || 0) + 1); });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name).slice(0, 5);
  }, [orders]);

  const favoriteBoxes = useMemo(() => {
    const counts = new Map<string, number>();
    orders.forEach(o => { if (o.boxName) counts.set(o.boxName, (counts.get(o.boxName) || 0) + 1); });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name).slice(0, 5);
  }, [orders]);

  const popularServices = useMemo(() => {
    const counts = new Map<string, number>();
    orders.flatMap(o => o.services).forEach(service => {
      counts.set(service.serviceName, (counts.get(service.serviceName) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name).slice(0, 5);
  }, [orders]);

  const lastVisitDays = client.lastVisitAt ? differenceInDays(new Date(), new Date(client.lastVisitAt)) : undefined;
  const visitReminder = lastVisitDays !== undefined ? (lastVisitDays >= 90 ? 'Не был 90+ дней — свяжитесь с клиентом.' : lastVisitDays >= 60 ? 'Не был 60+ дней — отправьте напоминание.' : lastVisitDays >= 30 ? 'Не был 30+ дней — предложите акцию.' : null) : null;
  const avgInterval = client.averageVisitIntervalDays || undefined;
  const monthlySummary = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, index) => {
      const date = subMonths(new Date(), 5 - index);
      const key = format(date, 'MMM yyyy', { locale: ru });
      const monthOrders = orders.filter(o => o.completedAt && isSameMonth(new Date(o.completedAt), date));
      return {
        name: key,
        spent: monthOrders.reduce((sum, order) => sum + order.totalAmount, 0),
        visits: monthOrders.length,
        averageCheck: monthOrders.length ? Math.round(monthOrders.reduce((sum, order) => sum + order.totalAmount, 0) / monthOrders.length) : 0,
      };
    });
    return months;
  }, [orders]);

  const handleSaveNotes = () => {
    updateClient({ ...client, notes: notesDraft });
  };

  const refreshClient = () => setRefreshTick(t => t + 1);

  const handleSaveVehicle = () => {
    const plate = (vehicleForm.licensePlate || '').trim().toUpperCase();
    if (!plate) {
      setVehicleFormError('Введите госномер автомобиля');
      return;
    }
    const duplicate = vehicles.some(v => v.licensePlate.trim().toUpperCase() === plate && v.id !== activeVehicle?.id);
    if (duplicate) {
      setVehicleFormError('Автомобиль с таким номером уже есть.');
      return;
    }
    const saveData: Vehicle = {
      id: activeVehicle?.id || generateId(),
      clientId: client.id,
      ownerClientId: client.id,
      organizationId: activeOrg.id,
      make: vehicleForm.make?.trim() || undefined,
      model: vehicleForm.model?.trim() || undefined,
      year: vehicleForm.year?.trim() || undefined,
      color: vehicleForm.color?.trim() || undefined,
      licensePlate: plate,
      vin: vehicleForm.vin?.trim() || undefined,
      comment: vehicleForm.comment?.trim() || undefined,
      createdAt: activeVehicle?.createdAt || new Date().toISOString(),
      firstVisitAt: activeVehicle?.firstVisitAt || client.firstVisitAt,
      lastVisitAt: activeVehicle?.lastVisitAt || client.lastVisitAt,
      visitsCount: activeVehicle?.visitsCount || 0,
      totalSpent: activeVehicle?.totalSpent || 0,
      orderIds: activeVehicle?.orderIds || [],
      popularServices: activeVehicle?.popularServices || [],
      photos: activeVehicle?.photos || [],
    };
    if (activeVehicle) {
      updateVehicle(saveData);
    } else {
      addVehicle(saveData);
      setActiveVehicleId(saveData.id);
    }
    setIsCreatingVehicle(false);
    setVehicleFormError('');
  };

  const handleDeleteVehicle = () => {
    if (!activeVehicle) return;
    if (!confirm('Автомобиль будет архивирован. Продолжить?')) return;
    deleteVehicle(activeVehicle.id);
    setActiveVehicleId(null);
    setVehicleForm({ licensePlate: '', make: '', model: '', year: '', color: '', vin: '', comment: '' });
    setIsCreatingVehicle(false);
    setVehicleFormError('');
  };

  const handleBonusAction = (type: 'accrue' | 'spend' | 'refund') => {
    if (bonusAmount <= 0) return;
    if (!loyaltySettings.enabled || !loyaltySettings.useBonuses) return;
    const performer = userRole === 'manager' ? 'Управляющий' : 'Администратор';
    const reason = bonusReason || (type === 'accrue' ? 'Начисление бонусов' : type === 'spend' ? 'Списание бонусов' : 'Возврат бонусов');
    if (type === 'accrue') {
      accrueBonus(activeOrg.id, client.id, bonusAmount, performer, reason);
    } else if (type === 'spend') {
      spendBonus(activeOrg.id, client.id, bonusAmount, performer, reason);
    } else {
      refundBonus(activeOrg.id, client.id, bonusAmount, performer, reason);
    }
    setBonusAmount(0);
    setBonusReason('');
    refreshClient();
  };

  const handleCancelBonus = () => {
    if (!cancelBonusId) return;
    cancelBonusOperation(activeOrg.id, client.id, cancelBonusId, userRole === 'manager' ? 'Управляющий' : 'Администратор', 'Отмена операции');
    setCancelBonusId('');
    refreshClient();
  };

  const handleSaveDiscount = () => {
    const allowed = loyaltySettings.maxDiscountPercent ?? 0;
    const next = Math.max(0, Math.min(discountValue, allowed));
    setClientDiscount(activeOrg.id, client.id, next, userRole === 'manager' ? 'Управляющий' : 'Администратор', discountReason || 'Изменение скидки');
    setDiscountReason('');
    refreshClient();
  };

  const handleToggleVip = (setVip: boolean) => {
    if (setVip && !loyaltySettings.autoVip && !client.isVip) {
      // allow manual VIP assignment even if autoVip disabled
    }
    setClientVip(activeOrg.id, client.id, setVip, userRole === 'manager' ? 'Управляющий' : 'Администратор', vipReason || (setVip ? 'Назначение VIP' : 'Снятие VIP'));
    setVipReason('');
    refreshClient();
  };

  const selectedVehicleId = vehicles[0]?.id || null;
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(selectedVehicleId);

  useEffect(() => {
    if (!activeVehicleId || !vehicles.some(v => v.id === activeVehicleId)) {
      setActiveVehicleId(vehicles[0]?.id || null);
    }
  }, [vehicles, activeVehicleId]);

  const activeVehicle = vehicles.find(v => v.id === activeVehicleId) || null;

  useEffect(() => {
    if (activeVehicle) {
      setVehicleForm({
        licensePlate: activeVehicle.licensePlate,
        make: activeVehicle.make || '',
        model: activeVehicle.model || '',
        year: activeVehicle.year || '',
        color: activeVehicle.color || '',
        vin: activeVehicle.vin || '',
        comment: activeVehicle.comment || '',
      });
      setIsCreatingVehicle(false);
      setVehicleFormError('');
    } else if (isCreatingVehicle) {
      setVehicleForm({ licensePlate: '', make: '', model: '', year: '', color: '', vin: '', comment: '' });
      setVehicleFormError('');
    }
  }, [activeVehicle, isCreatingVehicle]);

  return (
    <div className="glass rounded-3xl p-5 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{client.fullName}</h1>
          <p className="text-slate-400 text-sm">Телефон: {client.phone || 'Не указан'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {client.isVip && <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">VIP</span>}
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">Уровень: {client.loyaltyLevel || 'Standard'}</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">CRM Score: {client.crmScore || 0}</span>
          </div>
          {visitReminder && <div className="mt-3 rounded-3xl bg-amber-500/10 p-3 text-sm text-amber-100">{visitReminder}</div>}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={() => exportClientCsv(activeOrg, client, vehicles, orders, recommendations, actionLogs)} className="btn-neon rounded-xl px-4 py-3 text-sm">CSV</button>
          <button type="button" onClick={() => exportClientExcel(activeOrg, client, vehicles, orders, recommendations, actionLogs)} className="btn-neon rounded-xl px-4 py-3 text-sm">Excel</button>
          <button type="button" onClick={() => exportClientPdf(activeOrg, client, vehicles, orders, recommendations, actionLogs)} className="btn-neon rounded-xl px-4 py-3 text-sm">PDF</button>
          <button type="button" onClick={() => onSelectClient(null)} className="btn-neon rounded-xl px-4 py-3 text-sm">Скрыть карточку</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(tabKey => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={`text-xs px-3 py-2 rounded-full transition ${tab === tabKey ? 'bg-cyan-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
          >
            {tabKey === 'main' ? 'Основное' : tabKey === 'cars' ? 'Автомобили' : tabKey === 'visits' ? 'История' : tabKey === 'preferences' ? 'Предпочтения' : tabKey === 'analytics' ? 'Аналитика' : tabKey === 'loyalty' ? 'Лояльность' : 'Заметки'}
          </button>
        ))}
      </div>

      {tab === 'main' && (
        <div className="space-y-4">
          <div className="glass rounded-3xl p-5 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Карточка клиента</h2>
                <p className="text-slate-400 text-sm">Редактируйте имя, телефон и комментарий клиента.</p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={handleSaveClientInfo} className="btn-neon rounded-xl px-4 py-3 text-sm">Сохранить данные</button>
                {infoSaved && <span className="text-sm text-emerald-300">Сохранено</span>}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">ФИО клиента</label>
                <input
                  type="text"
                  value={fullNameDraft}
                  onChange={e => setFullNameDraft(e.target.value)}
                  className="w-full input-neon rounded-3xl px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Телефон</label>
                <input
                  type="tel"
                  value={phoneDraft}
                  onChange={e => setPhoneDraft(e.target.value)}
                  className="w-full input-neon rounded-3xl px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Комментарий</label>
                <textarea
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  className="w-full input-neon rounded-3xl px-4 py-3 text-sm min-h-[88px]"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="glass rounded-3xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
                <div>
                  <p className="text-slate-500">Создан</p>
                  <p>{format(new Date(client.createdAt), 'dd.MM.yyyy')}</p>
                </div>
                <div>
                  <p className="text-slate-500">Первый визит</p>
                  <p>{client.firstVisitAt ? format(new Date(client.firstVisitAt), 'dd.MM.yyyy') : '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Последний визит</p>
                  <p>{client.lastVisitAt ? format(new Date(client.lastVisitAt), 'dd.MM.yyyy') : '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Всего визитов</p>
                  <p>{client.totalVisits || 0}</p>
                </div>
                <div>
                  <p className="text-slate-500">Всего потрачено</p>
                  <p>{(client.totalSpent || 0).toLocaleString('ru-RU')} {activeOrg.currency}</p>
                </div>
                <div>
                  <p className="text-slate-500">Средний чек</p>
                  <p>{(client.averageCheck || 0).toLocaleString('ru-RU')} {activeOrg.currency}</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-3xl p-5 space-y-4">
              <h2 className="text-base font-semibold text-white">Быстрая аналитика</h2>
              <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
                <div>
                  <p className="text-slate-500">Средний интервал</p>
                  <p>{avgInterval ? `${avgInterval} дн.` : '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Авто</p>
                  <p>{vehicles.length}</p>
                </div>
                <div>
                  <p className="text-slate-500">Скидка</p>
                  <p>{(client.discountPercent || 0).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-slate-500">Бонусы</p>
                  <p>{client.bonusPoints || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'cars' && (
        <div className="space-y-4">
          <div className="glass rounded-3xl p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Автомобили клиента</h2>
                <p className="text-slate-400 text-sm">Добавляйте, редактируйте и управляйте автомобилями этого клиента.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingVehicle(true);
                  setActiveVehicleId(null);
                  setVehicleForm({ licensePlate: '', make: '', model: '', year: '', color: '', vin: '', comment: '' });
                  setVehicleFormError('');
                }}
                className="btn-neon rounded-xl px-4 py-3 text-sm"
              >
                Добавить автомобиль
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 mt-4">
              {vehicles.length > 0 ? vehicles.map(vehicle => {
                const plateKey = (vehicle.licensePlate || '').toLowerCase();
                const vehicleOrders = [
                  ...(ordersByVehicleId.get(vehicle.id) || []),
                  ...(ordersByPlate.get(plateKey) || []),
                ];
                const uniqueOrders = vehicleOrders.length > 1 ? Array.from(new Map(vehicleOrders.map(o => [o.id, o])).values()) : vehicleOrders;
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => {
                      setIsCreatingVehicle(false);
                      setActiveVehicleId(vehicle.id);
                    }}
                    className={`w-full text-left rounded-3xl p-4 border transition ${activeVehicleId === vehicle.id ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-white font-semibold">{vehicle.licensePlate}</p>
                        <p className="text-sm text-slate-400">{vehicle.make || 'Марка'} {vehicle.model || 'Модель'}{vehicle.year ? ` • ${vehicle.year}` : ''} • {vehicle.color || 'Цвет не указан'}</p>
                      </div>
                      <div className="text-sm text-slate-300">{uniqueOrders.length} визитов</div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-300">
                      <div>
                        <p className="text-slate-500">Последний визит</p>
                        <p>{vehicle.lastVisitAt ? format(new Date(vehicle.lastVisitAt), 'dd.MM.yyyy') : '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Потрачено</p>
                        <p>{(vehicle.totalSpent || 0).toLocaleString('ru-RU')} {activeOrg.currency}</p>
                      </div>
                    </div>
                  </button>
                );
              }) : (
                <p className="text-slate-500">У клиента нет автомобилей в базе.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="glass rounded-3xl p-5 space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">{activeVehicle ? 'Редактировать автомобиль' : 'Новый автомобиль'}</h2>
                  <p className="text-slate-400 text-sm">Заполните госномер, марку, модель, год, цвет и VIN.</p>
                </div>
                {activeVehicle && (
                  <button type="button" onClick={handleDeleteVehicle} className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200 hover:bg-red-500/10">Архивировать</button>
                )}
              </div>
              {vehicleFormError && <div className="rounded-3xl bg-rose-500/10 p-3 text-sm text-rose-200">{vehicleFormError}</div>}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Госномер</label>
                  <input type="text" value={vehicleForm.licensePlate || ''} onChange={e => setVehicleForm({ ...vehicleForm, licensePlate: e.target.value })} className="w-full input-neon rounded-3xl px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Марка</label>
                  <input type="text" value={vehicleForm.make || ''} onChange={e => setVehicleForm({ ...vehicleForm, make: e.target.value })} className="w-full input-neon rounded-3xl px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Модель</label>
                  <input type="text" value={vehicleForm.model || ''} onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })} className="w-full input-neon rounded-3xl px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Год</label>
                  <input type="text" value={vehicleForm.year || ''} onChange={e => setVehicleForm({ ...vehicleForm, year: e.target.value })} className="w-full input-neon rounded-3xl px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Цвет</label>
                  <input type="text" value={vehicleForm.color || ''} onChange={e => setVehicleForm({ ...vehicleForm, color: e.target.value })} className="w-full input-neon rounded-3xl px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">VIN</label>
                  <input type="text" value={vehicleForm.vin || ''} onChange={e => setVehicleForm({ ...vehicleForm, vin: e.target.value })} className="w-full input-neon rounded-3xl px-4 py-3 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Комментарий</label>
                <textarea value={vehicleForm.comment || ''} onChange={e => setVehicleForm({ ...vehicleForm, comment: e.target.value })} className="w-full input-neon rounded-3xl px-4 py-3 text-sm min-h-[120px]" />
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={handleSaveVehicle} className="btn-neon rounded-xl px-4 py-3 text-sm">Сохранить автомобиль</button>
                <button type="button" onClick={() => {
                  setIsCreatingVehicle(false);
                  setVehicleFormError('');
                  setActiveVehicleId(vehicles[0]?.id || null);
                }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 hover:bg-white/10">Отмена</button>
              </div>
            </div>
            {activeVehicle && (() => {
              const plateKey = (activeVehicle.licensePlate || '').toLowerCase();
              const vehicleOrders = [
                ...(ordersByVehicleId.get(activeVehicle.id) || []),
                ...(ordersByPlate.get(plateKey) || []),
              ];
              const uniqueOrders = vehicleOrders.length > 1 ? Array.from(new Map(vehicleOrders.map(o => [o.id, o])).values()) : vehicleOrders;
              return (
                <VehicleCard
                  vehicle={activeVehicle}
                  orders={uniqueOrders}
                  currency={activeOrg.currency}
                  ownerName={client.fullName}
                  organizationId={activeOrg.id}
                />
              );
            })()}
          </div>
        </div>
      )}

      {tab === 'visits' && (
        <div className="glass rounded-3xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-white">История посещений</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400 text-xs uppercase tracking-[0.2em]">
                <tr>
                  <th className="py-3 pr-3">Дата</th>
                  <th className="py-3 pr-3">Услуги</th>
                  <th className="py-3 pr-3">Сумма</th>
                  <th className="py-3 pr-3">Оплата</th>
                  <th className="py-3 pr-3">Мойщик</th>
                  <th className="py-3 pr-3">Бокс</th>
                  <th className="py-3 pr-3">Время</th>
                </tr>
              </thead>
              <tbody>
                {historyOrders.length > 0 ? historyOrders.map(order => (
                  <tr key={order.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-3 text-white">{format(new Date(order.completedAt || order.createdAt), 'dd.MM.yyyy')}</td>
                    <td className="py-3 pr-3 text-slate-300">{order.services.map(s => s.serviceName).join(', ')}</td>
                    <td className="py-3 pr-3 text-slate-300">{order.totalAmount.toLocaleString('ru-RU')} {activeOrg.currency}</td>
                    <td className="py-3 pr-3 text-slate-300">{order.paymentMethod || order.paymentParts?.map(part => `${part.method}: ${part.amount}`).join('; ') || '—'}</td>
                    <td className="py-3 pr-3 text-slate-300">{order.washerName || '—'}</td>
                    <td className="py-3 pr-3 text-slate-300">{order.boxName || '—'}</td>
                    <td className="py-3 pr-3 text-slate-300">{order.completedAt ? format(new Date(order.completedAt), 'HH:mm') : '—'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">Заказов пока нет.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'preferences' && (
        <div className="glass rounded-3xl p-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl bg-white/5 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Любимый мойщик</h3>
            <p className="text-slate-300">{favoriteWashers[0] || 'Не определён'}</p>
          </div>
          <div className="rounded-3xl bg-white/5 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Любимый бокс</h3>
            <p className="text-slate-300">{favoriteBoxes[0] || 'Не определён'}</p>
          </div>
          <div className="rounded-3xl bg-white/5 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Популярные услуги</h3>
            <p className="text-slate-300">{popularServices.join(', ') || 'Не определено'}</p>
          </div>
          <div className="rounded-3xl bg-white/5 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Средний чек</h3>
            <p className="text-slate-300">{(client.averageCheck || 0).toLocaleString('ru-RU')} {activeOrg.currency}</p>
          </div>
          <div className="rounded-3xl bg-white/5 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Средний интервал</h3>
            <p className="text-slate-300">{avgInterval ? `${avgInterval} дн.` : '—'}</p>
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="glass rounded-3xl p-5">
            <h2 className="text-base font-semibold text-white mb-4">Динамика по месяцам</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlySummary}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'rgba(10,10,26,0.95)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)' }} formatter={(value: any) => [Number(value).toLocaleString('ru-RU') + ' ' + activeOrg.currency, 'Сумма']} />
                  <Line type="monotone" dataKey="spent" stroke="#00d4ff" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-4">
            <div className="glass rounded-3xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Визиты по месяцам</h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySummary}>
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'rgba(10,10,26,0.95)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)' }} />
                    <Bar dataKey="visits" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass rounded-3xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Средний чек</h3>
              <p className="text-white text-3xl font-bold">{monthlySummary.length ? monthlySummary[monthlySummary.length - 1].averageCheck.toLocaleString('ru-RU') : '0'} {activeOrg.currency}</p>
              <p className="text-slate-400 text-sm mt-2">Последние 6 месяцев</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'loyalty' && (
        <div className="space-y-4">
          <div className="glass rounded-3xl p-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-white/5 p-5">
              <p className="text-sm text-slate-400">Бонусный баланс</p>
              <p className="text-2xl font-semibold text-white">{client.bonusPoints || 0}</p>
            </div>
            <div className="rounded-3xl bg-white/5 p-5">
              <p className="text-sm text-slate-400">Текущая скидка</p>
              <p className="text-2xl font-semibold text-white">{(client.discountPercent || 0).toFixed(0)}%</p>
            </div>
            <div className="rounded-3xl bg-white/5 p-5">
              <p className="text-sm text-slate-400">Статус VIP</p>
              <p className="text-2xl font-semibold text-white">{client.isVip ? 'Да' : 'Нет'}</p>
            </div>
          </div>

          {!loyaltySettings.enabled ? (
            <div className="glass rounded-3xl p-5 text-slate-300">
              <h3 className="text-base font-semibold text-white">Система лояльности отключена</h3>
              <p>Включите систему в настройках, чтобы управлять бонусами, скидками и VIP-клиентами.</p>
            </div>
          ) : (
            <>
              <div className="glass rounded-3xl p-5 space-y-4">
                <h3 className="text-base font-semibold text-white">Управление бонусами</h3>
                {!loyaltySettings.useBonuses ? (
                  <p className="text-slate-400">Бонусная система отключена в настройках.</p>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Сумма</label>
                      <input type="number" value={bonusAmount} onChange={e => setBonusAmount(Number(e.target.value))} className="w-full input-neon rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Причина</label>
                      <input type="text" value={bonusReason} onChange={e => setBonusReason(e.target.value)} className="w-full input-neon rounded-xl px-3 py-2 text-sm" placeholder="Комментарий" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button type="button" onClick={() => handleBonusAction('accrue')} className="btn-neon rounded-xl px-4 py-3 text-sm">Начислить</button>
                      <button type="button" onClick={() => handleBonusAction('spend')} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 hover:bg-white/10">Списать</button>
                      <button type="button" onClick={() => handleBonusAction('refund')} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 hover:bg-white/10">Вернуть</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="glass rounded-3xl p-5 space-y-4">
                <h3 className="text-base font-semibold text-white">Отмена операции</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Операция</label>
                    <select className="w-full input-neon rounded-xl px-3 py-2 text-sm" value={cancelBonusId} onChange={e => setCancelBonusId(e.target.value)}>
                      <option value="">Выберите операцию</option>
                      {(client.bonusHistory || []).map(op => (
                        <option key={op.id} value={op.id}>{`${op.type} ${op.amount} → остаток ${op.balanceAfter}`}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={handleCancelBonus} className="btn-neon rounded-xl px-4 py-3 text-sm">Отменить операцию</button>
                </div>
              </div>

              <div className="glass rounded-3xl p-5 space-y-4">
                <h3 className="text-base font-semibold text-white">Управление скидкой</h3>
                {!loyaltySettings.useDiscounts ? (
                  <p className="text-slate-400">Скидки отключены в настройках.</p>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-3">
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Новая скидка, %</label>
                      <input type="number" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))} className="w-full input-neon rounded-xl px-3 py-2 text-sm" min={0} max={loyaltySettings.maxDiscountPercent || 100} />
                      <p className="text-xs text-slate-500 mt-1">Макс {loyaltySettings.maxDiscountPercent || 100}%</p>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Причина</label>
                      <input type="text" value={discountReason} onChange={e => setDiscountReason(e.target.value)} className="w-full input-neon rounded-xl px-3 py-2 text-sm" placeholder="Причина" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button type="button" onClick={handleSaveDiscount} className="btn-neon rounded-xl px-4 py-3 text-sm">Сохранить скидку</button>
                      <button type="button" onClick={() => { setDiscountValue(0); setDiscountReason(''); setClientDiscount(activeOrg.id, client.id, 0, userRole === 'manager' ? 'Управляющий' : 'Администратор', 'Снятие скидки'); refreshClient(); }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 hover:bg-white/10">Снять скидку</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="glass rounded-3xl p-5 space-y-4">
                <h3 className="text-base font-semibold text-white">Управление VIP</h3>
                <div className="grid gap-3 lg:grid-cols-3">
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Причина</label>
                    <input type="text" value={vipReason} onChange={e => setVipReason(e.target.value)} className="w-full input-neon rounded-xl px-3 py-2 text-sm" placeholder="Причина" />
                  </div>
                  <button type="button" onClick={() => handleToggleVip(true)} className="btn-neon rounded-xl px-4 py-3 text-sm">Назначить VIP</button>
                  <button type="button" onClick={() => handleToggleVip(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 hover:bg-white/10">Снять VIP</button>
                </div>
              </div>
            </>
          )}

          <div className="glass rounded-3xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-white">Истории</h3>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-3xl bg-white/5 p-4">
                <p className="text-slate-400 text-xs uppercase tracking-[0.2em]">Начисления / списания</p>
                <p className="text-white text-sm mt-3">{(client.bonusHistory || []).length} записей</p>
              </div>
              <div className="rounded-3xl bg-white/5 p-4">
                <p className="text-slate-400 text-xs uppercase tracking-[0.2em]">История скидок</p>
                <p className="text-white text-sm mt-3">{(client.discountHistory || []).length} записей</p>
              </div>
              <div className="rounded-3xl bg-white/5 p-4">
                <p className="text-slate-400 text-xs uppercase tracking-[0.2em]">История VIP</p>
                <p className="text-white text-sm mt-3">{(client.vipHistory || []).length} записей</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-white">Последние бонусные операции</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400 text-xs uppercase tracking-[0.2em]">
                  <tr>
                    <th className="py-3 pr-3">Дата</th>
                    <th className="py-3 pr-3">Тип</th>
                    <th className="py-3 pr-3">Сумма</th>
                    <th className="py-3 pr-3">Баланс</th>
                    <th className="py-3 pr-3">Причина</th>
                  </tr>
                </thead>
                <tbody>
                  {(client.bonusHistory || []).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8).map(entry => (
                    <tr key={entry.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-3 text-slate-300">{format(new Date(entry.createdAt), 'dd.MM.yyyy')}</td>
                      <td className="py-3 pr-3 text-slate-300">{entry.type}</td>
                      <td className="py-3 pr-3 text-slate-300">{entry.amount}</td>
                      <td className="py-3 pr-3 text-slate-300">{entry.balanceAfter}</td>
                      <td className="py-3 pr-3 text-slate-300">{entry.reason || '—'}</td>
                    </tr>
                  ))}
                  {(client.bonusHistory || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">Операций с бонусами пока нет.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass rounded-3xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-white">Action Log</h3>
            {actionLogs.length > 0 ? (
              <div className="space-y-3">
                {actionLogs.map(log => (
                  <div key={log.id} className="rounded-3xl bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-white">{log.description || log.action}</p>
                      <span className="text-xs text-slate-500">{format(new Date(log.createdAt), 'dd.MM.yyyy HH:mm')}</span>
                    </div>
                    {log.changes && (
                      <div className="mt-2 text-xs text-slate-400">
                        {Object.entries(log.changes).map(([key, value]) => (
                          <p key={key}>{key}: {String(value.oldValue)} → {String(value.newValue)}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Событий пока нет.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="glass rounded-3xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-white">Заметки менеджера</h2>
          <textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            className="w-full input-neon rounded-3xl min-h-[220px] p-4 text-sm"
            placeholder="Добавьте примечание для клиента"
          />
          <button type="button" onClick={handleSaveNotes} className="btn-neon rounded-xl px-5 py-3 text-sm">Сохранить заметку</button>
        </div>
      )}
    </div>
  );
}
