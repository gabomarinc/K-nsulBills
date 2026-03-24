
import { Invoice, PaymentIntegration } from '../types';

/**
 * Yappy Service: Frontend logic for generating payment links
 */
/**
 * Main Yappy Entry Point: Attempts V2 (Pagos Seguros) first with correct signatures.
 * Falls back to V1 (Direct Link) if handshake fails.
 */
export const getSafeYappyCheckoutUrl = async (
  invoice: Invoice,
  config: PaymentIntegration,
  remainingBalance: number
): Promise<string> => {
  try {
    const v2Result = await createYappyV2Checkout(invoice, config, remainingBalance);
    return v2Result.directUrl;
  } catch (error) {
    console.warn("Yappy V2 Handshake failed, using V1 fallback:", error);
    // Fallback to stable V1 link
    const { yappyApiKey, yappySeed } = config;
    const baseUrl = "https://www.yappy.com.pa/pago";
    const params = new URLSearchParams({
        id: yappyApiKey || '',
        orderId: invoice.id,
        amount: remainingBalance.toFixed(2),
        seed: yappySeed || Date.now().toString(),
        desc: `Pago Factura ${invoice.id}`
    });
    return `${baseUrl}?${params.toString()}`;
  }
};

/**
 * Yappy V2: Build signed redirect URL using correct 'merchantSecret' derivation and signatures.
 */
export const createYappyV2Checkout = async (
  invoice: Invoice, 
  config: PaymentIntegration, 
  remainingBalance: number
): Promise<{ directUrl: string }> => {
  const { yappyApiKey, yappySecretKey } = config;

  if (!yappyApiKey || !yappySecretKey) {
    throw new Error('Configuración de Yappy incompleta');
  }

  // 1. DERIVE MERCHANT SECRET: Base64 decode secretToken and take second part (index 1)
  let merchantSecret = yappySecretKey;
  try {
    const decoded = atob(yappySecretKey);
    const parts = decoded.split('.');
    if (parts.length >= 2) {
      merchantSecret = parts[1];
    }
  } catch (e) {
    console.warn('Secret derivation failed on frontend:', e);
  }

  const orderId = invoice.id;
  const total = remainingBalance.toFixed(2);
  const subtotal = remainingBalance.toFixed(2);
  const taxes = "0.00";
  const paymentDate = Date.now().toString(); // Epoch timestamp
  const clientDomain = window.location.origin;
  const successUrl = `${clientDomain}/#/documents/${invoice.id}?payment=success`;
  const failUrl = `${clientDomain}/#/documents/${invoice.id}?payment=failed`;
  const checkoutUrl = `${clientDomain}/#/documents/${invoice.id}`;

  // 2. HANDSHAKE: Get JWT via Proxy
  const jwtRes = await fetch('/api/yappy/v1/get-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: yappyApiKey,
      secretKey: yappySecretKey, // Send raw, proxy will derive
      domain: clientDomain
    })
  });

  if (!jwtRes.ok) {
    throw new Error('Handshake con BGeneral falló');
  }
  const { accessToken } = await jwtRes.json();
  const jwtToken = accessToken || '';

  // 3. SIGNATURE: total + merchantId + subtotal + taxes + paymentDate + YAP + VEN + orderId + successUrl + failUrl + domainUrl
  const sigData = [
    total,
    yappyApiKey,
    subtotal,
    taxes,
    paymentDate,
    'YAP',
    'VEN',
    orderId,
    successUrl,
    failUrl,
    clientDomain
  ].join('');

  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(merchantSecret); // Use derived secret!
  const dataBytes = encoder.encode(sigData);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
  const sigArray = Array.from(new Uint8Array(sigBuffer));
  const signature = sigArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 4. BUILD FINAL URL
  const paramsObj: Record<string, string> = {
    sbx: 'no',
    donation: 'no',
    checkoutUrl,
    signature,
    merchantId: yappyApiKey,
    total,
    subtotal,
    taxes,
    paymentDate,
    paymentMethod: 'YAP',
    transactionType: 'VEN',
    orderId,
    successUrl,
    failUrl,
    domain: clientDomain,
    jwtToken,
    platform: 'desarrollopropiophp'
  };

  const directUrl = `https://pagosbg.bgeneral.com?${new URLSearchParams(paramsObj).toString()}`;
  return { directUrl };
};





/**
 * Generate a Deep Link for Yappy (Mobile)
 */
export const getYappyDeepLink = (amount: number, orderId: string): string => {
  return `yappy://payment?amount=${amount.toFixed(2)}&orderId=${orderId}`;
};
