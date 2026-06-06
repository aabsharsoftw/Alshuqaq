import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface ListingSummary {
  listingNumber: number;
  title: string;
  location: string;
  rent: number;
}

/**
 * Thin wrapper around Resend. All sends are best-effort: failures are logged
 * but never thrown, so a mail outage cannot break the core API request.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly from: string;
  private readonly adminEmail: string;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('resend.apiKey'));
    this.from = this.config.get<string>('resend.from') as string;
    this.adminEmail = this.config.get<string>('admin.notifyEmail') as string;
  }

  private async send(to: string, subject: string, html: string) {
    try {
      await this.resend.emails.send({ from: this.from, to, subject, html });
      this.logger.log(`Email sent to ${to}: "${subject}"`);
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${to}: "${subject}"`,
        err as Error,
      );
    }
  }

  sendTenantWelcome(email: string, name: string) {
    return this.send(
      email,
      'Welcome to Rental App',
      `<p>Hi ${name},</p>
       <p>Welcome to Rental App! You can now browse approved apartment listings
       and contact us about any property you like.</p>
       <p>Happy house hunting,<br/>The Rental App Team</p>`,
    );
  }

  sendEnquiryConfirmation(
    email: string,
    name: string,
    listing: ListingSummary,
  ) {
    return this.send(
      email,
      `We received your enquiry about listing #${listing.listingNumber}`,
      `<p>Hi ${name},</p>
       <p>Thanks for reaching out about <strong>${listing.title}</strong>
       (listing #${listing.listingNumber}, ${listing.location}).</p>
       <p>Our team will contact you shortly. Please quote
       <strong>#${listing.listingNumber}</strong> in any follow-up.</p>
       <p>The Rental App Team</p>`,
    );
  }

  sendAdminNewEnquiry(params: {
    name: string;
    phone: string;
    email?: string | null;
    message: string;
    listing: ListingSummary;
  }) {
    const { name, phone, email, message, listing } = params;
    return this.send(
      this.adminEmail,
      `New enquiry for listing #${listing.listingNumber}`,
      `<p>New enquiry received.</p>
       <ul>
         <li><strong>Listing:</strong> #${listing.listingNumber} — ${listing.title} (${listing.location})</li>
         <li><strong>Name:</strong> ${name}</li>
         <li><strong>Phone:</strong> ${phone}</li>
         <li><strong>Email:</strong> ${email ?? '—'}</li>
       </ul>
       <p><strong>Message:</strong></p>
       <p>${message}</p>`,
    );
  }

  sendAdminNewListing(landlordEmail: string, listing: ListingSummary) {
    return this.send(
      this.adminEmail,
      `New listing pending approval: #${listing.listingNumber}`,
      `<p>A landlord submitted a new listing that needs approval.</p>
       <ul>
         <li><strong>Listing:</strong> #${listing.listingNumber} — ${listing.title}</li>
         <li><strong>Location:</strong> ${listing.location}</li>
         <li><strong>Rent:</strong> ${listing.rent}</li>
         <li><strong>Landlord:</strong> ${landlordEmail}</li>
       </ul>
       <p>Review it in the admin dashboard.</p>`,
    );
  }

  sendLandlordDecision(
    email: string,
    listing: ListingSummary,
    approved: boolean,
    reason?: string,
  ) {
    const status = approved ? 'approved' : 'rejected';
    return this.send(
      email,
      `Your listing #${listing.listingNumber} was ${status}`,
      `<p>Hi,</p>
       <p>Your listing <strong>${listing.title}</strong>
       (#${listing.listingNumber}) has been <strong>${status}</strong>.</p>
       ${
         !approved && reason
           ? `<p><strong>Reason:</strong> ${reason}</p>`
           : ''
       }
       ${
         approved
           ? '<p>It is now live and visible to tenants.</p>'
           : '<p>You can edit and resubmit the listing.</p>'
       }
       <p>The Rental App Team</p>`,
    );
  }
}
