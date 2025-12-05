
/**
 * DGI PANAMA SERVICE ADAPTER
 * Based on logic from: https://github.com/Electronic-Signatures-Industries/dgi-fe
 * 
 * NOTE: This service simulates the interaction with DGI's SOAP Web Services (iTax 2.0).
 * In a production environment, this logic requires a backend proxy to handle 
 * XML Signing (X.509) and CORS headers which are not supported directly in browsers.
 */

export interface ContribuyenteDGI {
  ruc: string;
  dv: string;
  razonSocial: string;
  tipoPersona: 'NATURAL' | 'JURIDICA';
  direccion?: string;
  estado: 'ACTIVO' | 'INACTIVO' | 'NO_HABIDO';
  email?: string; // DGI sometimes returns notification email
}

// Real-world examples of Panamanian companies for the "Live Connection" simulation
const DGI_DATABASE_MOCK: ContribuyenteDGI[] = [
  {
    ruc: '15569888-2-2021',
    dv: '55',
    razonSocial: 'COPA AIRLINES INC',
    tipoPersona: 'JURIDICA',
    direccion: 'AV. PRINCIPAL, COSTA DEL ESTE, TORRE BLU, PISO 5',
    estado: 'ACTIVO',
    email: 'facturacion@copaair.com'
  },
  {
    ruc: '1224-45-12222',
    dv: '88',
    razonSocial: 'BANCO GENERAL S.A.',
    tipoPersona: 'JURIDICA',
    direccion: 'CALLE 50, TORRE BG, CIUDAD DE PANAMÁ',
    estado: 'ACTIVO'
  },
  {
    ruc: '344-555-2323',
    dv: '12',
    razonSocial: 'SUPERMERCADOS 99 S.A.',
    tipoPersona: 'JURIDICA',
    direccion: 'VÍA PORRAS, EDIFICIO SUPER 99',
    estado: 'ACTIVO'
  },
  {
    ruc: '8-754-1234',
    dv: '00',
    razonSocial: 'JUAN PÉREZ (SERVICIOS PROFESIONALES)',
    tipoPersona: 'NATURAL',
    direccion: 'CONDADO DEL REY, PH GREEN PARK, TORRE 2',
    estado: 'ACTIVO'
  },
  {
    ruc: '10-234-567',
    dv: '44',
    razonSocial: 'TECH SOLUTIONS PANAMA S.A.',
    tipoPersona: 'JURIDICA',
    direccion: 'CLAYTON, CIUDAD DEL SABER, EDIF 234',
    estado: 'ACTIVO'
  }
];

/**
 * Calculates the Check Digit (DV) for a given RUC.
 * This mimics the standard mod11 algorithm used in Panama.
 */
export const calculateDV = (rucBase: string): string => {
  // Simplified mock logic for demo purposes. 
  // Real algo involves complex weights based on RUC type (NT, PE, E, etc).
  let sum = 0;
  for (let i = 0; i < rucBase.length; i++) {
    sum += rucBase.charCodeAt(i);
  }
  return (sum % 100).toString(); 
};

/**
 * Simulates a call to the 'ConsultarRuc' SOAP endpoint.
 */
export const consultarRucDGI = async (rucInput: string): Promise<ContribuyenteDGI | null> => {
  // Normalize input
  const cleanRuc = rucInput.trim().toUpperCase();

  // 1. Network Simulation Delay (DGI API is notoriously slow sometimes)
  await new Promise(resolve => setTimeout(resolve, 1500));

  // 2. Database Lookup
  // We check if the input includes the DV or just the RUC base
  const found = DGI_DATABASE_MOCK.find(c => {
     // Check full match "RUC DV" or "RUC-DV" or just "RUC"
     const fullString = `${c.ruc} DV ${c.dv}`;
     return cleanRuc.includes(c.ruc) || fullString.includes(cleanRuc);
  });

  if (found) return found;

  // 3. Fallback for "Generic Valid Format" simulation
  // If it looks like a valid RUC but isn't in our tiny mock DB, return a generic success
  // to prevent getting stuck during a demo.
  const isPlausibleRuc = cleanRuc.length > 5 && (cleanRuc.includes('-') || cleanRuc.startsWith('8-') || cleanRuc.startsWith('PE-'));
  
  if (isPlausibleRuc) {
    return {
      ruc: cleanRuc.split(' DV')[0],
      dv: '00',
      razonSocial: 'EMPRESA DEMOSTRACIÓN S.A.',
      tipoPersona: cleanRuc.startsWith('8-') ? 'NATURAL' : 'JURIDICA',
      direccion: 'DIRECCIÓN GENÉRICA, PANAMÁ',
      estado: 'ACTIVO'
    };
  }

  return null;
};
