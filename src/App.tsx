import { BrowserRouter } from 'react-router-dom';
import InternalApp from './app/InternalApp';
import WebsiteApp from './website/WebsiteApp';

function App() {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
    return <InternalApp />;
  }

  return (
    <BrowserRouter basename="/mvs-app">
      <WebsiteApp />
    </BrowserRouter>
  );
}

export default App;
