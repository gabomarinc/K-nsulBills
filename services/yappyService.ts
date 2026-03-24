
import { Invoice, PaymentIntegration } from '../types';

/**
 * Yappy Service: Frontend logic for generating payment links
 */
/**
 * Main Yappy Entry Point: Attempts the standard Signed URL (V1/SDK Style)
 * as it's the most reliable and direct way to reach 'Pagos Seguros'.
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
    console.warn("Yappy Handshake failed, using legacy fallback:", error);
    // Legacy fallback just in case
    const { yappyApiKey } = config;
    return `https://www.yappy.com.pa/pago?id=${yappyApiKey}&amount=${remainingBalance.toFixed(2)}&orderId=${invoice.id}`;
  }
};

/**
 * Yappy V1/SDK Signed URL: The standard way to reach the 'Pagos Seguros' screen.
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

  // 1. DERIVE KEY: Part 0 is for HMAC, Part 1 is for Handshake API Header
  let hmacSecret = yappySecretKey;
  try {
    const decoded = atob(yappySecretKey);
    const parts = decoded.split('.');
    if (parts.length >= 2) {
      hmacSecret = parts[0]; // Part 0 is for HMAC
    }
  } catch (e) {
    console.warn('Secret decoding failed on frontend:', e);
  }

  // 2. FORMAT DATA (CRITICAL: Remove dots from amounts for the signature)
  const formatAmount = (amt: number) => amt.toFixed(2).replace(/\./g, '');
  
  const totalStr = formatAmount(remainingBalance);
  const subtotalStr = formatAmount(remainingBalance);
  const taxesStr = "000"; // 0.00
  const orderId = invoice.id;
  const paymentDate = Math.floor(Date.now() / 1000).toString(); // Seconds timestamp
  const clientDomain = window.location.origin;
  const successUrl = `${clientDomain}/#/documents/${invoice.id}?payment=success`;
  const failUrl = `${clientDomain}/#/documents/${invoice.id}?payment=failed`;

  // 3. HANDSHAKE (JWT Token via Proxy)
  const jwtRes = await fetch('/api/yappy/v1/get-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: yappyApiKey,
      secretKey: yappySecretKey, // Send raw, proxy will derive part1
      domain: clientDomain
    })
  });

  if (!jwtRes.ok) {
    throw new Error('No se pudo obtener el token de seguridad de Yappy.');
  }
  const { accessToken, token } = await jwtRes.json();
  const jwtToken = accessToken || token || '';

  // 4. SIGNATURE: total + merchantId + subtotal + taxes + paymentDate + YAP + VEN + orderId + successUrl + failUrl + domainUrl
  const signatureString = [
    totalStr,
    yappyApiKey,
    subtotalStr,
    taxesStr,
    paymentDate,
    'YAP',
    'VEN',
    orderId,
    successUrl,
    failUrl,
    clientDomain
  ].join('');

  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(hmacSecret);
  const dataBytes = encoder.encode(signatureString);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
  const sigArray = Array.from(new Uint8Array(sigBuffer));
  const hash = sigArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 5. FINAL REDIRECT URL (Must use /checkout path and match parameters EXACTLY)
  const params = new URLSearchParams({
    orderId,
    total: remainingBalance.toFixed(2),
    hash,
    merchantId: yappyApiKey,
    jwtToken,
    successUrl,
    failUrl,
    domain: clientDomain,
    subtotal: remainingBalance.toFixed(2),
    taxes: "0.00",
    paymentDate,
    paymentMethod: 'YAP',
    transactionType: 'VEN',
    platform: 'desarrollopropio'
  });

  return { directUrl: `https://pagosbg.bgeneral.com/checkout?${params.toString()}` };
};






/**
 * Generate a Deep Link for Yappy (Mobile)
 */
export const getYappyDeepLink = (amount: number, orderId: string): string => {
  return `yappy://payment?amount=${amount.toFixed(2)}&orderId=${orderId}`;
};
