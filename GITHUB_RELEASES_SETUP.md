# GitHub Releases: Настройка сервера обновлений для MVS

## 🎯 Решение: GitHub Releases как сервер обновлений

Для Assignment 18 рекомендую использовать **GitHub Releases** потому что:

1. ✅ **Бесплатно** — Неограниченный трафик
2. ✅ **Встроенная поддержка** в electron-updater
3. ✅ **Автоматическое управление** версиями
4. ✅ **HTTPS по умолчанию** — Безопасность
5. ✅ **Лёгкое тестирование** локально
6. ✅ **API для автоматизации** — CI/CD готов

---

## 📦 Настройка GitHub Repository

### Шаг 1: Создать Repository (если ещё нет)

```bash
# На GitHub.com создайте:
# Название: mvs-app
# Описание: MVS Car Management System
# Visibility: Public (для обновлений)
# .gitignore: Node
# License: MIT
```

### Шаг 2: Клонировать и подготовить

```bash
git clone https://github.com/YOUR_USERNAME/mvs-app.git
cd mvs-app

# Если это существующий проект:
git remote add origin https://github.com/YOUR_USERNAME/mvs-app.git
git branch -M main
git push -u origin main
```

### Шаг 3: Создать структуру для релизов

```bash
# Структура проекта для Release
# (build/ и dist/ файлы создаются при npm run build)

mvs-app/
├── src/
├── electron/
├── build/
│   ├── win-unpacked/       ← Распакованное приложение
│   ├── MVSSetup-1.0.1.exe ← ДЛЯ РЕЛИЗА
│   └── latest.yml          ← ДЛЯ РЕЛИЗА
├── package.json
└── .github/
    └── workflows/
        └── build-release.yml ← GitHub Actions
```

---

## 🔄 Обновление package.json для GitHub Releases

### Текущая конфигурация (custom provider)

```json
{
  "version": "1.0.0",
  "publish": [{
    "provider": "custom",
    "url": "https://updates.mvs.app/releases",
    "channel": "latest"
  }]
}
```

### Изменяем на GitHub Releases

```json
{
  "version": "1.0.1",
  "publish": [{
    "provider": "github",
    "owner": "YOUR_USERNAME",
    "repo": "mvs-app",
    "channel": "latest"
  }],
  "build": {
    "publish": [{
      "provider": "github",
      "owner": "YOUR_USERNAME",
      "repo": "mvs-app"
    }]
  }
}
```

**Где найти:**
- `YOUR_USERNAME` — Ваше имя пользователя на GitHub
- `repo` — Название репозитория (обычно `mvs-app`)

---

## 🚀 Выпуск версии 1.0.1

### Метод 1: Ручной выпуск через GitHub UI

#### Шаг 1: Обновить версию в package.json

```bash
cd /Users/maksim/Desktop/carwin0.4.7

# Отредактировать package.json
nano package.json
# Измените: "version": "1.0.0" → "1.0.1"
```

#### Шаг 2: Собрать приложение

```bash
# Очистить старые сборки
rm -rf build/ dist/

# Собрать новую версию
npm run build

# Проверить что создались файлы
ls -lh build/MVSSetup-*.exe
ls -lh build/latest.yml
```

#### Шаг 3: Создать Release на GitHub

```bash
# Перейти в GitHub UI:
# 1. https://github.com/YOUR_USERNAME/mvs-app
# 2. Справа нажмите "Create a new release"
# 3. Заполните форму:

Tag name:      v1.0.1
Release title: MVS 1.0.1 - Автоматические обновления
Description:   - Система автоматических обновлений
               - Красивый диалог обновления
               - Фоновая загрузка с прогресс-баром

# 4. Upload binary files:
# Загрузите из build/:
#   - MVSSetup-1.0.1.exe
#   - MVSSetup-1.0.1.exe.blockmap
#   - latest.yml

# 5. Установите "Latest" если это текущая версия
# 6. Нажмите "Publish release"
```

#### Результат

```
GitHub создаст URL:
https://github.com/YOUR_USERNAME/mvs-app/releases/tag/v1.0.1

Прямые ссылки на файлы:
https://github.com/YOUR_USERNAME/mvs-app/releases/download/v1.0.1/MVSSetup-1.0.1.exe
https://github.com/YOUR_USERNAME/mvs-app/releases/download/v1.0.1/latest.yml
```

---

### Метод 2: Автоматический выпуск через GitHub CLI

```bash
# Установить GitHub CLI
brew install gh  # macOS
# или
choco install gh  # Windows

# Авторизоваться
gh auth login

# Создать release
gh release create v1.0.1 \
  build/MVSSetup-1.0.1.exe \
  build/MVSSetup-1.0.1.exe.blockmap \
  build/latest.yml \
  --title "MVS 1.0.1" \
  --notes "Система автоматических обновлений" \
  --latest
```

---

### Метод 3: Автоматический выпуск через GitHub Actions

Создайте `.github/workflows/build-release.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build application
        run: npm run build
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            build/MVSSetup-*.exe
            build/MVSSetup-*.exe.blockmap
            build/latest.yml
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Использование:**
```bash
# Просто создайте git tag и push
git tag v1.0.1
git push origin v1.0.1

# GitHub Actions автоматически:
# 1. Собирает приложение
# 2. Создаёт Release
# 3. Загружает файлы
```

---

## 🔍 Проверка что электрон-апдейтер найдёт релиз

### electron-updater автоматически запросит:

```
https://api.github.com/repos/YOUR_USERNAME/mvs-app/releases/latest
```

### Ответ будет содержать:

```json
{
  "tag_name": "v1.0.1",
  "assets": [
    {
      "name": "MVSSetup-1.0.1.exe",
      "browser_download_url": "https://github.com/.../download/v1.0.1/MVSSetup-1.0.1.exe"
    },
    {
      "name": "latest.yml",
      "browser_download_url": "https://github.com/.../download/v1.0.1/latest.yml"
    }
  ]
}
```

---

## ✅ Проверка работы

### Локально (с версией 1.0.0)

```bash
# 1. Убедитесь что установлена версия 1.0.0
# 2. Запустите приложение
npm run electron

# 3. Проверьте логи
# Windows: %APPDATA%/MVS/startup.log
# Должны быть:
# [updater] Checking for updates...
# [updater] Update available: 1.0.0 → 1.0.1
# [updater] Download started...

# 4. Появится диалог: "Обновление 1.0.1 доступно"
```

### Проверка latest.yml вручную

```bash
# Скачайте latest.yml с GitHub
curl -L https://github.com/YOUR_USERNAME/mvs-app/releases/download/v1.0.1/latest.yml

# Должно быть что-то вроде:
# version: 1.0.1
# files:
#   - url: https://github.com/YOUR_USERNAME/mvs-app/releases/download/v1.0.1/MVSSetup-1.0.1.exe
#     sha512: '...'
#     size: ...
```

---

## 🛡️ Rate Limiting GitHub API

**Важно:** GitHub API имеет лимиты:
- 60 запросов в час для неавторизованных
- 5000 запросов в час для авторизованных

**Решение:** Добавить GitHub токен в переменные окружения

```bash
# На Windows (PowerShell):
$env:GH_TOKEN = "your-github-token"

# На macOS/Linux:
export GH_TOKEN="your-github-token"

# Или в .env файле:
echo "GH_TOKEN=your-github-token" > .env
```

---

## 🔐 Безопасность

### Цифровая подпись приложения (опционально)

electron-updater поддерживает подпись релизов для дополнительной безопасности.

### Для Assignment 18 (необязательно, но рекомендуется)

Подробнее: https://www.electron.build/code-signing

---

## 📊 Альтернативные решения (Future)

Если GitHub Releases не подходит в future:

### 1. S3 + CloudFront
```json
{
  "publish": [{
    "provider": "s3",
    "bucket": "mvs-updates",
    "path": "/releases",
    "region": "eu-west-1"
  }]
}
```

### 2. Cloudflare R2
```json
{
  "publish": [{
    "provider": "custom",
    "url": "https://cdn.mvs.app/releases",
    "channel": "latest"
  }]
}
```

### 3. Custom Strapi Backend
```json
{
  "publish": [{
    "provider": "custom",
    "url": "https://api.mvs.app/releases",
    "channel": "latest"
  }]
}
```

---

## 📝 Шпаргалка GitHub Releases

### Быстрая командная строка

```bash
# 1. Обновить версию
sed -i 's/"version": "1.0.0"/"version": "1.0.1"/g' package.json

# 2. Собрать
npm run build

# 3. Коммитить и тегировать
git add -A
git commit -m "Release 1.0.1"
git tag -a v1.0.1 -m "Version 1.0.1"
git push origin main
git push origin v1.0.1

# 4. Создать Release через CLI
gh release create v1.0.1 build/MVSSetup-1.0.1.* build/latest.yml --latest

# 5. Готово!
```

---

## ✅ Checklist

- [ ] GitHub репозиторий создан
- [ ] package.json обновлён для GitHub
- [ ] Версия обновлена на 1.0.1
- [ ] npm run build выполнен успешно
- [ ] Release создан на GitHub
- [ ] Файлы загружены (exe, blockmap, yml)
- [ ] URL release скопирован
- [ ] latest.yml доступен по HTTPS
- [ ] Тестирование обновления пройдено
- [ ] Логи показывают успешное обновление

---

**Готово к Assignment 18 Phase 2!**
