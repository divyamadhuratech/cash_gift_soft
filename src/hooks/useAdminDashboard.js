import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function useAdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    // Deferred so the state resets below don't fire synchronously during the
    // effect pass — they land on the next microtask, same visible behaviour.
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError("");
      api
        .get("/admin/dashboard")
        .then((res) => {
          if (!cancelled) setData(res.data);
        })
        .catch((err) => {
          if (!cancelled) setError(err.response?.data?.message || "Failed to load admin dashboard");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}

export default useAdminDashboard;