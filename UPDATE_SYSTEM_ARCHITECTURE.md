# Архитектура системы обновлений MVS

## Введение

MVS использует **electron-updater** — современный фреймворк для автоматических обновлений в Electron приложениях. Система полностью автоматизирована и не требует участия пользователя.

## Компоненты системы

### 1. Слой инициализации (electron/main.ts)

```
┌─────────────────────────────────────────┐
│     Electron Main Process               │
│  ┌─────────────────────────────────┐   │
│  │  setupAutoUpdater()             │   │
│  │  - logger.info('[updater]...')  │   │
│  │  - autoUpdater.checkForUpdates()│   │
│  └─────────────────────────────────┘   │
│           ↓                             │
│  ┌─────────────────────────────────┐   │
│  │  Event Listeners                │   │
│  │  - update-available             │   │
│  │  - download-progress            │   │
│  │  - update-downloaded            │   │
│  │  - error                        │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Ключевые функции:**

- `setupAutoUpdater()`: Инициализация при запуске приложения
- Автоматическая проверка на старте: `autoUpdater.checkForUpdates()`
- Фоновая проверка каждый час: `setInterval(..., 3600000)`
- Логирование в `startup.log` для отладки

**Слушатели событий:**

```typescript
autoUpdater.on('update-available', (info) => {
  // Отправляет в renderer: { currentVersion, newVersion }
  mainWindow.webContents.send('updater/update-available', {
    currentVersion: app.getVersion(),
    newVersion: info.version
  });
});

autoUpdater.on('download-progress', (progress) => {
  // Отправляет процент: { percent: 0-100 }
  mainWindow.webContents.send('updater/download-progress', { percent: progress.percent });
});

autoUpdater.on('update-downloaded', () => {
  // Готово к установке — пользователь может нажать "Перезапустить"
  mainWindow.webContents.send('updater/update-downloaded');
});
```

### 2. Слой IPC (Inter-Process Communication)

```
┌─────────────────────────────────────────┐
│   Main Process (electron/main.ts)       │
│                                         │
│  ipcMain.handle('updater/download-update', () => {
│    autoUpdater.downloadUpdate()
│  })
│                                         │
│  ipcMain.handle('updater/install-update', () => {
│    autoUpdater.quitAndInstall()
│  })
└────────────────────┬────────────────────┘
                     │ IPC Bridge
                     ↓
┌─────────────────────────────────────────┐
│   Renderer Process (React)              │
│   (electron/preload.ts exposes API)     │
└─────────────────────────────────────────┘
```

**IPC Handler'ы:**

- `updater/check-for-updates` → `autoUpdater.checkForUpdates()`
- `updater/download-update` → `autoUpdater.downloadUpdate()`
- `updater/install-update` → `autoUpdater.quitAndInstall()`
- `updater/dismiss-update` → просто скрывает диалог

### 3. Preload API (electron/preload.ts)

```typescript
window.electron.updater = {
  // Слушатели событий (receiver)
  onUpdateAvailable(callback: (data) => void)
  onDownloadProgress(callback: (progress) => void)
  onUpdateDownloaded(callback: () => void)
  onError(callback: (error) => void)
  
  // Методы действий (invoke)
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  installUpdate(): Promise<void>
  dismissUpdate(): Promise<void>
}
```

**Функционирование:**

```
Renderer: window.electron.updater.onUpdateAvailable(callback)
    ↓
Preload: ipcRenderer.on('updater/update-available', callback)
    ↓
Main: mainWindow.webContents.send('updater/update-available', data)
```

### 4. React UI Компонент (src/components/UpdateDialog.tsx)

```
┌────────────────────────────────────────┐
│   InternalApp.tsx (root component)     │
│                                        │
│   useEffect(() => {                    │
│     window.electron.updater.           │
│     onUpdateAvailable((data) => {      │
│       setIsUpdateDialogOpen(true)      │
│       setNewVersion(data.newVersion)   │
│     })                                 │
│   }, [])                               │
│                                        │
│   return (                             │
│     <>                                 │
│       <Layout>...</Layout>             │
│       <UpdateDialog isOpen={...}       │
│         onUpdate={handleUpdateClick}   │
│         onInstall={handleInstallClick} │
│       />                               │
│     </>                                │
│   )                                    │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│   UpdateDialog.tsx                     │
│                                        │
│   [Версия 1.0.0 → 1.0.1]              │
│   [████████████░░░] 67%                │
│   [Обновить] [Позже]                  │
└────────────────────────────────────────┘
```

## Поток данных обновления

```
1. Пользователь запускает приложение
   ↓
2. Главный процесс инициализирует setupAutoUpdater()
   ↓
3. autoUpdater.checkForUpdates() проверяет https://updates.mvs.app/releases/latest.yml
   ↓
4. Если есть обновление (версия > текущей):
   - Отправляет 'update-available' в renderer
   ↓
5. React компонент получает событие и показывает диалог
   Диалог: "Доступна версия 1.0.1! Обновить?"
   ↓
6. Пользователь нажимает "Обновить сейчас":
   - React вызывает window.electron.updater.downloadUpdate()
   - IPC отправляет сообщение в main: 'updater/download-update'
   - Main вызывает autoUpdater.downloadUpdate()
   ↓
7. Во время загрузки:
   - autoUpdater.on('download-progress') отправляет прогресс
   - React обновляет прогресс-бар: 0% → 100%
   ↓
8. Когда загрузка завершена:
   - autoUpdater.on('update-downloaded') сообщает о готовности
   - React показывает "Перезапустить и установить"
   ↓
9. Пользователь нажимает "Перезапустить":
   - React вызывает window.electron.updater.installUpdate()
   - Main вызывает autoUpdater.quitAndInstall()
   ↓
10. Приложение:
    - Закрывается
    - Запускает установщик (новый .exe)
    - Заменяет файлы
    - Перезапускается с новой версией
```

## Конфигурация electron-updater

**Файл: package.json**

```json
{
  "version": "1.0.0",
  "publish": [
    {
      "provider": "custom",
      "url": "https://updates.mvs.app/releases",
      "channel": "latest"
    }
  ]
}
```

**Параметры:**

- `provider: "custom"` — использует пользовательский HTTP сервер (не GitHub/S3)
- `url` — базовый URL для скачивания артефактов
- `channel: "latest"` — используется канал latest (можно использовать beta, alpha и т.п.)

**Ожидаемая структура на сервере:**

```
https://updates.mvs.app/releases/
├── latest.yml        # Метаинформация текущей версии
├── MVSSetup-1.0.1.exe # Установщик
└── MVSSetup-1.0.1.exe.blockmap
```

electron-updater ищет файл `latest.yml` для определения доступной версии.

## Безопасность

### Проверка целостности

- **SHA512 хеш**: Каждый файл в `latest.yml` должен содержать корректный хеш
- **Валидация**: electron-updater проверяет хеш перед установкой
- **Блокировка**: Если хеши не совпадают, обновление отклоняется

### HTTPS

- **Обязательно**: Сервер обновлений должен использовать HTTPS
- **Сертификат**: Валидный SSL сертификат от доверенного CA
- **Причина**: Предотвращение man-in-the-middle атак

### Подпись обновлений (опционально)

electron-updater поддерживает криптографическую подпись обновлений с приватным ключом. Пока не реализовано, но может быть добавлено:

```typescript
// Будущее расширение в package.json:
{
  "build": {
    "publish": {
      "provider": "custom",
      "url": "...",
      "updaterCacheDirName": "MVS-updater"
    }
  }
}
```

## Обработка ошибок

```typescript
autoUpdater.on('error', (error) => {
  logger.error('[updater] Error:', error.message);
  // Логируется, но приложение продолжает работать
  // Проверка повторится через час
});
```

**Возможные ошибки:**

1. **Сервер недоступен** → Повтор через час
2. **Неверный `latest.yml`** → Ошибка логируется
3. **Неверный SHA512 хеш** → Обновление отклоняется, повтор через час
4. **Нет места на диске** → Ошибка загрузки

## Логирование

**Файл: `%APPDATA%/MVS/startup.log`** (Windows)

```
2024-01-15 10:25:30 [updater] Initialized auto-updater with custom provider
2024-01-15 10:25:31 [updater] Check for updates...
2024-01-15 10:25:32 [updater] Update available: 1.0.0 → 1.0.1
2024-01-15 10:25:33 [updater] Download started...
2024-01-15 10:25:35 [updater] Download progress: 0%
2024-01-15 10:25:45 [updater] Download progress: 50%
2024-01-15 10:26:05 [updater] Download progress: 100%
2024-01-15 10:26:06 [updater] Update downloaded, ready to install
2024-01-15 10:26:10 [updater] Quit and install...
```

## Производительность

- **Загрузка в фоне**: Не блокирует главный поток
- **Периодичность**: Проверка каждый час (не каждую минуту)
- **Размер обновления**: 120-150 MB для полного exe
- **Дельта-обновления**: Поддерживаются electron-updater (скачивается только разница)

## Тестирование локально

```bash
# 1. Запустите dev сервер
npm run dev

# 2. Запустите Electron в режиме разработки
npm run electron

# 3. Проверьте логи в консоли
# Должны быть сообщения о проверке обновлений

# 4. Если нужно протестировать с локальным сервером:
#    - Создайте локальный HTTP сервер
#    - Отредактируйте package.json: url: "http://localhost:3000"
#    - Положите latest.yml и exe в корень сервера
```

## Дальнейшие улучшения

- [ ] Криптографическая подпись обновлений
- [ ] Канал beta для ранних тестеров
- [ ] Дельта-обновления (скачивание только изменений)
- [ ] Откат на предыдущую версию из UI
- [ ] Уведомление в системном трее о новой версии
- [ ] Планирование обновления на конкретное время
- [ ] Статистика обновлений (сколько пользователей обновилось)

---

**Версия документации:** 1.0
**Дата:** January 2024
**electron-updater версия:** 6.x
