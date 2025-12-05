
import { Client } from '@neondatabase/serverless';
import { Invoice } from '../types';

/**
 * NEON DATABASE CONFIGURATION
 * 
 * NOTE: In a real production app, never expose credentials in the frontend code.
 * This should be handled by a backend API. For this prototype, we use the serverless driver.
 * 
 * We allow looking up the URL from localStorage for easier testing in browser environments
 * without env var injection.
 */

const getDbClient = () => {
  // 1. Try Environment Variable
  const envUrl = process.env.DATABASE_URL;
  // 2. Try Local Storage (User Settings)
  const localUrl = localStorage.getItem('NEON_DATABASE_URL');
  
  const url = envUrl || localUrl;

  if (!url) {
    console.warn("Neon DB: No DATABASE_URL found. Running in Offline/Mock mode.");
    return null;
  }
  
  const client = new Client(url);
  return client;
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
    console.error("Neon DB Connection Error:", error);
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
