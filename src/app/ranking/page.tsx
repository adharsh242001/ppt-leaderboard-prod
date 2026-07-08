import Scoreboard from "@/components/Scoreboard";
import { requireAdmin } from "@/lib/auth";

export default async function RankingPage() {
  await requireAdmin();
  return (
    <Scoreboard
      title="PPT Leaderboard"
      logoSrc="/Logo.png"
      brandColor="#6366f1"
      showRankingList
    />
  );
}
