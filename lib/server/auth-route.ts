import { cookies } from "next/headers";

import { auth } from "@/firebase/admin";

/** Returns Firebase uid if the request has a valid session cookie, else null. */
export async function getSessionUidFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    return decoded.uid;
  } catch {
    return null;
  }
}
