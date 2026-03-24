
import { Invoice, PaymentIntegration } from '../types';

/**
 * Yappy Service: Frontend logic for generating payment links
 */
/**
 * Main Yappy Entry Point: Simplest possible direct payment link.
 * This is the bulletproof V1 approach (yappy.com.pa/pago).
 * No handshakes, no JWTs, no CORS issues.
 */
export const getSafeYappyCheckoutUrl = async (
  invoice: Invoice,
  config: PaymentIntegration,
  remainingBalance: number
): Promise<string> => {
  const { yappyApiKey, yappySeed } = config;
  const baseUrl = "https://www.yappy.com.pa/pago";
  
  // Minimal parameter set for maximum compatibility
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
 * Kept for backward compatibility but redirected to safe method
 */
export const createYappyV2Checkout = async (
  invoice: Invoice, 
  config: PaymentIntegration,
  remainingBalance: number
): Promise<{ directUrl: string }> => {
  const url = await getSafeYappyCheckoutUrl(invoice, config, remainingBalance);
  return { directUrl: url };
};




/**
 * Generate a Deep Link for Yappy (Mobile)
 */
export const getYappyDeepLink = (amount: number, orderId: string): string => {
  return `yappy://payment?amount=${amount.toFixed(2)}&orderId=${orderId}`;
};
