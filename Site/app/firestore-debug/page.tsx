"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function FirestoreDebugPage() {
  const [status, setStatus] = useState("Starting…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setStatus("Writing test doc…");
        const ref = doc(db, "debug", "ping");
        await setDoc(ref, { createdAt: new Date().toISOString() }, { merge: true });

        setStatus("Reading test doc…");
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setStatus("Success: Firestore read + write worked.");
        } else {
          setStatus("Read succeeded but document does not exist.");
        }
      } catch (err: any) {
        console.error("Firestore debug error", err);
        setStatus("Failed");
        setError(err?.message || String(err));
      }
    };

    run();
  }, []);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-slate-100">
      <h1 className="text-lg font-semibold">Firestore debug</h1>
      <p className="text-sm text-slate-300">{status}</p>
      {error && (
        <pre className="mt-2 max-w-md whitespace-pre-wrap rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
          {error}
        </pre>
      )}
    </div>
  );
}