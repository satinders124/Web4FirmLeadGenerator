import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SENDER_EMAIL;

  if (!apiKey || !from) {
    return NextResponse.json(
      { error: "Email sending is not configured yet. Add RESEND_API_KEY and SENDER_EMAIL in Vercel environment variables." },
      { status: 503 }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid email request." }, { status: 400 });
  }

  const to = String(payload.to || "").trim();
  const subject = String(payload.subject || "").trim();
  const html = String(payload.html || "").trim();

  if (!to || !subject || !html) {
    return NextResponse.json({ error: "Recipient, subject and message are required." }, { status: 400 });
  }

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    const result = await resendResponse.json();

    if (!resendResponse.ok) {
      return NextResponse.json({ error: result?.message || "Email provider rejected this request." }, { status: resendResponse.status });
    }

    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    console.error("Email send failed", error);
    return NextResponse.json({ error: "Unable to contact the email provider." }, { status: 500 });
  }
}
