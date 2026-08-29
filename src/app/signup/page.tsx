import { getDict } from "@/lib/i18n-server";
import SignupForm from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const dict = await getDict();
  return <SignupForm dict={dict} fromPredictions={from === "predictions"} />;
}
