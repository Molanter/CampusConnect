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

    const isSelf = false; // Logic to check if row is self (need current uid)

    // Permission logic
    const canManage = currentUserRole === "owner" || (currentUserRole === "admin" && member.role === "member");
    const isOwner = currentUserRole === "owner";

    return (
        <div className="flex items-center justify-between rounded-xl bg-white/5 p-3 hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-3">
                {member.photoURL ? (
                    <img
                        src={member.photoURL}
                        alt={member.displayName || "User"}
                        className="h-10 w-10 rounded-full object-cover"
                    />
                ) : (
                    <UserCircleIcon className="h-10 w-10 text-zinc-500" />
                )}

                <div>
                    <h4 className="text-sm font-medium text-white">
                        {member.displayName || member.username || "Unknown User"}
                    </h4>
                    <p className="text-xs text-zinc-500 capitalize">
                        {member.role === "owner" && <span className="text-amber-500 font-bold">Owner</span>}
                        {member.role === "admin" && <span className="text-blue-400 font-semibold">Admin</span>}
                        {member.role === "member" && "Member"}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {member.status === "pending" ? (
                    <>
                        <button
                            onClick={() => onApprove?.(member.uid)}
                            className="rounded-full bg-green-500/20 p-2 text-green-400 hover:bg-green-500/30"
                            title="Approve"
                        >
                            <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => onReject?.(member.uid)}
                            className="rounded-full bg-red-500/20 p-2 text-red-400 hover:bg-red-500/30"
                            title="Reject"
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    </>
                ) : (
                    canManage && (
                        <Menu as="div" className="relative inline-block text-left">
                            <Menu.Button className="flex items-center justify-center rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white">
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
                                <Menu.Items className="absolute right-0 z-50 mt-2 w-48 origin-top-right divide-y divide-zinc-700/50 rounded-xl bg-[#1c1c1e] shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    <div className="p-1">
                                        {/* Promote/Demote */}
                                        {isOwner && member.role === "member" && (
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        onClick={() => onPromote?.(member.uid)}
                                                        className={`${active ? "bg-white/10 text-white" : "text-zinc-300"
                                                            } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
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
                                                        className={`${active ? "bg-white/10 text-white" : "text-zinc-300"
                                                            } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                    >
                                                        Demote to Member
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        )}

                                        {/* Kick */}
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button
                                                    onClick={() => onKick?.(member.uid)}
                                                    className={`${active ? "bg-red-500/20 text-red-500" : "text-red-400"
                                                        } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                >
                                                    Remove from Club
                                                </button>
                                            )}
                                        </Menu.Item>
                                    </div>
                                </Menu.Items>
                            </Transition>
                        </Menu>
                    )
                )}
            </div>
        </div>
    );
}
