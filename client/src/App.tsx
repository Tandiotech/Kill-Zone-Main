import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import SignalPage from "@/pages/signal";
import ChartPage from "@/pages/chart";
import IntelligenceDashboardPage from "@/pages/intelligence-dashboard";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import { AuthGate } from "@/components/auth/AuthGate";
import { useEffect } from "react";

function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Dark mode by default for this finance dashboard
    document.documentElement.classList.add("dark");
  }, []);

  return <>{children}</>;
}

/** The command-center UI is its own page (cockpit.html) so its global styles stay out of this app. */
function CockpitRedirect() {
  useEffect(() => {
    window.location.replace("./cockpit.html");
  }, []);
  return null;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={CockpitRedirect} />
      <Route path="/legacy" component={IntelligenceDashboardPage} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/signal" component={SignalPage} />
      <Route path="/chart" component={ChartPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AuthGate>
              <AppRouter />
            </AuthGate>
          </Router>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
