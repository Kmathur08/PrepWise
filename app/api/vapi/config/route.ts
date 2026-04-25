import { getSessionUidFromCookies } from "@/lib/server/auth-route";

export const runtime = "nodejs";

/**
 * Returns Vapi public key + workflow id only for signed-in users.
 * Keys are not embedded in the client bundle (use VAPI_* env on server).
 */
export async function GET() {
  const uid = await getSessionUidFromCookies();
  if (!uid) {
    return Response.json({ success: false, message: "Sign in required." }, { status: 401 });
  }

  const publicKey =
    process.env.VAPI_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPI_API_KEY;
  const workflowId =
    process.env.VAPI_WORKFLOW_ID || process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID;

  if (!publicKey || !workflowId) {
    return Response.json(
      {
        success: false,
        message: "Vapi is not configured on the server.",
      },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    publicKey,
    workflowId,
  });
}
