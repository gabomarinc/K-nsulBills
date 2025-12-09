
import { Invoice, UserProfile } from '../types';

// Default sender. 
// IMPORTANT: In Resend Sandbox, this MUST be 'onboarding@resend.dev'.
// Once you verify your domain, change this to 'No Reply <facturas@tu-dominio.com>'
const DEFAULT_SENDER = 'FacturaZen <onboarding@resend.dev>';

interface Attachment {
  content: string; // Base64 string
  filename: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html?: string;
  templateId?: string;
  data?: any;
  senderName?: string;
  attachments?: Attachment[];
}

/**
 * Sends an email by calling the internal Vercel Serverless Function (/api/send).
 * Supports both raw HTML and Resend Template IDs.
 */
export const sendEmail = async (
  payload: EmailPayload
): Promise<{ success: boolean; id?: string; error?: string }> => {
  
  try {
    const body: any = {
      from: DEFAULT_SENDER, 
      to: [payload.to],
      subject: payload.subject,
    };

    // Use Template ID if provided, otherwise fallback to HTML
    if (payload.templateId) {
        body.template_id = payload.templateId;
        body.data = payload.data || {};
    } else {
        body.html = payload.html || '<p>No content</p>';
    }

    if (payload.attachments && payload.attachments.length > 0) {
      body.attachments = payload.attachments;
    }

    // Call our own internal API route (Serverless Function)
    const response = await fetch('/api/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      let errorMsg = data.error || 'Error al enviar email';
      if (data.details?.name === 'validation_error' && data.details?.message?.includes('domain')) {
        errorMsg = 'Modo Sandbox: Solo puedes enviar correos a tu propia dirección verificada o debes verificar tu dominio en Resend.';
      }
      return { success: false, error: errorMsg };
    }

    return { success: true, id: data.id };
  } catch (error) {
    console.error('Email Service Error:', error);
    return { success: false, error: 'Error de conexión con el servidor de envíos.' };
  }
};

/**
 * Sends the Welcome Email using a Template.
 * Configured Alias: 'welcome-to-konsul-bills'
 * Variables exposed to Template: {{name}}, {{login_url}}, {{email}}
 */
export const sendWelcomeEmail = async (user: UserProfile) => {
    // Priority: Env Var -> Hardcoded Alias requested by user
    const templateId = process.env.RESEND_WELCOME_ID || 'welcome-to-konsul-bills';
    const loginUrl = window.location.origin; // e.g. https://facturazen.vercel.app

    return sendEmail({
        to: user.email!,
        subject: 'Bienvenido a Kônsul 🚀',
        templateId: templateId,
        data: {
            name: user.name,
            login_url: loginUrl,
            email: user.email
        }
    });
};

/**
 * Helper: Send Document (Invoice/Quote)
 */
export const sendDocumentEmail = async (
    recipientEmail: string, 
    subject: string, 
    htmlContent: string, 
    issuerName: string,
    attachments?: Attachment[]
) => {
    return sendEmail({
        to: recipientEmail,
        subject: subject,
        html: htmlContent,
        senderName: issuerName,
        attachments: attachments
    });
};

/**
 * Generates an HTML Template for an Invoice or Quote.
 */
export const generateDocumentHtml = (invoice: Invoice, issuer: UserProfile): string => {
  const isQuote = invoice.type === 'Quote';
  const color = issuer.branding?.primaryColor || '#27bea5';
  
  const itemsHtml = invoice.items.map(item => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 12px 0; color: #1e293b;">${item.description}</td>
      <td style="padding: 12px 0; text-align: center; color: #64748b;">${item.quantity}</td>
      <td style="padding: 12px 0; text-align: right; color: #64748b;">$${item.price.toFixed(2)}</td>
      <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #1e293b;">$${(item.quantity * item.price).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: sans-serif; background-color: #f8fafc; margin: 0; padding: 40px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background-color: ${color}; padding: 40px; text-align: center; color: white; }
        .content { padding: 40px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .total { font-size: 24px; font-weight: bold; color: ${color}; text-align: right; margin-top: 20px; border-top: 2px solid #f1f5f9; padding-top: 20px; }
        .footer { text-align: center; padding: 20px; background-color: #f1f5f9; color: #94a3b8; font-size: 12px; }
        .btn { display: inline-block; background-color: ${color}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;">${isQuote ? 'Nueva Cotización' : 'Nueva Factura'}</h1>
          <p style="opacity:0.9;">${issuer.name}</p>
        </div>
        <div class="content">
          <p>Hola <strong>${invoice.clientName}</strong>,</p>
          <p>Te enviamos el documento <strong>#${invoice.id}</strong> emitido el ${new Date(invoice.date).toLocaleDateString()}.</p>
          
          <table class="table">
            <thead>
              <tr style="text-align: left; color: #94a3b8; font-size: 12px; text-transform: uppercase;">
                <th>Descripción</th>
                <th style="text-align: center;">Cant</th>
                <th style="text-align: right;">Precio</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total">
            Total: ${invoice.currency} ${invoice.total.toLocaleString()}
          </div>

          <div style="text-align: center;">
             <a href="#" class="btn">Ver Documento Online</a>
          </div>
        </div>
        <div class="footer">
          Enviado con Kônsul por ${issuer.name}
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generates a Welcome HTML Email (Legacy Fallback).
 */
export const generateWelcomeHtml = (userName: string, url: string): string => {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; background-color: #f8fafc; padding: 40px;">
      <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; text-align: center;">
        <h1 style="color: #1c2938;">Bienvenido a Kônsul 🚀</h1>
        <p style="color: #64748b; font-size: 16px; line-height: 1.5;">
          Hola <strong>${userName}</strong>, estamos felices de tenerte a bordo.
          <br/><br/>
          Tu oficina virtual está lista. Ahora puedes crear facturas ilimitadas, 
          gestionar clientes y visualizar tus finanzas como un experto.
        </p>
        <a href="${url}" style="display: inline-block; background-color: #27bea5; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; margin-top: 20px;">
          Ir a mi Dashboard
        </a>
      </div>
    </body>
    </html>
  `;
};
