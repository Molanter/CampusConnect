"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../../lib/firebase";

export default function UsernameRedirectPage() {
  const params = useParams();
  const username = params.username as string;
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!username) return;

    const lookupUser = async () => {
      try {

        const q = query(collection(db, "users"), where("username", "==", username));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const uid = snap.docs[0].id;
          router.replace(`/user/${uid}`);
        } else {
          setError("User not found");
        }
      } catch (err) {
        console.error("Error looking up user", err);
        setError("Error finding user");
      }
    };

    lookupUser();
  }, [username, router]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-400">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center text-neutral-400">
      Loading profile...
    </div>
  );
}

