import { NextResponse } from "next/server";
import { getCurrentUserAndRole } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getCurrentUserAndRole();
  if (!auth.configured) return NextResponse.json({ configured: false, user: null, role: null });
  if (!auth.user) return NextResponse.json({ configured: true, user: null, role: null }, { status: 401 });
  return NextResponse.json({ configured: true, user: { id: auth.user.id, email: auth.user.email }, role: auth.role });
}
