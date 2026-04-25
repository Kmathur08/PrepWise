"use client";

import Vapi from "@vapi-ai/web";

let vapiSingleton: Vapi | null = null;
let lastPublicKey: string | null = null;

export async function getVapiForInterview(): Promise<{
  vapi: Vapi;
  workflowId: string;
}> {
  const res = await fetch("/api/vapi/config", { credentials: "same-origin" });
  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "Could not load voice interview. Sign in and try again.");
  }

  const { publicKey, workflowId } = data as {
    publicKey: string;
    workflowId: string;
  };

  if (!vapiSingleton || lastPublicKey !== publicKey) {
    vapiSingleton = new Vapi(publicKey);
    lastPublicKey = publicKey;
  }

  return { vapi: vapiSingleton, workflowId };
}

export async function assertCallCredit(): Promise<void> {
  const res = await fetch("/api/vapi/consume-call-credit", {
    method: "POST",
    credentials: "same-origin",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Cannot start call (usage limit or server error).");
  }
}
