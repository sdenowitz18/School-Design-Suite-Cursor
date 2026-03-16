import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import DesignedExperiencePage from "@/pages/designed-experience";

declare const __BUILD_TIME__: string;

function Router() {
  return (
    <Switch>
      <Route path="/" component={DesignedExperiencePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        {import.meta.env.DEV && (
          <div className="fixed bottom-2 right-2 z-50 bg-black/70 text-white text-[10px] font-mono px-2 py-1 rounded pointer-events-none select-none">
            {new Date(__BUILD_TIME__).toLocaleTimeString()}
          </div>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
