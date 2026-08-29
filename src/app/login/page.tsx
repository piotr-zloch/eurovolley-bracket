import { getDict } from "@/lib/i18n-server";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const dict = await getDict();

  return <LoginForm dict={dict} message={message ?? error} />;
}
