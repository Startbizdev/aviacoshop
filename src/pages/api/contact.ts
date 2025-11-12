import { type APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, phone, subject, message } = body;
    
    // Validation
    if (!name || !email || !subject || !message) {
      return new Response(JSON.stringify({ 
        error: 'Tous les champs obligatoires doivent être remplis.' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ 
        error: 'Format d\'email invalide.' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Prepare email content
    const emailSubject = `Contact Form: ${subject}`;
    const emailBody = `
Nouveau message depuis le formulaire de contact

Nom: ${name}
Email: ${email}
Téléphone: ${phone || 'Non fourni'}
Sujet: ${subject}

Message:
${message}

---
Ce message a été envoyé depuis le formulaire de contact du site Aviaco Shop.
    `.trim();
    
    // Send email using a simple SMTP service or email API
    // For production, you should use a proper email service like:
    // - Resend (resend.com)
    // - SendGrid (sendgrid.com)
    // - AWS SES
    // - Nodemailer with SMTP
    
    // For now, we'll use a simple fetch to a mail service
    // You can replace this with your preferred email service
    const emailResponse = await sendEmail({
      to: 'rfq@aviaco.fr',
      from: 'noreply@aviaco.fr', // Change this to your verified sender email
      subject: emailSubject,
      text: emailBody,
      replyTo: email,
    });
    
    if (!emailResponse.success) {
      throw new Error('Failed to send email');
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Votre message a été envoyé avec succès.' 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('Contact form error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Une erreur est survenue lors de l\'envoi du message. Veuillez réessayer plus tard.' 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

// Email sending function
async function sendEmail({
  to,
  from,
  subject,
  text,
  replyTo,
}: {
  to: string;
  from: string;
  subject: string;
  text: string;
  replyTo: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Option 1: Using Resend (recommended - simple and modern)
    // Install: npm install resend
    // Get API key from: https://resend.com/api-keys
    // Add to .env: RESEND_API_KEY=re_xxxxx
    const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
    
    if (RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(RESEND_API_KEY);
        
        const { data, error } = await resend.emails.send({
          from: from,
          to: to,
          subject: subject,
          text: text,
          reply_to: replyTo,
        });
        
        if (error) {
          console.error('Resend error:', error);
          return { success: false, error: error.message };
        }
        
        return { success: true };
      } catch (resendError: any) {
        console.error('Resend import/send error:', resendError);
        // Fall through to alternative methods
      }
    }
    
    // Option 2: Using SendGrid
    // Install: npm install @sendgrid/mail
    // Get API key from: https://app.sendgrid.com/settings/api_keys
    // Add to .env: SENDGRID_API_KEY=SG.xxxxx
    const SENDGRID_API_KEY = import.meta.env.SENDGRID_API_KEY;
    
    if (SENDGRID_API_KEY) {
      try {
        const sgMail = await import('@sendgrid/mail');
        sgMail.setApiKey(SENDGRID_API_KEY);
        
        await sgMail.send({
          to: to,
          from: from,
          subject: subject,
          text: text,
          replyTo: replyTo,
        });
        
        return { success: true };
      } catch (sgError: any) {
        console.error('SendGrid error:', sgError);
        // Fall through to alternative methods
      }
    }
    
    // Option 3: Using Web3Forms (free, no API key needed)
    // Documentation: https://web3forms.com/
    const WEB3FORMS_ACCESS_KEY = import.meta.env.WEB3FORMS_ACCESS_KEY;
    
    if (WEB3FORMS_ACCESS_KEY) {
      try {
        const response = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_key: WEB3FORMS_ACCESS_KEY,
            subject: subject,
            from_name: replyTo.split('@')[0],
            from_email: replyTo,
            to_email: to,
            message: text,
          }),
        });
        
        const result = await response.json();
        
        if (result.success) {
          return { success: true };
        } else {
          return { success: false, error: result.message || 'Failed to send email' };
        }
      } catch (web3Error: any) {
        console.error('Web3Forms error:', web3Error);
        // Fall through to logging
      }
    }
    
    // Fallback: Log email for development/testing
    // In production, you should always have one of the above services configured
    console.log('=== EMAIL TO SEND (Development Mode) ===');
    console.log('To:', to);
    console.log('From:', from);
    console.log('Subject:', subject);
    console.log('Reply-To:', replyTo);
    console.log('Body:', text);
    console.log('========================================');
    console.log('⚠️  No email service configured. Please set up one of:');
    console.log('   - RESEND_API_KEY (recommended)');
    console.log('   - SENDGRID_API_KEY');
    console.log('   - WEB3FORMS_ACCESS_KEY');
    console.log('========================================');
    
    // For development, return success so the form works
    // In production, this should return an error if no service is configured
    const isDevelopment = import.meta.env.DEV;
    if (isDevelopment) {
      return { success: true };
    } else {
      return { success: false, error: 'Email service not configured' };
    }
  } catch (error: any) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
}

