import { redirectToActive } from "@/lib/tournament";

// Legacy URL from before there were several tournaments; see redirectToActive.
export default function Legacy() {
  return redirectToActive("leaderboard");
}
