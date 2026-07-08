export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="bg-float-circle w-72 h-72 bg-indigo-300 -top-20 -right-20" />
        <div className="bg-float-circle w-56 h-56 bg-blue-300 bottom-10 -left-16" />
        <div className="bg-float-circle w-40 h-40 bg-purple-300 top-1/3 left-1/4" />
      </div>

      <div className="card-strong rounded-2xl w-full max-w-sm px-8 py-10 relative animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Access</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your password to continue</p>
        </div>

        <form action="/auth/login" method="post" className="space-y-5">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="Enter admin password"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              required
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:brightness-110 transition"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
