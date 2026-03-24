
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
 * Yappy V2: Build signed static redirect URL using HMAC-SHA256
 * Based on the official BGeneral/Eprezto approach.
 */
export const createYappyV2Checkout = async (
  invoice: Invoice, 
  config: PaymentIntegration,
  remainingBalance: number
): Promise<{ directUrl: string }> => {
  const { yappyApiKey, yappySecretKey } = config;

  if (!yappyApiKey || !yappySecretKey) {
    throw new Error('Yappy no está configurado correctamente en el perfil del emisor.');
  }

  const orderId = invoice.id;
  const total = remainingBalance;
  const subtotal = remainingBalance;
  const taxes = 0;
  const paymentDate = Date.now();
  const clientDomain = window.location.origin;
  const successUrl = `${clientDomain}/#/documents/${invoice.id}?payment=success`;
  const failUrl = `${clientDomain}/#/documents/${invoice.id}?payment=failed`;
  const checkoutUrl = `${clientDomain}/#/documents/${invoice.id}`;

  // STEP 1: Fetch JWT token via our backend PROXY to bypass CORS
  let jwtToken = '';
  try {
    const jwtRes = await fetch('/api/yappy/v1/get-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: yappyApiKey,
        domain: clientDomain
      })
    });
    if (jwtRes.ok) {
      const jwtData = await jwtRes.json();
      jwtToken = jwtData.accessToken || jwtData.token || '';
    }
  } catch (e) {
    console.warn('Yappy JWT proxy failed, proceeding without token:', e);
  }

  // STEP 2: Build HMAC-SHA256 signature
  // The ORDER of fields is CRITICAL for BGeneral. 
  // Standard V2 Signature: total + merchantId + subtotal + taxes + paymentDate + YAP + VEN + orderId + successUrl + failUrl + domainUrl
  const sigData = [
    total.toFixed(2),
    yappyApiKey,
    subtotal.toFixed(2),
    taxes.toFixed(2),
    paymentDate.toString(),
    'YAP',
    'VEN',
    orderId,
    successUrl,
    failUrl,
    clientDomain
  ].join('');

  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(yappySecretKey);
  const dataBytes = encoder.encode(sigData);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
  const sigArray = Array.from(new Uint8Array(sigBuffer));
  const signature = sigArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // STEP 3: Build redirect URL
  const paramsObj: Record<string, string> = {
    sbx: 'no',
    donation: 'no',
    checkoutUrl,
    signature,
    merchantId: yappyApiKey,
    total: total.toFixed(2),
    subtotal: subtotal.toFixed(2),
    taxes: taxes.toFixed(2),
    paymentDate: String(paymentDate),
    paymentMethod: 'YAP',
    transactionType: 'VEN',
    orderId,
    successUrl,
    failUrl,
    domain: clientDomain,
    aliasYappy: '',
    platform: 'desarrollopropiophp'
  };
  if (jwtToken) paramsObj.jwtToken = jwtToken;

  const directUrl = `https://pagosbg.bgeneral.com?${new URLSearchParams(paramsObj).toString()}`;
  return { directUrl };
};



/**
 * Generate a Deep Link for Yappy (Mobile)
 */
export const getYappyDeepLink = (amount: number, orderId: string): string => {
  return `yappy://payment?amount=${amount.toFixed(2)}&orderId=${orderId}`;
};
