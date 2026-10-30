import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";

// Reads cookies, so it must be rendered inside <Suspense> (see site-header.tsx).
export async function AuthButton() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Button asChild size="sm">
        <Link href="/sign-in">Sign in</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" variant="ghost">
        <Link href="/account">My boxes</Link>
      </Button>
      {/* A form, not a link: signing out changes state, so it must not be a GET. */}
      <form action={signOut}>
        <Button type="submit" size="sm" variant="outline">
          Sign out
        </Button>
      </form>
    </div>
  );
}
