interface ConfirmedPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function ConfirmedPage({
  searchParams,
}: ConfirmedPageProps) {
  const params = await searchParams;
  const status = params.status || "success";

  const content =
    {
      success: {
        title: "Email confirmed 🎉",
        description: "You’re on the RUTA waitlist and will be notified when we launch.",
      },
      already: {
        title: "Already confirmed",
        description: "This email is already on the RUTA waitlist for launch notifications.",
      },
      invalid: {
        title: "Invalid confirmation link",
        description: "This link is missing or no longer valid.",
      },
      error: {
        title: "Something went wrong",
        description: "Please try again later.",
      },
    }[status] || {
      title: "Email confirmed 🎉",
      description: "You’re on the RUTA waitlist and will be notified when we launch.",
    };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
        <h1 className="mb-3 text-2xl font-semibold">{content.title}</h1>
        <p className="text-muted-foreground">{content.description}</p>
      </div>
    </main>
  );
}
