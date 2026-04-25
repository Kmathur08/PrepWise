import { getCurrentUser } from "@/lib/actions/auth.action";
import InterviewSetupForm from "@/components/InterviewSetupForm";

const Page = async () => {
  const user = await getCurrentUser();

  if (!user) return null;

  return (
    <section className="flex flex-col gap-6">
      <h3>Create a personalized mock interview</h3>
      <p className="text-light-100">
        Add your target role and optional resume details. Questions and post-interview
        feedback will be tailored to your profile.
      </p>
      <InterviewSetupForm userId={user.id} />
    </section>
  );
};

export default Page;