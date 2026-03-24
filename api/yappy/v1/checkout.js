import crypto from 'crypto';
import { getYappyConfigByApiKey } from '../../../services/neon';

/**
 * Yappy V2 Checkout API
 * HANDSHAKE STEP 1 & 2
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, orderId, total, domain, successUrl, failUrl } = req.body;

  if (!apiKey || !orderId || !total) {
    return res.status(400).json({ error: 'Missing required fields (apiKey, orderId, total)' });
  }

  try {
    // 1. Fetch the full config from DB safely
    const config = await getYappyConfigByApiKey(apiKey);
    
    if (!config || !config.yappySecretKey) {
      return res.status(404).json({ 
        error: 'Yappy configuration not found',
        details: 'No se encontró una configuración válida para este API Key.' 
      });
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const origin = `${protocol}://${host}`;
    const clientDomain = domain || origin;

    // 2. STEP 1: Validate Merchant Handshake
    const validateRes = await fetch('https://apipagosbg.bgeneral.cloud/payments/validate/merchant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId: apiKey,
        urlDomain: clientDomain
      })
    });

    const validateData = await validateRes.json();
    if (!validateData.status || validateData.status.code !== 200) {
      return res.status(400).json({ 
        error: 'Yappy Authentication Failed', 
        details: validateData 
      });
    }

    const sessionToken = validateData.status.token;

    // 3. STEP 2: Generate Order Hash
    // Hash: SHA256(merchantId + orderId + total + secretKey)
    const amountStr = Number(total).toFixed(2);
    const hashData = apiKey + orderId + amountStr + yappySecretKey;
    const hash = crypto.createHash('sha256').update(hashData).digest('hex');

    // 4. STEP 3: Create Payment Order (Web Component Handshake)
    const orderRes = await fetch('https://apipagosbg.bgeneral.cloud/payments/payment-wc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        merchantId: apiKey,
        orderId: orderId,
        domain: clientDomain,
        paymentDate: Math.floor(Date.now() / 1000),
        total: amountStr,
        subtotal: amountStr,
        taxes: "0.00",
        hash: hash,
        successUrl: successUrl || clientDomain,
        failUrl: failUrl || clientDomain,
        ipnUrl: `${origin}/api/yappy/v1/movement/history`
      })
    });

    const orderData = await orderRes.json();
    
    // START DIAGNOSTIC INJECTION
    try {
      const fs = require('fs');
      
      // Also try the non-WC endpoint to see if it gives a direct URL
      const altOrderRes = await fetch('https://apipagosbg.bgeneral.cloud/payments/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          merchantId: apiKey,
          orderId: orderId,
          domain: clientDomain,
          paymentDate: Math.floor(Date.now() / 1000),
          total: amountStr,
          subtotal: amountStr,
          taxes: "0.00",
          hash: hash,
          successUrl: successUrl || clientDomain,
          failUrl: failUrl || clientDomain,
          ipnUrl: `${origin}/api/yappy/v1/movement/history`
        })
      });
      const altOrderData = await altOrderRes.json();
      
      fs.writeFileSync('/tmp/yappy_log.json', JSON.stringify({
        wc_endpoint: orderData,
        standard_endpoint: altOrderData
      }, null, 2));
      
      // Also attach to the orderData to send it to the frontend
      orderData.diagnostic = altOrderData;
    } catch(err) {
      console.error("Diagnostic error:", err);
    }
    // END DIAGNOSTIC INJECTION

    if (!orderData.status || orderData.status.code !== 200) {
       return res.status(400).json({ 
         error: 'Yappy Order Creation Failed', 
         details: orderData 
       });
    }

    // 5. Return success to frontend with tokens required by btn-yappy component
    return res.status(200).json({
      success: true,
      body: {
        transactionId: orderData.body.transactionId,
        token: orderData.body.token,
        documentName: orderData.body.documentName,
        diagnostic: orderData.diagnostic || null
      }
    });

  } catch (error) {
    console.error('Yappy Checkout Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
