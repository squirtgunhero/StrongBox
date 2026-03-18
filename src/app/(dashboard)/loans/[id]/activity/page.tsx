export default function LoanActivityPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Loan Activity</h1>
      {/* TODO: Audit trail / activity feed */}
      <div className="rounded-lg border bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
        <p className="text-sm text-zinc-500">Activity for loan {params.id}</p>
      </div>
    </div>
  );
}
