import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRealtimeWebSocketUrl } from "@/lib/realtime";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Azure OpenAI API key not configured" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    token: apiKey,
    url: getRealtimeWebSocketUrl(),
  });
}
