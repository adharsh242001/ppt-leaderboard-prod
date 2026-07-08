import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="bg-float-circle w-72 h-72 bg-gray-200 -top-20 -right-20" />
        <div className="bg-float-circle w-56 h-56 bg-indigo-200 bottom-10 -left-16" />
      </div>

      <div className="card-strong rounded-2xl px-10 py-12 text-center max-w-sm w-full animate-fade-in">
        <div className="text-5xl mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="text-sm text-gray-500 mt-2">This page does not exist.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 transition"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
