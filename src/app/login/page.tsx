import { getDict } from "@/lib/i18n-server";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; from?: string }>;
}) {
  const { error, message, from } = await searchParams;
  const dict = await getDict();

  return (
    <LoginForm
      dict={dict}
      message={message ?? error}
      fromPredictions={from === "predictions"}
    />
  );
}
