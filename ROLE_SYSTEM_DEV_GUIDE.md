# ROLE_SYSTEM_IMPLEMENTATION - Техническая справка разработчика

## 📦 Структура реализации

```
src/
├── store.ts                          # ← Функции управления паролями
├── types.ts                          # (UserRole уже существует)
├── app/
│   └── InternalApp.tsx               # ← Ограничение доступа
└── components/
    ├── Layout.tsx                    # ← Меню переключения ролей
    └── Settings.tsx                  # ← Форма управления паролями
```

## 🔧 API функций

### store.ts

```typescript
// Получить текущие пароли ролей
function getRolePasswords(): {manager: string; admin: string}
// Возвращает пароли из localStorage или значения по умолчанию

// Установить пароль для роли
function setRolePassword(role: 'manager' | 'admin', password: string): boolean
// Возвращает true если успешно, false если пароль пустой

// Проверить пароль роли
function verifyRolePassword(role: 'manager' | 'admin', password: string): boolean
// Возвращает true если пароль правильный, false если неправильный
```

### Layout.tsx

```typescript
interface LayoutProps {
  onRoleChange: (role: UserRole) => void;  // ← Callback для переключения роли
  // ... другие пропсы
}

// Методы компонента
function handleRoleSelect(role: UserRole): void
// Открывает модальное окно для подтверждения пароля

function confirmRoleSwitch(): void
// Проверяет пароль и вызывает onRoleChange если правильно
```

### InternalApp.tsx

```typescript
function handleRoleChange(nextRole: UserRole): void
// Переключает роль пользователя через updateUserProfile

// Проверка доступа при отображении страницы
if (user.role === 'admin' && restrictedForAdmin.includes(currentPage)) {
  // Показать сообщение об ограничении
}

// Передача callback в Layout
<Layout onRoleChange={handleRoleChange} ... />
```

### Settings.tsx

```typescript
function handleSaveRolePasswords(): void
// Сохраняет новые пароли для обеих ролей

// Загрузка паролей при монтировании
useEffect(() => {
  const pwd = getRolePasswords();
  setManagerRolePassword(pwd.manager);
  setAdminRolePassword(pwd.admin);
}, []);
```

## 🎨 UI компоненты

### Меню ролей (Layout.tsx - боковая панель)

```jsx
<div className="p-4 border-t border-white/5">
  <button onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}>
    <p>{user.name}</p>
    <p>{roleIcon} {roleLabel}</p>
  </button>
  {isRoleMenuOpen && (
    <div className="absolute mt-2 w-full bg-slate-900">
      <button onClick={() => handleRoleSelect('manager')}>👑 Управляющий</button>
      <button onClick={() => handleRoleSelect('admin')}>🛡️ Администратор</button>
    </div>
  )}
</div>
```

### Модальное окно пароля (Layout.tsx)

```jsx
{rolePromptOpen && (
  <div className="fixed inset-0 z-50 modal-overlay" onClick={() => setRolePromptOpen(false)}>
    <div className="modal-panel rounded-2xl p-6 w-full max-w-md">
      <h3>Введите пароль {pendingRole === 'manager' ? 'управляющего' : 'администратора'}</h3>
      <input type="password" value={rolePassword} onChange={...} />
      {roleError && <p className="text-red-400">{roleError}</p>}
      <button onClick={() => setRolePromptOpen(false)}>Отмена</button>
      <button onClick={confirmRoleSwitch}>Подтвердить</button>
    </div>
  </div>
)}
```

### Форма паролей (Settings.tsx - вкладка Система)

```jsx
<div>
  <input
    type="password"
    placeholder="Пароль управляющего"
    value={managerRolePassword}
    onChange={e => setManagerRolePassword(e.target.value)}
  />
  <input
    type="password"
    placeholder="Пароль администратора"
    value={adminRolePassword}
    onChange={e => setAdminRolePassword(e.target.value)}
  />
  <button onClick={handleSaveRolePasswords}>Сохранить пароли</button>
  {passwordSaveMessage && <p>{passwordSaveMessage}</p>}
</div>
```

## 🔐 Поток данных при переключении роли

```
Пользователь нажимает на роль
       ↓
handleRoleSelect() → setPendingRole() + setRolePromptOpen()
       ↓
Модальное окно отображается с фокусом на input
       ↓
Пользователь вводит пароль
       ↓
[Enter] → confirmRoleSwitch()
       ↓
verifyRolePassword(pendingRole, rolePassword)
       ↓
✓ Правильно:      onRoleChange(pendingRole) → updateUserProfile()
✗ Неправильно:   setRoleError('Неверный пароль')
       ↓
Интерфейс обновляется с новой ролью
```

## 💾 Хранилище данных

### localStorage ключ: `wd_role_passwords`

```json
{
  "manager": "235792",
  "admin": "0000"
}
```

**Где используется**:
- getRolePasswords() - читает из localStorage
- setRolePassword() - записывает в localStorage
- verifyRolePassword() - читает из localStorage для проверки

## 🚫 Ограничение доступа

### Ограниченные страницы (InternalApp.tsx)

```typescript
const restrictedForAdmin = ['washers', 'settings'];

if (user.role === 'admin' && restrictedForAdmin.includes(currentPage)) {
  return (
    <div className="p-6">
      <p className="text-red-400">Недостаточно прав доступа</p>
    </div>
  );
}
```

### Отключение кнопок (Layout.tsx)

```typescript
const isDisabled =
  (item.page === 'settings' && !isManager) ||
  (item.page === 'washers' && !isManager) ||
  (item.page === 'analytics' && !isManager && activeOrg.analyticsAdminView === false);

// Кнопка отображается как заблокированная (🔒)
```

## 🧪 Тестирование

### Что проверить

1. ✅ Меню ролей открывается при клике
2. ✅ Выбор другой роли открывает модаль пароля
3. ✅ Неправильный пароль показывает ошибку
4. ✅ Правильный пароль переключает роль
5. ✅ Escape закрывает модаль
6. ✅ Enter подтверждает пароль
7. ✅ Клик вне модали закрывает её
8. ✅ Admin не может открыть Washers
9. ✅ Admin не может открыть Settings
10. ✅ Manager может открыть все разделы
11. ✅ Пароли сохраняются в Settings
12. ✅ Пароли персистируют после перезагрузки

## 📝 Изменения в коде

### src/store.ts (~30 строк добавлено)

```typescript
type RolePasswords = {
  manager: string;
  admin: string;
};

const DEFAULT_ROLE_PASSWORDS: RolePasswords = {
  manager: '235792',
  admin: '0000'
};

export function getRolePasswords(): RolePasswords {
  const stored = localStorage.getItem(KEYS.rolePasswords);
  if (!stored) return DEFAULT_ROLE_PASSWORDS;
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_ROLE_PASSWORDS;
  }
}

export function setRolePassword(role: UserRole, password: string): boolean {
  if (!password.trim()) return false;
  const pwd = getRolePasswords();
  pwd[role] = password;
  localStorage.setItem(KEYS.rolePasswords, JSON.stringify(pwd));
  dispatchStoreChanged();
  return true;
}

export function verifyRolePassword(role: UserRole, password: string): boolean {
  return getRolePasswords()[role] === password;
}
```

### src/components/Layout.tsx (~20 строк добавлено)

- Добавлен пропс `onRoleChange`
- Добавлены state для модали: `isRoleMenuOpen`, `rolePromptOpen`, `pendingRole`, `rolePassword`, `roleError`
- Добавлены методы: `handleRoleSelect()`, `confirmRoleSwitch()`
- Добавлено UI меню и модальное окно

### src/app/InternalApp.tsx (~15 строк добавлено)

- Добавлен импорт `UserRole`
- Добавлен метод `handleRoleChange()`
- Добавлена проверка доступа в `renderPage()`
- Передача `onRoleChange` в Layout

### src/components/Settings.tsx (~25 строк добавлено)

- Добавлены импорты `getRolePasswords`, `setRolePassword`
- Добавлены state для паролей: `managerRolePassword`, `adminRolePassword`, `passwordSaveMessage`
- Добавлен метод `handleSaveRolePasswords()`
- Добавлена форма в вкладке "Система"

## 🎯 Точки расширения

Для будущих улучшений:

1. **Добавить больше ролей**: Просто добавить в `UserRole` тип и `restrictedForAdmin` список
2. **Добавить детальные права**: Создать объект с правами вместо простых ролей
3. **Истекание сессии**: Добавить timeout для автоматического выхода
4. **Логирование ролей**: Сохранять историю переключений
5. **Синхронизация**: Отправлять пароли на сервер (если требуется)

## 🔍 Отладка

### Проверить текущие пароли в console

```javascript
// В браузере, в console (F12)
localStorage.getItem('wd_role_passwords')
```

### Сбросить пароли на значения по умолчанию

```javascript
// В браузере, в console (F12)
localStorage.removeItem('wd_role_passwords')
location.reload()
```

### Проверить текущую роль

```javascript
// В браузере, в console (F12)
// Зависит от того, как хранится в store
console.log(user.role)
```

---

**Версия документа**: 1.0  
**Последнее обновление**: 2024  
**Для разработчиков**: Все необходимые детали реализации
