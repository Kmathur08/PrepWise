import { db } from "@/firebase/admin";

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Optional per-user daily cap for AI-backed operations (resume parse, question gen, feedback).
 * Set AI_CREDITS_PER_USER_PER_DAY in Vercel env (e.g. "20"). Unset = no server-side cap.
 */
export async function consumeAiCredit(userId: string): Promise<{
  ok: boolean;
  message?: string;
}> {
  const raw = process.env.AI_CREDITS_PER_USER_PER_DAY;
  const limit = raw ? Number.parseInt(raw, 10) : NaN;
  if (!raw || Number.isNaN(limit) || limit <= 0) {
    return { ok: true };
  }

  const docId = `${userId}_${dayKey()}`;
  const ref = db.collection("aiUsage").doc(docId);

  try {
    let blocked = false;
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      const count = (snap.data()?.count as number | undefined) ?? 0;
      if (count >= limit) {
        blocked = true;
        return;
      }
      transaction.set(
        ref,
        {
          userId,
          day: dayKey(),
          count: count + 1,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    });
    if (blocked) {
      return {
        ok: false,
        message:
          "Daily AI usage limit reached. Try again tomorrow or contact the administrator.",
      };
    }
    return { ok: true };
  } catch (error) {
    console.error("consumeAiCredit:", error);
    return { ok: false, message: "Unable to verify usage limits. Please try again." };
  }
}
