import { BrowserRouter } from 'react-router-dom';
import InternalApp from './app/InternalApp';
import WebsiteApp from './website/WebsiteApp';

function App() {
  // В Electron preload открывает window.electron — если оно есть, показываем InternalApp
  const isElectron = typeof window !== 'undefined' && typeof (window as any).electron !== 'undefined';
  if (isElectron || (typeof window !== 'undefined' && window.location.pathname.startsWith('/app'))) {
    return <InternalApp />;
  }

  return (
    <BrowserRouter basename="/mvs-app">
      <WebsiteApp />
    </BrowserRouter>
  );
}

export default App;
