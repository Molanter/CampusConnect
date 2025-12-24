"use client";

import { ClubMember, ClubRole } from "../../lib/clubs";
import { UserCircleIcon, CheckIcon, XMarkIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/solid";
import { Menu, Transition } from "@headlessui/react";
import { Fragment } from "react";

interface MemberRowProps {
    member: ClubMember;
    currentUserRole: ClubRole | null; // Role of the viewer
    onPromote?: (uid: string) => void;
    onDemote?: (uid: string) => void;
    onKick?: (uid: string) => void;
    onApprove?: (uid: string) => void;
    onReject?: (uid: string) => void;
}

export function MemberRow({
    member,
    currentUserRole,
    onPromote,
    onDemote,
    onKick,
    onApprove,
    onReject,
}: MemberRowProps) {
    const isOwner = currentUserRole === "owner";
    const canManage = isOwner || (currentUserRole === "admin" && member.role === "member");

    const displayName = member.name || member.displayName || member.username || "Unknown User";
    const initials = displayName.charAt(0).toUpperCase();

    if (member.status === "pending") {
        return (
            <div className="flex w-full items-center justify-between py-1">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-neutral-700 ring-1 ring-white/10">
                        {member.photoURL ? (
                            <img src={member.photoURL} alt={displayName} className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white">
                                {initials}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold text-white">{displayName}</span>
                        <span className="text-xs text-amber-500 font-medium">Pending Request</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onApprove?.(member.uid)}
                        className="rounded-full bg-green-500/20 p-2 text-green-400 hover:bg-green-500/30 transition-colors"
                        title="Approve"
                    >
                        <CheckIcon className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onReject?.(member.uid)}
                        className="rounded-full bg-red-500/20 p-2 text-red-400 hover:bg-red-500/30 transition-colors"
                        title="Reject"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full items-center justify-between py-1">
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-neutral-700 ring-1 ring-white/10">
                    {member.photoURL ? (
                        <img src={member.photoURL} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white">
                            {initials}
                        </div>
                    )}
                </div>
                <div className="flex flex-col leading-tight">
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white">{displayName}</span>
                        <span className="text-sm text-neutral-500">·</span>
                        <span className={`text-[13px] font-medium capitalize ${member.role === "owner" ? "text-amber-500" :
                            member.role === "admin" ? "text-blue-400" : "text-neutral-400"
                            }`}>
                            {member.role}
                        </span>
                    </div>
                    <span className="text-xs text-neutral-500">
                        {member.username || ""}
                    </span>
                </div>
            </div>

            {canManage && (
                <Menu as="div" className="relative inline-block text-left">
                    <Menu.Button className="flex items-center justify-center rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors">
                        <EllipsisHorizontalIcon className="h-5 w-5" />
                    </Menu.Button>
                    <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                    >
                        <Menu.Items className="absolute right-0 z-50 mt-2 w-48 origin-top-right divide-y divide-white/5 rounded-2xl border border-white/10 bg-[#1C1C1E]/95 backdrop-blur-xl p-1.5 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none">
                            <div className="p-1">
                                {isOwner && member.role === "member" && (
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                onClick={() => onPromote?.(member.uid)}
                                                className={`${active ? "bg-white/10 text-white" : "text-neutral-300"
                                                    } group flex w-full items-center rounded-xl px-2 py-2 text-[13px] font-medium transition-colors`}
                                            >
                                                Promote to Admin
                                            </button>
                                        )}
                                    </Menu.Item>
                                )}
                                {isOwner && member.role === "admin" && (
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                onClick={() => onDemote?.(member.uid)}
                                                className={`${active ? "bg-white/10 text-white" : "text-neutral-300"
                                                    } group flex w-full items-center rounded-xl px-2 py-2 text-[13px] font-medium transition-colors`}
                                            >
                                                Demote to Member
                                            </button>
                                        )}
                                    </Menu.Item>
                                )}

                                <Menu.Item>
                                    {({ active }) => (
                                        <button
                                            onClick={() => onKick?.(member.uid)}
                                            className={`${active ? "bg-red-500/20 text-red-500" : "text-red-400"
                                                } group flex w-full items-center rounded-xl px-2 py-2 text-[13px] font-medium transition-colors`}
                                        >
                                            Remove from Club
                                        </button>
                                    )}
                                </Menu.Item>
                            </div>
                        </Menu.Items>
                    </Transition>
                </Menu>
            )}
        </div>
    );
}
