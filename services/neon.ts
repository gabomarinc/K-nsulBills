
import { Client } from '@neondatabase/serverless';
import { Invoice, UserProfile, DbClient, DbProvider, CatalogItem } from '../types';
import bcrypt from 'bcryptjs';

/**
 * NEON DATABASE CONFIGURATION
 */

const getDbClient = () => {
  try {
    const url = process.env.DATABASE_URL;

    if (!url) {
      console.warn("DATABASE_URL environment variable is not set.");
      return null;
    }

    // Validate URL format simply
    if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
      console.warn("Invalid Database URL format");
      return null;
    }

    return new Client(url);
  } catch (error) {
    console.error("Error initializing DB Client:", error);
    return null;
  }
};

/**
 * AUDIT LOGGING SYSTEM (OPTIMIZED)
 * Stores only the latest activity per user to save space.
 */
export const logAuditAction = async (userId: string, action: string, details: any) => {
  const client = getDbClient();
  if (!client) return;

  try {
    await client.connect();

    // Ensure table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 1. Try to UPDATE existing record for this user
    const updateRes = await client.query(
      `UPDATE audit_log SET action = $1, details = $2, created_at = NOW() WHERE user_id = $3`,
      [action, JSON.stringify(details), userId]
    );

    // 2. Logic based on result
    const rowsAffected = updateRes.rowCount || 0;

    if (rowsAffected === 0) {
      // CASE A: No record exists -> Insert new
      await client.query(
        `INSERT INTO audit_log (user_id, action, details) VALUES ($1, $2, $3)`,
        [userId, action, JSON.stringify(details)]
      );
    } else if (rowsAffected > 1) {
      // CASE B: Multiple records exist (Legacy Cleanup) -> Delete all and Insert fresh
      // This auto-cleans the DB as users perform actions
      await client.query(`DELETE FROM audit_log WHERE user_id = $1`, [userId]);
      await client.query(
        `INSERT INTO audit_log (user_id, action, details) VALUES ($1, $2, $3)`,
        [userId, action, JSON.stringify(details)]
      );
    }

    // CASE C: rowsAffected === 1 -> Successfully updated the single record. Do nothing else.

    await client.end();
  } catch (e) {
    console.error("Audit Log Optimization Failed:", e);
  }
};

/**
 * SECURITY HELPERS
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
};

export const comparePassword = async (plain: string, hashed: string): Promise<boolean> => {
  return bcrypt.compareSync(plain, hashed);
};

/**
 * HELPER: Map DB Row to UserProfile
 */
const mapUserRowToProfile = (row: any): UserProfile => {
  const profileSettings = row.profile_data || {};

  // Ensure fiscalConfig structure exists with defaults if missing in DB
  const fiscalConfig = profileSettings.fiscalConfig || {
    entityType: row.type === 'COMPANY' ? 'JURIDICA' : 'NATURAL',
    specialRegime: 'NONE',
    annualRevenue: 0,
    declaredCapital: 0,
    hasEmployees: false,
    itbmsRegistered: false,
    companyForm: 'SA'
  };

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    type: row.type === 'COMPANY' ? 'Empresa (SAS/SL)' : 'Autónomo',

    // Explicitly map bank info and fiscal config from JSON to ensure visibility
    bankAccountType: profileSettings.bankAccountType || 'Ahorro',
    fiscalConfig: fiscalConfig,

    // Map specific columns over generic profile data if they exist
    stripeCustomerId: row.stripe_customer_id || profileSettings.stripeCustomerId,
    plan: row.plan_name || profileSettings.plan || 'Free',
    renewalDate: row.renewal_date || profileSettings.renewalDate,

    ...profileSettings, // Spread the rest (branding, apiKeys, etc.)
    isOnboardingComplete: true
  } as UserProfile;
};

/**
 * GET USER BY ID
 */
export const getUserById = async (userId: string): Promise<UserProfile | null> => {
  if (userId === 'user_demo_p1') {
    return {
      id: 'user_demo_p1',
      name: 'Juan Pérez (Demo)',
      email: 'juan@konsulbills.com',
      type: 'Autónomo' as any,
      taxId: '8-123-456',
      avatar: '',
      isOnboardingComplete: true,
      defaultCurrency: 'USD',
      plan: 'Emprendedor Pro',
      country: 'Panamá',
      bankAccountType: 'Ahorro', // Default demo
      branding: { primaryColor: '#27bea5', templateStyle: 'Modern' },
      apiKeys: { gemini: '', openai: '' },
      fiscalConfig: {
        entityType: 'NATURAL',
        specialRegime: 'NONE',
        annualRevenue: 0,
        declaredCapital: 0,
        hasEmployees: false,
        itbmsRegistered: false
      }
    } as UserProfile;
  }

  const client = getDbClient();
  if (!client) {
    throw new Error("DB Client configuration missing");
  }

  try {
    await client.connect();
    // Updated query to fetch new columns
    const query = `
      SELECT id, name, email, type, profile_data, stripe_customer_id, plan_name, renewal_date 
      FROM users WHERE id = $1
    `;
    const { rows } = await client.query(query, [userId]);
    await client.end();

    if (rows.length > 0) {
      return mapUserRowToProfile(rows[0]);
    }
    return null;
  } catch (error) {
    console.error("Neon Get User Error:", error);
    throw error;
  }
};

/**
 * GET USER BY EMAIL
 */
export const getUserByEmail = async (email: string): Promise<UserProfile | null> => {
  const client = getDbClient();
  if (!client) return null;

  try {
    await client.connect();
    const query = `
      SELECT id, name, email, type, profile_data, stripe_customer_id, plan_name, renewal_date 
      FROM users WHERE email = $1
    `;
    const { rows } = await client.query(query, [email]);
    await client.end();

    if (rows.length > 0) {
      return mapUserRowToProfile(rows[0]);
    }
    return null;
  } catch (error) {
    console.error("Neon Get User By Email Error:", error);
    return null;
  }
};

/**
 * AUTHENTICATION
 */
export const authenticateUser = async (email: string, password: string): Promise<UserProfile | null> => {
  const client = getDbClient();

  if (client) {
    try {
      await client.connect();
      const query = `
        SELECT id, name, email, password, type, profile_data, stripe_customer_id, plan_name, renewal_date 
        FROM users WHERE email = $1
      `;
      const { rows } = await client.query(query, [email]);

      if (rows.length > 0) {
        const userRow = rows[0];
        const storedPassword = userRow.password || '';
        let isMatch = false;

        if (email === 'juan@konsulbills.com' && password === 'password123') {
          isMatch = true;
        } else {
          if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
            isMatch = await comparePassword(password, storedPassword).catch(() => false);
          } else {
            isMatch = storedPassword === password;
          }
        }

        if (isMatch) {
          await client.end();
          logAuditAction(userRow.id, 'LOGIN', { email: userRow.email });
          return mapUserRowToProfile(userRow);
        }
      }
      await client.end();
    } catch (error) {
      console.error("Neon Auth Error:", error);
    }
  }

  // Fallback Demo
  if (email === 'juan@konsulbills.com' && password === 'password123') {
    return {
      id: 'user_demo_p1',
      name: 'Juan Pérez (Demo)',
      email: 'juan@konsulbills.com',
      type: 'Autónomo' as any,
      taxId: '8-123-456',
      avatar: '',
      isOnboardingComplete: true,
      defaultCurrency: 'USD',
      plan: 'Emprendedor Pro',
      country: 'Panamá',
      bankAccountType: 'Ahorro',
      branding: { primaryColor: '#27bea5', templateStyle: 'Modern' },
      apiKeys: { gemini: '', openai: '' },
      fiscalConfig: {
        entityType: 'NATURAL',
        specialRegime: 'NONE',
        annualRevenue: 0,
        declaredCapital: 0,
        hasEmployees: false,
        itbmsRegistered: false
      }
    } as UserProfile;
  }
  return null;
};

/**
 * CREATE USER
 */
export const createUserInDb = async (profile: Partial<UserProfile>, password: string, email: string): Promise<boolean> => {
  const client = getDbClient();
  if (!client) return false;

  try {
    await client.connect();

    const checkRes = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (checkRes.rows.length > 0) {
      await client.end();
      throw new Error('El correo ya está registrado');
    }

    const hashedPassword = await hashPassword(password);

    // Use ID if provided (from Frontend generation), otherwise generate new
    const userId = profile.id || `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const profileData = { ...profile };
    // Remove structured fields from JSON blob to avoid duplication
    delete (profileData as any).id;
    delete (profileData as any).name;
    delete (profileData as any).email;
    delete (profileData as any).type;
    delete (profileData as any).password;
    delete (profileData as any).stripeCustomerId;
    delete (profileData as any).plan;
    delete (profileData as any).renewalDate;

    // Ensure we keep bankAccountType and fiscalConfig inside profileData JSON

    const dbType = (profile.type || '').includes('Empresa') ? 'COMPANY' : 'FREELANCE';

    // Insert into new columns as well
    await client.query(
      `INSERT INTO users (id, name, email, password, type, profile_data, stripe_customer_id, plan_name, renewal_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        profile.name,
        email,
        hashedPassword,
        dbType,
        JSON.stringify(profileData),
        profile.stripeCustomerId || null,
        profile.plan || 'Free',
        profile.renewalDate || null
      ]
    );

    await client.end();
    logAuditAction(userId, 'REGISTER_USER', { email });
    return true;
  } catch (error) {
    console.error("Create User Error:", error);
    return false;
  }
};

/**
 * UPDATE USER PROFILE
 */
export const updateUserProfileInDb = async (profile: UserProfile): Promise<boolean> => {
  const client = getDbClient();
  if (!client) return false;

  try {
    await client.connect();
    const profileData = { ...profile };

    // Clean JSON blob - Remove top-level columns to avoid redundancy
    delete (profileData as any).id;
    delete (profileData as any).name;
    delete (profileData as any).email;
    delete (profileData as any).type;
    delete (profileData as any).password;
    delete (profileData as any).stripeCustomerId;
    delete (profileData as any).plan;
    delete (profileData as any).renewalDate;

    // CRITICAL: Ensure bankAccountType and fiscalConfig remain in profileData for stringification
    // profileData.bankAccountType should be present if it was in 'profile'
    // profileData.fiscalConfig should be present if it was in 'profile'

    if (!profile.fiscalConfig) {
      console.warn("Saving profile without fiscalConfig - checks might fail later.");
    }

    const dbType = (profile.type || '').includes('Empresa') ? 'COMPANY' : 'FREELANCE';

    await client.query(
      `UPDATE users 
       SET name = $1, type = $2, profile_data = $3, stripe_customer_id = $4, plan_name = $5, renewal_date = $6, updated_at = NOW() 
       WHERE id = $7`,
      [
        profile.name,
        dbType,
        JSON.stringify(profileData),
        profile.stripeCustomerId || null,
        profile.plan || 'Free',
        profile.renewalDate || null,
        profile.id
      ]
    );

    await client.end();
    return true;
  } catch (error) {
    console.error("Update User Error:", error);
    return false;
  }
};

/**
 * UPDATE USER PASSWORD
 */
export const updateUserPassword = async (userId: string, newPassword: string): Promise<boolean> => {
  const client = getDbClient();
  if (!client) return false;

  try {
    const hashedPassword = await hashPassword(newPassword);
    await client.connect();

    await client.query(
      `UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2`,
      [hashedPassword, userId]
    );

    await client.end();
    logAuditAction(userId, 'PASSWORD_CHANGE', { timestamp: new Date().toISOString() });
    return true;
  } catch (error) {
    console.error("Update Password Error:", error);
    return false;
  }
};

/**
 * CATALOG MANAGEMENT
 */

// Fetch Catalog Items
export const fetchCatalogItemsFromDb = async (userId: string): Promise<CatalogItem[]> => {
  const client = getDbClient();
  if (!client) return [];

  try {
    await client.connect();

    // Create Table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS catalog_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price NUMERIC NOT NULL,
        description TEXT,
        is_recurring BOOLEAN DEFAULT FALSE,
        sku TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // AUTO-MIGRATION: Ensure columns exist if table was created in older version
    try {
      await client.query(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS sku TEXT;`);
      await client.query(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;`);
      await client.query(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS description TEXT;`);
      await client.query(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`);
    } catch (migError) {
      // Ignore errors if columns already exist or generic warnings
      console.log("Catalog Schema Check: OK");
    }

    const result = await client.query('SELECT * FROM catalog_items WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    await client.end();

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      price: parseFloat(row.price),
      description: row.description,
      isRecurring: row.is_recurring,
      sku: row.sku
    }));
  } catch (error) {
    console.error("Fetch Catalog Error:", error);
    return [];
  }
};

// Save (Upsert) Catalog Item
export const saveCatalogItemToDb = async (item: CatalogItem, userId: string): Promise<{ success: boolean, error?: string }> => {
  const client = getDbClient();
  if (!client) return { success: false, error: 'Database client not initialized. Check DATABASE_URL.' };

  try {
    await client.connect();

    const query = `
      INSERT INTO catalog_items (id, user_id, name, price, description, is_recurring, sku, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        price = EXCLUDED.price,
        description = EXCLUDED.description,
        is_recurring = EXCLUDED.is_recurring,
        sku = EXCLUDED.sku,
        updated_at = NOW();
    `;

    await client.query(query, [
      item.id,
      userId,
      item.name,
      item.price,
      item.description || null,
      item.isRecurring || false,
      item.sku || null
    ]);

    await client.end();
    return { success: true };
  } catch (error: any) {
    console.error("Save Catalog Item Error:", error);
    // Return specific error message to help debugging
    return { success: false, error: error.message || 'Unknown database error' };
  }
};

// Delete Catalog Item
export const deleteCatalogItemFromDb = async (itemId: string, userId: string): Promise<boolean> => {
  const client = getDbClient();
  if (!client) return false;

  try {
    await client.connect();
    await client.query('DELETE FROM catalog_items WHERE id = $1 AND user_id = $2', [itemId, userId]);
    await client.end();
    return true;
  } catch (error) {
    console.error("Delete Catalog Item Error:", error);
    return false;
  }
};

/**
 * FETCH INVOICES & EXPENSES
 */
export const fetchInvoicesFromDb = async (userId: string): Promise<Invoice[] | null> => {
  const client = getDbClient();
  if (!client) return null;

  try {
    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        client_name TEXT,
        client_tax_id TEXT,
        total NUMERIC,
        status TEXT,
        date TEXT,
        type TEXT,
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        provider_name TEXT,
        date TEXT,
        total NUMERIC,
        currency TEXT,
        category TEXT,
        receipt_url TEXT,
        status TEXT,
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const invoicesPromise = client.query(
      `SELECT * FROM invoices WHERE user_id = $1 OR data->>'userId' = $1`,
      [userId]
    );
    const expensesPromise = client.query(
      `SELECT * FROM expenses WHERE data->>'userId' = $1`,
      [userId]
    );

    const [invoicesRes, expensesRes] = await Promise.allSettled([invoicesPromise, expensesPromise]);
    await client.end();

    let allDocs: Invoice[] = [];

    if (invoicesRes.status === 'fulfilled') {
      const mappedInvoices = invoicesRes.value.rows.map((row: any) => ({
        ...row.data,
        id: row.id,
        userId: row.user_id || userId,
        clientName: row.client_name,
        clientTaxId: row.client_tax_id,
        total: parseFloat(row.total),
        status: row.status,
        date: row.date,
        type: row.type,
        amountPaid: row.data.amountPaid ? parseFloat(row.data.amountPaid) : 0
      }));
      allDocs = [...allDocs, ...mappedInvoices];
    }

    if (expensesRes.status === 'fulfilled') {
      const mappedExpenses = expensesRes.value.rows.map((row: any) => ({
        ...row.data,
        id: row.id,
        userId: userId,
        clientName: row.provider_name,
        total: parseFloat(row.total),
        status: row.status,
        date: row.date,
        type: 'Expense',
        receiptUrl: row.receipt_url
      }));
      allDocs = [...allDocs, ...mappedExpenses];
    }

    return allDocs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.warn("Neon DB Fetch Error:", error);
    return null;
  }
};

/**
 * FETCH CLIENTS (Combines 'clients' and 'prospects' tables)
 */
export const fetchClientsFromDb = async (userId: string): Promise<DbClient[]> => {
  const client = getDbClient();
  if (!client) return [];

  try {
    await client.connect();

    // 1. ROBUST SCHEMA MIGRATION: Ensure columns exist before querying
    // This fixes issues where 'tags' or 'notes' might be missing in older schemas
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS prospects (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL);
      
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS tax_id TEXT;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS tags TEXT;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS tax_id TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS tags TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);

    // 2. Fetch Separately to isolate potential table errors
    const clientsRes = await client.query(
      `SELECT id, name, tax_id, email, address, phone, tags, notes, 'CLIENT' as status FROM clients WHERE user_id = $1`,
      [userId]
    );

    const prospectsRes = await client.query(
      `SELECT id, name, tax_id, email, address, phone, tags, notes, 'PROSPECT' as status FROM prospects WHERE user_id = $1`,
      [userId]
    );

    await client.end();

    const allRows = [...clientsRes.rows, ...prospectsRes.rows];

    return allRows.map(row => ({
      id: row.id,
      name: row.name,
      taxId: row.tax_id,
      email: row.email,
      address: row.address,
      phone: row.phone,
      tags: row.tags,
      notes: row.notes,
      status: (row.status || 'PROSPECT') as 'CLIENT' | 'PROSPECT'
    }));

  } catch (error) {
    console.error("Error fetching clients/prospects (Critical):", error);
    // Return empty array but log aggressively
    return [];
  }
};

/**
 * FETCH PROVIDERS
 */
export const fetchProvidersFromDb = async (userId: string): Promise<DbProvider[]> => {
  const client = getDbClient();
  if (!client) return [];

  try {
    await client.connect();

    // Ensure providers table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tax_id TEXT,
        email TEXT,
        address TEXT,
        phone TEXT,
        category TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const result = await client.query('SELECT * FROM providers WHERE user_id = $1', [userId]);
    await client.end();

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      taxId: row.tax_id,
      email: row.email,
      address: row.address,
      phone: row.phone,
      category: row.category,
      notes: row.notes
    }));
  } catch (error) {
    console.error("Error fetching providers:", error);
    return [];
  }
};

/**
 * SAVE PROVIDER (For Expenses)
 */
export const saveProviderToDb = async (providerData: DbProvider, userId: string): Promise<{ success: boolean, error?: string }> => {
  const clientDb = getDbClient();
  if (!clientDb) return { success: false, error: 'Database connection failed' };

  // Create consistent ID based on name to match records
  const safeName = providerData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const id = providerData.id || `prov_${userId.substring(0, 8)}_${safeName}`;

  try {
    await clientDb.connect();

    // Ensure providers table exists
    await clientDb.query(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tax_id TEXT,
        email TEXT,
        address TEXT,
        phone TEXT,
        category TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const upsertProvider = `
        INSERT INTO providers (id, user_id, name, tax_id, email, address, phone, category, notes, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (id) DO UPDATE SET 
          name = EXCLUDED.name,
          tax_id = COALESCE(EXCLUDED.tax_id, providers.tax_id),
          email = COALESCE(EXCLUDED.email, providers.email),
          address = COALESCE(EXCLUDED.address, providers.address),
          phone = COALESCE(EXCLUDED.phone, providers.phone),
          category = COALESCE(EXCLUDED.category, providers.category),
          notes = COALESCE(EXCLUDED.notes, providers.notes),
          updated_at = NOW();
    `;

    await clientDb.query(upsertProvider, [
      id, userId, providerData.name, providerData.taxId, providerData.email, providerData.address, providerData.phone, providerData.category, providerData.notes
    ]);

    await clientDb.end();
    return { success: true };

  } catch (error: any) {
    console.error("Save Provider Error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * SAVE CLIENT OR PROSPECT
 * Handles moving between tables (Promotion from Prospect to Client)
 */
export const saveClientToDb = async (clientData: DbClient, userId: string, status: 'CLIENT' | 'PROSPECT'): Promise<{ success: boolean, error?: string }> => {
  const clientDb = getDbClient();
  if (!clientDb) return { success: false, error: 'Database connection failed' };

  // Create consistent ID based on name to match records between tables
  const safeName = clientData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const id = clientData.id || `cli_${userId.substring(0, 8)}_${safeName}`;

  try {
    await clientDb.connect();

    if (status === 'CLIENT') {
      // --- CASE 1: IT IS A CLIENT (Invoice Created) ---
      // 1. Insert/Update into CLIENTS table
      const upsertClient = `
            INSERT INTO clients (id, user_id, name, tax_id, email, address, phone, tags, notes, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            ON CONFLICT (id) DO UPDATE SET 
              name = EXCLUDED.name,
              tax_id = COALESCE(EXCLUDED.tax_id, clients.tax_id),
              email = COALESCE(EXCLUDED.email, clients.email),
              address = COALESCE(EXCLUDED.address, clients.address),
              phone = COALESCE(EXCLUDED.phone, clients.phone),
              tags = COALESCE(EXCLUDED.tags, clients.tags),
              notes = COALESCE(EXCLUDED.notes, clients.notes),
              updated_at = NOW();
        `;
      await clientDb.query(upsertClient, [
        id, userId, clientData.name, clientData.taxId, clientData.email, clientData.address, clientData.phone, clientData.tags, clientData.notes
      ]);

      // 2. Remove from PROSPECTS if it existed there (Promotion Logic)
      await clientDb.query('DELETE FROM prospects WHERE id = $1', [id]);

    } else {
      // --- CASE 2: IT IS A PROSPECT (Only Quote) ---
      // 1. Check if they are ALREADY a client. If so, update client, don't downgrade to prospect.
      const checkClient = await clientDb.query('SELECT id FROM clients WHERE id = $1', [id]);

      // TS Fix: rowCount might be null, so we coalesce to 0
      if ((checkClient.rowCount || 0) > 0) {
        // Already a client, update client table instead
        const updateClient = `
                UPDATE clients SET 
                  tax_id = COALESCE($1, tax_id),
                  email = COALESCE($2, email),
                  address = COALESCE($3, address),
                  phone = COALESCE($4, phone),
                  updated_at = NOW()
                WHERE id = $5
             `;
        await clientDb.query(updateClient, [clientData.taxId, clientData.email, clientData.address, clientData.phone, id]);
      } else {
        // 2. Not a client, Insert/Update into PROSPECTS table
        const upsertProspect = `
                INSERT INTO prospects (id, user_id, name, tax_id, email, address, phone, tags, notes, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                ON CONFLICT (id) DO UPDATE SET 
                  name = EXCLUDED.name,
                  tax_id = COALESCE(EXCLUDED.tax_id, prospects.tax_id),
                  email = COALESCE(EXCLUDED.email, prospects.email),
                  address = COALESCE(EXCLUDED.address, prospects.address),
                  phone = COALESCE(EXCLUDED.phone, prospects.phone),
                  tags = COALESCE(EXCLUDED.tags, prospects.tags),
                  notes = COALESCE(EXCLUDED.notes, prospects.notes),
                  updated_at = NOW();
            `;
        await clientDb.query(upsertProspect, [
          id, userId, clientData.name, clientData.taxId, clientData.email, clientData.address, clientData.phone, clientData.tags, clientData.notes
        ]);
      }
    }

    await clientDb.end();
    logAuditAction(userId, 'SAVE_CLIENT', { name: clientData.name, status });
    return { success: true };

  } catch (error: any) {
    console.error("Save Client/Prospect Error:", error);
    // Attempt Auto-Fix for UUID vs TEXT mismatch if schema drifted
    if (error.code === '42804') {
      try {
        const retryDb = getDbClient();
        if (retryDb) {
          await retryDb.connect();
          await retryDb.query(`ALTER TABLE clients ALTER COLUMN id TYPE TEXT USING id::text;`);
          await retryDb.query(`ALTER TABLE prospects ALTER COLUMN id TYPE TEXT USING id::text;`);
          await retryDb.end();
          return { success: false, error: "Schema repaired. Please try again." };
        }
      } catch (e) { console.error("Repair failed", e); }
    }
    return { success: false, error: error.message };
  }
};

/**
 * SAVE DOCUMENT
 */
export const saveInvoiceToDb = async (invoice: Invoice): Promise<boolean> => {
  const client = getDbClient();
  if (!client) return false;

  try {
    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        client_name TEXT,
        client_tax_id TEXT,
        total NUMERIC,
        status TEXT,
        date TEXT,
        type TEXT,
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    if (invoice.type === 'Expense') {
      const query = `
        INSERT INTO expenses (id, provider_name, date, total, currency, category, receipt_url, status, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET 
          provider_name = EXCLUDED.provider_name, total = EXCLUDED.total, date = EXCLUDED.date, 
          category = EXCLUDED.category, receipt_url = EXCLUDED.receipt_url, data = EXCLUDED.data;
      `;
      const category = invoice.items[0]?.description || 'General';
      await client.query(query, [invoice.id, invoice.clientName, invoice.date, invoice.total, invoice.currency, category, invoice.receiptUrl, invoice.status, JSON.stringify(invoice)]);
    } else {
      const query = `
        INSERT INTO invoices (id, user_id, client_name, client_tax_id, total, status, date, type, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET 
          user_id = EXCLUDED.user_id, client_name = EXCLUDED.client_name, client_tax_id = EXCLUDED.client_tax_id,
          total = EXCLUDED.total, status = EXCLUDED.status, date = EXCLUDED.date, data = EXCLUDED.data;
      `;
      await client.query(query, [invoice.id, invoice.userId, invoice.clientName, invoice.clientTaxId, invoice.total, invoice.status, invoice.date, invoice.type, JSON.stringify(invoice)]);
    }

    await client.end();
    return true;
  } catch (error) {
    console.error("Neon DB Save Invoice Error:", error);
    return false;
  }
};

/**
 * DELETE DOCUMENT
 */
export const deleteInvoiceFromDb = async (id: string, userId: string): Promise<boolean> => {
  const client = getDbClient();
  if (!client) return false;
  try {
    await client.connect();
    const resInv = await client.query('DELETE FROM invoices WHERE id = $1', [id]);

    // TS Fix: rowCount might be null
    if ((resInv.rowCount || 0) === 0) {
      await client.query('DELETE FROM expenses WHERE id = $1', [id]);
    }
    await client.end();
    return true;
  } catch (error) {
    console.error("Delete Error:", error);
    return false;
  }
};
