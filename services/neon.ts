
import { Client } from '@neondatabase/serverless';
import { Invoice, UserProfile } from '../types';

/**
 * NEON DATABASE CONFIGURATION
 * 
 * NOTE: In a real production app, never expose credentials in the frontend code.
 * This should be handled by a backend API. For this prototype, we use the serverless driver.
 */

const getDbClient = () => {
  try {
    // 1. Try Environment Variable
    const envUrl = process.env.DATABASE_URL;
    // 2. Try Local Storage (User Settings)
    const localUrl = localStorage.getItem('NEON_DATABASE_URL');
    
    const url = envUrl || localUrl;

    if (!url) {
      return null;
    }
    
    // Safety check for minimal valid postgres URL structure
    if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
      console.warn("Invalid Database URL format");
      return null;
    }
    
    const client = new Client(url);
    return client;
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
  
  // If no DB connection string, fallback to MOCK for demo purposes if creds match default
  if (!client) {
    if (email === 'juan@facturazen.com' && password === 'password123') {
       // Return Mock Profile
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
    // Don't throw error, just return null so UI handles "Invalid credentials"
    return null;
  }

  try {
    await client.connect();
    
    // WARNING: In production, use bcrypt/argon2 on a backend. 
    // This is a prototype direct connection.
    const query = 'SELECT * FROM users WHERE email = $1 AND password = $2';
    const { rows } = await client.query(query, [email, password]);
    
    await client.end();

    if (rows.length > 0) {
       const userRow = rows[0];
       // Merge flat columns with the JSONB profile_data
       return {
         id: userRow.id,
         name: userRow.name,
         email: userRow.email,
         type: userRow.type,
         ...userRow.profile_data, // Expand JSONB profile
         isOnboardingComplete: true // Assuming existing users are complete
       } as UserProfile;
    }
    
    return null;
  } catch (error) {
    console.error("Neon Auth Error:", error);
    // Fallback to local mock login if DB fails (for demo resilience)
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
 * Fetches all invoices from Neon DB
 */
export const fetchInvoicesFromDb = async (): Promise<Invoice[] | null> => {
  const client = getDbClient();
  if (!client) return null;

  try {
    await client.connect();
    // We assume a table 'invoices' exists. 
    // Schema: id (text), client_name (text), total (numeric), status (text), date (timestamp), type (text), data (jsonb)
    const { rows } = await client.query('SELECT * FROM invoices ORDER BY date DESC');
    await client.end();

    // Transform SQL rows back to Application Type
    return rows.map((row: any) => {
      // Merge the structured columns with the JSONB blob 'data' which contains items, timeline, etc.
      // Priority to SQL columns if needed, but data blob is usually source of truth for complex fields
      return {
        ...row.data, 
        id: row.id,
        clientName: row.client_name,
        total: parseFloat(row.total),
        status: row.status,
        date: row.date, // Ensure date object or string consistency
        type: row.type
      } as Invoice;
    });

  } catch (error) {
    console.warn("Neon DB Connection Error (using local data):", error);
    return null; // Return null to fallback to mocks
  }
};

/**
 * Saves (Upserts) an invoice to Neon DB
 */
export const saveInvoiceToDb = async (invoice: Invoice): Promise<boolean> => {
  const client = getDbClient();
  if (!client) return false;

  try {
    await client.connect();
    
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
      JSON.stringify(invoice) // Store the full object in JSONB for flexibility
    ];

    await client.query(query, values);
    await client.end();
    return true;

  } catch (error) {
    console.error("Neon DB Save Error:", error);
    return false;
  }
};

/**
 * Deletes an invoice from Neon DB
 */
export const deleteInvoiceFromDb = async (id: string): Promise<boolean> => {
  const client = getDbClient();
  if (!client) return false;

  try {
    await client.connect();
    await client.query('DELETE FROM invoices WHERE id = $1', [id]);
    await client.end();
    return true;
  } catch (error) {
    console.error("Neon DB Delete Error:", error);
    return false;
  }
};
