
import { Client } from '@neondatabase/serverless';
import { Invoice, UserProfile, DbClient } from '../types';
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
 * SCHEMA REPAIR HELPER
 * Attempts to fix common schema drifts (UUID vs TEXT id, missing columns)
 */
const repairClientTableSchema = async (client: Client) => {
    try {
        // 1. Ensure 'id' is TEXT. 
        // The 'USING id::text' clause allows converting existing UUIDs to strings without error.
        await client.query(`ALTER TABLE clients ALTER COLUMN id TYPE TEXT USING id::text;`);
    } catch (e) {
        // Ignore if table doesn't exist yet or column issues
        console.warn("Schema repair (ID type) notice:", e);
    }

    try {
        // 2. Ensure 'status' column exists
        await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PROSPECT';`);
    } catch (e) {
        console.warn("Schema repair (Status col) notice:", e);
    }
};

/**
 * AUDIT LOGGING SYSTEM
 */
export const logAuditAction = async (userId: string, action: string, details: any) => {
  const client = getDbClient();
  if (!client) return;

  try {
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(
      `INSERT INTO audit_log (user_id, action, details) VALUES ($1, $2, $3)`,
      [userId, action, JSON.stringify(details)]
    );
    await client.end();
  } catch (e) {
    console.error("Audit Log Failed:", e);
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
         branding: { primaryColor: '#27bea5', templateStyle: 'Modern' },
         apiKeys: { gemini: '', openai: '' } 
       } as UserProfile;
  }

  const client = getDbClient();
  if (!client) {
    throw new Error("DB Client configuration missing - Potential Offline Mode");
  }

  try {
    await client.connect();
    const query = 'SELECT id, name, email, type, profile_data FROM users WHERE id = $1';
    const { rows } = await client.query(query, [userId]);
    await client.end();

    if (rows.length > 0) {
       const userRow = rows[0];
       const profileSettings = userRow.profile_data || {};

       return {
         id: userRow.id,
         name: userRow.name,
         email: userRow.email,
         type: userRow.type === 'COMPANY' ? 'Empresa (SAS/SL)' : 'Autónomo',
         ...profileSettings,
         isOnboardingComplete: true
       } as UserProfile;
    }
    
    return null; 
  } catch (error) {
    console.error("Neon Get User Error:", error);
    throw error; 
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
      const query = 'SELECT id, name, email, password, type, profile_data FROM users WHERE email = $1';
      const { rows } = await client.query(query, [email]);
      
      if (rows.length > 0) {
         const userRow = rows[0];
         const storedPassword = userRow.password || ''; 

         let isMatch = false;
         let needsPasswordUpdate = false;

         if (email === 'juan@konsulbills.com' && password === 'password123') {
            console.log("🔓 Demo Credentials Matched - Bypassing Hash Check");
            isMatch = true;
            const isHashCorrect = await comparePassword('password123', storedPassword).catch(() => false);
            if (!isHashCorrect) {
               needsPasswordUpdate = true;
            }
         } else {
            if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
                try {
                  isMatch = await comparePassword(password, storedPassword);
                } catch (e) {
                  console.error("Bcrypt compare error:", e);
                  isMatch = false;
                }
            } else {
                isMatch = storedPassword === password;
            }
         }

         if (isMatch) {
           if (needsPasswordUpdate) {
              try {
                const newHash = await hashPassword('password123');
                await client.query('UPDATE users SET password = $1 WHERE id = $2', [newHash, userRow.id]);
              } catch (err) {
                console.warn("Failed to auto-update password hash", err);
              }
           }

           await client.end(); 
           logAuditAction(userRow.id, 'LOGIN', { email: userRow.email, timestamp: new Date().toISOString() });

           const profileSettings = userRow.profile_data || {};

           return {
             id: userRow.id, 
             name: userRow.name,
             email: userRow.email,
             type: userRow.type === 'COMPANY' ? 'Empresa (SAS/SL)' : 'Autónomo',
             ...profileSettings, 
             isOnboardingComplete: true 
           } as UserProfile;
         }
      }
      await client.end(); 
    } catch (error) {
      console.error("Neon Auth Error:", error);
    }
  }

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
         branding: { primaryColor: '#27bea5', templateStyle: 'Modern' },
         apiKeys: { gemini: '', openai: '' } 
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
    const userId = `user_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    
    const profileData = { ...profile };
    delete (profileData as any).id;
    delete (profileData as any).name;
    delete (profileData as any).email;
    delete (profileData as any).type;
    delete (profileData as any).password;

    const typeString = profile.type || '';
    const dbType = typeString.includes('Empresa') ? 'COMPANY' : 'FREELANCE';

    const query = `
      INSERT INTO users (id, name, email, password, type, profile_data)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await client.query(query, [
      userId,
      profile.name,
      email,
      hashedPassword,
      dbType,
      JSON.stringify(profileData)
    ]);

    await client.end();
    logAuditAction(userId, 'REGISTER_USER', { email, name: profile.name });

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
    delete (profileData as any).id;
    delete (profileData as any).name;
    delete (profileData as any).email;
    delete (profileData as any).type;
    delete (profileData as any).password;

    const cleanProfileData = JSON.parse(JSON.stringify(profileData));
    const typeString = profile.type || '';
    const dbType = typeString.includes('Empresa') ? 'COMPANY' : 'FREELANCE';

    const query = `
      UPDATE users 
      SET 
        name = $1,
        type = $2,
        profile_data = $3,
        updated_at = NOW()
      WHERE id = $4
    `;

    await client.query(query, [
      profile.name,
      dbType,
      JSON.stringify(cleanProfileData),
      profile.id
    ]);

    await client.end();
    logAuditAction(profile.id, 'UPDATE_PROFILE', { changedFields: Object.keys(cleanProfileData) });

    return true;
  } catch (error) {
    console.error("Update User Error:", error);
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
      `SELECT * FROM invoices WHERE user_id = $1 OR data->>'userId' = $1 OR (user_id IS NULL AND data->>'userId' IS NULL)`, 
      [userId]
    );
    
    const expensesPromise = client.query(
      `SELECT * FROM expenses WHERE data->>'userId' = $1 OR data->>'userId' IS NULL`, 
      [userId]
    );

    const [invoicesRes, expensesRes] = await Promise.allSettled([invoicesPromise, expensesPromise]);

    await client.end();

    let allDocs: Invoice[] = [];

    if (invoicesRes.status === 'fulfilled') {
      const mappedInvoices = invoicesRes.value.rows.map((row: any) => ({
        ...row.data, 
        id: row.id,
        userId: row.user_id || row.data.userId || userId,
        clientName: row.client_name,
        clientTaxId: row.client_tax_id || row.data.clientTaxId,
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
        userId: row.data.userId || userId,
        clientName: row.provider_name, 
        total: parseFloat(row.total),
        status: row.status, 
        date: row.date,
        type: 'Expense',
        receiptUrl: row.receipt_url
      }));
      allDocs = [...allDocs, ...mappedExpenses];
    }

    return allDocs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  } catch (error) {
    console.warn("Neon DB Fetch Error:", error);
    return null; 
  }
};

/**
 * FETCH CLIENTS
 */
export const fetchClientsFromDb = async (userId: string): Promise<DbClient[]> => {
  const client = getDbClient();
  if (!client) return [];

  try {
    await client.connect();
    
    // Ensure table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tax_id TEXT,
        email TEXT,
        address TEXT,
        phone TEXT,
        tags TEXT,
        notes TEXT,
        status TEXT DEFAULT 'PROSPECT',
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // AGGRESSIVE AUTO-MIGRATION ON FETCH
    // This ensures that simply loading the app will try to fix the DB schema
    await repairClientTableSchema(client);

    const result = await client.query('SELECT * FROM clients WHERE user_id = $1', [userId]);
    await client.end();

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      taxId: row.tax_id,
      email: row.email,
      address: row.address,
      phone: row.phone,
      tags: row.tags,
      notes: row.notes,
      status: row.status || 'PROSPECT'
    }));
  } catch (error) {
    console.error("Error fetching clients:", error);
    return [];
  }
};

/**
 * SAVE CLIENT (Robust & Auto-Healing)
 */
export const saveClientToDb = async (client: DbClient, userId: string, status: 'CLIENT' | 'PROSPECT'): Promise<{success: boolean, error?: string}> => {
  const clientDb = getDbClient();
  if (!clientDb) return { success: false, error: 'Database connection failed' };

  // Prepare Data
  const safeName = client.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const clientId = client.id || `cli_${userId.substring(0,8)}_${safeName}`;

  // Define Query
  const query = `
    INSERT INTO clients (id, user_id, name, tax_id, email, address, phone, tags, notes, status, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (id) 
    DO UPDATE SET 
      name = EXCLUDED.name,
      tax_id = COALESCE(EXCLUDED.tax_id, clients.tax_id),
      email = COALESCE(EXCLUDED.email, clients.email),
      address = COALESCE(EXCLUDED.address, clients.address),
      phone = COALESCE(EXCLUDED.phone, clients.phone),
      tags = COALESCE(EXCLUDED.tags, clients.tags),
      notes = COALESCE(EXCLUDED.notes, clients.notes),
      status = CASE 
          WHEN clients.status = 'CLIENT' THEN 'CLIENT'
          ELSE EXCLUDED.status
      END,
      updated_at = NOW();
  `;

  const values = [
    clientId,
    userId,
    client.name,
    client.taxId || null,
    client.email || null,
    client.address || null,
    client.phone || null,
    client.tags || null,
    client.notes || null,
    status
  ];

  try {
    await clientDb.connect();
    
    // 1. Initial Table Check
    await clientDb.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tax_id TEXT,
        email TEXT,
        address TEXT,
        phone TEXT,
        tags TEXT,
        notes TEXT,
        status TEXT DEFAULT 'PROSPECT',
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Execute Insert
    try {
        await clientDb.query(query, values);
    } catch (insertError: any) {
        // AUTO-HEALING
        // 42804 = Datatype Mismatch (UUID vs TEXT)
        // 42703 = Undefined Column (Missing status)
        if (insertError.code === '42804' || insertError.code === '42703' || insertError.message.includes('type')) {
             console.log("⚠️ DB Error detected. Attempting Auto-Repair...", insertError.code);
             
             // Run repair commands explicitly
             await repairClientTableSchema(clientDb);
             
             // Retry the insert
             await clientDb.query(query, values);
        } else {
            // Re-throw if it's a different error
            throw insertError;
        }
    }

    await clientDb.end();
    logAuditAction(userId, 'SAVE_CLIENT', { clientName: client.name, status });
    return { success: true };

  } catch (error: any) {
    console.error("Neon DB Client Save Error:", error);
    return { success: false, error: error.message || 'Database error' };
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
    
    const invoiceData = { ...invoice };
    
    if (invoice.type === 'Expense') {
      const query = `
        INSERT INTO expenses (id, provider_name, date, total, currency, category, receipt_url, status, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) 
        DO UPDATE SET 
          provider_name = EXCLUDED.provider_name,
          total = EXCLUDED.total,
          date = EXCLUDED.date,
          category = EXCLUDED.category,
          receipt_url = EXCLUDED.receipt_url,
          data = EXCLUDED.data;
      `;
      
      const category = invoice.items[0]?.description || 'General';

      await client.query(query, [
        invoice.id,
        invoice.clientName, 
        invoice.date,
        invoice.total,
        invoice.currency,
        category,
        invoice.receiptUrl || null,
        invoice.status,
        JSON.stringify(invoiceData)
      ]);

    } else {
      const query = `
        INSERT INTO invoices (id, user_id, client_name, client_tax_id, total, status, date, type, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) 
        DO UPDATE SET 
          user_id = EXCLUDED.user_id,
          client_name = EXCLUDED.client_name,
          client_tax_id = EXCLUDED.client_tax_id,
          total = EXCLUDED.total,
          status = EXCLUDED.status,
          date = EXCLUDED.date,
          data = EXCLUDED.data;
      `;

      await client.query(query, [
        invoice.id,
        invoiceData.userId, 
        invoice.clientName,
        invoice.clientTaxId || null, 
        invoice.total,
        invoice.status,
        invoice.date,
        invoice.type,
        JSON.stringify(invoiceData)
      ]);
    }

    await client.end();

    if (invoiceData.userId) {
        logAuditAction(invoiceData.userId, 'SAVE_DOCUMENT', { 
            docId: invoice.id, 
            type: invoice.type, 
            amount: invoice.total,
            client: invoice.clientName
        });
    }

    return true;

  } catch (error) {
    console.error("Neon DB Save Error:", error);
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
    
    if (resInv.rowCount === 0) {
       await client.query('DELETE FROM expenses WHERE id = $1', [id]);
    }

    await client.end();
    logAuditAction(userId, 'DELETE_DOCUMENT', { docId: id });

    return true;
  } catch (error) {
    console.error("Neon DB Delete Error:", error);
    return false;
  }
};
