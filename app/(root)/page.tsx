import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import InterviewCard from "@/components/InterviewCard";

import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getInterviewsByUserId,
  getUserPerformanceSnapshot,
  getLatestInterviews,
} from "@/lib/actions/general.action";

async function Home() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [userInterviews, allInterview, performance] = await Promise.all([
    getInterviewsByUserId(user.id),
    getLatestInterviews({ userId: user.id }),
    getUserPerformanceSnapshot(user.id),
  ]);

  const hasPastInterviews = userInterviews.length > 0;
  const hasUpcomingInterviews = allInterview.length > 0;

  return (
    <>
      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg">
          <h2>Get Interview-Ready with AI-Powered Practice & Feedback</h2>
          <p className="text-lg">
            Practice real interview questions & get instant feedback
          </p>

          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/interview">Start an Interview</Link>
          </Button>
        </div>

        <Image
          src="/robot.png"
          alt="robo-dude"
          width={400}
          height={400}
          className="max-sm:hidden"
        />
      </section>

      <section className="flex flex-col gap-6 mt-8">
        <h2>Your Interviews</h2>

        <div className="interviews-section">
          {hasPastInterviews ? (
            userInterviews.map((interview) => (
              <InterviewCard
                key={interview.id}
                userId={user.id}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
              />
            ))
          ) : (
            <p>You haven&apos;t taken any interviews yet</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-6 mt-8">
        <h2>Performance Over Time</h2>
        {performance.performanceOverTime.length ? (
          <div className="card-border p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {performance.performanceOverTime.slice(-6).map((entry) => (
                <div key={`${entry.interviewId}-${entry.createdAt}`} className="bg-dark-200 rounded-xl p-3">
                  <p className="text-sm text-light-100">{new Date(entry.createdAt).toLocaleDateString()}</p>
                  <p className="text-lg font-semibold">{entry.score}/100</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-light-100">Frequent weak areas:</span>
              {performance.weakAreas.length ? (
                performance.weakAreas.slice(0, 4).map((item) => (
                  <span key={item.area} className="px-3 py-1 rounded-full bg-dark-200 text-sm">
                    {item.area} ({item.count})
                  </span>
                ))
              ) : (
                <span className="text-sm text-light-100">No weak areas detected yet.</span>
              )}
            </div>
          </div>
        ) : (
          <p>Take an interview to start tracking your progress.</p>
        )}
      </section>

      <section className="flex flex-col gap-6 mt-8">
        <h2>Previous Attempts</h2>
        {performance.attempts.length ? (
          <div className="interviews-section">
            {performance.attempts.slice(0, 6).map((attempt) => (
              <div key={attempt.id} className="card-border w-[360px] max-sm:w-full">
                <div className="card-interview min-h-fit">
                  <h3 className="capitalize">{attempt.role}</h3>
                  <p>Attempt #{attempt.attemptNumber} - Score {attempt.totalScore}/100</p>
                  <p className="text-sm text-light-100">{new Date(attempt.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No attempts recorded yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-6 mt-8">
        <h2>Take Interviews</h2>

        <div className="interviews-section">
          {hasUpcomingInterviews ? (
            allInterview.map((interview) => (
              <InterviewCard
                key={interview.id}
                userId={user.id}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
              />
            ))
          ) : (
            <p>There are no interviews available</p>
          )}
        </div>
      </section>
    </>
  );
}

export default Home;
