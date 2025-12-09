
import { Invoice, UserProfile } from '../types';

const RESEND_API_URL = 'https://api.resend.com/emails';

// Default sender. In production with a verified domain, change this to 'No Reply <noreply@yourdomain.com>'
const DEFAULT_SENDER = 'FacturaZen <onboarding@resend.dev>';

interface Attachment {
  content: string; // Base64 string
  filename: string;
}

/**
 * Sends an email using the Resend API via System Environment Variable.
 */
export const sendEmail = async (
  to: string,
  subject: string,
  htmlContent: string,
  senderName: string = 'FacturaZen',
  attachments?: Attachment[]
): Promise<{ success: boolean; id?: string; error?: string }> => {
  
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error("Resend API Key missing in environment variables.");
    return { success: false, error: 'Error del servidor: Configuración de email no disponible.' };
  }

  try {
    const body: any = {
      from: DEFAULT_SENDER, 
      to: [to],
      subject: subject,
      html: htmlContent,
    };

    if (attachments && attachments.length > 0) {
      body.attachments = attachments;
    }

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Error al enviar email' };
    }

    return { success: true, id: data.id };
  } catch (error) {
    console.error('Resend Error:', error);
    return { success: false, error: 'Error de conexión con servicio de email' };
  }
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
 * Generates a Welcome HTML Email.
 */
export const generateWelcomeHtml = (userName: string): string => {
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
        <a href="#" style="display: inline-block; background-color: #27bea5; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; margin-top: 20px;">
          Ir a mi Dashboard
        </a>
      </div>
    </body>
    </html>
  `;
};
