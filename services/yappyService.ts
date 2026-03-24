
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
 * Yappy V2: Direct frontend handshake
 */
export const createYappyV2Checkout = async (
  invoice: Invoice, 
  config: PaymentIntegration,
  remainingBalance: number
): Promise<{ directUrl?: string, diagnostic?: any }> => {
  const { yappyApiKey, yappySecretKey } = config;

  if (!yappyApiKey || !yappySecretKey) {
    throw new Error('Yappy no está configurado correctamente en el perfil del emisor.');
  }

  const orderId = `FAC-${invoice.id}`;
  const amountStr = remainingBalance.toFixed(2);
  const clientDomain = window.location.origin;

  try {
    // STEP 1: Validate Merchant Handshake
    const validateRes = await fetch('https://apipagosbg.bgeneral.cloud/payments/validate/merchant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId: yappyApiKey,
        urlDomain: clientDomain
      })
    });
    
    if (!validateRes.ok) throw new Error('Network error validating merchant');
    const validateData = await validateRes.json();
    
    if (!validateData.status || validateData.status.code !== 200) {
      throw new Error(`Yappy Auth Failed: ${JSON.stringify(validateData)}`);
    }

    const sessionToken = validateData.status.token;

    // STEP 2: Generate Order Hash
    const hashData = yappyApiKey + orderId + amountStr + yappySecretKey;
    const msgUint8 = new TextEncoder().encode(hashData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // STEP 3: Request Direct Payment URL endpoint
    const urlRes = await fetch('https://apipagosbg.bgeneral.cloud/payments/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        merchantId: yappyApiKey,
        orderId: orderId,
        domain: clientDomain,
        paymentDate: Math.floor(Date.now() / 1000),
        total: amountStr,
        subtotal: amountStr,
        taxes: "0.00",
        hash: hashHex,
        successUrl: `${clientDomain}/#/documents/${invoice.id}?payment=success`,
        failUrl: `${clientDomain}/#/documents/${invoice.id}?payment=failed`,
        ipnUrl: `${clientDomain}/api/yappy/v1/movement/history`
      })
    });

    if (!urlRes.ok) throw new Error('Network error fetching payment URL');
    const urlData = await urlRes.json();

    if (urlData.url) {
      return { directUrl: urlData.url, diagnostic: urlData };
    } else if (urlData.body && urlData.body.url) {
      return { directUrl: urlData.body.url, diagnostic: urlData };
    } else {
      throw new Error(`Invalid response from Yappy URL endpoint: ${JSON.stringify(urlData)}`);
    }

  } catch (error: any) {
    console.error("Yappy V2 Frontend Error:", error);
    throw new Error(error.message || "Error desconocido al procesar pago Yappy desde el cliente");
  }
};

/**
 * Generate a Deep Link for Yappy (Mobile)
 */
export const getYappyDeepLink = (amount: number, orderId: string): string => {
  return `yappy://payment?amount=${amount.toFixed(2)}&orderId=${orderId}`;
};
