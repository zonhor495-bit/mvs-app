# 🎯 СИСТЕМА РОЛЕЙ - БЫСТРЫЕ КОМАНДЫ

## 📋 ВСЕ КОМАНДЫ В ОДНОМ МЕСТЕ

```bash
# 🚀 ЗАПУСК ПРИЛОЖЕНИЯ
npm run dev
# ➜ Откроется на http://localhost:5174

# 🧪 ПРОСМОТР ВСЕХ ТЕСТОВ (2 мин)
node ROLE_SYSTEM_TEST_CHECKLIST.mjs

# 📋 ПРОСМОТР ФИНАЛЬНОГО СТАТУСА (1 мин)
node ROLE_SYSTEM_DEPLOYMENT_READY.mjs

# 📚 ПРОСМОТР ДОКУМЕНТАЦИИ
open ROLE_SYSTEM_QUICK_REFERENCE.md
open ROLE_SYSTEM_QUICK_TEST.md
open ROLE_SYSTEM_COMPLETION_SUMMARY.md
open ROLE_SYSTEM_FINAL_STATUS.md

# 🔧 КОМПИЛЯЦИЯ И СБОРКА
npm run build
# ✓ Создаст dist/ для production

# 🔄 ПЕРЕСБОРКА (если что-то не работает)
rm -rf dist node_modules
npm install
npm run build
npm run dev

# 🌐 ОТКРЫТЬ ПРИЛОЖЕНИЕ
open http://localhost:5174
open http://localhost:5173  # если 5174 не работает
```

---

## 📊 МАТРИЦА КОМАНД ПО СЦЕНАРИЯМ

### 🎮 Я хочу начать тестирование

```bash
# Шаг 1: Убедитесь что server работает
npm run dev

# Шаг 2: Откройте браузер
open http://localhost:5174

# Шаг 3: Следуйте инструкциям в ROLE_SYSTEM_QUICK_TEST.md
```

### 📋 Я хочу посмотреть что было сделано

```bash
# Вариант 1: Индекс всей документации
cat ROLE_SYSTEM_QUICK_REFERENCE.md

# Вариант 2: Финальный отчёт
node ROLE_SYSTEM_DEPLOYMENT_READY.mjs

# Вариант 3: Резюме работы
cat ROLE_SYSTEM_COMPLETION_SUMMARY.md
```

### 🧪 Я хочу выполнить все тесты

```bash
# Шаг 1: Посмотрите все тесты
node ROLE_SYSTEM_TEST_CHECKLIST.mjs

# Шаг 2: Откройте браузер
open http://localhost:5174

# Шаг 3: Выполните каждый тест из ROLE_SYSTEM_QUICK_TEST.md
```

### 👨‍💻 Я хочу посмотреть код

```bash
# Посмотреть Layout компонент
cat src/components/Layout.tsx | grep -A 20 "roleIcon\|roleLabel\|RoleMenu"

# Посмотреть InternalApp компонент
cat src/app/InternalApp.tsx | grep -A 20 "adminCanAccess\|renderPage"

# Посмотреть типы ролей
cat src/types.ts | grep -A 5 "UserRole\|RolePasswords"

# Посмотреть функции управления паролями
cat src/store.ts | grep -A 10 "getRolePasswords\|setRolePassword\|verifyRolePassword"
```

### 🔧 Если что-то не работает

```bash
# 1. Проверить что все запущено
lsof -i :5174

# 2. Посмотреть логи dev сервера
npm run dev

# 3. Пересобрать приложение
npm run build

# 4. Очистить кэш
rm -rf .vite dist node_modules

# 5. Переустановить зависимости
npm install

# 6. Пересобрать и запустить
npm run build && npm run dev
```

### 📦 Для production

```bash
# 1. Сборка
npm run build

# 2. Проверка dist/
ls -la dist/

# 3. Развёртывание
# Скопируйте dist/ на сервер

# Для Electron:
npm run build:electron
```

---

## 🔐 ПАРОЛИ

```
Администратор: 0000
Управляющий: 235792
```

---

## 📁 ОСНОВНЫЕ ФАЙЛЫ

### Компоненты с ролями
```
src/components/Layout.tsx         - UI меню роли
src/app/InternalApp.tsx           - Контроль доступа
src/store.ts                      - Управление паролями
src/types.ts                      - Типы ролей
```

### Документация
```
ROLE_SYSTEM_QUICK_REFERENCE.md         - Индекс
ROLE_SYSTEM_QUICK_TEST.md              - Тесты
ROLE_SYSTEM_TEST_CHECKLIST.mjs         - Скрипт тестов
ROLE_SYSTEM_COMPLETION_SUMMARY.md      - Резюме
ROLE_SYSTEM_FINAL_STATUS.md            - Техническое
ROLE_SYSTEM_DEPLOYMENT_READY.mjs       - Финальный отчёт
ROLE_SYSTEM_DOCUMENTATION_INDEX.md     - Этот файл
```

---

## ⚡ ГОРЯЧИЕ КЛАВИШИ

```
Ctrl+F         - Поиск в файле
Cmd+K Cmd+O    - Открыть файл в VS Code
npm run dev    - Запустить dev сервер (Ctrl+C чтобы остановить)
```

---

## 🎯 САМЫЕ БЫСТРЫЕ КОМАНДЫ

```bash
# Показать тесты (2 сек)
node ROLE_SYSTEM_TEST_CHECKLIST.mjs

# Показать статус (1 сек)
node ROLE_SYSTEM_DEPLOYMENT_READY.mjs

# Открыть браузер (1 сек)
open http://localhost:5174

# Запустить dev server (30 сек)
npm run dev
```

---

## 🆘 ПОМОЩЬ

| Проблема | Решение |
|----------|---------|
| Приложение не открывается | `npm run dev` |
| Порт 5174 занят | Используйте 5173 или убейте процесс |
| Ошибки компиляции | `npm run build` - проверьте ошибки |
| Forgot password | Admin: 0000, Manager: 235792 |
| Dev server зависает | Ctrl+C и `npm run dev` заново |
| LocalStorage не сохраняется | Очистите: F12 → Application → Clear |

---

## 📊 СПИСОК ВСЕХ КОМАНД

```bash
npm run dev                        # Запуск dev сервера
npm run build                      # Сборка для production
npm run preview                    # Превью production сборки
npm run build:electron             # Сборка Electron приложения
npm run electron                   # Запуск Electron
node ROLE_SYSTEM_TEST_CHECKLIST.mjs        # Показать все тесты
node ROLE_SYSTEM_DEPLOYMENT_READY.mjs      # Показать финальный статус
```

---

## 🚀 РЕКОМЕНДУЕМЫЙ ПОРЯДОК

1. **Запустить:**
   ```bash
   npm run dev
   ```

2. **Открыть браузер:**
   ```bash
   open http://localhost:5174
   ```

3. **Прочитать тесты:**
   ```bash
   node ROLE_SYSTEM_TEST_CHECKLIST.mjs
   ```

4. **Выполнить тесты:**
   - Открыть `ROLE_SYSTEM_QUICK_TEST.md`
   - Выполнить все 16 тестов в браузере

5. **Посмотреть статус:**
   ```bash
   node ROLE_SYSTEM_DEPLOYMENT_READY.mjs
   ```

---

**Готово! Начните тестирование!** 🎉
