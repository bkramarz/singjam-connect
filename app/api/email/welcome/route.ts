import { NextResponse } from "next/server";
import { resend, FROM_ADDRESS } from "@/lib/resend";
import { welcomeEmailHtml } from "@/emails/welcome";

export async function POST(request: Request) {
  const { email, username } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: "Welcome to SingJam",
    html: welcomeEmailHtml({ username }),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
