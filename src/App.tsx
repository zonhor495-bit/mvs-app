import { BrowserRouter } from 'react-router-dom';
import InternalApp from './app/InternalApp';
import WebsiteApp from './website/WebsiteApp';

function App() {
  const isElectron = typeof window !== 'undefined' && typeof (window as any).electron !== 'undefined';
  const isAppPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/app');
  
  // Для внешнего приложения (не Electron и не /app) показываем WebsiteApp
  if (!isElectron && !isAppPath) {
    return (
      <BrowserRouter basename="/mvs-app">
        <WebsiteApp />
      </BrowserRouter>
    );
  }

  // Для внутреннего приложения (Electron или /app) используем единый auth-поток внутри InternalApp
  return <InternalApp />;
}

export default App;
