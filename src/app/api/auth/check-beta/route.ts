import { isBetaUser } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email : "";

    if (!email) {
      return NextResponse.json({ approved: false, error: "Missing email" }, { status: 400 });
    }

    const approved = await isBetaUser(email);
    return NextResponse.json({ approved });
  } catch (error) {
    console.error("[check-beta] Error:", error);
    return NextResponse.json({ approved: false, error: "Internal error" }, { status: 500 });
  }
}
