# 🚀 БЫСТРЫЙ СТАРТ - НОВАЯ СИСТЕМА АУТЕНТИФИКАЦИИ

## За 5 Минут

### 1. Сборка
```bash
cd /Users/maksim/Desktop/carwin0.4.7
npm install lucide-react --save  # Если уже не установлено
npm run build
```

### 2. Первый Запуск
1. Очистить localStorage (DevTools → Application → LocalStorage → Clear)
2. Открыть приложение
3. Должен показаться экран **InitSetup** 
4. Ввести пароли:
   - Администратор: `admin123`
   - Управляющий: `manager456`
5. Кликнуть "Создать"
6. Заполнить данные автомойки и создать
7. Готово! 🎉

### 3. Тестирование Входа
1. F5 - перезагрузить
2. Должен показаться **RoleLogin**
3. Выбрать роль и ввести пароль
4. Проверить что видны нужные разделы

### 4. Меню Ролей
- Нажать на кнопку роли (👤 или 👑) в правом верхнем углу
- Выбрать другую роль
- Ввести пароль
- Переключиться или выйти

---

## 📂 Новые/Изменённые Файлы

### ✨ Новые
```
src/permissions.ts                  - Система разрешений
src/components/InitSetup.tsx        - Экран первоначальной настройки
src/components/RoleLogin.tsx        - Экран входа
AUTH_SYSTEM_TESTING.md             - Инструкции по тестированию
AUTH_SYSTEM_IMPLEMENTATION_REPORT.md - Полный отчёт
```

### 🔧 Изменённые
```
src/App.tsx                        - Новая обёртка InternalAppWithAuth
src/store.ts                       - Функции аутентификации (60+ строк)
src/app/InternalApp.tsx            - Поддержка onLogout пропса
src/components/Layout.tsx          - Меню переключения ролей
```

---

## 🎯 Основные Функции

| Функция | Где | Как |
|---------|-----|-----|
| Первый запуск | InitSetup | Ввести 2 пароля |
| Последующие входы | RoleLogin | Выбрать роль → пароль |
| Переключение ролей | Layout (👤 меню) | Выбрать роль → пароль |
| Logout | Layout (👤 меню) | "Выйти из аккаунта" |

---

## 💾 localStorage Keys

```javascript
wd_is_initialized       // true после первого запуска
wd_auth_passwords       // {"admin":"...","manager":"..."}
wd_current_role         // "admin" или "manager"
wd_session              // {"userId":"...","activeOrgId":"..."}
```

---

## 🔑 Ограничения Ролей

### 👤 Администратор Видит:
- Dashboard
- Orders
- Clients
- Pricing
- Cashier
- Analytics
- Reports

### 👑 Управляющий Видит:
- ВСЕ разделы

---

## 🧪 Быстрые Тесты

```javascript
// В консоли браузера

// Проверить инициализацию
console.log(localStorage.getItem('wd_is_initialized'));

// Проверить пароли
console.log(localStorage.getItem('wd_auth_passwords'));

// Проверить текущую роль
console.log(localStorage.getItem('wd_current_role'));

// Очистить для переинициализации
localStorage.clear();
```

---

## ⚡ Типичные Проблемы

| Проблема | Решение |
|----------|---------|
| InitSetup не появляется | Очистить localStorage → F5 |
| Пароли не работают | Проверить localStorage.getItem('wd_auth_passwords') |
| Меню ролей не видно | Нажать на кнопку (👤) в правом верхнем углу |
| Не переключается роль | Убедиться что пароль верный |

---

## 📖 Дополнительно

- Полные инструкции по тестированию: [AUTH_SYSTEM_TESTING.md](AUTH_SYSTEM_TESTING.md)
- Полный отчёт: [AUTH_SYSTEM_IMPLEMENTATION_REPORT.md](AUTH_SYSTEM_IMPLEMENTATION_REPORT.md)

---

**Статус**: ✅ ГОТОВО К ИСПОЛЬЗОВАНИЮ

Система полностью готова к тестированию. Все компоненты интегрированы и компилируются без ошибок.
