import Scoreboard from "@/components/Scoreboard";

export default function Page() {
  return (
    <Scoreboard
      title="Live Scores"
      logoSrc="/Logo.png"                     // put your logo in /public
      brandColor="#00000085"                    // any color (e.g., emerald)
      csvUrl="https://docs.google.com/spreadsheets/d/e/2PACX-1vTr2plG4M3KkcgG__aVYOoObkoMT-MipuuorKmA5zdg85g4dbC_Ipqr_BOrkxOe3zS17Jw-30o8G992/pub?gid=2042098263&single=true&output=csv"
      // Or, if private:
      // apiKey={process.env.NEXT_PUBLIC_GSHEETS_API_KEY!}
      // sheetId="1AbC..."
      // range="Sheet1!A1:B"
    />
  );
}
