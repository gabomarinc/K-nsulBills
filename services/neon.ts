
import { Client } from '@neondatabase/serverless';
import { Invoice } from '../types';

/**
 * NEON DATABASE CONFIGURATION
 * Project ID: rapid-firefly-64178234
 * 
 * NOTE: In a real production app, never expose credentials in the frontend code.
 * This should be handled by a backend API. For this prototype, we use the serverless driver.
 */

// Intentamos obtener la URL de la variable de entorno, si no, usamos una estructura base
// El usuario debe proveer la contraseña o la URL completa en el entorno.
const DATABASE_URL = process.env.DATABASE_URL; 

export const getDbClient = () => {
  if (!DATABASE_URL) {
    console.warn("Neon DB: No DATABASE_URL found. Running in Offline/Mock mode.");
    return null;
  }
  
  const client = new Client(DATABASE_URL);
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
      return {
        ...row.data, // Spread the JSONB data (items, timeline, etc)
        id: row.id,
        clientName: row.client_name,
        total: parseFloat(row.total),
        status: row.status,
        date: row.date,
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
