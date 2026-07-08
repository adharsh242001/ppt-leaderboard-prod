export default function VoteDonePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="bg-float-circle w-72 h-72 bg-green-200 -top-20 -right-20" />
        <div className="bg-float-circle w-56 h-56 bg-emerald-200 bottom-10 -left-16" />
      </div>

      <div className="card-strong rounded-2xl px-10 py-12 text-center max-w-sm w-full animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-5 shadow-lg">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Thank you for voting</h1>
        <p className="text-sm text-gray-500 mt-2">Your scores have been recorded.</p>
      </div>
    </main>
  );
}
