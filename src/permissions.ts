/**
 * Система прав доступа (Permissions)
 * Масштабируемая архитектура без привязки к названиям ролей
 */

// Типы действий/функций в приложении
export enum Permission {
  // Заказы
  VIEW_ORDERS = 'view_orders',
  CREATE_ORDER = 'create_order',
  EDIT_ORDER = 'edit_order',
  CLOSE_ORDER = 'close_order',

  // Услуги
  VIEW_SERVICES = 'view_services',
  EDIT_SERVICES = 'edit_services',
  CREATE_SERVICE = 'create_service',
  DELETE_SERVICE = 'delete_service',

  // Цены
  VIEW_PRICES = 'view_prices',
  EDIT_PRICES = 'edit_prices',

  // Клиенты
  VIEW_CLIENTS = 'view_clients',
  MANAGE_CLIENTS = 'manage_clients',

  // Платежи
  PROCESS_PAYMENT = 'process_payment',
  VIEW_PAYMENTS = 'view_payments',

  // Сотрудники
  VIEW_EMPLOYEES = 'view_employees',
  MANAGE_EMPLOYEES = 'manage_employees',
  MANAGE_SALARIES = 'manage_salaries',

  // Склад
  VIEW_WAREHOUSE = 'view_warehouse',
  MANAGE_WAREHOUSE = 'manage_warehouse',

  // Поставщики
  VIEW_SUPPLIERS = 'view_suppliers',
  MANAGE_SUPPLIERS = 'manage_suppliers',

  // Аналитика и отчёты
  VIEW_ANALYTICS = 'view_analytics',
  VIEW_REPORTS = 'view_reports',

  // Кассовые операции
  MANAGE_CASHIER = 'manage_cashier',

  // Настройки
  VIEW_SETTINGS = 'view_settings',
  MANAGE_SETTINGS = 'manage_settings',

  // Финансы
  VIEW_FINANCE = 'view_finance',
  MANAGE_FINANCE = 'manage_finance',

  // Роли (для управления прав)
  MANAGE_ROLES = 'manage_roles',
  CHANGE_PASSWORDS = 'change_passwords',
}

// Роли и их привилегии
export type UserRole = 'admin' | 'manager';

export interface RolePermissions {
  name: string;
  description: string;
  permissions: Permission[];
}

/**
 * Определение прав для каждой роли
 */
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    name: 'Администратор',
    description: 'Сотрудник на автомойке',
    permissions: [
      // Заказы - полный доступ
      Permission.VIEW_ORDERS,
      Permission.CREATE_ORDER,
      Permission.EDIT_ORDER,
      Permission.CLOSE_ORDER,

      // Услуги - только просмотр
      Permission.VIEW_SERVICES,

      // Цены - только просмотр
      Permission.VIEW_PRICES,

      // Клиенты - полный доступ
      Permission.VIEW_CLIENTS,
      Permission.MANAGE_CLIENTS,

      // Платежи - полный доступ
      Permission.PROCESS_PAYMENT,
      Permission.VIEW_PAYMENTS,

      // Кассовые операции
      Permission.MANAGE_CASHIER,

      // Аналитика и отчёты - просмотр
      Permission.VIEW_ANALYTICS,
      Permission.VIEW_REPORTS,
    ],
  },
  manager: {
    name: 'Управляющий',
    description: 'Полный контроль',
    permissions: [
      // Заказы - полный доступ
      Permission.VIEW_ORDERS,
      Permission.CREATE_ORDER,
      Permission.EDIT_ORDER,
      Permission.CLOSE_ORDER,

      // Услуги - полный доступ
      Permission.VIEW_SERVICES,
      Permission.EDIT_SERVICES,
      Permission.CREATE_SERVICE,
      Permission.DELETE_SERVICE,

      // Цены - полный доступ
      Permission.VIEW_PRICES,
      Permission.EDIT_PRICES,

      // Клиенты - полный доступ
      Permission.VIEW_CLIENTS,
      Permission.MANAGE_CLIENTS,

      // Платежи - полный доступ
      Permission.PROCESS_PAYMENT,
      Permission.VIEW_PAYMENTS,

      // Сотрудники - полный доступ
      Permission.VIEW_EMPLOYEES,
      Permission.MANAGE_EMPLOYEES,
      Permission.MANAGE_SALARIES,

      // Склад - полный доступ
      Permission.VIEW_WAREHOUSE,
      Permission.MANAGE_WAREHOUSE,

      // Поставщики - полный доступ
      Permission.VIEW_SUPPLIERS,
      Permission.MANAGE_SUPPLIERS,

      // Финансы - полный доступ
      Permission.VIEW_FINANCE,
      Permission.MANAGE_FINANCE,

      // Аналитика и отчёты - полный доступ
      Permission.VIEW_ANALYTICS,
      Permission.VIEW_REPORTS,

      // Кассовые операции - полный доступ
      Permission.MANAGE_CASHIER,

      // Настройки - полный доступ
      Permission.VIEW_SETTINGS,
      Permission.MANAGE_SETTINGS,

      // Управление ролями
      Permission.MANAGE_ROLES,
      Permission.CHANGE_PASSWORDS,
    ],
  },
};

/**
 * Проверить, есть ли у пользователя определённое право
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const rolePerms = ROLE_PERMISSIONS[role];
  if (!rolePerms) return false;
  return rolePerms.permissions.includes(permission);
}

/**
 * Проверить, есть ли у пользователя все права из списка
 */
export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.every(perm => hasPermission(role, perm));
}

/**
 * Проверить, есть ли у пользователя хотя бы одно право из списка
 */
export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.some(perm => hasPermission(role, perm));
}

/**
 * Получить все права для роли
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role]?.permissions || [];
}

/**
 * Проверить, может ли пользователь видеть страницу
 */
export function canViewPage(
  role: UserRole,
  pagePermissions: Permission[]
): boolean {
  if (pagePermissions.length === 0) return true; // Если прав нет, доступ открыт всем
  return hasAnyPermission(role, pagePermissions);
}
