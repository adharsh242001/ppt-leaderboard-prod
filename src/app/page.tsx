import Scoreboard from "@/components/Scoreboard";
import { requireAdmin } from "@/lib/auth";

export default async function Home() {
  await requireAdmin();
  return (
    <Scoreboard
      title="PPT Leaderboard"
      logoSrc="/Logo.png"
      brandColor="#b85d32"
      showRankingList={false}
    />
  );
}
