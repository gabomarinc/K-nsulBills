import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const { emailConfig, ...resendBody } = body;

    // --- CUSTOM SMTP LOGIC ---
    if (emailConfig && emailConfig.provider === 'SMTP' && emailConfig.host && emailConfig.user && emailConfig.password) {
        try {
            const transporter = nodemailer.createTransport({
                host: emailConfig.host,
                port: emailConfig.port || 465,
                secure: emailConfig.port === 465, // true for 465, false for other ports
                auth: {
                    user: emailConfig.user,
                    pass: emailConfig.password
                }
            });

            const senderNameMatch = body.from ? body.from.match(/"?([^"<]+)"?\s*</) : null;
            const senderName = senderNameMatch ? senderNameMatch[1].trim() : 'Usuario';
            
            const mailOptions = {
                from: `"${senderName}" <${emailConfig.user}>`,
                to: body.to ? (Array.isArray(body.to) ? body.to.join(', ') : body.to) : '',
                cc: body.cc ? (Array.isArray(body.cc) ? body.cc.join(', ') : body.cc) : '',

                subject: body.subject,
                html: body.html,
                attachments: body.attachments ? body.attachments.map(att => ({
                    filename: att.filename,
                    content: att.content,
                    encoding: 'base64'
                })) : []
            };

            const info = await transporter.sendMail(mailOptions);
            return res.status(200).json({ success: true, id: info.messageId, method: 'smtp' });
        } catch (smtpError) {
            console.error('SMTP Error:', smtpError);
            return res.status(500).json({ error: 'Error enviando correo por SMTP. Revisa tus credenciales.', details: smtpError?.message });
        }
    }

    // --- FALLBACK: RESEND LOGIC ---
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing Resend API Key in server environment' });
    }

    // Call Resend API from the server side
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(resendBody), // Pass without emailConfig
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.message || 'Error sending email via Resend',
        details: data 
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Email Sending Error:', error);
    return res.status(500).json({ error: 'Internal Server Error sending email' });
  }
}
