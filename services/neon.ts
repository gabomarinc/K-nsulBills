
import { Client } from '@neondatabase/serverless';
import { Invoice, UserProfile } from '../types';

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
 * AUTHENTICATION: Login User
 */
export const authenticateUser = async (email: string, password: string): Promise<UserProfile | null> => {
  const client = getDbClient();
  
  // Fallback Mock Logic
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

  try {
    await client.connect();
    const query = 'SELECT * FROM users WHERE email = $1 AND password = $2';
    const { rows } = await client.query(query, [email, password]);
    await client.end();

    if (rows.length > 0) {
       const userRow = rows[0];
       return {
         id: userRow.id,
         name: userRow.name,
         email: userRow.email,
         type: userRow.type,
         ...userRow.profile_data, 
         isOnboardingComplete: true 
       } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Neon Auth Error:", error);
    // Emergency Fallback
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
 * Fetches data from BOTH 'invoices' and 'expenses' tables and unifies them.
 */
export const fetchInvoicesFromDb = async (): Promise<Invoice[] | null> => {
  const client = getDbClient();
  if (!client) return null;

  try {
    await client.connect();
    
    // 1. Fetch Invoices & Quotes
    const invoicesPromise = client.query('SELECT * FROM invoices');
    
    // 2. Fetch Expenses (Handle case where table might not exist yet gracefully-ish via catch or strict setup)
    // We assume table 'expenses' exists based on previous SQL execution.
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
