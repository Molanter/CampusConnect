"use client";

import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { CheckIcon, XMarkIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/solid";
import { ClubMember, ClubRole } from "../../lib/clubs";

interface MemberMenuProps {
    member: ClubMember;
    currentUserRole: ClubRole | null;
    onPromote?: (uid: string) => void;
    onDemote?: (uid: string) => void;
    onKick?: (uid: string) => void;
    onApprove?: (uid: string) => void;
    onReject?: (uid: string) => void;
}

export function MemberMenu({
    member,
    currentUserRole,
    onPromote,
    onDemote,
    onKick,
    onApprove,
    onReject
}: MemberMenuProps) {

    const canManage = currentUserRole === "owner" || (currentUserRole === "admin" && member.role === "member");
    const isOwner = currentUserRole === "owner";

    if (member.status === "pending") {
        return (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onApprove?.(member.uid)}
                    className="rounded-full bg-green-500/10 p-2 text-green-500 hover:bg-green-500/16 transition-colors shadow-sm active:scale-95"
                    title="Approve"
                >
                    <CheckIcon className="h-4 w-4" />
                </button>
                <button
                    onClick={() => onReject?.(member.uid)}
                    className="rounded-full bg-red-500/10 p-2 text-red-500 hover:bg-red-500/16 transition-colors shadow-sm active:scale-95"
                    title="Reject"
                >
                    <XMarkIcon className="h-4 w-4" />
                </button>
            </div>
        );
    }

    if (!canManage) return null;

    return (
        <Menu as="div" className="relative inline-block text-left">
            <Menu.Button className="flex items-center justify-center rounded-full p-2 text-secondary hover:bg-secondary/10 hover:text-foreground">
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
                <Menu.Items className="absolute right-0 z-50 mt-2 w-48 origin-top-right divide-y divide-secondary/10 overflow-hidden cc-radius-menu cc-glass-strong cc-glass-highlight focus:outline-none">
                    <div className="p-1.5">
                        {/* Promote/Demote */}
                        {isOwner && member.role === "member" && (
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={() => onPromote?.(member.uid)}
                                        className={`${active ? "bg-secondary/10 text-foreground" : "text-secondary"
                                            } group flex w-full items-center rounded-full px-3 py-2 text-sm transition-colors`}
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
                                        className={`${active ? "bg-secondary/10 text-foreground" : "text-secondary"
                                            } group flex w-full items-center rounded-full px-3 py-2 text-sm transition-colors`}
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
                                    className={`${active ? "bg-red-500/10 text-red-500" : "text-red-500/80"
                                        } group flex w-full items-center rounded-full px-3 py-2 text-sm transition-colors`}
                                >
                                    Remove from Club
                                </button>
                            )}
                        </Menu.Item>
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    );
}
