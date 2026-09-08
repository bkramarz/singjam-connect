export type FailedTicketDelivery = {
  orderId: string;
  jamName: string;
  jamUrl: string;
  buyerEmail: string | null;
  amountLabel: string;
  paidLabel: string;
  reason: string;
};

// Internal alarm, not a buyer-facing email: the plainest possible layout, with
// everything a human needs to send the ticket by hand in the body rather than
// behind a link. Same shape as the Spotify token alert.
export function ticketDeliveryFailedEmailHtml(failures: FailedTicketDelivery[]) {
  const rows = failures
    .map(
      (f) => `
  <div style="border:1px solid #e4e4e7;border-radius:8px;padding:16px;margin-bottom:12px">
    <p style="font-size:15px;font-weight:600;margin:0 0 8px">${f.jamName} · ${f.amountLabel}</p>
    <p style="font-size:14px;line-height:1.6;color:#52525b;margin:0">
      Buyer: ${f.buyerEmail ?? "<em>no address on the order</em>"}<br />
      Paid: ${f.paidLabel}<br />
      Order: <code>${f.orderId}</code><br />
      Error: ${f.reason}
    </p>
    <p style="font-size:14px;margin:8px 0 0"><a href="${f.jamUrl}/tickets/manage" style="color:#4338ca">Guest list and door codes</a></p>
  </div>`,
    )
    .join("");

  const count = failures.length;
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Action required: ${count} paid ticket${count === 1 ? "" : "s"} not delivered</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    ${count === 1 ? "This order was" : "These orders were"} charged successfully, but the
    confirmation email has failed every attempt since. For a guest with no account
    that email is their only copy of the ticket, so send it by hand from the guest
    list below and check the address on the order.
  </p>
  ${rows}
  <p style="font-size:14px;line-height:1.6;color:#52525b">
    Retries continue every ten minutes. This alert repeats only for orders it has
    not already named.
  </p>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Music. Community. Love.</p>
</body>
</html>`;
}
