// Currency Service for exchange rates and conversion between USD and EUR
// Uses open.er-api.com (which provides real-time interbank/google equivalent exchange rates)
// Includes hardcoded reliable fallbacks if offline or API fails.

export interface ExchangeRates {
  USD: number;
  EUR: number;
}

let cachedRates: ExchangeRates = {
  USD: 1.0,
  EUR: 0.92, // Default fallback (1 USD = 0.92 EUR)
};

let lastFetched = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

export const fetchExchangeRates = async (): Promise<ExchangeRates> => {
  const now = Date.now();
  if (now - lastFetched < CACHE_DURATION) {
    return cachedRates;
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data && data.rates && typeof data.rates.EUR === 'number') {
      cachedRates = {
        USD: 1.0,
        EUR: data.rates.EUR,
      };
      lastFetched = now;
      console.log('[CurrencyService] Successfully updated rates from API:', cachedRates);
    }
  } catch (error) {
    console.error('[CurrencyService] Error fetching exchange rates, using fallbacks:', error);
  }

  return cachedRates;
};

export const getCachedRates = (): ExchangeRates => {
  return cachedRates;
};

/**
 * Synchronously convert an amount from one currency to another using cached rates
 */
export const convertCurrency = (amount: number, from: string, to: string, rates: ExchangeRates = cachedRates): number => {
  const fromUpper = (from || 'USD').toUpperCase();
  const toUpper = (to || 'USD').toUpperCase();

  if (fromUpper === toUpper) return amount;

  // Normalize rates
  const eurRate = rates.EUR || 0.92;

  if (fromUpper === 'USD' && toUpper === 'EUR') {
    return amount * eurRate;
  }
  if (fromUpper === 'EUR' && toUpper === 'USD') {
    return amount / eurRate;
  }

  return amount; // Fallback if unrecognized
};

/**
 * Helper to get currency symbol
 */
export const getCurrencySymbol = (currency: string): string => {
  const upper = (currency || 'USD').toUpperCase();
  return upper === 'EUR' ? '€' : '$';
};
