interface Feedback {
  id: string;
  interviewId: string;
  totalScore: number;
  weakAreas?: string[];
  questionEvaluations?: Array<{
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
  }>;
  categoryScores: Array<{
    name: string;
    score: number;
    comment: string;
  }>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  createdAt: string;
}

interface Interview {
  id: string;
  role: string;
  level: string;
  questions: string[];
  techstack: string[];
  resumeText?: string;
  createdAt: string;
  userId: string;
  type: string;
  finalized: boolean;
}

interface CreateFeedbackParams {
  interviewId: string;
  userId: string;
  transcript: { role: string; content: string }[];
  feedbackId?: string;
}

interface User {
  name: string;
  email: string;
  id: string;
}

interface InterviewCardProps {
  interviewId?: string;
  userId?: string;
  role: string;
  type: string;
  techstack: string[];
  createdAt?: string;
}

interface AgentProps {
  userName: string;
  userId?: string;
  interviewId?: string;
  feedbackId?: string;
  type: "generate" | "interview";
  questions?: string[];
}

interface CreateInterviewParams {
  userId: string;
  role?: string;
  level?: string;
  type?: string;
  techstack?: string;
  amount?: number;
  resumeText?: string;
}

interface InterviewAttempt {
  id: string;
  interviewId: string;
  userId: string;
  role: string;
  totalScore: number;
  weakAreas: string[];
  createdAt: string;
  attemptNumber: number;
  answers: Array<{
    question: string;
    answer: string;
    score: number;
    missingKeywords: string[];
  }>;
}

interface RouteParams {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string>>;
}

interface GetFeedbackByInterviewIdParams {
  interviewId: string;
  userId: string;
}

interface GetLatestInterviewsParams {
  userId: string;
  limit?: number;
}

interface SignInParams {
  email: string;
  idToken: string;
}

interface SignUpParams {
  uid: string;
  name: string;
  email: string;
  password: string;
}

type FormType = "sign-in" | "sign-up";

interface InterviewFormProps {
  interviewId: string;
  role: string;
  level: string;
  type: string;
  techstack: string[];
  amount: number;
}

interface TechIconProps {
  techStack: string[];
}
