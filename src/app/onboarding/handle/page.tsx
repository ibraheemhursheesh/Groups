import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/app/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { HandleForm } from "./handle-form";

export const metadata = {
  title: "Choose your handle · Groupss",
};

export default async function ChooseHandlePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/");

  const user = session.user as typeof session.user & {
    handle?: string | null;
    handleConfirmed?: boolean | null;
    isAnonymous?: boolean | null;
  };

  // Guests never go through onboarding, and nobody repeats it.
  if (user.isAnonymous || user.handleConfirmed) redirect("/");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-12">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl" />

      <section className="relative w-full max-w-md rounded-3xl border bg-card p-8 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.2)] sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-lg shadow-primary/25">
            @
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            One last step
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Choose your handle
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This is how people will find and mention you. You can pick the
            suggestion below or make it your own.
          </p>
        </div>

        <HandleForm initialHandle={user.handle ?? ""} />
      </section>
    </main>
  );
}
