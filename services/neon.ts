
import { Client } from '@neondatabase/serverless';
import { Invoice, UserProfile } from '../types';
import * as bcrypt from 'bcryptjs';

/**
 * NEON DATABASE CONFIGURATION
 */

const getDbClient = () => {
  try {
    const envUrl = process.env.DATABASE_URL;
    const localUrl = localStorage.getItem('NEON_DATABASE_URL');
    const url = envUrl || localUrl;

    if (!url) return null;
    
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
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

export const comparePassword = async (plain: string, hashed: string): Promise<boolean> => {
  return await bcrypt.compare(plain, hashed);
};

/**
 * AUTHENTICATION: Login User
 */
export const authenticateUser = async (email: string, password: string): Promise<UserProfile | null> => {
  const client = getDbClient();
  
  // 1. OFFLINE / NO-DB MODE FALLBACK
  if (!client) {
    if (email === 'juan@facturazen.com' && password === 'password123') {
       return {
         id: 'p1',
         name: 'Juan Pérez',
         type: 'Autónomo' as any,
         taxId: '8-123-456',
         avatar: '',
         isOnboardingComplete: true,
         defaultCurrency: 'USD',
         plan: 'Emprendedor Pro',
         country: 'Panamá',
         branding: { primaryColor: '#27bea5', templateStyle: 'Modern' }
       } as UserProfile;
    }
    return null;
  }

  // 2. CONNECTED MODE
  try {
    await client.connect();
    // Fetch user and the JSON profile_data column
    const query = 'SELECT id, name, email, password, type, profile_data FROM users WHERE email = $1';
    const { rows } = await client.query(query, [email]);
    await client.end();

    if (rows.length > 0) {
       const userRow = rows[0];
       const storedPassword = userRow.password || ''; 

       let isMatch = false;

       // Check if password is hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
       if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
          isMatch = await comparePassword(password, storedPassword);
       } else {
          // Legacy plain text check (for older accounts not yet migrated)
          isMatch = storedPassword === password;
       }

       // --- SAFETY NET FOR DEMO USER ---
       if (!isMatch && email === 'juan@facturazen.com' && password === 'password123') {
           console.warn("⚠️ Demo Backdoor Active: Database password check failed, but demo credentials matched.");
           isMatch = true;
       }

       if (isMatch) {
         // CRITICAL: Merge the JSONB profile_data with the root columns
         // This ensures API Keys, Bank Info, and Payment Integrations (Dual Providers) are loaded into app state
         const profileSettings = userRow.profile_data || {};

         return {
           id: userRow.id,
           name: userRow.name,
           email: userRow.email,
           type: userRow.type === 'COMPANY' ? 'Empresa (SAS/SL)' : 'Autónomo',
           // Spread the JSON settings (contains apiKeys, bankAccount, paymentIntegration, etc.)
           ...profileSettings, 
           isOnboardingComplete: true 
         } as UserProfile;
       }
    }
    
    return null;
  } catch (error) {
    console.error("Neon Auth Error:", error);
    // 3. EMERGENCY FALLBACK ON CONNECTION ERROR
    if (email === 'juan@facturazen.com' && password === 'password123') {
        return {
             id: 'p1',
             name: 'Juan Pérez (Offline)',
             type: 'Autónomo' as any,
             taxId: '8-123-456',
             avatar: '',
             isOnboardingComplete: true,
             defaultCurrency: 'USD',
             plan: 'Emprendedor Pro',
             country: 'Panamá',
             branding: { primaryColor: '#27bea5', templateStyle: 'Modern' }
           } as UserProfile;
    }
    return null;
  }
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
    
    // Construct profile_data dynamically
    // Exclude root columns from JSON to avoid duplication
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

    // Prepare JSONB data (Everything except root columns)
    // This effectively saves apiKeys, paymentIntegration, bankAccount, etc.
    const profileData = { ...profile };
    delete (profileData as any).id;
    delete (profileData as any).name;
    delete (profileData as any).email;
    delete (profileData as any).type;
    delete (profileData as any).password;

    // Sanitize to ensure clean JSON
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
 */
export const fetchInvoicesFromDb = async (): Promise<Invoice[] | null> => {
  const client = getDbClient();
  if (!client) return null;

  try {
    await client.connect();
    
    // 1. Fetch Invoices & Quotes
    const invoicesPromise = client.query('SELECT * FROM invoices');
    // 2. Fetch Expenses
    const expensesPromise = client.query('SELECT * FROM expenses');

    const [invoicesRes, expensesRes] = await Promise.allSettled([invoicesPromise, expensesPromise]);

    await client.end();

    let allDocs: Invoice[] = [];

    // Process Invoices
    if (invoicesRes.status === 'fulfilled') {
      const mappedInvoices = invoicesRes.value.rows.map((row: any) => ({
        ...row.data, 
        id: row.id,
        clientName: row.client_name,
        total: parseFloat(row.total),
        status: row.status,
        date: row.date,
        type: row.type // 'Invoice' or 'Quote'
      }));
      allDocs = [...allDocs, ...mappedInvoices];
    }

    // Process Expenses
    if (expensesRes.status === 'fulfilled') {
      const mappedExpenses = expensesRes.value.rows.map((row: any) => ({
        ...row.data,
        id: row.id,
        clientName: row.provider_name, // Map provider to clientName for frontend consistency
        total: parseFloat(row.total),
        status: row.status, // Usually 'Aceptada'
        date: row.date,
        type: 'Expense',
        receiptUrl: row.receipt_url
      }));
      allDocs = [...allDocs, ...mappedExpenses];
    }

    // Sort combined list by date desc
    return allDocs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  } catch (error) {
    console.warn("Neon DB Fetch Error:", error);
    return null; 
  }
};

/**
 * Saves (Upserts) a document to the correct table based on type.
 */
export const saveInvoiceToDb = async (invoice: Invoice): Promise<boolean> => {
  const client = getDbClient();
  if (!client) return false;

  try {
    await client.connect();
    
    if (invoice.type === 'Expense') {
      // --- SAVE TO EXPENSES TABLE ---
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

      const values = [
        invoice.id,
        invoice.clientName, // In expense context, this is provider
        invoice.date,
        invoice.total,
        invoice.currency,
        category,
        invoice.receiptUrl || null,
        invoice.status,
        JSON.stringify(invoice)
      ];

      await client.query(query, values);

    } else {
      // --- SAVE TO INVOICES TABLE (Invoices & Quotes) ---
      const query = `
        INSERT INTO invoices (id, client_name, total, status, date, type, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) 
        DO UPDATE SET 
          client_name = EXCLUDED.client_name,
          total = EXCLUDED.total,
          status = EXCLUDED.status,
          date = EXCLUDED.date,
          data = EXCLUDED.data;
      `;

      const values = [
        invoice.id,
        invoice.clientName,
        invoice.total,
        invoice.status,
        invoice.date,
        invoice.type,
        JSON.stringify(invoice)
      ];

      await client.query(query, values);
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
    
    // Optimistic approach: try deleting from invoices first
    const resInv = await client.query('DELETE FROM invoices WHERE id = $1', [id]);
    
    // If nothing deleted, try expenses
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
