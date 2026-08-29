import { getDict } from "@/lib/i18n-server";
import ForgotForm from "./ForgotForm";

export default async function ForgotPasswordPage() {
  const dict = await getDict();
  return <ForgotForm dict={dict} />;
}
