#!/bin/bash

# Скрипт для подготовки к тестированию обновления
# Использование: ./scripts/prepare-update-test.sh

set -e

echo "=================================="
echo "Подготовка к тестированию обновления 1.1.0"
echo "=================================="
echo ""

# 1. Проверка версии в package.json
echo "✓ Проверка версии..."
VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
echo "  Текущая версия: $VERSION"
if [ "$VERSION" != "1.1.0" ]; then
    echo "  ⚠️  Версия не 1.1.0! Обновите package.json"
    exit 1
fi
echo "  ✅ Версия корректна"
echo ""

# 2. Проверка что сборка существует
echo "✓ Проверка файлов сборки..."
if [ ! -f "build/win/MVSSetup.exe" ] && [ ! -f "build/win/latest.yml" ]; then
    echo "  ⚠️  Файлы сборки не найдены!"
    echo "  Запустите: npm run build:win"
    exit 1
fi
echo "  ✅ Файлы сборки готовы"
echo ""

# 3. Проверка WD125
echo "✓ Проверка файлов релиза..."
if [ ! -f "WD125/MVSSetup-1.1.0.exe" ] || [ ! -f "WD125/latest.yml" ]; then
    echo "  ⚠️  Файлы релиза не найдены!"
    echo "  Скопируйте файлы из build/win/ в WD125/"
    exit 1
fi
echo "  ✅ Файлы релиза готовы"
echo ""

# 4. Показываем информацию о файлах
echo "✓ Информация о релизе:"
SIZE=$(ls -lh "WD125/MVSSetup-1.1.0.exe" | awk '{print $5}')
echo "  📦 Установщик: MVSSetup-1.1.0.exe ($SIZE)"
echo "  📄 Метаданные: latest.yml"
echo ""

# 5. Показываем как запустить сервер
echo "=================================="
echo "Готово к тестированию!"
echo "=================================="
echo ""
echo "Для запуска локального сервера обновлений:"
echo "  node scripts/update-server.cjs"
echo ""
echo "Инструкции полностью в:"
echo "  TESTING_UPDATE_1_1_0.md"
echo ""
echo "Краткая проверка:"
echo "  1. npm run build:win       (собрать приложение)"
echo "  2. node scripts/update-server.cjs  (запустить сервер)"
echo "  3. Установить версию 1.0.3 на тестовой машине"
echo "  4. Изменить URL в package.json на http://IP:3000"
echo "  5. Проверить обновление на версию 1.1.0"
echo ""
