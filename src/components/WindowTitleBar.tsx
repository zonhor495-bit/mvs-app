import { useEffect, useState } from 'react';

export default function WindowTitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let mounted = true;
    const syncState = async () => {
      if (!window.electron?.windowControls) return;
      try {
        const maximized = await window.electron.windowControls.isMaximized();
        if (mounted) setIsMaximized(maximized);
      } catch {
        // ignore
      }
    };

    void syncState();
    const interval = window.setInterval(syncState, 800);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const handleToggleMaximize = async () => {
    if (!window.electron?.windowControls) return;
    try {
      const maximized = await window.electron.windowControls.toggleMaximize();
      setIsMaximized(maximized);
    } catch {
      // ignore
    }
  };

  return (
    <div className="h-11 px-3 flex items-center justify-between border-b border-white/10 bg-slate-950/95 backdrop-blur-md select-none app-drag-region">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 text-[10px] font-bold">
          MVS
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-100 leading-none">MVS</p>
          <p className="text-[10px] text-slate-400 leading-none mt-1">Car Management System</p>
        </div>
      </div>

      <div className="flex items-center app-no-drag-region">
        <button
          onClick={() => window.electron?.windowControls?.minimize()}
          className="w-10 h-8 text-slate-300 hover:bg-white/10 transition"
          aria-label="Свернуть окно"
        >
          —
        </button>
        <button
          onClick={handleToggleMaximize}
          className="w-10 h-8 text-slate-300 hover:bg-white/10 transition"
          aria-label={isMaximized ? 'Восстановить окно' : 'Развернуть окно'}
        >
          {isMaximized ? '❐' : '□'}
        </button>
        <button
          onClick={() => window.electron?.windowControls?.close()}
          className="w-10 h-8 text-slate-300 hover:bg-red-500/80 hover:text-white transition"
          aria-label="Закрыть окно"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
