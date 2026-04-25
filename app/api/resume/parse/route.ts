import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { consumeAiCredit } from "@/lib/ai-usage";
import { getSessionUidFromCookies } from "@/lib/server/auth-route";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function normalizeExtractedText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function hasMeaningfulText(text: string) {
  if (!text) return false;
  const normalized = normalizeExtractedText(text);
  if (!normalized) return false;

  // Prefer content with a reasonable amount of letters/numbers.
  const signal = normalized.replace(/[^a-zA-Z0-9]/g, "");
  return signal.length >= 80;
}

async function extractPdfTextLocally(buffer: Buffer): Promise<string> {
  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    return (parsed.text || "").trim();
  } catch (error) {
    // Local extraction can fail for scanned or heavily compressed PDFs.
    console.warn("Local PDF extract warning:", error);
    return "";
  } finally {
    await parser?.destroy();
  }
}

async function extractPdfTextWithGemini(buffer: Buffer): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "application/pdf",
        data: buffer.toString("base64"),
      },
    },
    {
      text: `Extract all readable plain text from this PDF (resume/CV).
Rules:
- Output only the document text, no preamble or commentary.
- Preserve approximate structure using line breaks where natural.
- If the PDF is image-only or unreadable, respond with exactly: NO_TEXT_EXTRACTED`,
    },
  ]);

  const text = result.response.text().trim();
  if (text === "NO_TEXT_EXTRACTED" || !text) {
    return "";
  }
  return text;
}

export async function POST(request: Request) {
  try {
    const uid = await getSessionUidFromCookies();
    if (!uid) {
      return Response.json(
        { success: false, message: "Sign in required to upload a resume." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("resume");

    if (!file || !(file instanceof File)) {
      return Response.json(
        { success: false, message: "Resume file is required." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        {
          success: false,
          message: "File too large. Please upload a file under 5MB.",
        },
        { status: 400 }
      );
    }

    const filename = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let text = "";

    if (mimeType.includes("pdf") || filename.endsWith(".pdf")) {
      const localText = await extractPdfTextLocally(buffer);
      text = localText;

      // If local text is missing or low quality, try Gemini OCR extraction.
      const shouldTryGemini = !hasMeaningfulText(localText);
      if (shouldTryGemini) {
        const credit = await consumeAiCredit(uid);
        if (!credit.ok && !localText.trim()) {
          return Response.json(
            { success: false, message: credit.message || "Usage limit reached." },
            { status: 429 }
          );
        }

        try {
          const geminiText = await extractPdfTextWithGemini(buffer);
          if (hasMeaningfulText(geminiText)) {
            text = geminiText;
          }
        } catch (error) {
          console.warn("Gemini PDF extract warning:", error);

          // If local parser extracted anything usable, continue with it.
          if (!localText.trim()) {
            return Response.json(
              {
                success: false,
                message: process.env.GOOGLE_GENERATIVE_AI_API_KEY
                  ? "Could not read this PDF. Try DOCX, paste text instead, or use a text-based PDF export."
                  : "Could not read this PDF locally, and Gemini fallback is not configured. Add GOOGLE_GENERATIVE_AI_API_KEY or upload DOCX.",
              },
              { status: 400 }
            );
          }
        }
      }
    } else if (
      mimeType.includes("wordprocessingml.document") ||
      filename.endsWith(".docx")
    ) {
      const parsed = await mammoth.extractRawText({ buffer });
      text = parsed.value || "";
    } else {
      return Response.json(
        {
          success: false,
          message: "Unsupported file type. Please upload PDF or DOCX.",
        },
        { status: 400 }
      );
    }

    const normalizedText = normalizeExtractedText(text);
    if (!normalizedText) {
      return Response.json(
        {
          success: false,
          message:
            "Unable to extract text from this file. Paste your resume text manually or try another format.",
        },
        { status: 400 }
      );
    }

    return Response.json(
      { success: true, text: normalizedText.slice(0, 15000) },
      { status: 200 }
    );
  } catch (error) {
    console.error("Resume parse error:", error);
    return Response.json(
      { success: false, message: "Failed to parse resume." },
      { status: 500 }
    );
  }
}
