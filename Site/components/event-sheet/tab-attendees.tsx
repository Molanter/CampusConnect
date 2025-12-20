"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Post } from "@/lib/posts";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface TabAttendeesProps {
    post: Post;
}

interface UserSummary {
    uid: string;
    displayName: string;
    photoURL?: string;
    username?: string;
}

export function TabAttendees({ post }: TabAttendeesProps) {
    const { goingUids = [], maybeUids = [] } = post;
    const [attendees, setAttendees] = useState<UserSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const uids = [...goingUids, ...maybeUids].slice(0, 30);
        if (uids.length === 0) {
            setLoading(false);
            return;
        }

        const fetchUsers = async () => {
            try {

                const users = await Promise.all(uids.map(async uid => {
                    const snap = await getDoc(doc(db, "users", uid));
                    if (snap.exists()) {
                        const d = snap.data();
                        return {
                            uid,
                            displayName: d.displayName || d.username || "User",
                            photoURL: d.photoURL,
                            username: d.username
                        } as UserSummary;
                    }
                    return null;
                }));
                setAttendees(users.filter(u => u !== null) as UserSummary[]);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        void fetchUsers();
    }, [JSON.stringify(goingUids), JSON.stringify(maybeUids)]);

    const total = goingUids.length + maybeUids.length;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 min-h-[300px] px-2">
            {/* Header Stats - Centered or Top aligned? "Simple layout: counts at the top" */}
            <div className="mb-6 flex flex-col items-center justify-center p-4">
                <h2 className="text-3xl font-bold text-white">{total}</h2>
                <p className="text-sm text-neutral-400">People Going or Interested</p>
                <div className="mt-2 flex gap-2 text-xs font-medium">
                    <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-400 ring-1 ring-inset ring-blue-500/20">{goingUids.length} Going</span>
                    <span className="rounded-full bg-yellow-500/10 px-2.5 py-1 text-yellow-500 ring-1 ring-inset ring-yellow-500/20">{maybeUids.length} Maybe</span>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-4 gap-4 sm:grid-cols-5 md:grid-cols-6">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                            <div className="h-14 w-14 animate-pulse rounded-full bg-white/5" />
                        </div>
                    ))}
                </div>
            ) : attendees.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                    <p>No attendees yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-4 gap-x-2 gap-y-6 sm:grid-cols-5 md:grid-cols-6">
                    {attendees.map(user => (
                        <Link key={user.uid} href={`/user/${user.uid}`} className="group flex flex-col items-center text-center cursor-pointer">
                            <div className="h-14 w-14 overflow-hidden rounded-full ring-2 ring-transparent group-hover:ring-white/20 transition-all bg-neutral-800">
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt={user.displayName} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-lg font-bold text-white">
                                        {user.displayName[0]}
                                    </div>
                                )}
                            </div>
                            <div className="mt-2 w-full px-1">
                                <p className="truncate text-[11px] font-medium text-neutral-300 group-hover:text-white">
                                    {user.displayName}
                                </p>
                                {user.username && (
                                    <p className="truncate text-[10px] text-neutral-500">
                                        @{user.username}
                                    </p>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
