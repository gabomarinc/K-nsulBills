
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
      await client.end();

      if (rows.length > 0) {
         const userRow = rows[0];
         const storedPassword = userRow.password || ''; 

         let isMatch = false;

         // SPECIAL: Allow Demo Password Bypass if it matches the specific demo email
         // This ensures you can always log in as Juan even if you forgot the DB password, 
         // but critically, it returns the REAL DB USER ID.
         if (email === 'juan@facturazen.com' && password === 'password123') {
            console.log("🔓 Demo Credentials Matched - Bypassing Hash Check to Load Real Data");
            isMatch = true;
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
    } catch (error) {
      console.error("Neon Auth Error:", error);
      // Don't return null yet, try fallback if it's the demo user
    }
  }

  // 2. STATIC FALLBACK (Only if DB failed or user not found AND it's the demo user)
  if (email === 'juan@facturazen.com' && password === 'password123') {
       console.log("🔓 Using Static Demo Profile (DB Unreachable or User Not Found)");
       return {
         id: 'user_demo_p1', 
         name: 'Juan Pérez (Demo)',
         email: 'juan@facturazen.com',
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

    // 1. Fetch Invoices & Quotes
    const invoicesPromise = client.query(
      `SELECT * FROM invoices WHERE data->>'userId' = $1`, 
      [userId]
    );
    
    // 2. Fetch Expenses
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
        clientName: row.client_name,
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
 * Saves (Upserts) a document to the correct table based on type.
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

      await client.query(query, [
        invoice.id,
        invoice.clientName,
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
