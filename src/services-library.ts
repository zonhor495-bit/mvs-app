/**
 * Библиотека стандартных услуг автомойки MVS
 * Примерно 40 самых популярных услуг
 */

export interface MVSService {
  id: string;
  name: string;
  category: 'washing' | 'polishing' | 'protection' | 'interior' | 'maintenance' | 'engine';
  description: string;
}

export const MVS_SERVICES_LIBRARY: MVSService[] = [
  // === МОЙКА === 
  { id: 'srv_001', name: 'Комплексная мойка', category: 'washing', description: 'Полный комплекс внешней и внутренней мойки' },
  { id: 'srv_002', name: 'Экспресс-мойка', category: 'washing', description: 'Быстрая базовая мойка кузова' },
  { id: 'srv_003', name: 'Мойка кузова', category: 'washing', description: 'Стандартная мойка внешней поверхности' },
  { id: 'srv_004', name: 'Мойка днища', category: 'washing', description: 'Очистка днища от грязи и реагентов' },
  { id: 'srv_005', name: 'Мойка двигателя', category: 'washing', description: 'Безопасная мойка моторного отсека' },
  { id: 'srv_006', name: 'Мойка дисков', category: 'washing', description: 'Очистка колесных дисков' },
  { id: 'srv_007', name: 'Мойка салона', category: 'interior', description: 'Влажная уборка салона автомобиля' },
  { id: 'srv_008', name: 'Сухая чистка', category: 'interior', description: 'Сухая очистка внутренних поверхностей' },
  { id: 'srv_041', name: 'Трёхфазная мойка', category: 'washing', description: 'Премиальный многоэтапный комплекс' },
  { id: 'srv_042', name: 'Двухфазная мойка', category: 'washing', description: 'Усиленная мойка с предварительным слоем' },
  { id: 'srv_043', name: 'Мойка порогов', category: 'washing', description: 'Очистка порогов и нижних частей кузова' },
  { id: 'srv_044', name: 'Мойка арок', category: 'washing', description: 'Промывка колесных арок' },
  { id: 'srv_045', name: 'Пена и смыв', category: 'washing', description: 'Пенный комплекс с ручным смывом' },

  // === ПОЛИРОВКА ===
  { id: 'srv_009', name: 'Полировка кузова', category: 'polishing', description: 'Восстановление блеска лакокрасочного покрытия' },
  { id: 'srv_010', name: 'Полировка панели', category: 'polishing', description: 'Полировка центральной панели и глянцевых вставок' },
  { id: 'srv_011', name: 'Полировка фар', category: 'polishing', description: 'Восстановление прозрачности фар' },
  { id: 'srv_012', name: 'Полировка стёкол', category: 'polishing', description: 'Устранение мелких потертостей на стеклах' },
  { id: 'srv_013', name: 'Полировка пластика', category: 'polishing', description: 'Обновление пластиковых элементов салона' },
  { id: 'srv_046', name: 'Абразивная полировка', category: 'polishing', description: 'Глубокая коррекция ЛКП' },
  { id: 'srv_047', name: 'Финишная полировка', category: 'polishing', description: 'Финальный блеск после коррекции' },
  { id: 'srv_048', name: 'Антиголограммная полировка', category: 'polishing', description: 'Удаление голограмм и микрорисок' },

  // === ЗАЩИТА ===
  { id: 'srv_014', name: 'Нанесение воска', category: 'protection', description: 'Защитный воск с эффектом блеска' },
  { id: 'srv_015', name: 'Нанесение керамики', category: 'protection', description: 'Керамическое защитное покрытие' },
  { id: 'srv_016', name: 'Антидождь', category: 'protection', description: 'Гидрофобная обработка стекол' },
  { id: 'srv_017', name: 'Защитная плёнка', category: 'protection', description: 'Нанесение защитной пленки на элементы' },
  { id: 'srv_049', name: 'Жидкое стекло', category: 'protection', description: 'Нанесение долговременного защитного слоя' },
  { id: 'srv_050', name: 'Консервация кузова', category: 'protection', description: 'Долгосрочная защита кузова' },

  // === ШИНЫ И ДИСКИ ===
  { id: 'srv_018', name: 'Чернение шин', category: 'maintenance', description: 'Восстановление глубокого чёрного цвета резины' },
  { id: 'srv_019', name: 'Балансировка шин', category: 'maintenance', description: 'Балансировка колесных шин' },
  { id: 'srv_020', name: 'Полировка дисков', category: 'maintenance', description: 'Полировка поверхности дисков' },
  { id: 'srv_021', name: 'Восстановление дисков', category: 'maintenance', description: 'Косметическое восстановление дисков' },
  { id: 'srv_051', name: 'Мойка шин', category: 'maintenance', description: 'Очистка шин специальным составом' },
  { id: 'srv_052', name: 'Обработка шин', category: 'maintenance', description: 'Кондиционирование и защита шин' },

  // === ХИМЧИСТКА ===
  { id: 'srv_022', name: 'Химчистка салона', category: 'interior', description: 'Глубокая химчистка внутренних поверхностей' },
  { id: 'srv_023', name: 'Химчистка сидений', category: 'interior', description: 'Удаление загрязнений с сидений' },
  { id: 'srv_024', name: 'Чистка ковриков', category: 'interior', description: 'Сухая и влажная чистка ковриков' },
  { id: 'srv_025', name: 'Чистка потолка', category: 'interior', description: 'Деликатная очистка потолочного покрытия' },
  { id: 'srv_053', name: 'Химчистка багажника', category: 'interior', description: 'Очистка багажного отделения' },
  { id: 'srv_054', name: 'Чистка дверных карт', category: 'interior', description: 'Химчистка дверных карт и карманов' },
  { id: 'srv_055', name: 'Чистка ремней', category: 'interior', description: 'Очистка ремней безопасности' },

  // === ДЕЗОДОРИРОВАНИЕ И ОЗОНАЦИЯ ===
  { id: 'srv_026', name: 'Озонация', category: 'maintenance', description: 'Устранение запахов и дезинфекция салона' },
  { id: 'srv_027', name: 'Ароматизация', category: 'maintenance', description: 'Придание салону приятного аромата' },
  { id: 'srv_028', name: 'Дезинсекция', category: 'maintenance', description: 'Обработка от насекомых и запахов' },
  { id: 'srv_056', name: 'Антибактериальная обработка', category: 'maintenance', description: 'Гигиеническая обработка салона' },

  // === ТОНИРОВАНИЕ И ОКРАСКА ===
  { id: 'srv_029', name: 'Тонирование стёкол', category: 'protection', description: 'Тонировка стекол автомобиля' },
  { id: 'srv_030', name: 'Роспись кузова', category: 'maintenance', description: 'Декоративная работа по кузову' },

  // === ДВИГАТЕЛЬ ===
  { id: 'srv_031', name: 'Консервация двигателя', category: 'engine', description: 'Защитная консервация моторного отсека' },
  { id: 'srv_032', name: 'Чистка двигателя паром', category: 'engine', description: 'Паровая очистка двигателя' },
  { id: 'srv_033', name: 'Обработка подвески', category: 'engine', description: 'Очистка и защита элементов подвески' },
  { id: 'srv_057', name: 'Диагностика подкапотного пространства', category: 'engine', description: 'Визуальный осмотр и очистка' },
  { id: 'srv_058', name: 'Обработка радиатора', category: 'engine', description: 'Очистка и защита радиатора' },

  // === СТЁКЛА И ЗЕРКАЛА ===
  { id: 'srv_034', name: 'Обработка стёкол', category: 'protection', description: 'Антидождь и защита стекол' },
  { id: 'srv_035', name: 'Полировка зеркал', category: 'polishing', description: 'Чистка и полировка зеркал' },
  { id: 'srv_059', name: 'Чистка зеркал', category: 'maintenance', description: 'Удаление загрязнений с зеркал' },

  // === ПОЛОВ И КОВРОВ ===
  { id: 'srv_036', name: 'Чистка ковров', category: 'interior', description: 'Очистка ковровых покрытий' },
  { id: 'srv_037', name: 'Химчистка ковров', category: 'interior', description: 'Глубокая химчистка ковров' },
  { id: 'srv_060', name: 'Чистка багажного коврика', category: 'interior', description: 'Очистка коврика в багажнике' },

  // === ДОП. УСЛУГИ ===
  { id: 'srv_038', name: 'Полировка хромированных деталей', category: 'polishing', description: 'Блеск хрома и декоративных элементов' },
  { id: 'srv_039', name: 'Восстановление кожи', category: 'maintenance', description: 'Чистка и восстановление кожаных элементов' },
  { id: 'srv_040', name: 'Нанесение защитного покрытия', category: 'protection', description: 'Защитный слой на лакокрасочное покрытие' },
  { id: 'srv_061', name: 'Пылесос салона', category: 'interior', description: 'Быстрая уборка салона пылесосом' },
  { id: 'srv_062', name: 'Пылесос багажника', category: 'interior', description: 'Уборка багажного отделения' },
  { id: 'srv_063', name: 'Чистка дверных проёмов', category: 'interior', description: 'Очистка дверных проёмов и кромок' },
  { id: 'srv_064', name: 'Обработка пластика салона', category: 'interior', description: 'Кондиционирование пластиковых деталей' },
  { id: 'srv_065', name: 'Чернение молдингов', category: 'maintenance', description: 'Обновление цвета внешних молдингов' },
  { id: 'srv_066', name: 'Полировка порогов', category: 'polishing', description: 'Полировка порогов и накладок' },
  { id: 'srv_067', name: 'Антискрип обработка', category: 'maintenance', description: 'Устранение скрипов в салоне' },
  { id: 'srv_068', name: 'Обработка уплотнителей', category: 'maintenance', description: 'Смазка и защита резиновых уплотнителей' },
  { id: 'srv_069', name: 'Кондиционирование кожи', category: 'interior', description: 'Питание и защита кожаных поверхностей' },
  { id: 'srv_070', name: 'Защита салона', category: 'protection', description: 'Комплексная защита и обработка салона' },
];

/**
 * Получить услугу из библиотеки по ID
 */
export function getServiceFromLibrary(serviceId: string): MVSService | undefined {
  return MVS_SERVICES_LIBRARY.find(s => s.id === serviceId);
}

/**
 * Проверить, существует ли услуга в библиотеке
 */
export function isServiceInLibrary(serviceName: string): boolean {
  return MVS_SERVICES_LIBRARY.some(s => s.name === serviceName);
}

/**
 * Получить услугу по названию
 */
export function getServiceByName(name: string): MVSService | undefined {
  return MVS_SERVICES_LIBRARY.find(s => s.name === name);
}
