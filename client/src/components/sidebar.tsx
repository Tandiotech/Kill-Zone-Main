import { KillzoneLogo } from "@/pages/dashboard";
import { Gauge, BarChart3, Clock, Info, X, ScrollText, FileSearch, Zap, BarChart2 } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";

const navItems = [
  { label: "Score", icon: Gauge, target: "score-section" },
  { label: "Why", icon: FileSearch, target: "drivers-section" },
  { label: "Components", icon: BarChart3, target: "components-section" },
  { label: "Live Log", icon: ScrollText, target: "log-section" },
  { label: "History", icon: Clock, target: "history-section" },
  { label: "About", icon: Info, target: "about-section" },
];

const signalLink = { label: "Signal", icon: Zap, href: "#/signal" };
const chartLink = { label: "Chart", icon: BarChart2, href: "#/chart" };

export function DashboardSidebar({ onClose }: { onClose: () => void }) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    onClose();
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Logo */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <KillzoneLogo size={36} />
          <div>
            <div className="text-sm font-bold text-[hsl(210_10%_85%)] tracking-wide">
              KILL<span className="text-[#C49B30]">ZONE</span>
            </div>
            <div className="text-[10px] text-[hsl(210_8%_45%)] uppercase tracking-[0.15em]">
              Gold Intelligence
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded hover:bg-[hsl(210_15%_16%)]"
          data-testid="button-close-sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav items */}
      <nav className="space-y-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => scrollTo(item.target)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm text-[hsl(210_8%_55%)] hover:text-[hsl(210_10%_85%)] hover:bg-[hsl(210_15%_16%)] transition-colors"
            data-testid={`link-${item.label.toLowerCase()}`}
          >
            <item.icon size={16} className="shrink-0" />
            {item.label}
          </button>
        ))}

        {/* Signal page link */}
        <a
          href={signalLink.href}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm text-[#C49B30] hover:text-[#e0b942] hover:bg-[#C49B3012] transition-colors border border-[#C49B3020] mt-2"
        >
          <signalLink.icon size={16} className="shrink-0" />
          {signalLink.label}
          <span className="ml-auto text-[9px] font-mono opacity-60">TG</span>
        </a>

        {/* Chart page link */}
        <a
          href={chartLink.href}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm text-[#20808D] hover:text-[#2aa3b3] hover:bg-[#20808D12] transition-colors border border-[#20808D20] mt-1"
        >
          <chartLink.icon size={16} className="shrink-0" />
          {chartLink.label}
        </a>
      </nav>

      {/* Bottom info */}
      <div className="mt-auto pt-6 border-t border-[hsl(210_15%_14%)] space-y-3">
        <LogoutButton className="w-full flex items-center justify-center gap-2 rounded-md border border-[hsl(210_15%_18%)] bg-[hsl(210_22%_12%)] px-3 py-2 text-xs font-medium text-[hsl(210_8%_55%)] hover:bg-[hsl(210_15%_16%)] hover:text-[hsl(210_10%_85%)] transition-colors" />
        <div className="text-[10px] text-[hsl(210_8%_40%)] space-y-1">
          <p>Gold Safe Haven Score</p>
          <p>7-Component Weighted Model</p>
          <p className="text-[#C49B30]/60">v1.0 — Killzone Research</p>
        </div>
      </div>
    </div>
  );
}
