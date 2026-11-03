import crypto from 'crypto';
import { config } from './config';

export interface LeadCreatedEventPayload {
  id: string;
  type: 'lead.created';
  createdAt: string;
  data: {
    leadId: string;
    status: string;
    email: string;
    firstName: string;
  };
}

export function signPayload(timestamp: number, rawBody: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${timestamp}.${rawBody}`);
  return `t=${timestamp},v1=${hmac.digest('hex')}`;
}

export async function sendLeadCreatedEvent(event: LeadCreatedEventPayload): Promise<boolean> {
  const rawBody = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(timestamp, rawBody, config.eventsSigningSecret);

  try {
    const response = await fetch(config.n8nLeadsEventsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tidewave-Event-Id': event.id,
        'X-Tidewave-Signature': signature,
      },
      body: rawBody,
    });

    if (!response.ok) {
      console.warn(`[Event] n8n webhook returned status ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    // We catch and log so an unreachable webhook doesn't crash the server process
    console.warn(`[Event] Could not deliver event ${event.id} to n8n webhook:`, (error as Error).message);
    return false;
  }
}
