export default function LoanDocumentsPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Loan Documents</h1>
      {/* TODO: Document checklist, upload, viewer */}
      <div className="rounded-lg border bg-white p-6">
        <p className="text-sm text-stone-500">Documents for loan {params.id}</p>
      </div>
    </div>
  );
}
