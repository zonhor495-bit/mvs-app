#!/usr/bin/env node

/**
 * Локальный сервер обновлений для тестирования electron-updater
 * Используется для проверки механизма автообновления
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const RELEASE_DIR = path.join(__dirname, 'WD125');

console.log('🚀 Запуск локального сервера обновлений...');
console.log(`📁 Директория релизов: ${RELEASE_DIR}`);
console.log(`🌐 Сервер будет доступен на: http://localhost:${PORT}`);

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`\n📨 Запрос: ${req.method} ${pathname}`);

  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Главная страница
  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>MVS Обновления</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    .status { background: #e8f5e9; padding: 10px; border-radius: 5px; margin: 10px 0; }
    .file { background: #fff; padding: 10px; margin: 5px 0; border-left: 3px solid #4caf50; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
    a { color: #2196f3; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>🚀 Сервер обновлений MVS</h1>
  <div class="status">Статус: <strong>✅ Работает</strong></div>
  
  <h2>Доступные файлы:</h2>
  <div class="file"><a href="/latest.yml">latest.yml</a> - Метаданные версии</div>
  <div class="file"><a href="/MVSSetup-1.1.0.exe">MVSSetup-1.1.0.exe</a> - Установщик (84MB)</div>
  
  <h2>Как использовать:</h2>
  <ol>
    <li>Скопируйте URL сервера: <code>http://localhost:${PORT}</code></li>
    <li>Откройте <code>package.json</code> и установите URL в поле <code>publish</code></li>
    <li>Пересоберите приложение: <code>npm run build:win</code></li>
    <li>Запустите Electron и проверьте обновления</li>
    <li>Логи будут в <code>%APPDATA%\\MVS\\startup.log</code></li>
  </ol>
  
  <h2>Тестовый сценарий:</h2>
  <ol>
    <li>Установите версию 1.0.3</li>
    <li>Запустите этот сервер</li>
    <li>Укажите URL в package.json и соберите версию 1.1.0</li>
    <li>Проверьте что версия 1.0.3 видит обновление на 1.1.0</li>
    <li>Нажмите "Обновить" и дождитесь завершения</li>
  </ol>
</body>
</html>
    `);
    return;
  }

  // latest.yml
  if (pathname === '/latest.yml') {
    const filePath = path.join(RELEASE_DIR, 'latest.yml');
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: latest.yml');
      console.log('❌ Файл не найден: latest.yml');
      return;
    }
    res.writeHead(200, { 
      'Content-Type': 'application/x-yaml',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    const content = fs.readFileSync(filePath);
    console.log('✅ Возвращаю latest.yml');
    console.log(content.toString());
    res.end(content);
    return;
  }

  // Установщик
  if (pathname.includes('MVSSetup') && pathname.endsWith('.exe')) {
    const filename = pathname.split('/').pop();
    const filePath = path.join(RELEASE_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Not found: ${filename}`);
      console.log(`❌ Файл не найден: ${filename}`);
      return;
    }
    
    const stats = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stats.size,
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    console.log(`✅ Начинаю передачу: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
    
    const stream = fs.createReadStream(filePath);
    let lastLog = Date.now();
    let transferred = 0;
    
    stream.on('data', (chunk) => {
      transferred += chunk.length;
      if (Date.now() - lastLog > 1000) {
        console.log(`   📥 Передано: ${(transferred / 1024 / 1024).toFixed(2)}MB / ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
        lastLog = Date.now();
      }
    });
    
    stream.on('end', () => {
      console.log(`✅ Передача завершена: ${filename}`);
    });
    
    stream.on('error', (err) => {
      console.error(`❌ Ошибка при передаче: ${err.message}`);
    });
    
    stream.pipe(res);
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
  console.log(`❌ Неизвестный путь: ${pathname}`);
});

server.listen(PORT, () => {
  console.log(`\n✅ Сервер запущен на http://localhost:${PORT}`);
  console.log('\n💡 Для тестирования:');
  console.log('1. Откройте http://localhost:' + PORT);
  console.log('2. Измените URL в package.json на http://localhost:' + PORT);
  console.log('3. Пересоберите приложение');
  console.log('4. Проверьте обновления\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Порт ${PORT} уже используется`);
  } else {
    console.error(`❌ Ошибка сервера: ${err.message}`);
  }
  process.exit(1);
});
