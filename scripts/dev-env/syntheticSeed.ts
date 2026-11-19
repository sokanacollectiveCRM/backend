import { v5 as uuidv5 } from 'uuid';

export const SYNTHETIC_EMAIL_DOMAIN = 'sokana-dev.example';
export const SYNTHETIC_UUID_NAMESPACE = '8f1b0c6e-4d2a-4c7f-9b31-6d0e8a1f5c22';
export const SYNTHETIC_MARKER = 'synthetic-dev-fixture';

export type ColumnMeta = {
  column_name: string;
  is_nullable: string;
  column_default: string | null;
  data_type: string;
};

export type PreparedInsert = {
  table: string;
  columns: string[];
  values: unknown[];
  sql: string;
};

export function syntheticId(key: string): string {
  return uuidv5(key, SYNTHETIC_UUID_NAMESPACE);
}

export function syntheticEmail(localPart: string): string {
  return `${localPart}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function isProductionTarget(input: {
  database?: string;
  host?: string;
  instance?: string;
}): string | null {
  const database = String(input.database || '').trim();
  const host = String(input.host || '').trim();
  const instance = String(input.instance || '').trim();
  const combined = `${host} ${instance}`;

  if (database === 'sokana_private') {
    return 'Refusing to seed production database sokana_private';
  }
  if (
    combined.includes('sokana-phi-postgres') &&
    !combined.includes('sokana-phi-postgres-dev')
  ) {
    return 'Refusing to seed production Cloud SQL instance sokana-phi-postgres';
  }
  if (
    combined.includes('sokana-private-api') &&
    !combined.includes('sokana-private-api-dev')
  ) {
    return 'Refusing to target production Cloud Run service';
  }
  return null;
}

export function dumpContainsRowData(sql: string): boolean {
  return /^COPY .+\sFROM stdin;/m.test(sql);
}

export function defaultForColumn(column: ColumnMeta): unknown {
  const type = `${column.data_type}`.toLowerCase();
  if (type === 'uuid') {
    return syntheticId(`missing:${column.column_name}`);
  }
  if (
    type.includes('int') ||
    type === 'numeric' ||
    type === 'decimal' ||
    type === 'real' ||
    type === 'double precision'
  ) {
    return 0;
  }
  if (type === 'boolean') return false;
  if (type === 'json' || type === 'jsonb') return {};
  if (type === 'array' || type.endsWith('[]')) return [];
  if (type.includes('timestamp') || type === 'date') return new Date();
  return SYNTHETIC_MARKER;
}

export function pickInsertColumns(
  available: ColumnMeta[],
  desired: Record<string, unknown>,
  options?: { fillMissingRequired?: boolean }
): { columns: string[]; values: unknown[] } {
  const fillMissingRequired = options?.fillMissingRequired ?? true;
  const present = new Set(available.map((column) => column.column_name));
  const columns: string[] = [];
  const values: unknown[] = [];

  for (const [column, value] of Object.entries(desired)) {
    if (!present.has(column)) continue;
    columns.push(column);
    values.push(value);
  }

  const missingRequired = available.filter((column) => {
    const hasDefault = Boolean(column.column_default);
    return (
      column.is_nullable === 'NO' &&
      !hasDefault &&
      !columns.includes(column.column_name)
    );
  });

  if (missingRequired.length > 0 && !fillMissingRequired) {
    throw new Error(
      `Missing required columns: ${missingRequired
        .map((column) => column.column_name)
        .join(', ')}`
    );
  }

  for (const column of missingRequired) {
    columns.push(column.column_name);
    values.push(defaultForColumn(column));
  }

  return { columns, values };
}

export function buildUpsertSql(
  table: string,
  columns: string[],
  conflictColumns: string[] = ['id']
): string {
  if (columns.length === 0) {
    throw new Error(`No insertable columns for ${table}`);
  }
  const quoted = columns.map((column) => `"${column}"`).join(', ');
  const params = columns.map((_, index) => `$${index + 1}`).join(', ');
  const usableConflict = conflictColumns.filter((column) =>
    columns.includes(column)
  );
  if (usableConflict.length === 0) {
    return `INSERT INTO ${table} (${quoted}) VALUES (${params})`;
  }
  const conflict = usableConflict.map((column) => `"${column}"`).join(', ');
  const updates = columns
    .filter((column) => !usableConflict.includes(column))
    .map((column) => `"${column}" = EXCLUDED."${column}"`);
  const conflictSql =
    updates.length > 0
      ? `ON CONFLICT (${conflict}) DO UPDATE SET ${updates.join(', ')}`
      : `ON CONFLICT (${conflict}) DO NOTHING`;
  return `INSERT INTO ${table} (${quoted}) VALUES (${params}) ${conflictSql}`;
}

export function prepareInsert(
  table: string,
  available: ColumnMeta[],
  desired: Record<string, unknown>,
  conflictColumns: string[] = ['id']
): PreparedInsert {
  const { columns, values } = pickInsertColumns(available, desired);
  return {
    table,
    columns,
    values,
    sql: buildUpsertSql(table, columns, conflictColumns),
  };
}

export type SyntheticClientStatus =
  | 'matching'
  | 'active'
  | 'pending'
  | 'lead'
  | 'contacted';

export type SyntheticFixture = {
  admin: {
    key: string;
    firstName: string;
    lastName: string;
    emailLocal: string;
    phone: string;
  };
  doulas: Array<{
    key: string;
    firstName: string;
    lastName: string;
    emailLocal: string;
    phone: string;
    bio: string;
    city: string;
  }>;
  clients: Array<{
    key: string;
    firstName: string;
    lastName: string;
    emailLocal: string;
    phone: string;
    city: string;
    state: string;
    zip: string;
    status: SyntheticClientStatus;
    portalStatus: 'not_invited' | 'invited' | 'active';
    paymentMethod: 'Self-Pay' | 'Medicaid' | 'Commercial Insurance';
    serviceNeeded: string;
    dueDate: string;
    assignedDoulaKey?: string;
    assignmentRole?: 'primary' | 'backup';
    services: string[];
    hourType?: 'prenatal' | 'postpartum';
  }>;
};

export function buildFixtureCatalog(): SyntheticFixture {
  return {
    admin: {
      key: 'admin:dev',
      firstName: 'Dev',
      lastName: 'Admin',
      emailLocal: 'dev.admin',
      phone: '3125550100',
    },
    doulas: [
      {
        key: 'doula:avery',
        firstName: 'Avery',
        lastName: 'Patel',
        emailLocal: 'avery.patel',
        phone: '3125550201',
        bio: 'Synthetic prenatal doula for isolated testing.',
        city: 'Chicago',
      },
      {
        key: 'doula:jordan',
        firstName: 'Jordan',
        lastName: 'Kim',
        emailLocal: 'jordan.kim',
        phone: '3125550202',
        bio: 'Synthetic postpartum doula for isolated testing.',
        city: 'Evanston',
      },
    ],
    clients: [
      {
        key: 'client:maya',
        firstName: 'Maya',
        lastName: 'Rivera',
        emailLocal: 'maya.rivera',
        phone: '3125551001',
        city: 'Chicago',
        state: 'IL',
        zip: '60614',
        status: 'active',
        portalStatus: 'active',
        paymentMethod: 'Self-Pay',
        serviceNeeded: 'Labor Support Services',
        dueDate: '2026-11-02',
        assignedDoulaKey: 'doula:avery',
        assignmentRole: 'primary',
        services: ['Labor Support', 'Perinatal Education'],
        hourType: 'prenatal',
      },
      {
        key: 'client:priya',
        firstName: 'Priya',
        lastName: 'Shah',
        emailLocal: 'priya.shah',
        phone: '3125551002',
        city: 'Oak Park',
        state: 'IL',
        zip: '60302',
        status: 'active',
        portalStatus: 'invited',
        paymentMethod: 'Medicaid',
        serviceNeeded: 'Postpartum Doula Services',
        dueDate: '2026-08-18',
        assignedDoulaKey: 'doula:jordan',
        assignmentRole: 'primary',
        services: ['Postpartum Support', 'Lactation Support'],
        hourType: 'postpartum',
      },
      {
        key: 'client:elena',
        firstName: 'Elena',
        lastName: 'Brooks',
        emailLocal: 'elena.brooks',
        phone: '3125551003',
        city: 'Evanston',
        state: 'IL',
        zip: '60201',
        status: 'matching',
        portalStatus: 'not_invited',
        paymentMethod: 'Commercial Insurance',
        serviceNeeded: 'Combined',
        dueDate: '2026-12-09',
        services: [],
      },
      {
        key: 'client:nina',
        firstName: 'Nina',
        lastName: 'Okoye',
        emailLocal: 'nina.okoye',
        phone: '3125551004',
        city: 'Chicago',
        state: 'IL',
        zip: '60640',
        status: 'lead',
        portalStatus: 'not_invited',
        paymentMethod: 'Self-Pay',
        serviceNeeded: 'Labor Support Services',
        dueDate: '2027-01-20',
        assignedDoulaKey: 'doula:avery',
        assignmentRole: 'backup',
        services: ['Labor Support'],
        hourType: 'prenatal',
      },
      {
        key: 'client:sofia',
        firstName: 'Sofia',
        lastName: 'Nguyen',
        emailLocal: 'sofia.nguyen',
        phone: '3125551005',
        city: 'Chicago',
        state: 'IL',
        zip: '60622',
        status: 'contacted',
        portalStatus: 'not_invited',
        paymentMethod: 'Commercial Insurance',
        serviceNeeded: 'Postpartum Doula Services',
        dueDate: '2026-09-30',
        assignedDoulaKey: 'doula:jordan',
        assignmentRole: 'primary',
        services: ['Postpartum Support', 'First Night Care'],
        hourType: 'postpartum',
      },
    ],
  };
}

export function clientNumberForIndex(index: number): string {
  return `CL-9${String(index + 1).padStart(4, '0')}`;
}
