# Assignment 18 Phase 2: Подготовка первой публикации (1.0.1)

## 📋 Что было сделано на Phase 1

✅ Выбрана стратегия: **GitHub Releases**  
✅ Обновлён `package.json` на версию **1.0.1**  
✅ Настроена конфигурация для GitHub Releases provider  
✅ Подготовлена документация по GitHub интеграции  

---

## 🔄 Phase 2: Сборка версии 1.0.1

### Шаг 1: Проверка текущей версии

```bash
cd /Users/maksim/Desktop/carwin0.4.7

# Проверить что версия 1.0.1
grep '"version"' package.json
# Output: "version": "1.0.1",

# Проверить что конфигурирован GitHub Releases
grep -A3 '"publish"' package.json | head -8
# Output:
# "publish": [
#   {
#     "provider": "github",
#     "owner": "maksim-desktop",
#     "repo": "mvs-app",
```

### Шаг 2: Подготовка зависимостей

```bash
# Убедиться что все зависимости установлены
npm list electron-updater

# Output должен быть:
# mvs@1.0.1 /Users/maksim/Desktop/carwin0.4.7
# └── electron-updater@6.x.x ✅

# Если нет, установить:
npm install electron-updater
```

### Шаг 3: Очистка старых сборок

```bash
# Удалить старые артефакты
rm -rf build/
rm -rf dist/

# Проверить что удалено
ls build/ 2>/dev/null || echo "✅ build/ удалён"
```

### Шаг 4: Сборка приложения

```bash
# Полная сборка
npm run build

# Output должен быть:
# build:web завершена
# build:electron завершена
# electron-builder завершён успешно
```

### Шаг 5: Проверка артефактов

```bash
# Проверить что созданы нужные файлы
ls -lh build/

# Должны быть:
# MVSSetup-1.0.1.exe          (~120-150 MB)
# MVSSetup-1.0.1.exe.blockmap (~20-30 KB)
# latest.yml                  (~1 KB)
# win-unpacked/               (распакованное приложение)
```

### Шаг 6: Проверка latest.yml

```bash
# Посмотреть содержимое latest.yml
cat build/latest.yml

# Должно быть:
# version: 1.0.1
# files:
#   - url: https://github.com/.../releases/download/v1.0.1/MVSSetup-1.0.1.exe
#     sha512: '...'  (128 символов)
#     size: 123456789
# path: MVSSetup-1.0.1.exe
# sha512: '...'
# releaseDate: '2026-07-10T...'
```

### Шаг 7: Вычисление SHA512 хеша

```bash
# Вычислить хеш exe файла (для проверки)
# Windows (PowerShell):
(Get-FileHash -Path "build/MVSSetup-1.0.1.exe" -Algorithm SHA512).Hash

# macOS/Linux:
shasum -a 512 build/MVSSetup-1.0.1.exe | awk '{print $1}'

# Проверить что хеш из latest.yml совпадает
# (electron-builder автоматически это вычисляет)
```

---

## 📦 Подготовка к GitHub Release

### Файлы для загрузки

```
build/
├── MVSSetup-1.0.1.exe         ✅ Главный установщик
├── MVSSetup-1.0.1.exe.blockmap ✅ Для дельта-обновлений
└── latest.yml                  ✅ Метаинформация версии
```

### Проверка структуры latest.yml

```yaml
version: 1.0.1
files:
  - url: https://github.com/maksim-desktop/mvs-app/releases/download/v1.0.1/MVSSetup-1.0.1.exe
    sha512: 'XXXXXXX...XXXXXXX' (128 символов, нижний регистр)
    size: 129345678  (размер в байтах)
path: MVSSetup-1.0.1.exe
sha512: 'XXXXXXX...XXXXXXX'
releaseDate: '2026-07-10T00:00:00.000Z'
```

---

## ✅ Checklist Phase 2

- [ ] package.json обновлён на 1.0.1
- [ ] GitHub Releases provider настроен
- [ ] npm run build выполнен успешно
- [ ] build/MVSSetup-1.0.1.exe создана
- [ ] build/MVSSetup-1.0.1.exe.blockmap создана
- [ ] build/latest.yml создана и валидна
- [ ] SHA512 хеши совпадают в latest.yml
- [ ] Файлы готовы к загрузке на GitHub

---

## 🚀 Следующий шаг: Phase 3

После проверки Phase 2:

1. ✅ Переименовать текущую версию 1.0.0 на backup
2. 📦 Подготовить release на GitHub
3. 🧪 Создать тестовую версию 1.0.0 для тестирования
4. 🔄 Протестировать полный цикл обновления

---

**Дата:** 10 июля 2026 г.  
**Версия:** 1.0.1  
**Статус:** 🔄 Ready for GitHub Release
