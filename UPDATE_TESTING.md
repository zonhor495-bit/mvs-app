# Тестирование системы обновлений MVS

## Быстрый старт

### Преrequisites

- Node.js 16+
- npm
- Git
- Visual Studio Build Tools (для сборки Electron)

## Локальное тестирование

### Вариант 1: Простое тестирование UI компонента

```bash
# 1. Откройте React компонент
cat src/components/UpdateDialog.tsx

# 2. Компонент готов и не требует реального обновления
#    Можно тестировать отдельно с mock-данными
```

### Вариант 2: Тестирование с dev сервером

```bash
# 1. Запустите приложение
npm run dev

# 2. В другом терминале запустите Electron
npm run electron

# 3. После запуска приложение автоматически проверит обновления
#    (Если сервер недоступен, ошибка будет залогирована)

# 4. Проверьте логи:
#    Найдите файл: %APPDATA%\MVS\startup.log
#    Должны быть записи типа:
#    [updater] Check for updates...
#    [updater] Update not available (current version is latest)
```

### Вариант 3: Тестирование с локальным сервером обновлений

```bash
# 1. Создайте директорию для "сервера"
mkdir -p ~/mvs-updates-test
cd ~/mvs-updates-test

# 2. Создайте latest.yml
cat > latest.yml << 'EOF'
version: 1.0.1
files:
  - url: MVSSetup-1.0.1.exe
    sha512: 'dummyhash512dummyhash512dummyhash512dummyhash512dummyhash512dummyhash512'
    size: 125432890
path: MVSSetup-1.0.1.exe
sha512: 'dummyhash512dummyhash512dummyhash512dummyhash512dummyhash512dummyhash512'
releaseDate: '2024-01-15T10:30:00.000Z'
EOF

# 3. Запустите простой HTTP сервер
python3 -m http.server 8000
# или на Windows:
# python -m http.server 8000

# 4. Отредактируйте package.json временно
nano package.json
# Измените: "url": "http://localhost:8000"

# 5. Пересоберите приложение
npm run build

# 6. Запустите Electron и проверьте
npm run electron

# 7. Должно быть:
# - Проверка версий (1.0.0 vs 1.0.1)
# - Обнаружено обновление
# - Диалог с предложением обновления (версия 1.0.1)
# - При нажатии "Обновить" → попытка загрузить (ошибка, т.к. exe не существует)

# 8. Не забудьте вернуть оригинальный URL!
nano package.json
# Верните: "url": "https://updates.mvs.app/releases"
```

### Вариант 4: Полное тестирование (с реальным exe)

```bash
# 1. Подготовьте версию 1.0.0 (текущая)
npm run build
# Скопируйте build/MVSSetup-1.0.0.exe в безопасное место

# 2. Измените версию на 1.0.1 в package.json
nano package.json
# "version": "1.0.1"

# 3. Внесите тестовое изменение (например, в Dashboard.tsx)
nano src/components/Dashboard.tsx
# Добавьте комментарий или число версии

# 4. Пересоберите
npm run build
# Получите build/MVSSetup-1.0.1.exe

# 5. Скопируйте latest.yml и новый exe на локальный тестовый сервер
cp build/latest.yml ~/mvs-updates-test/
cp build/MVSSetup-1.0.1.exe ~/mvs-updates-test/

# 6. Запустите HTTP сервер
cd ~/mvs-updates-test
python3 -m http.server 8000

# 7. Установите версию 1.0.0
# Распакуйте или запустите старый installer

# 8. Откройте приложение 1.0.0
# Должно обнаружить обновление 1.0.1

# 9. Нажмите "Обновить сейчас"
# Должно:
#   - Показать прогресс-бар
#   - Загрузить MVSSetup-1.0.1.exe
#   - Завершить загрузку (100%)
#   - Показать "Перезапустить и установить"

# 10. Нажмите "Перезапустить и установить"
# Должно:
#   - Закрыть приложение
#   - Запустить установщик
#   - Установить новую версию
#   - Запустить приложение 1.0.1

# 11. Проверьте версию в приложении
# Должна быть 1.0.1
```

## Проверка логов

### Windows

```powershell
# Откройте лог файл
notepad "$env:APPDATA\MVS\startup.log"

# Должны быть записи:
# [updater] Initialized auto-updater with custom provider
# [updater] Check for updates...
# [updater] Update available: 1.0.0 -> 1.0.1
# [updater] Download started from https://...
# [updater] Download progress: 0%
# [updater] Download progress: 25%
# ...
# [updater] Update downloaded, ready to install
```

### macOS/Linux

```bash
# Логи обычно в:
~/.config/MVS/startup.log
# или
~/Library/Application Support/MVS/startup.log

tail -f ~/path/to/startup.log
```

## Автоматические проверки (CI/CD)

### Проверка TypeScript

```bash
npx tsc --noEmit
# Должно быть без ошибок
```

### Проверка сборки

```bash
npm run build
# Должно завершиться успешно, без ошибок

# Проверьте, что созданы:
ls -la build/
# - win-unpacked/  (если Windows)
# - MVSSetup*.exe
# - latest.yml
```

### Проверка preload API типов

```bash
npx tsc --lib ES2020,DOM --skipLibCheck src/electron.d.ts
# Должно быть без ошибок

# Или включите в основную проверку:
npx tsc --noEmit
```

## Возможные проблемы и решения

### Проблема: "Cannot find module electron-updater"

```bash
# Решение: переустановить зависимости
rm -rf node_modules package-lock.json
npm install
npm install electron-updater
```

### Проблема: "latest.yml not found on server"

```
Проверьте:
1. Сервер запущен и слушает порт
2. latest.yml находится в корне
3. URL в package.json правильный
4. Нет 404 ошибок в логах сервера
```

### Проблема: "SHA512 mismatch"

```
1. Перегенерируйте latest.yml при новой сборке
2. Или используйте скрипт для вычисления хеша:

# PowerShell (Windows):
(Get-FileHash -Path "MVSSetup-1.0.1.exe" -Algorithm SHA512).Hash

# Bash (macOS/Linux):
shasum -a 512 MVSSetup-1.0.1.exe | cut -d' ' -f1
```

### Проблема: Диалог не появляется

```
Проверьте:
1. Версия в latest.yml > версии в приложении
2. latest.yml валидный YAML
3. Логи: %APPDATA%\MVS\startup.log
4. Сеть доступна (если удалённый сервер)
5. Context Isolation не блокирует preload API
```

### Проблема: Обновление зависает на "Загрузка..."

```
Возможные причины:
1. Сервер не отдаёт файл (проверьте логи сервера)
2. Недостаточно места на диске
3. Антивирус блокирует загрузку
4. Сетевая проблема

Решение: Проверьте startup.log на ошибки
```

## Тестовые сценарии

### Сценарий 1: Базовый поток обновления

```
1. Установите версию 1.0.0
2. Запустите приложение
3. Сервер имеет версию 1.0.1
4. ✓ Диалог появляется
5. ✓ Нажимаете "Обновить"
6. ✓ Загружается с прогресс-баром
7. ✓ После загрузки показывает "Перезапустить"
8. ✓ Нажимаете "Перезапустить"
9. ✓ Приложение обновляется
10. ✓ Запускается версия 1.0.1
```

### Сценарий 2: Отклонение обновления

```
1. Появляется диалог с обновлением
2. Нажимаете "Напомнить позже"
3. Диалог закрывается
4. Приложение продолжает работать
5. Через час проверка повторится
```

### Сценарий 3: Ошибка сервера

```
1. Сервер обновлений выключен
2. Приложение стартует
3. ✓ Проверка завершается с ошибкой
4. ✓ Ошибка залогируется
5. ✓ Приложение продолжает работать
6. Через час повторная проверка
```

### Сценарий 4: Уже актуальная версия

```
1. Версия 1.0.0 установлена
2. Сервер имеет версию 1.0.0
3. ✓ Проверка проходит
4. ✓ Диалог не появляется
5. ✓ Приложение работает нормально
```

## Checklist перед production

- [ ] TypeScript компилируется без ошибок
- [ ] Build завершается успешно
- [ ] latest.yml содержит корректный SHA512
- [ ] HTTPS включён на сервере обновлений
- [ ] Сервер доступен (тестовый запрос)
- [ ] Диалог отображается корректно
- [ ] Загрузка работает без ошибок
- [ ] Установка завершается успешно
- [ ] Версия в приложении обновляется
- [ ] Логирование работает
- [ ] Обработка ошибок работает

---

**Версия:** 1.0
**Дата:** January 2024
