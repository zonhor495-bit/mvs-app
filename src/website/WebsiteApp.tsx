import { useEffect, useState } from 'react';
import { NavLink, Link, Routes, Route, useLocation } from 'react-router-dom';

const features = [
  { title: 'Заказы и услуги', description: 'Принимайте заказы, рассчитывайте услуги и имейте полный контроль над процессом.', icon: '📋' },
  { title: 'Клиенты и авто', description: 'Храните историю посетителей, автомобили и предпочтения клиентов.', icon: '👥' },
  { title: 'Финансовый контроль', description: 'Отслеживайте оплату, отчёты и прибыль в одном интерфейсе.', icon: '💳' },
  { title: 'Аналитика в режиме реального времени', description: 'Принимайте решения на основе доходов, нагрузки и отзывов.', icon: '📈' },
  { title: 'Склад и материалы', description: 'Управляйте запасами, списаниями и закупками без лишних усилий.', icon: '📦' },
  { title: 'Сотрудники и смены', description: 'Планируйте смены, фиксируйте выплаты и контролируйте эффективность.', icon: '👷' },
];

const faqs = [
  { question: 'Как установить MVS на Windows?', answer: 'Скачайте установщик на странице загрузки, запустите его и следуйте шагам мастера. Созданные ярлыки появятся на рабочем столе и в меню Пуск.' },
  { question: 'Поддерживается ли работа офлайн?', answer: 'Да, MVS работает как локальное Windows-приложение и не требует постоянного подключения для управления автомойкой.' },
  { question: 'Можно ли добавить несколько автомоек?', answer: 'Внутри приложения вы можете создавать несколько организаций и переключаться между ними.' },
  { question: 'Как быстро можно начать работу?', answer: 'Через несколько минут после установки вы можете создавать заказы, регистрировать клиентов и контролировать смены.' },
  { question: 'Какие отчёты доступны в MVS?', answer: 'MVS предоставляет отчёты по выручке, расходам, аналитике загрузки боксов и эффективности сотрудников.' },
  { question: 'Что делать, если нужно восстановить данные?', answer: 'Данные хранятся локально. Вы можете делать резервные копии базы и легко восстанавливать их через встроенный экспорт/импорт.' },
];

function Logo() {
  return (
    <div className="h-10 w-10 rounded-2xl border border-slate-200/80 bg-white/90 dark:border-slate-700 dark:bg-slate-900 flex items-center justify-center text-sm font-bold text-sky-600 dark:text-sky-400">
      MVS
    </div>
  );
}

function usePageViews() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);
}

function Header({ theme, toggleTheme }: { theme: 'light' | 'dark'; toggleTheme: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/95 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <Link to="/" className="flex items-center gap-3 text-slate-900 dark:text-white">
          <Logo />
          <div>
            <p className="text-base font-semibold tracking-tight">MVS</p>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Car Management System</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <NavLink to="/features" className="text-sm font-medium text-slate-600 transition hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-400">Возможности</NavLink>
          <NavLink to="/how-it-works" className="text-sm font-medium text-slate-600 transition hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-400">Как работает</NavLink>
          <NavLink to="/screenshots" className="text-sm font-medium text-slate-600 transition hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-400">Скриншоты</NavLink>
          <NavLink to="/reviews" className="text-sm font-medium text-slate-600 transition hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-400">Отзывы</NavLink>
          <NavLink to="/faq" className="text-sm font-medium text-slate-600 transition hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-400">FAQ</NavLink>
          <Link to="/download" className="text-sm font-medium text-slate-600 transition hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-400">Скачать</Link>
        </nav>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 md:inline-flex">
            {theme === 'dark' ? '☀️ Светлая' : '🌙 Тёмная'}
          </button>
          <Link to="/download" className="hidden rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 md:inline-flex">Скачать</Link>
          <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 md:hidden" onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="border-t border-slate-200/70 bg-white/95 px-6 py-5 dark:border-slate-800/70 dark:bg-slate-950/95 md:hidden">
          <div className="flex flex-col gap-3">
            <NavLink to="/features" onClick={() => setMenuOpen(false)} className="rounded-2xl px-4 py-3 text-sm text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800">Возможности</NavLink>
            <NavLink to="/how-it-works" onClick={() => setMenuOpen(false)} className="rounded-2xl px-4 py-3 text-sm text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800">Как работает</NavLink>
            <NavLink to="/screenshots" onClick={() => setMenuOpen(false)} className="rounded-2xl px-4 py-3 text-sm text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800">Скриншоты</NavLink>
            <Link to="/download" onClick={() => setMenuOpen(false)} className="rounded-2xl bg-sky-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-sky-500">Скачать</Link>
            <button onClick={toggleTheme} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-900 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              {theme === 'dark' ? '☀️ Светлая тема' : '🌙 Тёмная тема'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

import { useRef } from 'react';

function PageSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fadeIn');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    // @ts-ignore
    <section ref={ref} className={`opacity-0 px-6 py-16 sm:px-8 ${className}`}>
      {children}
    </section>
  );
}

function HomePage() {
  return (
    <main>
      <PageSection className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-7xl grid gap-12 lg:grid-cols-[0.95fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700 dark:bg-slate-800 dark:text-sky-300">MVS — Car Management System</div>
            <div className="space-y-6">
              <h1 className="text-5xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-6xl">Профессиональная CRM для автомоек с быстрым запуском на Windows.</h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">MVS объединяет заказы, клиентов, сотрудников и финансы в одном приложении. Готово к реальной эксплуатации, с инсталлятором, ярлыками и деинсталлятором.</p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link to="/download" className="inline-flex items-center justify-center rounded-full bg-sky-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500">Скачать для Windows</Link>
              <Link to="/features" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-8 py-4 text-base font-semibold text-slate-900 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">Посмотреть возможности</Link>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-white/90 p-6 shadow-xl shadow-slate-200/50 transition hover:-translate-y-1 hover:shadow-sky-300/20 dark:bg-slate-900 dark:shadow-black/20">
                <p className="text-xs uppercase tracking-[0.35em] text-sky-600 dark:text-sky-400">Готово для</p>
                <p className="mt-4 text-xl font-semibold text-slate-950 dark:text-white">Windows 10 и 11</p>
              </div>
              <div className="rounded-3xl bg-white/90 p-6 shadow-xl shadow-slate-200/50 transition hover:-translate-y-1 hover:shadow-sky-300/20 dark:bg-slate-900 dark:shadow-black/20">
                <p className="text-xs uppercase tracking-[0.35em] text-sky-600 dark:text-sky-400">Скорость</p>
                <p className="mt-4 text-xl font-semibold text-slate-950 dark:text-white">Моментальный запуск</p>
              </div>
              <div className="rounded-3xl bg-white/90 p-6 shadow-xl shadow-slate-200/50 transition hover:-translate-y-1 hover:shadow-sky-300/20 dark:bg-slate-900 dark:shadow-black/20">
                <p className="text-xs uppercase tracking-[0.35em] text-sky-600 dark:text-sky-400">Развёртывание</p>
                <p className="mt-4 text-xl font-semibold text-slate-950 dark:text-white">В несколько кликов</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-sky-100/80 to-white p-8 shadow-2xl shadow-slate-200/30 dark:border-slate-800 dark:from-slate-900/70 dark:to-slate-950 dark:shadow-black/20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_45%)]" />
            <div className="relative rounded-[1.75rem] border border-slate-200/80 bg-white p-8 shadow-xl dark:border-slate-800/80 dark:bg-slate-950">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-2xl text-white shadow-lg">M</div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">MVS Desktop</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Полноценное Windows-приложение</p>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-lg font-semibold text-slate-900 dark:text-white">Быстрая установка, запуск и полный контроль</p>
                <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">Профессиональное ПО для автомоек: инсталлятор с ярлыками, автоматическое добавление в систему и чистый релизный интерфейс.</p>
              </div>
            </div>
          </div>
        </div>
      </PageSection>
    </main>
  );
}

function FeaturesPage() {
  return (
    <main>
      <PageSection className="bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="space-y-3 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-400">Основные возможности</p>
            <h2 className="text-4xl font-semibold">Всё, что нужно для управления автомойкой</h2>
            <p className="mx-auto max-w-2xl text-base leading-8 text-slate-300">MVS объединяет CRM, финансы, склад и аналитику в единый рабочий инструмент, понятный для руководителя и оператора.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-8 transition hover:-translate-y-1 hover:border-sky-500/40 hover:bg-slate-950">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-2xl text-white shadow-lg">{feature.icon}</div>
                <h3 className="mt-6 text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </PageSection>
    </main>
  );
}

function HowItWorksPage() {
  const steps = [
    { title: 'Скачать установщик', description: 'Получите последнюю версию MVS для Windows на странице загрузки.', number: '01' },
    { title: 'Установить и запустить', description: 'Запустите инсталлятор и создайте ярлыки для быстрого доступа.', number: '02' },
    { title: 'Настроить автомойку', description: 'Добавьте организацию, сотрудников и товары в пару кликов.', number: '03' },
    { title: 'Управлять процессом', description: 'Принимайте заказы, контролируйте финансы и отслеживайте эффективность.', number: '04' },
  ];

  return (
    <main>
      <PageSection>
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="space-y-3 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Как это работает</p>
            <h2 className="text-4xl font-semibold text-slate-950 dark:text-white">Запуск бизнеса мойки за несколько шагов</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {steps.map((step) => (
              <div key={step.number} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-sky-100 text-2xl font-bold text-sky-600 dark:bg-slate-800 dark:text-sky-400">{step.number}</div>
                <h3 className="text-2xl font-semibold text-slate-950 dark:text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </PageSection>
    </main>
  );
}

function ScreenshotsPage() {
  const cards = ['Dashboard', 'Клиенты', 'Заказы', 'Аналитика', 'Финансы', 'Настройки'];
  return (
    <main>
      <PageSection className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-7xl space-y-10">
          <div className="space-y-3 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600 dark:text-sky-400">Скриншоты</p>
            <h2 className="text-4xl font-semibold">Интерфейс для ежедневной работы</h2>
            <p className="mx-auto max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-400">Эргономичный интерфейс, понятные карточки и прозрачный рабочий процесс для вашей автомойки.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {cards.map((title) => (
              <div key={title} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-5 h-64 rounded-3xl bg-slate-200 dark:bg-slate-800" />
                <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h3>
              </div>
            ))}
          </div>
        </div>
      </PageSection>
    </main>
  );
}

function ReviewsPage() {
  const reviews = [
    { name: 'Анна, владелец мойки', quote: 'MVS сделал работу команды более организованной, а отчёты — понятными. Теперь мы точно знаем, какие услуги приносят прибыль.' },
    { name: 'Дмитрий, управляющий', quote: 'Скачал, установил и сразу начал использовать. Интерфейс прост, а функционал закрывает весь цикл управления.' },
    { name: 'Елена, бухгалтер', quote: 'Финансовая аналитика в MVS позволяет быстро сверять выручку и расходы. Больше никаких таблиц в Excel.' },
  ];
  return (
    <main>
      <PageSection>
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="space-y-3 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Отзывы</p>
            <h2 className="text-4xl font-semibold text-slate-950 dark:text-white">Что говорят профессионалы</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {reviews.map((review) => (
              <div key={review.name} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-lg leading-8 text-slate-700 dark:text-slate-300">“{review.quote}”</p>
                <p className="mt-6 font-semibold text-slate-900 dark:text-white">{review.name}</p>
              </div>
            ))}
          </div>
        </div>
      </PageSection>
    </main>
  );
}

function FAQPage() {
  return (
    <main>
      <PageSection className="bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="space-y-3 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-400">FAQ</p>
            <h2 className="text-4xl font-semibold">Ответы на популярные вопросы</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="rounded-3xl border border-slate-800 bg-slate-900 p-6" open={false}>
                <summary className="cursor-pointer text-lg font-semibold text-white">{faq.question}</summary>
                <p className="mt-4 text-slate-300">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </PageSection>
    </main>
  );
}

function SupportPage() {
  return (
    <main>
      <PageSection>
        <div className="mx-auto max-w-6xl grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Поддержка</p>
            <h2 className="text-4xl font-semibold text-slate-950 dark:text-white">Готовы помочь на каждом этапе</h2>
            <p className="max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">MVS предоставляет поддержку по установке, настройке и ежедневной работе. Ответим быстро и понятно.</p>
          </div>
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Email</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">support@mvs.app</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Телефон</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">+7 (999) 123-45-67</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">График</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">Пн–Пт 09:00–18:00</p>
            </div>
          </div>
        </div>
      </PageSection>
    </main>
  );
}

function DownloadPage() {
  return (
    <main>
      <PageSection className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-10 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Скачать</p>
              <h2 className="mt-3 text-4xl font-semibold">MVS для Windows</h2>
              <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300">Запуск профессионального ПО для автомойки: установка, ярлыки и деинсталлятор в одном пакете.</p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <a href="https://github.com/zonhor495-bit/mvs-app/releases/latest/download/MVSSetup.exe" className="inline-flex items-center justify-center rounded-full bg-sky-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500">Скачать для Windows</a>
                <a href="/support" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-8 py-4 text-base font-semibold text-slate-900 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">Нужна помощь?</a>
              </div>
            </div>
            <div className="rounded-[1.75rem] bg-slate-950 p-8 text-slate-100 shadow-xl dark:bg-slate-900">
              <div className="rounded-3xl bg-slate-900 p-6 shadow-inner">
                <p className="text-sm uppercase tracking-[0.3em] text-sky-400">Пакет включает</p>
                <ul className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
                  <li>✔ Установщик NSIS</li>
                  <li>✔ Ярлык на рабочем столе</li>
                  <li>✔ Ярлык в меню Пуск</li>
                  <li>✔ Деинсталлятор</li>
                  <li>✔ Профессиональная иконка</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </PageSection>
    </main>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white/95 py-10 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-400">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p>© 2026 MVS — Car Management System</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/support" className="hover:text-sky-600">Поддержка</Link>
          <Link to="/faq" className="hover:text-sky-600">FAQ</Link>
          <Link to="/download" className="hover:text-sky-600">Скачать</Link>
        </div>
      </div>
    </footer>
  );
}

export default function WebsiteApp() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  usePageViews();

  useEffect(() => {
    const savedTheme = typeof window !== 'undefined' ? window.localStorage.getItem('mvs-theme') : null;
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
    } else if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mvs-theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => setTheme((value) => (value === 'dark' ? 'light' : 'dark'));

  return (
    <div className={theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}>
      <Header theme={theme} toggleTheme={toggleTheme} />
      <div className="min-h-[calc(100vh-80px)]">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/screenshots" element={<ScreenshotsPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/download" element={<DownloadPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}
