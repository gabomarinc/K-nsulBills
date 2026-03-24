
import { Invoice, PaymentIntegration } from '../types';

/**
 * Yappy Service: Frontend logic for generating payment links
 */
export const generateYappyPaymentLink = async (
  invoice: Invoice, 
  config: PaymentIntegration,
  remainingBalance: number
): Promise<string> => {
  const { yappyMerchantId, yappySecretKey } = config;

  if (!yappyMerchantId) {
    throw new Error("Yappy Merchant ID is missing");
  }

  // STANDARD YAPPY LINK FORMAT (Based on documented "Botón de Pago")
  // Note: For advanced security, the signature should be generated on the server if possible.
  // But for simple "Link de Pago" integrations, Yappy uses a specific public URL.
  
  const baseUrl = "https://pago.yappy.com.pa/pago";
  const amount = remainingBalance.toFixed(2);
  const orderId = invoice.id;
  
  // Create a signature if required by the specific merchant implementation
  // Many Yappy "Link de Pago" implementations just use a direct URL with ID and amount
  // However, the "Conector" model uses a dynamic link.
  
  const params = new URLSearchParams({
    id: yappyMerchantId,
    orderId: orderId,
    amount: amount,
    desc: `Factura ${orderId}`
  });

  // If we were doing QR generation, we would use a library here.
  // For the button, a redirect is sufficient.
  
  return `${baseUrl}?${params.toString()}`;
};

/**
 * Generate a Deep Link for Yappy (Mobile)
 */
export const getYappyDeepLink = (amount: number, orderId: string): string => {
  return `yappy://payment?amount=${amount.toFixed(2)}&orderId=${orderId}`;
};
