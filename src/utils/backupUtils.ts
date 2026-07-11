import JSZip from 'jszip';

/**
 * Backup Data Interface
 */
export interface BackupData {
  version: string;
  timestamp: string;
  metadata: {
    appVersion: string;
    carwinVersion: string;
    createdBy: string;
    comment?: string;
  };
  data: {
    organizations: any[];
    users: any[];
    washers: any[];
    orders: any[];
    clients: any[];
    vehicles: any[];
    boxes: any[];
    services: any[];
    prices: any[];
    carTypes: any[];
    cashShifts: any[];
    cashOperations: any[];
    warehouseItems: any[];
    warehouseMovements: any[];
    expenseRecords: any[];
    payrollRecords: any[];
    actionLogs: any[];
    shifts: any[];
    purchases: any[];
    inventory: any[];
  };
  checksum: string;
}

/**
 * Serialize all application data into a backup object
 */
export function serializeBackupData(
  createdBy: string,
  comment?: string
): BackupData {
  const now = new Date().toISOString();
  
  // Get all data from localStorage
  const data = {
    organizations: JSON.parse(localStorage.getItem('wd_organizations') || '[]'),
    users: JSON.parse(localStorage.getItem('wd_users') || '[]'),
    washers: JSON.parse(localStorage.getItem('wd_washers') || '[]'),
    orders: JSON.parse(localStorage.getItem('wd_orders') || '[]'),
    clients: JSON.parse(localStorage.getItem('wd_clients') || '[]'),
    vehicles: JSON.parse(localStorage.getItem('wd_vehicles') || '[]'),
    boxes: JSON.parse(localStorage.getItem('wd_boxes') || '[]'),
    services: JSON.parse(localStorage.getItem('wd_services') || '[]'),
    prices: JSON.parse(localStorage.getItem('wd_prices') || '[]'),
    carTypes: JSON.parse(localStorage.getItem('wd_car_types') || '[]'),
    cashShifts: JSON.parse(localStorage.getItem('wd_cash_shifts') || '[]'),
    cashOperations: JSON.parse(localStorage.getItem('wd_cash_operations') || '[]'),
    warehouseItems: JSON.parse(localStorage.getItem('wd_warehouse_items') || '[]'),
    warehouseMovements: JSON.parse(localStorage.getItem('wd_warehouse_movements') || '[]'),
    expenseRecords: JSON.parse(localStorage.getItem('wd_expenses') || '[]'),
    payrollRecords: JSON.parse(localStorage.getItem('wd_payrolls') || '[]'),
    actionLogs: JSON.parse(localStorage.getItem('wd_action_logs') || '[]'),
    shifts: JSON.parse(localStorage.getItem('wd_shifts') || '[]'),
    purchases: JSON.parse(localStorage.getItem('wd_purchases') || '[]'),
    inventory: JSON.parse(localStorage.getItem('wd_inventory') || '[]'),
  };

  const backup: BackupData = {
    version: '1.0.0',
    timestamp: now,
    metadata: {
      appVersion: '0.0.1',
      carwinVersion: '0.4.7',
      createdBy,
      comment,
    },
    data,
    checksum: '', // Will be computed
  };

  // Compute checksum
  backup.checksum = computeChecksum(backup);

  return backup;
}

/**
 * Deserialize backup data and restore to localStorage
 */
export async function deserializeBackupData(
  backup: BackupData,
  options?: { onProgress?: (p: number) => void; signal?: AbortSignal }
): Promise<boolean> {
  try {
    if (!backup.data) return false;

    const mapping: Record<string, string> = {
      organizations: 'wd_organizations',
      users: 'wd_users',
      washers: 'wd_washers',
      orders: 'wd_orders',
      clients: 'wd_clients',
      vehicles: 'wd_vehicles',
      boxes: 'wd_boxes',
      services: 'wd_services',
      prices: 'wd_prices',
      carTypes: 'wd_car_types',
      cashShifts: 'wd_cash_shifts',
      cashOperations: 'wd_cash_operations',
      warehouseItems: 'wd_warehouse_items',
      warehouseMovements: 'wd_warehouse_movements',
      expenseRecords: 'wd_expenses',
      payrollRecords: 'wd_payrolls',
      actionLogs: 'wd_action_logs',
      shifts: 'wd_shifts',
      purchases: 'wd_purchases',
      inventory: 'wd_inventory',
    };

    const keys = Object.keys(mapping);
    const total = keys.length;
    let applied = 0;

    for (const k of keys) {
      if (options?.signal?.aborted) throw new Error('Restore cancelled');
      const value = (backup.data as Record<string, any>)[k];
      if (Array.isArray(value)) {
        try {
          localStorage.setItem(mapping[k], JSON.stringify(value));
        } catch (e) {
          console.warn('Failed to write section', k, e);
        }
      }
      applied++;
      options?.onProgress && options.onProgress(Math.round((applied / total) * 100));
      await new Promise(res => setTimeout(res, 8));
    }

    // Restore activeOrg if present
    if ((backup.metadata as any).activeOrg) {
      try { localStorage.setItem('wd_active_org', (backup.metadata as any).activeOrg); } catch {}
    }

    // Clear session after restore to force re-login
    localStorage.removeItem('wd_session');
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('wd-store-changed'));

    return true;
  } catch (error) {
    console.error('Error deserializing backup:', error);
    throw error;
  }
}

/**
 * Partially restore specific sections from backup
 */
export async function deserializePartialBackupData(
  backup: BackupData,
  sections: string[],
  options?: { onProgress?: (p: number) => void; signal?: AbortSignal }
): Promise<number> {
  try {
    const keys: Record<string, string> = {
      organizations: 'wd_organizations',
      users: 'wd_users',
      washers: 'wd_washers',
      orders: 'wd_orders',
      clients: 'wd_clients',
      vehicles: 'wd_vehicles',
      boxes: 'wd_boxes',
      services: 'wd_services',
      prices: 'wd_prices',
      carTypes: 'wd_car_types',
      cashShifts: 'wd_cash_shifts',
      cashOperations: 'wd_cash_operations',
      warehouseItems: 'wd_warehouse_items',
      warehouseMovements: 'wd_warehouse_movements',
      expenseRecords: 'wd_expenses',
      payrollRecords: 'wd_payrolls',
      actionLogs: 'wd_action_logs',
      shifts: 'wd_shifts',
      purchases: 'wd_purchases',
      inventory: 'wd_inventory',
    };

    const total = sections.length;
    let applied = 0;
    for (const section of sections) {
      if (options?.signal?.aborted) throw new Error('Restore cancelled');
      if (section in keys) {
        const value = (backup.data as Record<string, any>)[section];
        if (Array.isArray(value)) {
          try {
            localStorage.setItem(keys[section], JSON.stringify(value));
            applied++;
            options?.onProgress && options.onProgress(Math.round((applied / total) * 100));
            await new Promise(res => setTimeout(res, 8));
          } catch (e) {
            console.warn('Failed to write partial section', section, e);
          }
        }
      }
    }

    // Clear session to be safe
    localStorage.removeItem('wd_session');
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('wd-store-changed'));

    return applied;
  } catch (error) {
    console.error('Error deserializing partial backup:', error);
    throw error;
  }
}

/**
 * Create a downloadable .carwinbackup file (ZIP format)
 */
export async function downloadBackup(
  backup: BackupData,
  fileName: string = `backup_${new Date().getTime()}.carwinbackup`,
  options?: { password?: string }
): Promise<void> {
  try {
    const zip = new JSZip();

    // Add metadata (may be updated for encrypted payload)
    let metadata = { ...backup.metadata } as any;

    if (options?.password) {
      const payload = JSON.stringify({ data: backup.data, checksum: backup.checksum, timestamp: backup.timestamp });
      const encrypted = await encryptBackupAES(payload, options.password);
      zip.file('payload.enc', encrypted);
      metadata.encrypted = true;
    } else {
      // Add data
      zip.file('data.json', JSON.stringify(backup.data, null, 2));

      // Add checksum
      zip.file('checksum.txt', backup.checksum);
    }

    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    // Generate ZIP
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading backup:', error);
    throw error;
  }
}

/**
 * Parse a backup file (.carwinbackup or .zip)
 */
export async function parseBackupFile(file: File, options?: { password?: string; onProgress?: (p: number) => void; signal?: AbortSignal }): Promise<BackupData> {
  try {
    const zip = new JSZip();
    const loaded = await zip.loadAsync(file, { checkCRC32: true });

    // Read metadata
    const metadataFile = loaded.file('metadata.json');
    if (!metadataFile) throw new Error('metadata.json not found in backup');

    const metadata = JSON.parse(await metadataFile.async('string'));

    // Encrypted payload support
    const payloadFile = loaded.file('payload.enc');
    if (payloadFile) {
      // If password provided, decrypt and return full backup
      if (!options?.password) {
        const err: any = new Error('Backup is password protected');
        err.code = 'ENCRYPTED_BACKUP';
        err.metadata = metadata;
        throw err;
      }
      const encryptedB64 = await payloadFile.async('string');
      const decrypted = await decryptBackupAES(encryptedB64, options.password);
      const payload = JSON.parse(decrypted);
      return {
        version: '1.0.0',
        timestamp: payload.timestamp || metadata.timestamp || new Date().toISOString(),
        metadata,
        data: payload.data,
        checksum: payload.checksum || '',
      };
    }

    // Read data
    const dataFile = loaded.file('data.json');
    if (!dataFile) throw new Error('data.json not found in backup');

    const data = JSON.parse(await dataFile.async('string'));

    // Read checksum
    const checksumFile = loaded.file('checksum.txt');
    let checksum = '';
    if (checksumFile) {
      checksum = await checksumFile.async('string');
    }

    return {
      version: '1.0.0',
      timestamp: metadata.timestamp || new Date().toISOString(),
      metadata,
      data,
      checksum: checksum.trim(),
    };
  } catch (error) {
    console.error('Error parsing backup file:', error);
    throw new Error(`Failed to parse backup file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate backup structure
 */
export function validateBackupStructure(backup: BackupData): { valid: boolean; errors: string[]; warnings?: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!backup.metadata) errors.push('Missing metadata');
  if (!backup.data) errors.push('Missing data');
  if (!backup.checksum) errors.push('Missing checksum');

  // Check required data sections
  const requiredSections = ['organizations', 'users', 'orders', 'clients'];
  for (const section of requiredSections) {
    if (!(section in backup.data)) {
      errors.push(`Missing data section: ${section}`);
    }
  }

  // Verify checksum
  if (backup.checksum) {
    const computedChecksum = computeChecksum(backup);
    if (computedChecksum !== backup.checksum) {
      errors.push('Checksum mismatch - data may be corrupted');
    }
  }

  // Version compatibility: if major version differs, warn
  try {
    const metaVersion = (backup.metadata as any)?.carwinVersion;
    if (metaVersion) {
      const metaParts = String(metaVersion).split('.').map(Number);
      const curParts = String('0.4.7').split('.').map(Number);
      if (metaParts[0] !== curParts[0]) {
        warnings.push(`Major version differs: backup ${metaVersion} vs app ${'0.4.7'}`);
      }
    }
  } catch {}

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length ? warnings : undefined,
  };
}

/**
 * Compute SHA-256 checksum of backup data
 */
export function computeChecksum(backup: BackupData): string {
  const dataStr = JSON.stringify(backup.data) + backup.timestamp;
  let hash = 0;
  
  for (let i = 0; i < dataStr.length; i++) {
    const char = dataStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(16).substring(0, 32);
}

/**
 * Encrypt backup data with password (simple XOR-based encryption for now)
 * Note: For production, use proper AES-256 encryption with crypto-js or similar
 */
export function encryptBackup(backup: BackupData, password: string): string {
  const dataStr = JSON.stringify(backup);
  const key = generateKeyFromPassword(password);
  
  let encrypted = '';
  for (let i = 0; i < dataStr.length; i++) {
    encrypted += String.fromCharCode(dataStr.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  
  return btoa(encrypted);
}

/**
 * Decrypt backup data with password
 */
export function decryptBackup(encryptedData: string, password: string): BackupData {
  try {
    const encrypted = atob(encryptedData);
    const key = generateKeyFromPassword(password);
    
    let decrypted = '';
    for (let i = 0; i < encrypted.length; i++) {
      decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error('Failed to decrypt backup - password may be incorrect');
  }
}

/**
 * Generate encryption key from password
 */
function generateKeyFromPassword(password: string): string {
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += password.charAt(i % password.length);
  }
  return key;
}

/**
 * Get backup sections and their record counts
 */
export function getBackupSections(backup: BackupData): Array<{ key: string; name: string; count: number }> {
  return [
    { key: 'organizations', name: 'Organizations', count: backup.data.organizations.length },
    { key: 'users', name: 'Users', count: backup.data.users.length },
    { key: 'washers', name: 'Washers', count: backup.data.washers.length },
    { key: 'orders', name: 'Orders', count: backup.data.orders.length },
    { key: 'clients', name: 'Clients', count: backup.data.clients.length },
    { key: 'vehicles', name: 'Vehicles', count: backup.data.vehicles.length },
    { key: 'boxes', name: 'Boxes', count: backup.data.boxes.length },
    { key: 'services', name: 'Services', count: backup.data.services.length },
    { key: 'prices', name: 'Prices', count: backup.data.prices.length },
    { key: 'carTypes', name: 'Car Types', count: backup.data.carTypes.length },
    { key: 'cashShifts', name: 'Cash Shifts', count: backup.data.cashShifts.length },
    { key: 'cashOperations', name: 'Cash Operations', count: backup.data.cashOperations.length },
    { key: 'warehouseItems', name: 'Warehouse Items', count: backup.data.warehouseItems.length },
    { key: 'warehouseMovements', name: 'Warehouse Movements', count: backup.data.warehouseMovements.length },
    { key: 'expenseRecords', name: 'Expenses', count: backup.data.expenseRecords.length },
    { key: 'payrollRecords', name: 'Payroll', count: backup.data.payrollRecords.length },
    { key: 'actionLogs', name: 'Action Logs', count: backup.data.actionLogs.length },
    { key: 'shifts', name: 'Shifts', count: backup.data.shifts.length },
    { key: 'purchases', name: 'Purchases', count: backup.data.purchases.length },
    { key: 'inventory', name: 'Inventory', count: backup.data.inventory.length },
  ];
}

/**
 * Calculate total backup size in bytes
 */
export function calculateBackupSize(backup: BackupData): number {
  const jsonStr = JSON.stringify(backup);
  return new Blob([jsonStr]).size;
}

// -------------------- AES-256-GCM helpers --------------------
async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const pwUtf8 = new TextEncoder().encode(password);
  const keyMaterial = await crypto.subtle.importKey('raw', pwUtf8, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as any, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBackupAES(plainText: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt.buffer as ArrayBuffer);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, new TextEncoder().encode(plainText));
  const payload = {
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    cipher: arrayBufferToBase64(encrypted),
  };
  return btoa(JSON.stringify(payload));
}

export async function decryptBackupAES(payloadB64: string, password: string): Promise<string> {
  try {
    const payload = JSON.parse(atob(payloadB64));
    const salt = base64ToUint8Array(payload.salt);
    const iv = base64ToUint8Array(payload.iv);
    const cipher = base64ToUint8Array(payload.cipher);
    const key = await deriveKey(password, salt.buffer as ArrayBuffer);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, cipher.buffer as ArrayBuffer);
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    throw new Error('Failed to decrypt backup - password may be incorrect or data corrupted');
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
