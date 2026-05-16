import { type NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/operacao/handoff/export", request.url), 307);
}
