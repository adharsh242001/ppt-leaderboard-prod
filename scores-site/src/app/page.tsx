import Scoreboard from "@/components/Scoreboard";

export default function Home() {
  return (
    <Scoreboard
      title="PPT Leaderboard"
      logoSrc="/Logo.png"
      brandColor="#b85d32"
      csvUrl="https://docs.google.com/spreadsheets/d/e/2PACX-1vTr2plG4M3KkcgG__aVYOoObkoMT-MipuuorKmA5zdg85g4dbC_Ipqr_BOrkxOe3zS17Jw-30o8G992/pub?gid=2042098263&single=true&output=csv"
    />
  );
}
