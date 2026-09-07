import { Resend } from "resend";

const client = new Resend(process.env.RESEND_API_KEY);

export const FROM_ADDRESS = "SingJam <hello@singjam.org>";

// Replies go to a monitored inbox, not to the sending address. hello@ is a
// send-only identity, and someone answering a ticket confirmation or a jam
// invite is almost always asking the events team something.
export const REPLY_TO = "events@singjam.org";

// Applied to the client rather than at each call site: fourteen files send mail
// and the next one written would have forgotten. Wrapping in place (instead of
// exporting a plain object) keeps this a real Resend, which several helpers take
// as a parameter type. Anything a caller passes still wins, so a one-off can
// override the reply address.
const sendEmail = client.emails.send.bind(client.emails);
client.emails.send = ((payload: any, options?: any) =>
  sendEmail({ replyTo: REPLY_TO, ...payload }, options)) as typeof client.emails.send;

const sendBatch = client.batch.send.bind(client.batch);
client.batch.send = ((payloads: any, options?: any) =>
  sendBatch(
    Array.isArray(payloads) ? payloads.map((p: any) => ({ replyTo: REPLY_TO, ...p })) : payloads,
    options,
  )) as typeof client.batch.send;

export const resend = client;
