export default function LoanActivityPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Loan Activity</h1>
      {/* TODO: Audit trail / activity feed */}
      <div className="rounded-xl p-6">
        <p className="text-sm text-zinc-500">Activity for loan {params.id}</p>
      </div>
    </div>
  );
}
