"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

import { consumeAiCredit } from "@/lib/ai-usage";
import { db } from "@/firebase/admin";
type TranscriptMessage = { role: string; content: string };
type CategoryScore = { name: string; score: number; comment: string };
type AnswerEvaluation = {
  question: string;
  answer: string;
  area: string;
  score: number;
  keywordMatch: number;
  lengthScore: number;
  structureScore: number;
  relevanceScore: number;
  missingKeywords: string[];
  matchedKeywords: string[];
  feedback: string;
};

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "am",
  "this",
  "that",
  "it",
  "as",
  "at",
  "by",
  "from",
  "you",
  "your",
  "i",
  "we",
  "they",
  "he",
  "she",
]);

const DSA_KEYWORDS = [
  "algorithm",
  "time complexity",
  "space complexity",
  "array",
  "linked list",
  "stack",
  "queue",
  "tree",
  "graph",
  "dynamic programming",
  "recursion",
  "binary search",
  "hash map",
  "sorting",
];

const HR_KEYWORDS = [
  "team",
  "leadership",
  "conflict",
  "communication",
  "strength",
  "weakness",
  "challenge",
  "goal",
  "motivation",
  "impact",
  "responsibility",
];

const STRUCTURE_MARKERS = [
  "first",
  "second",
  "third",
  "because",
  "therefore",
  "however",
  "for example",
  "specifically",
  "result",
  "impact",
];

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && token.length > 2 && !STOPWORDS.has(token));
}

function extractKeywords(text: string, max = 8) {
  const freq = tokenize(text).reduce<Record<string, number>>((acc, token) => {
    acc[token] = (acc[token] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([keyword]) => keyword);
}

function detectArea(question: string) {
  const lower = question.toLowerCase();
  if (DSA_KEYWORDS.some((keyword) => lower.includes(keyword))) return "DSA";
  if (HR_KEYWORDS.some((keyword) => lower.includes(keyword))) return "HR";
  return "Technical";
}

function buildQuestionKeywords(question: string, interview: Interview) {
  const tech = interview.techstack?.map((item) => item.toLowerCase()) || [];
  const baseKeywords = extractKeywords(question, 6);
  const merged = [...new Set([...baseKeywords, ...tech])];
  return merged.slice(0, 10);
}

function evaluateAnswer(
  answer: string,
  question: string,
  interview: Interview,
  resumeKeywords: string[]
): AnswerEvaluation {
  const questionKeywords = buildQuestionKeywords(question, interview);
  const expectedKeywords = [...new Set([...questionKeywords, ...resumeKeywords])].slice(
    0,
    12
  );
  const answerLower = answer.toLowerCase();
  const answerTokens = new Set(tokenize(answer));
  const questionTokens = tokenize(question);

  const matchedKeywords = expectedKeywords.filter(
    (keyword) =>
      answerLower.includes(keyword) ||
      keyword.split(" ").every((segment) => answerTokens.has(segment))
  );
  const missingKeywords = expectedKeywords.filter(
    (keyword) => !matchedKeywords.includes(keyword)
  );

  const keywordMatch = expectedKeywords.length
    ? (matchedKeywords.length / expectedKeywords.length) * 100
    : 65;

  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const lengthScore = clampScore(Math.min(100, (wordCount / 80) * 100));

  const structureHits = STRUCTURE_MARKERS.filter((marker) =>
    answerLower.includes(marker)
  ).length;
  const structureScore = clampScore(
    40 + Math.min(60, structureHits * 14 + (answer.includes(".") ? 10 : 0))
  );

  const overlap = questionTokens.filter((token) => answerTokens.has(token)).length;
  const relevanceScore = questionTokens.length
    ? clampScore((overlap / questionTokens.length) * 120)
    : 60;

  const finalScore = clampScore(
    keywordMatch * 0.35 + lengthScore * 0.2 + structureScore * 0.2 + relevanceScore * 0.25
  );

  return {
    question,
    answer,
    area: detectArea(question),
    score: finalScore,
    keywordMatch: clampScore(keywordMatch),
    lengthScore,
    structureScore,
    relevanceScore,
    missingKeywords,
    matchedKeywords,
    feedback:
      finalScore >= 75
        ? "Strong answer with good coverage."
        : `Needs improvement. Focus on: ${missingKeywords.slice(0, 3).join(", ") || "clear structure and relevant examples"}.`,
  };
}

function transcriptToPairs(transcript: TranscriptMessage[], questions: string[]) {
  const userAnswers = transcript
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .filter(Boolean);

  return questions.map((question, index) => ({
    question,
    answer: userAnswers[index] || "",
  }));
}

async function generateNarrativeFeedback(
  interview: Interview,
  evaluations: AnswerEvaluation[],
  transcript: TranscriptMessage[]
) {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error("Missing Gemini API key");
    }
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are evaluating a mock interview.
Role: ${interview.role}
Type: ${interview.type}
Average score: ${Math.round(
                evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) /
                  Math.max(1, evaluations.length)
              )}
Evaluations:
${evaluations
  .map(
    (item, index) =>
      `${index + 1}) ${item.question}\nScore: ${item.score}\nMissing keywords: ${item.missingKeywords.join(", ")}`
  )
  .join("\n\n")}

Transcript:
${transcript.map((entry) => `${entry.role}: ${entry.content}`).join("\n")}

Return JSON with this exact shape:
{
  "strengths": ["..."],
  "areasForImprovement": ["..."],
  "finalAssessment": "..."
}`,
            },
          ],
        },
      ],
    });
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as {
      strengths: string[];
      areasForImprovement: string[];
      finalAssessment: string;
    };
  } catch {
    return {
      strengths: [
        "You completed the full mock interview flow and attempted all questions.",
      ],
      areasForImprovement: [
        "Use more role-specific keywords and structured answers with measurable outcomes.",
      ],
      finalAssessment:
        "Your baseline is solid. Keep improving keyword relevance, answer depth, and structure to increase interview performance over time.",
    };
  }
}

// CREATE FEEDBACK WITH REAL EVALUATION ENGINE
export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const credit = await consumeAiCredit(userId);
    if (!credit.ok) {
      return { success: false };
    }

    const interview = await getInterviewById(interviewId);
    if (!interview) return { success: false };

    const resumeKeywords = extractKeywords(interview.resumeText || "", 6);
    const pairs = transcriptToPairs(transcript, interview.questions || []);
    const evaluations = pairs.map((pair) =>
      evaluateAnswer(pair.answer, pair.question, interview, resumeKeywords)
    );

    const totalScore = clampScore(
      evaluations.reduce((sum, item) => sum + item.score, 0) /
        Math.max(1, evaluations.length)
    );

    const categoryScores: CategoryScore[] = [
      {
        name: "Keyword Match",
        score: clampScore(
          evaluations.reduce((sum, item) => sum + item.keywordMatch, 0) /
            Math.max(1, evaluations.length)
        ),
        comment: "Checks role/resume keyword coverage per answer.",
      },
      {
        name: "Answer Length",
        score: clampScore(
          evaluations.reduce((sum, item) => sum + item.lengthScore, 0) /
            Math.max(1, evaluations.length)
        ),
        comment: "Longer complete answers score better than one-liners.",
      },
      {
        name: "Answer Structure",
        score: clampScore(
          evaluations.reduce((sum, item) => sum + item.structureScore, 0) /
            Math.max(1, evaluations.length)
        ),
        comment: "Rewards clear flow and outcome-driven communication.",
      },
      {
        name: "Relevance",
        score: clampScore(
          evaluations.reduce((sum, item) => sum + item.relevanceScore, 0) /
            Math.max(1, evaluations.length)
        ),
        comment: "Measures question-to-answer topical alignment.",
      },
    ];

    const areaScores = evaluations.reduce<Record<string, { total: number; count: number }>>(
      (acc, item) => {
        if (!acc[item.area]) acc[item.area] = { total: 0, count: 0 };
        acc[item.area].total += item.score;
        acc[item.area].count += 1;
        return acc;
      },
      {}
    );

    const weakAreas = Object.entries(areaScores)
      .map(([area, metrics]) => ({
        area,
        score: metrics.total / metrics.count,
      }))
      .filter((item) => item.score < 70)
      .sort((a, b) => a.score - b.score)
      .map((item) => item.area);

    const llmFeedback = await generateNarrativeFeedback(interview, evaluations, transcript);

    const feedback = {
      interviewId,
      userId,
      totalScore,
      categoryScores,
      strengths: llmFeedback.strengths,
      areasForImprovement: [...llmFeedback.areasForImprovement, ...weakAreas],
      weakAreas,
      questionEvaluations: evaluations,
      finalAssessment: llmFeedback.finalAssessment,
      createdAt: new Date().toISOString(),
    };

    const feedbackRef = feedbackId
      ? db.collection("feedback").doc(feedbackId)
      : db.collection("feedback").doc();
    await feedbackRef.set(feedback);

    const attemptsSnapshot = await db
      .collection("interviewAttempts")
      .where("interviewId", "==", interviewId)
      .where("userId", "==", userId)
      .get();

    const attemptNumber = attemptsSnapshot.size + 1;
    await db.collection("interviewAttempts").add({
      interviewId,
      userId,
      role: interview.role,
      totalScore,
      weakAreas,
      createdAt: feedback.createdAt,
      attemptNumber,
      answers: evaluations.map((entry) => ({
        question: entry.question,
        answer: entry.answer,
        score: entry.score,
        missingKeywords: entry.missingKeywords,
      })),
    });

    return { success: true, feedbackId: feedbackRef.id };
  } catch (error) {
    console.error("Error saving feedback:", error);
    return { success: false };
  }
}

// ✅ GET INTERVIEW BY ID
export async function getInterviewById(id: string): Promise<Interview | null> {
const interview = await db.collection("interviews").doc(id).get();
return interview.data() as Interview | null;
}

// ✅ GET FEEDBACK
export async function getFeedbackByInterviewId(
params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
const { interviewId, userId } = params;

const querySnapshot = await db
.collection("feedback")
.where("interviewId", "==", interviewId)
.where("userId", "==", userId)
.limit(1)
.get();

if (querySnapshot.empty) return null;

const feedbackDoc = querySnapshot.docs[0];
return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
}

// ✅ GET ALL INTERVIEWS (FIXED 🔥)
export async function getLatestInterviews(
params: GetLatestInterviewsParams
): Promise<Interview[]> {
const { limit = 20 } = params;

const interviews = await db
.collection("interviews")
.orderBy("createdAt", "desc")
.where("finalized", "==", true)
.limit(limit)
.get();

return interviews.docs.map((doc) => ({
id: doc.id,
...doc.data(),
})) as Interview[];
}

// ✅ GET USER INTERVIEWS
export async function getInterviewsByUserId(
userId?: string
): Promise<Interview[]> {
if (!userId) return [];

const interviews = await db
.collection("interviews")
.where("userId", "==", userId)
.orderBy("createdAt", "desc")
.get();

return interviews.docs.map((doc) => ({
id: doc.id,
...doc.data(),
})) as Interview[];
}

async function generateRoleQuestions(params: {
  role: string;
  level: string;
  type: string;
  techstack: string;
  amount: number;
  resumeText?: string;
}) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return [];
  }
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Generate ${params.amount} interview questions for a ${params.level} ${params.role} role.
Interview type: ${params.type}.
Tech stack: ${params.techstack}.
Resume context: ${params.resumeText || "Not provided"}.
Prioritize role-relevant, practical questions and include both depth and behavioral checks.
Return JSON array only, e.g. ["Q1","Q2"].`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}

function getFallbackQuestions(role: string, type: string, amount: number) {
  const base = [
    `Tell me about yourself and why you are a fit for the ${role} role.`,
    "Describe a challenging project and how you solved it.",
    "How do you approach debugging and root-cause analysis?",
    "Explain a decision where you balanced speed vs quality.",
    "How do you collaborate with stakeholders and team members?",
    "Walk me through one problem-solving scenario step by step.",
  ];
  const typeSpecific =
    type.toLowerCase() === "behavioral"
      ? [
          "Describe a conflict in your team and how you resolved it.",
          "How do you handle feedback and adapt your work style?",
        ]
      : [
          `Explain core concepts you use daily in ${role}.`,
          "How do you optimize performance in your solutions?",
        ];
  return [...base, ...typeSpecific].slice(0, amount);
}

export async function createInterview(params: CreateInterviewParams) {
try {
  const credit = await consumeAiCredit(params.userId);
  if (!credit.ok) {
    return { success: false, interviewId: null, message: credit.message };
  }

  const role = params.role?.trim() || "Software Engineer";
  const level = params.level?.trim() || "Mid-level";
  const type = params.type?.trim() || "Mixed";
  const amount = params.amount || 6;
  const techstack = params.techstack?.trim() || "JavaScript, TypeScript";
  const resumeText = params.resumeText?.trim() || "";

  const generatedQuestions = await generateRoleQuestions({
    role,
    level,
    type,
    techstack,
    amount,
    resumeText,
  });
  const questions =
    generatedQuestions.length > 0
      ? generatedQuestions
      : getFallbackQuestions(role, type, amount);

  const interviewRef = db.collection("interviews").doc();
  await interviewRef.set({
    userId: params.userId,
    role,
    type,
    level,
    questions,
    techstack: techstack.split(",").map((item) => item.trim()).filter(Boolean),
    resumeText,
    finalized: true,
    createdAt: new Date().toISOString(),
  });

  return { success: true, interviewId: interviewRef.id };
} catch (error) {
  console.error("Error creating interview:", error);
  return { success: false, interviewId: null };
}
}

export async function getUserPerformanceSnapshot(userId: string) {
  try {
    // Avoid composite-index-only queries so the app works immediately after deploy.
    const feedbackSnapshot = await db
      .collection("feedback")
      .where("userId", "==", userId)
      .get();

    const feedbacks = feedbackSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) =>
        new Date((a as Feedback).createdAt).getTime() -
        new Date((b as Feedback).createdAt).getTime()
      ) as Feedback[];

    const performanceOverTime = feedbacks.map((feedback) => ({
      interviewId: feedback.interviewId,
      score: feedback.totalScore,
      createdAt: feedback.createdAt,
    }));

    const weakAreaCounts = feedbacks.reduce<Record<string, number>>(
      (acc, feedback) => {
        const areas = feedback.weakAreas || [];
        areas.forEach((area) => {
          acc[area] = (acc[area] || 0) + 1;
        });
        return acc;
      },
      {}
    );

    const attemptsSnapshot = await db
      .collection("interviewAttempts")
      .where("userId", "==", userId)
      .get();

    const attempts = attemptsSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort(
        (a, b) =>
          new Date((b as InterviewAttempt).createdAt).getTime() -
          new Date((a as InterviewAttempt).createdAt).getTime()
      )
      .slice(0, 15) as InterviewAttempt[];

    return {
      performanceOverTime,
      weakAreas: Object.entries(weakAreaCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([area, count]) => ({ area, count })),
      attempts,
    };
  } catch (error) {
    console.error("getUserPerformanceSnapshot error:", error);
    return {
      performanceOverTime: [],
      weakAreas: [],
      attempts: [],
    };
  }
}
