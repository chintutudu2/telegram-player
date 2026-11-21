import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/services/auth/auth.actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut} className={className}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut className="size-4" aria-hidden />
        Sign out
      </Button>
    </form>
  );
}
