"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { assertCallCredit, getVapiForInterview } from "@/lib/vapi-client";
import { createFeedback } from "@/lib/actions/general.action";

import type Vapi from "@vapi-ai/web";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  questions,
}: AgentProps) => {
  const router = useRouter();
  const vapiRef = useRef<Vapi | null>(null);
  const workflowIdRef = useRef<string | null>(null);

  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [callError, setCallError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const onCallStart = () => {
      setCallStatus(CallStatus.ACTIVE);
    };

    const onCallEnd = () => {
      setCallStatus(CallStatus.FINISHED);
    };

    const onMessage = (message: Message) => {
      if (message.type === "transcript") {
        const newMessage = {
          role: message.role,
          content: message.transcript,
        };
        setMessages((prev) => [...prev, newMessage]);
      }
    };

    const onSpeechStart = () => {
      setIsSpeaking(true);
    };

    const onSpeechEnd = () => {
      setIsSpeaking(false);
    };

    const onError = (error: Error) => {
      console.error("Vapi error:", error);
    };

    (async () => {
      try {
        const { vapi, workflowId } = await getVapiForInterview();
        if (cancelled) return;
        vapiRef.current = vapi;
        workflowIdRef.current = workflowId;

        vapi.on("call-start", onCallStart);
        vapi.on("call-end", onCallEnd);
        vapi.on("message", onMessage);
        vapi.on("speech-start", onSpeechStart);
        vapi.on("speech-end", onSpeechEnd);
        vapi.on("error", onError);

        setVoiceReady(true);
        setVoiceError("");
      } catch (error) {
        if (!cancelled) {
          setVoiceError(
            error instanceof Error
              ? error.message
              : "Voice interview could not be loaded. Sign in and refresh."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      const vapi = vapiRef.current;
      if (vapi) {
        vapi.off("call-start", onCallStart);
        vapi.off("call-end", onCallEnd);
        vapi.off("message", onMessage);
        vapi.off("speech-start", onSpeechStart);
        vapi.off("speech-end", onSpeechEnd);
        vapi.off("error", onError);
      }
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }
  }, [messages]);

  useEffect(() => {
    const handleGenerateFeedback = async () => {
      if (!interviewId || !userId) return;
      const { success, feedbackId: id } = await createFeedback({
        interviewId,
        userId,
        transcript: messages,
        feedbackId,
      });

      if (success && id) {
        router.push(`/interview/${interviewId}/feedback`);
      }
    };

    if (callStatus === CallStatus.FINISHED && messages.length > 0) {
      const timer = setTimeout(() => {
        handleGenerateFeedback();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [callStatus, feedbackId, interviewId, messages, router, userId]);

  const handleCall = async () => {
    setCallError("");
    setCallStatus(CallStatus.CONNECTING);

    try {
      await assertCallCredit();

      let vapi = vapiRef.current;
      let workflowId = workflowIdRef.current;
      if (!vapi || !workflowId) {
        const loaded = await getVapiForInterview();
        vapi = loaded.vapi;
        workflowId = loaded.workflowId;
        vapiRef.current = vapi;
        workflowIdRef.current = workflowId;
      }

      let formattedQuestions = "";
      if (questions) {
        formattedQuestions = questions.map((q) => `- ${q}`).join("\n");
      }

      await vapi.start(workflowId, {
        variableValues: {
          questions: formattedQuestions,
          username: userName,
          userid: userId,
        },
      });
    } catch (error) {
      setCallStatus(CallStatus.INACTIVE);
      setCallError(
        error instanceof Error ? error.message : "Could not start the call."
      );
    }
  };

  const handleDisconnect = () => {
    if (callStatus === CallStatus.ACTIVE) {
      vapiRef.current?.stop();
    }
  };

  const canClickCall =
    voiceReady && !voiceError && callStatus !== CallStatus.CONNECTING;

  return (
    <>
      <div className="call-view">
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="profile-image"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.png"
              alt="profile-image"
              width={539}
              height={539}
              className="rounded-full object-cover size-[120px]"
            />
            <h3>{userName}</h3>
          </div>
        </div>
      </div>

      {voiceError ? (
        <p className="text-sm text-red-300 text-center max-w-lg">{voiceError}</p>
      ) : null}
      {callError ? (
        <p className="text-sm text-red-300 text-center max-w-lg">{callError}</p>
      ) : null}

      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p
              key={lastMessage}
              className={cn(
                "transition-opacity duration-500 opacity-0",
                "animate-fadeIn opacity-100"
              )}
            >
              {lastMessage}
            </p>
          </div>
        </div>
      )}

      <div className="w-full flex justify-center">
        {callStatus !== "ACTIVE" ? (
          <button
            className="relative btn-call"
            disabled={!canClickCall}
            onClick={() => handleCall()}
          >
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                callStatus !== "CONNECTING" && "hidden"
              )}
            />

            <span className="relative">
              {!voiceReady && !voiceError
                ? "Loading..."
                : callStatus === "INACTIVE" || callStatus === "FINISHED"
                  ? "Call"
                  : ". . ."}
            </span>
          </button>
        ) : (
          <button className="btn-disconnect" onClick={() => handleDisconnect()}>
            End
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;
