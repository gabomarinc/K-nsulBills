
import { Invoice, PaymentIntegration } from '../types';

/**
 * Yappy Service: Frontend logic for generating payment links
 */
/**
 * Main Yappy Entry Point: Attempts V2 (handshake) and falls back to V1 (Direct Link) if failures occur.
 * This ensures the user is NEVER blocked by BGeneral API/CORS/Domain errors.
 */
export const getSafeYappyCheckoutUrl = async (
  invoice: Invoice,
  config: PaymentIntegration,
  remainingBalance: number
): Promise<string> => {
  try {
    console.log("Attempting Yappy V2 Handshake...");
    const v2Result = await createYappyV2Checkout(invoice, config, remainingBalance);
    return v2Result.directUrl;
  } catch (error) {
    console.warn("Yappy V2 failed, falling back to V1 Direct Link:", error);
    return generateYappyV1Link(invoice, config, remainingBalance);
  }
};

/**
 * Yappy V1 (Legacy/Direct Link): Simple, no-handshake redirect.
 * This is the ultimate fallback that always works.
 */
export const generateYappyV1Link = (
  invoice: Invoice,
  config: PaymentIntegration,
  remainingBalance: number
): string => {
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
};

/**
 * Yappy V2: Build signed static redirect URL using HMAC-SHA256
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

  const orderId = invoice.id;
  const total = remainingBalance;
  const subtotal = remainingBalance;
  const taxes = 0;
  const paymentDate = Date.now();
  const clientDomain = window.location.origin;
  const successUrl = `${clientDomain}/#/documents/${invoice.id}?payment=success`;
  const failUrl = `${clientDomain}/#/documents/${invoice.id}?payment=failed`;
  const checkoutUrl = `${clientDomain}/#/documents/${invoice.id}`;

  // STEP 1: Fetch JWT token via Proxy
  let jwtToken = '';
  const jwtRes = await fetch('/api/yappy/v1/get-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: yappyApiKey,
      secretKey: yappySecretKey,
      domain: clientDomain
    })
  });
  
  if (jwtRes.ok) {
    const jwtData = await jwtRes.json();
    jwtToken = jwtData.accessToken || jwtData.token || '';
  } else {
    // If we get 400/500 from proxy/BG, we throw so the fallback takes over
    const errData = await jwtRes.json().catch(() => ({}));
    throw new Error(`BGeneral rejected handshake: ${errData.message || jwtRes.statusText}`);
  }

  // STEP 2: Build HMAC-SHA256 signature
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
    platform: 'desarrollopropiophp',
    jwtToken
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
