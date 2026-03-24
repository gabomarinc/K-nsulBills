
import { Invoice, PaymentIntegration } from '../types';

/**
 * Yappy Service: Frontend logic for generating payment links
 */
export const generateYappyPaymentLink = async (
  invoice: Invoice, 
  config: PaymentIntegration,
  remainingBalance: number
): Promise<string> => {
  const { yappyApiKey, yappySecretKey, yappySeed } = config;

  if (!yappyApiKey) {
    throw new Error("Yappy API Key is missing");
  }

  // STANDARD YAPPY LINK FORMAT (Based on documented "Botón de Pago")
  // Note: For advanced security, the signature should be generated on the server if possible.
  // But for simple "Link de Pago" integrations, Yappy uses a specific public URL.
  
  const baseUrl = "https://www.yappy.com.pa/pago";
  const amount = remainingBalance.toFixed(2);
  const orderId = invoice.id;
  
  // Create a signature if required by the specific merchant implementation
  // Many Yappy "Link de Pago" implementations just use a direct URL with ID and amount
  // However, the "Conector" model uses a dynamic link.
  
  const params = new URLSearchParams({
    id: yappyApiKey, // Using API Key as the Merchant Identifier
    api_key: yappyApiKey,
    orderId: orderId,
    amount: amount,
    seed: yappySeed || Date.now().toString(),
    desc: `Factura ${orderId}`
  });

  // If we were doing QR generation, we would use a library here.
  // For the button, a redirect is sufficient.
  
  return `${baseUrl}?${params.toString()}`;
};

/**
 * Yappy V2: Trigger dynamic handshake via backend
 */
export const createYappyV2Checkout = async (
  invoice: Invoice, 
  config: PaymentIntegration,
  remainingBalance: number
): Promise<{ transactionId: string, token: string, documentName: string, diagnostic?: any }> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/yappy/v1/checkout');
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data.body);
        } else {
          reject(new Error(data.error || 'Error al conectar con Yappy'));
        }
      } catch (e) {
        reject(new Error('Error al procesar la respuesta de Yappy'));
      }
    };
    
    xhr.onerror = () => reject(new Error('Error de red al conectar con Yappy'));
    
    xhr.send(JSON.stringify({
      apiKey: config.yappyApiKey,
      orderId: invoice.id,
      total: remainingBalance,
      domain: window.location.origin,
      successUrl: `${window.location.origin}/#/documents/${invoice.id}?payment=success`,
      failUrl: `${window.location.origin}/#/documents/${invoice.id}?payment=failed`
    }));
  });
};

/**
 * Generate a Deep Link for Yappy (Mobile)
 */
export const getYappyDeepLink = (amount: number, orderId: string): string => {
  return `yappy://payment?amount=${amount.toFixed(2)}&orderId=${orderId}`;
};
