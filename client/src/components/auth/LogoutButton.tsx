import { supabase } from "@/lib/supabase";
import { clearStoredAuthToken } from "@/lib/authToken";
import { LogOut } from "lucide-react";

type Props = {
  className?: string;
  compact?: boolean;
};

export function LogoutButton({ className = "", compact }: Props) {
  return (
    <button
      type="button"
      className={
        className ||
        "inline-flex items-center gap-1.5 rounded border border-[var(--line-1)] bg-[var(--bg-2)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-2)] hover:bg-[var(--bg-3)] transition-colors"
      }
      onClick={async () => {
        clearStoredAuthToken();
        await supabase.auth.signOut();
        window.location.hash = "#/login";
      }}
      data-testid="button-logout"
    >
      <LogOut size={compact ? 12 : 14} className="opacity-70" />
      {!compact && "Log out"}
    </button>
  );
}
