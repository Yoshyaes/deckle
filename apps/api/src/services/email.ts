/**
 * Email service — thin wrapper over the Resend REST API.
 *
 * Uses `fetch` directly so we don't add a runtime dependency. If
 * RESEND_API_KEY is not set, all sends become no-ops and log a warning,
 * which keeps local dev and CI green without a mail provider.
 */

import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { users } from '../schema/db.js';
import { logger } from '../lib/logger.js';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /**
   * If supplied, sendEmail will look up this user's canonical
   * `users.email` from the DB and refuse to send if it doesn't match
   * `to`. Defends against an upstream impersonation bug accidentally
   * delivering email to the wrong inbox. audits/02-security.md P3.
   */
  userId?: string;
}

export interface SendEmailResult {
  id: string | null;
  skipped: boolean;
  error?: string;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    logger.warn(
      { to: input.to, subject: input.subject },
      'Email skipped — RESEND_API_KEY or EMAIL_FROM not configured',
    );
    return { id: null, skipped: true };
  }

  // When a userId is provided, verify the destination email against
  // the canonical user record. A mismatch indicates an upstream bug
  // (or impersonation) and we refuse to send rather than ship the
  // message to the wrong inbox.
  if (input.userId) {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    if (!user) {
      logger.error(
        { userId: input.userId, to: input.to, subject: input.subject },
        'Email refused: userId does not match any user',
      );
      return { id: null, skipped: false, error: 'recipient-userid-not-found' };
    }
    if (user.email.toLowerCase() !== input.to.toLowerCase()) {
      logger.error(
        {
          userId: input.userId,
          requested: input.to,
          canonical: user.email,
          subject: input.subject,
        },
        'Email refused: requested recipient does not match canonical user.email',
      );
      return { id: null, skipped: false, error: 'recipient-mismatch' };
    }
  }

  const body = {
    from,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text ?? stripHtml(input.html),
    ...(input.replyTo ? { reply_to: input.replyTo } : {}),
  };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (!res.ok) {
      const err = data.message || data.name || `HTTP ${res.status}`;
      logger.error({ err, to: input.to, subject: input.subject }, 'Email send failed');
      return { id: null, skipped: false, error: err };
    }

    logger.info(
      { id: data.id, to: input.to, subject: input.subject },
      'Email sent',
    );
    return { id: data.id ?? null, skipped: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg, to: input.to }, 'Email send threw');
    return { id: null, skipped: false, error: msg };
  }
}
