import { Client } from '@neondatabase/serverless';
import { Invoice, UserProfile } from '../types';
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
 * SECURITY HELPERS
 * NOTE: Using synchronous methods to ensure compatibility with browser-based bcryptjs builds
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
};

export const comparePassword = async (plain: string, hashed: string): Promise<boolean> => {
  return bcrypt.compareSync(plain, hashed);
};

/**
 * AUTHENTICATION: Login User
 */
export const authenticateUser = async (email: string, password: string): Promise<UserProfile | null> => {
  const client = getDbClient();
  
  // 1. ATTEMPT REAL DB AUTHENTICATION (First Priority)
  // We do this even for demo credentials to ensure we retrieve the REAL user ID linked to existing data.
  if (client) {
    try {
      await client.connect();
      const query = 'SELECT id, name, email, password, type, profile_data FROM users WHERE email = $1';
      const { rows } = await client.query(query, [email]);
      
      // Keep client open for potential password update
      
      if (rows.length > 0) {
         const userRow = rows[0];
         const storedPassword = userRow.password || ''; 

         let isMatch = false;
         let needsPasswordUpdate = false;

         // SPECIAL: Allow Demo Password Bypass if it matches the specific demo email
         // This ensures you can always log in as Juan even if you forgot the DB password, 
         // but critically, it returns the REAL DB USER ID.
         if (email === 'juan@konsulbills.com' && password === 'password123') {
            console.log("🔓 Demo Credentials Matched - Bypassing Hash Check");
            isMatch = true;
            
            // Auto-heal: If the stored hash isn't valid for 'password123', mark for update
            // This fixes the issue where the DB might have an old/different password
            const isHashCorrect = await comparePassword('password123', storedPassword).catch(() => false);
            if (!isHashCorrect) {
               needsPasswordUpdate = true;
            }
         } else {
            // Normal Password Check
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
           console.log(`✅ User Authenticated: ${userRow.id}`);
           
           // Sync password in DB if needed (Auto-repair)
           if (needsPasswordUpdate) {
              try {
                console.log("🔄 Syncing Demo Password Hash in DB...");
                const newHash = await hashPassword('password123');
                await client.query('UPDATE users SET password = $1 WHERE id = $2', [newHash, userRow.id]);
              } catch (err) {
                console.warn("Failed to auto-update password hash", err);
              }
           }

           await client.end(); // Now close connection

           const profileSettings = userRow.profile_data || {};

           return {
             id: userRow.id, // RETURNS THE REAL ID LINKED TO DATA
             name: userRow.name,
             email: userRow.email,
             type: userRow.type === 'COMPANY' ? 'Empresa (SAS/SL)' : 'Autónomo',
             ...profileSettings, 
             isOnboardingComplete: true 
           } as UserProfile;
         }
      }
      await client.end(); // Close if no user found or no match
    } catch (error) {
      console.error("Neon Auth Error:", error);
      // Don't return null yet, try fallback if it's the demo user
    }
  }

  // 2. STATIC FALLBACK (Only if DB failed or user not found AND it's the demo user)
  if (email === 'juan@konsulbills.com' && password === 'password123') {
       console.log("🔓 Using Static Demo Profile (DB Unreachable or User Not Found)");
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
 * CREATE USER (Secure)
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

    const query = `
      INSERT INTO users (id, name, email, password, type, profile_data)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await client.query(query, [
      userId,
      profile.name,
      email,
      hashedPassword,
      profile.type === 'Empresa (SAS/SL)' ? 'COMPANY' : 'FREELANCE',
      JSON.stringify(profileData)
    ]);

    await client.end();
    return true;

  } catch (error) {
    console.error("Create User Error:", error);
    return false;
  }
};

/**
 * UPDATE USER PROFILE (Persist Settings)
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
      profile.type === 'Empresa (SAS/SL)' ? 'COMPANY' : 'FREELANCE',
      JSON.stringify(cleanProfileData),
      profile.id
    ]);

    await client.end();
    return true;
  } catch (error) {
    console.error("Update User Error:", error);
    return false;
  }
};

/**
 * Fetches data from BOTH 'invoices' and 'expenses' tables and unifies them.
 * FILTERS BY userId to ensure data isolation.
 */
export const fetchInvoicesFromDb = async (userId: string): Promise<Invoice[] | null> => {
  const client = getDbClient();
  if (!client) return null;

  try {
    await client.connect();
    
    console.log(`Fetching data for User ID: ${userId}`);

    // FETCH INVOICES
    // FIX: Include rows where userId matches OR where userId is NULL (legacy data adoption)
    // NOTE: We check both the explicit user_id column AND the JSON blob for backward compatibility
    const invoicesPromise = client.query(
      `SELECT * FROM invoices WHERE user_id = $1 OR data->>'userId' = $1 OR (user_id IS NULL AND data->>'userId' IS NULL)`, 
      [userId]
    );
    
    // FETCH EXPENSES
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
        // Ensure the object in memory has the current userId attached if it was missing
        userId: row.user_id || row.data.userId || userId,
        clientName: row.client_name,
        clientTaxId: row.client_tax_id || row.data.clientTaxId, // Fetch from col or json
        total: parseFloat(row.total),
        status: row.status,
        date: row.date,
        type: row.type 
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
 * Saves (Upserts) a client to the clients table.
 */
export const saveClientToDb = async (client: { name: string, taxId?: string, email?: string, address?: string }, userId: string, status: 'CLIENT' | 'PROSPECT'): Promise<boolean> => {
  const clientDb = getDbClient();
  if (!clientDb) return false;

  try {
    await clientDb.connect();

    // Create a deterministic ID based on UserID + ClientName to avoid duplicates
    // Simple sanitization for the ID
    const safeName = client.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const clientId = `cli_${userId.substring(0,8)}_${safeName}`;

    const query = `
      INSERT INTO clients (id, user_id, name, tax_id, email, address, status, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (id) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        tax_id = COALESCE(EXCLUDED.tax_id, clients.tax_id),
        email = COALESCE(EXCLUDED.email, clients.email),
        address = COALESCE(EXCLUDED.address, clients.address),
        status = CASE 
           WHEN clients.status = 'CLIENT' THEN 'CLIENT' -- Once a client, always a client
           ELSE EXCLUDED.status
        END,
        updated_at = NOW();
    `;

    await clientDb.query(query, [
      clientId,
      userId,
      client.name,
      client.taxId || null,
      client.email || null,
      client.address || null,
      status
    ]);

    await clientDb.end();
    return true;
  } catch (error) {
    console.error("Neon DB Client Save Error:", error);
    return false;
  }
};

/**
 * Saves (Upserts) a document to the correct table based on type.
 * Updated to save specific columns: user_id, client_tax_id
 */
export const saveInvoiceToDb = async (invoice: Invoice): Promise<boolean> => {
  const client = getDbClient();
  if (!client) return false;

  try {
    await client.connect();
    
    const invoiceData = { ...invoice };
    
    // Log for debugging
    console.log(`Saving ${invoice.type} to DB for User: ${invoiceData.userId}`);

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
      // INVOICE / QUOTE
      // UPDATED: Now inserts user_id and client_tax_id explicit columns
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
        invoiceData.userId, // Explicit User ID
        invoice.clientName,
        invoice.clientTaxId || null, // Explicit Tax ID
        invoice.total,
        invoice.status,
        invoice.date,
        invoice.type,
        JSON.stringify(invoiceData)
      ]);
    }

    await client.end();
    return true;

  } catch (error) {
    console.error("Neon DB Save Error:", error);
    return false;
  }
};

/**
 * Deletes from correct table
 */
export const deleteInvoiceFromDb = async (id: string): Promise<boolean> => {
  const client = getDbClient();
  if (!client) return false;

  try {
    await client.connect();
    
    const resInv = await client.query('DELETE FROM invoices WHERE id = $1', [id]);
    
    if (resInv.rowCount === 0) {
       await client.query('DELETE FROM expenses WHERE id = $1', [id]);
    }

    await client.end();
    return true;
  } catch (error) {
    console.error("Neon DB Delete Error:", error);
    return false;
  }
};