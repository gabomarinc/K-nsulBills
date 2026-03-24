
import { Invoice, UserProfile } from '../types';

// Strict System Sender Logic
// Returns a sender string: "Sender Name <system_email>"
// The email part MUST match the domain verified in Resend (via ENV VAR)
const getSender = (name: string = 'Kônsul Bills') => {
  const verifiedEmail = process.env.RESEND_FROM_EMAIL;

  if (verifiedEmail) {
    return `${name} <${verifiedEmail}>`;
  }

  console.warn("⚠️ RESEND_FROM_EMAIL no está configurado en .env. Usando modo Sandbox (onboarding@resend.dev).");
  return `${name} <onboarding@resend.dev>`;
};

interface Attachment {
  content: string; // Base64 string
  filename: string;
}

interface EmailPayload {
  to: string;
  cc?: string; // Added CC support
  subject: string;
  html?: string;
  templateId?: string;
  data?: any;
  senderName?: string;
  attachments?: Attachment[];
  emailConfig?: any; // To pass custom SMTP settings to backend
}

/**
 * Sends an email by calling the internal Vercel Serverless Function (/api/send).
 */
export const sendEmail = async (
  payload: EmailPayload
): Promise<{ success: boolean; id?: string; error?: string }> => {

  try {
    // 1. Construct Sender: Uses User's Name + System Verified Email
    const sender = getSender(payload.senderName || 'Kônsul Bills');

    const body: any = {
      from: sender,
      to: [payload.to],
      subject: payload.subject,
    };

    // Add CC if present
    if (payload.cc) {
      body.cc = [payload.cc];
    }

    // Priority to HTML content to ensure delivery, BUT if templateId is present and no HTML, use template
    if (payload.html) {
      body.html = payload.html;
    } else if (payload.templateId) {
      // Fallback for systems that support template_id strictly
      body.template_id = payload.templateId;
      body.data = payload.data || {};
    } else {
      body.html = '<p>No content provided</p>';
    }

    if (payload.attachments && payload.attachments.length > 0) {
      body.attachments = payload.attachments;
    }

    if (payload.emailConfig) {
      body.emailConfig = payload.emailConfig;
    }

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
        errorMsg = `Error de Dominio: Estás intentando enviar desde "${sender}". Asegúrate de que RESEND_FROM_EMAIL en tu archivo .env coincida con el dominio verificado en Resend.`;
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
 * Checks the status of a sent email (delivered, opened, clicked)
 */
export const getEmailStatus = async (id: string): Promise<any> => {
  try {
    const response = await fetch(`/api/status?id=${id}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error("Error fetching email status", e);
    return null;
  }
};

/**
 * Sends the Welcome Email using the 'welcome-to-konsul-bills' template.
 */
export const sendWelcomeEmail = async (user: UserProfile) => {
  const loginUrl = window.location.origin;

  // NOTE: HTML property is omitted to force usage of templateId in sendEmail logic
  return sendEmail({
    to: user.email!,
    subject: 'Bienvenido a Kônsul 🚀', // This might be overridden by the template settings in Resend
    templateId: 'welcome-to-konsul-bills',
    senderName: 'Equipo Kônsul',
    data: {
      name: user.name,
      login_url: loginUrl,
      email: user.email
    }
  });
};

/**
 * Sends a Password Recovery Email with a temporary password.
 */
export const sendPasswordRecoveryEmail = async (email: string, temporaryPassword: string) => {
  return sendEmail({
    to: email,
    subject: 'Recupera tu acceso a Kônsul 🔐',
    senderName: 'Seguridad Kônsul',
    html: `
            <!DOCTYPE html>
            <html>
            <body style="font-family: sans-serif; background-color: #f8fafc; padding: 40px;">
              <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; text-align: center; border: 1px solid #e2e8f0;">
                <div style="background-color: #f1f5f9; width: 64px; height: 64px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
                    <span style="font-size: 32px;">🔐</span>
                </div>
                <h1 style="color: #1c2938; margin-bottom: 8px;">Restablecer Contraseña</h1>
                <p style="color: #64748b; font-size: 16px; line-height: 1.5; margin-bottom: 32px;">
                  Hemos recibido una solicitud para restablecer tu contraseña. Utiliza la siguiente clave temporal para ingresar a tu cuenta:
                </p>
                
                <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; padding: 16px; border-radius: 12px; margin-bottom: 32px;">
                    <span style="font-family: monospace; font-size: 24px; font-weight: bold; color: #1c2938; letter-spacing: 2px;">
                        ${temporaryPassword}
                    </span>
                </div>

                <p style="color: #94a3b8; font-size: 13px; margin-bottom: 32px;">
                    Por seguridad, una vez que ingreses, te recomendamos cambiar esta contraseña desde los ajustes de tu perfil.
                </p>

                <a href="${window.location.origin}" style="display: inline-block; background-color: #1c2938; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold;">
                  Ir al Login
                </a>
              </div>
            </body>
            </html>
        `
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
  attachments?: Attachment[],
  ccEmail?: string,
  emailConfig?: any
) => {
  return sendEmail({
    to: recipientEmail,
    cc: ccEmail,
    subject: subject,
    html: htmlContent,
    senderName: issuerName,
    attachments: attachments,
    emailConfig: emailConfig
  });
};

/**
 * Generates the Professional HTML Template for Invoice/Quote.
 */
export const generateDocumentHtml = (invoice: Invoice, issuer: UserProfile, paymentUrl?: string, yappyUrl?: string): string => {
  const isQuote = invoice.type === 'Quote';
  const docTypeLabel = isQuote ? 'Cotización' : 'Factura';
  const color = issuer.branding?.primaryColor || '#1c2938';

  const stripeButton = paymentUrl ? `
    <a href="${paymentUrl}" style="background-color: ${color}; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block; margin: 8px;">
        💳 Pagar con Tarjeta (Stripe)
    </a>` : '';

  const yappyButton = yappyUrl ? `
    <a href="${yappyUrl}" style="background-color: #f97316; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block; margin: 8px;">
        📱 Pagar con Yappy
    </a>` : '';

  const paymentButtons = (stripeButton || yappyButton) ? `
    <!-- BOTONES DE PAGO -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px;">
        <tr>
            <td align="center" style="padding-bottom: 8px;">
                ${stripeButton}
                ${yappyButton}
            </td>
        </tr>
    </table>
    <p style="color: #94a3b8; font-size: 12px; margin-top: 12px; text-align: center;">Links de pago seguros</p>
  ` : '';


  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nuevo Documento</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width: 100%;">
        <tr>
            <td style="padding: 40px 0; text-align: center;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    
                    <!-- ENCABEZADO -->
                    <tr>
                        <td style="background-color: ${color}; padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">
                                ${issuer.name}
                            </h1>
                        </td>
                    </tr>

                    <!-- CUERPO -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #64748b; font-size: 16px; margin-bottom: 24px;">
                                Hola <strong>${invoice.clientName}</strong>,
                            </p>
                            <p style="color: #334155; font-size: 18px; line-height: 1.6; margin-bottom: 32px;">
                                Te enviamos la <strong>${docTypeLabel} #${invoice.id}</strong>.
                                <br>
                                Encontrarás el documento PDF adjunto a este correo para tu revisión.
                            </p>

                            <!-- TARJETA DE RESUMEN -->
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                                <tr>
                                    <td style="padding: 24px; text-align: center;">
                                        <p style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700; margin: 0 0 8px 0;">Total a Pagar</p>
                                        <p style="color: #1c2938; font-size: 32px; font-weight: 800; margin: 0;">
                                            ${invoice.currency} ${invoice.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            ${paymentButtons}

                            <p style="color: #94a3b8; font-size: 14px; margin-top: 32px; text-align: center;">
                                Si tienes alguna pregunta, no dudes en responder a este correo.
                            </p>
                        </td>
                    </tr>

                    <!-- PIE DE PAGINA -->
                    <tr>
                        <td style="background-color: #f1f5f9; padding: 24px; text-align: center;">
                            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                                Enviado a través de Kônsul por ${issuer.name}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
  `;
};

/**
 * Generates a Welcome HTML Email (Deprecated in favor of Template)
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
