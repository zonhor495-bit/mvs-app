import { useState } from 'react';
import { runFullStressTest, loadTestDataToStorage } from '../utils/testDataGenerator';

export function StressTestPanel() {
  const [isRunning, setIsRunning] = useState(false);
  
  const handleRunTest = () => {
    setIsRunning(true);
    console.clear();
    try {
      runFullStressTest();
    } finally {
      setIsRunning(false);
    }
  };
  
  const handleLoadTestData = () => {
    setIsRunning(true);
    console.clear();
    try {
      loadTestDataToStorage();
      console.log('✅ Данные загружены. Перезагрузите страницу для применения.');
    } finally {
      setIsRunning(false);
    }
  };
  
  return (
    <div className="fixed bottom-4 right-4 bg-slate-900 border border-cyan-500/30 rounded-lg p-4 w-72 z-50">
      <h3 className="text-sm font-semibold text-white mb-3">🧪 Стресс-тест</h3>
      <div className="space-y-2">
        <button
          onClick={handleLoadTestData}
          disabled={isRunning}
          className="w-full px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 disabled:opacity-50 text-blue-300 text-xs rounded border border-blue-500/30 transition-colors"
        >
          📥 Загрузить 5000 клиентов, 10000 заказов
        </button>
        <button
          onClick={handleRunTest}
          disabled={isRunning}
          className="w-full px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 disabled:opacity-50 text-cyan-300 text-xs rounded border border-cyan-500/30 transition-colors"
        >
          {isRunning ? '⏳ Тестирование...' : '🚀 Запустить тест'}
        </button>
        <p className="text-xs text-slate-500 mt-2">Откройте консоль (F12) для результатов</p>
      </div>
    </div>
  );
}
