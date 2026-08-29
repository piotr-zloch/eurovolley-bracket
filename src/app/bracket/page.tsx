import { redirect } from "next/navigation";

// Merged into /predictions alongside the group stage.
export default function BracketRedirect() {
  redirect("/predictions");
}
