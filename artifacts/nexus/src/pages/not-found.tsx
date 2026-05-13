import { useLocation } from "wouter";
import { Home, Frown } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center text-center px-6 max-w-sm">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-5">
          <Frown className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-black rizz-gradient mb-2">404</h1>
        <p className="text-lg font-bold text-foreground mb-1">Page not found</p>
        <p className="text-sm text-muted-foreground mb-6">
          This page doesn't exist. Maybe it moved, or you mistyped the URL.
        </p>
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 px-6 py-3 btn-primary rounded-2xl text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-all"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </button>
      </div>
    </div>
  );
}
