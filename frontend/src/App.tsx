import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useStore } from "@/state/store";
import { Shell } from "@/app/Shell";
import { DEFAULT_PATH } from "@/app/nav";
import { Spinner } from "@/design/primitives";
import { Feasibility } from "@/modules/feasibility/Feasibility";
import { Sites } from "@/modules/sites/Sites";
import { Forecast } from "@/modules/forecast/Forecast";
import { Kol } from "@/modules/kol/Kol";
import { Monitoring } from "@/modules/monitoring/Monitoring";
import { Population } from "@/modules/population/Population";

export default function App() {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const load = useStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading") {
    return (
      <div className="h-full grid place-items-center text-text-muted">
        <div className="flex items-center gap-3">
          <Spinner /> Loading synthetic dataset…
        </div>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="h-full grid place-items-center p-8">
        <div className="max-w-md text-center">
          <h2 className="font-display text-xl text-primary mb-2">Cannot reach the AlfaDev API</h2>
          <p className="text-sm text-text-muted mb-3">{error}</p>
          <p className="text-xs text-text-faint">
            Start the backend: <code className="bg-inset px-1 rounded-sm">uvicorn app.main:app --reload</code> in <code className="bg-inset px-1 rounded-sm">backend/</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Navigate to={`/${DEFAULT_PATH}`} replace />} />
          <Route path="/feasibility" element={<Feasibility />} />
          <Route path="/sites" element={<Sites />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/kol" element={<Kol />} />
          <Route path="/monitoring" element={<Monitoring />} />
          <Route path="/population" element={<Population />} />
          <Route path="*" element={<Navigate to={`/${DEFAULT_PATH}`} replace />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
