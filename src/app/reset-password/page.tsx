import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n-server";
import ResetForm from "./ResetForm";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Reaching this page requires the session the recovery link established via /auth/callback.
  // Landing here without one means the link was stale, already used, or opened out of context.
  if (!user) {
    const dict = await getDict();
    redirect(`/login?error=${encodeURIComponent(dict.auth.errResetExpired)}`);
  }

  const dict = await getDict();
  return <ResetForm dict={dict} />;
}
