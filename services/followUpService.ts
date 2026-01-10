import { Invoice, UserProfile, TimelineEvent, FollowUpProfile } from '../types';
import { sendEmail, generateDocumentHtml } from './resendService';
import { saveInvoiceToDb } from './neon';

const FOLLOW_UP_RULES: Record<Exclude<FollowUpProfile, 'OFF'>, number[]> = {
    PASSIVE: [7],
    NORMAL: [3, 7, 15],
    AGGRESSIVE: [1, 2, 4, 6, 8, 10, 15, 20, 25, 30]
};

/**
 * Processes invoices to identify if any follow-up reminders need to be sent.
 * @returns Number of reminders sent.
 */
export const processInvoicesFollowUp = async (
    invoices: Invoice[],
    currentUser: UserProfile,
    onUpdateInvoice?: (updated: Invoice) => void
): Promise<number> => {
    const profile = currentUser.followUpProfile || 'OFF';
    if (profile === 'OFF') return 0;

    const rules = FOLLOW_UP_RULES[profile as Exclude<FollowUpProfile, 'OFF'>];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let remindersSent = 0;

    for (const invoice of invoices) {
        // Only process sent or partially paid invoices that are NOT quotes or expenses
        if (invoice.type !== 'Invoice') continue;
        if (invoice.status !== 'Enviada' && invoice.status !== 'Abonada' && invoice.status !== 'Seguimiento') continue;
        if (!invoice.clientEmail) continue;

        const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : new Date(invoice.date);
        // If no due date, default to 30 days after creation if paymentTermsDays is not set
        if (!invoice.dueDate) {
            dueDate.setDate(dueDate.getDate() + (currentUser.paymentTermsDays || 30));
        }
        dueDate.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - dueDate.getTime();
        const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (daysOverdue <= 0) continue; // Not overdue yet

        // Find the largest rule that applies and hasn't been sent yet
        const applicableRule = [...rules].reverse().find(days => daysOverdue >= days);

        if (applicableRule) {
            // Check if this rule (day milestone) already has a reminder in the timeline
            const alreadySent = invoice.timeline?.some(event =>
                event.type === 'REMINDER' &&
                event.description?.includes(`${applicableRule} días`)
            );

            if (!alreadySent) {
                // Trigger reminder
                try {
                    const success = await sendReminderEmail(invoice, currentUser, applicableRule);
                    if (success) {
                        remindersSent++;
                        const reminderEvent: TimelineEvent = {
                            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                            type: 'REMINDER',
                            title: 'Recordatorio automático enviado',
                            description: `Recordatorio de pago enviado tras ${applicableRule} días de vencimiento.`,
                            timestamp: new Date().toISOString()
                        };

                        const updatedInvoice: Invoice = {
                            ...invoice,
                            timeline: [...(invoice.timeline || []), reminderEvent],
                            status: 'Seguimiento' // Update status to reflect follow-up
                        };

                        // Persist to DB
                        await saveInvoiceToDb({ ...updatedInvoice, userId: currentUser.id });

                        // Update UI if callback provided
                        if (onUpdateInvoice) {
                            onUpdateInvoice(updatedInvoice);
                        }
                    }
                } catch (error) {
                    console.error(`Failed to send reminder for invoice ${invoice.id}:`, error);
                }
            }
        }
    }

    return remindersSent;
};

const sendReminderEmail = async (invoice: Invoice, issuer: UserProfile, days: number): Promise<boolean> => {
    const docTypeName = 'Factura';
    const subject = `Recordatorio de Pago: ${docTypeName} #${invoice.id} - ${issuer.name}`;

    // Custom reminder message
    const reminderMessage = `
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      Esperamos que estés bien. Te escribimos para recordarte que la <strong>${docTypeName} #${invoice.id}</strong> 
      presenta un saldo pendiente de <strong>${invoice.currency} ${(invoice.total - (invoice.amountPaid || 0)).toFixed(2)}</strong>.
    </p>
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      Agradecemos de antemano tu gestión para realizar el pago correspondiente. 
      Si ya has realizado el abono o tienes alguna duda, por favor ignora este mensaje o contáctanos directamente.
    </p>
  `;

    // We can reuse generateDocumentHtml but customize the body or create a new one.
    // For simplicity and consistency, I'll use a modified version of the document HTML.
    const htmlContent = generateReminderHtml(invoice, issuer, reminderMessage);

    const result = await sendEmail({
        to: invoice.clientEmail!,
        cc: issuer.email,
        subject: subject,
        html: htmlContent,
        senderName: issuer.legalName || issuer.name,
    });

    return result.success;
};

const generateReminderHtml = (invoice: Invoice, issuer: UserProfile, message: string): string => {
    const color = issuer.branding?.primaryColor || '#1c2938';
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recordatorio de Pago</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width: 100%;">
        <tr>
            <td style="padding: 40px 0; text-align: center;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <tr>
                        <td style="background-color: ${color}; padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">
                                ${issuer.name}
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #64748b; font-size: 16px; margin-bottom: 24px;">
                                Hola <strong>${invoice.clientName}</strong>,
                            </p>
                            ${message}
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                                <tr>
                                    <td style="padding: 24px; text-align: center;">
                                        <p style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700; margin: 0 0 8px 0;">Saldo Pendiente</p>
                                        <p style="color: #1c2938; font-size: 32px; font-weight: 800; margin: 0;">
                                            ${invoice.currency} ${(invoice.total - (invoice.amountPaid || 0)).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            <p style="color: #94a3b8; font-size: 14px; margin-top: 32px; text-align: center;">
                                Si tienes alguna pregunta, no dudes en responder a este correo.
                            </p>
                        </td>
                    </tr>
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
