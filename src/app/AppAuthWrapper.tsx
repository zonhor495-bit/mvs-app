import InternalApp from './InternalApp';

/**
 * Совместимый контейнер для старых импортов.
 * Основной auth-поток теперь живёт внутри `InternalApp`.
 */
export const AppAuthWrapper: React.FC = () => {
  return <InternalApp />;
};

export default AppAuthWrapper;
