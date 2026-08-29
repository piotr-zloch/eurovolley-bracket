import { redirect } from "next/navigation";

// Group predictions and the bracket were merged into one page. Kept so old links,
// bookmarks and the "x of 4 saved" emails that pointed here still work.
export default function StandingsRedirect() {
  redirect("/predictions");
}
