import { consumeAiCredit } from "@/lib/ai-usage";
import { getSessionUidFromCookies } from "@/lib/server/auth-route";

export const runtime = "nodejs";

/** Call immediately before starting a Vapi voice session (counts toward daily AI budget). */
export async function POST() {
  const uid = await getSessionUidFromCookies();
  if (!uid) {
    return Response.json({ success: false, message: "Sign in required." }, { status: 401 });
  }

  const credit = await consumeAiCredit(uid);
  if (!credit.ok) {
    return Response.json(
      { success: false, message: credit.message || "Usage limit reached." },
      { status: 429 }
    );
  }

  return Response.json({ success: true });
}
