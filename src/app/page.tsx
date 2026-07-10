export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="bg-float-circle w-96 h-96 bg-indigo-400 -top-32 -right-32" />
        <div className="bg-float-circle w-72 h-72 bg-purple-400 bottom-20 -left-20" />
        <div className="bg-float-circle w-56 h-56 bg-pink-400 top-1/2 left-1/3" />
      </div>

      <div className="relative text-center animate-fade-in">
        <p className="text-indigo-300 font-semibold tracking-[0.3em] uppercase text-sm sm:text-base mb-6">
          Presentation Leaderboard
        </p>
        <h1 className="text-6xl sm:text-8xl md:text-9xl font-black text-white leading-none tracking-tight drop-shadow-2xl">
          Q1
          <br />
          <span className="bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500 bg-clip-text text-transparent">
            Awards
          </span>
        </h1>
        <div className="mt-10 flex items-center justify-center gap-2 text-indigo-300 text-sm">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Coming soon
        </div>
      </div>
    </main>
  );
}
