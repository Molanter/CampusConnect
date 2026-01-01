"use client";

import Link from "next/link";
import { ClubMember, ClubRole } from "../../lib/clubs";
import { UserCircleIcon, CheckIcon, XMarkIcon, EllipsisHorizontalIcon, ChevronUpDownIcon } from "@heroicons/react/24/solid";
import { Menu, Transition, Dialog } from "@headlessui/react";
import { Fragment, useState } from "react";

interface MemberRowProps {
    member: ClubMember;
    currentUserRole: ClubRole | null;
    isGlobalAdmin?: boolean;
    onRoleChange?: (uid: string, newRole: ClubRole) => void;
    onKick?: (uid: string) => void;
    onApprove?: (uid: string) => void;
    onReject?: (uid: string) => void;
}

export function MemberRow({
    member,
    currentUserRole,
    isGlobalAdmin = false,
    onRoleChange,
    onKick,
    onApprove,
    onReject,
}: MemberRowProps) {
    const [targetRole, setTargetRole] = useState<ClubRole | null>(null);
    const isOwner = currentUserRole === "owner";
    const canManage = isOwner || isGlobalAdmin || (currentUserRole === "admin" && member.role === "member");

    const displayName = member.name || member.displayName || member.username || "Unknown User";
    const initials = displayName.charAt(0).toUpperCase();
    if (member.status === "pending" || member.status === "rejected") {
        const isRejected = member.status === "rejected";
        return (
            <div className="flex w-full items-center justify-between py-1">
                <Link
                    href={member.username ? `/user/u/${member.username}` : "#"}
                    className={`flex items-center gap-3 group ${member.username ? "cursor-pointer" : "cursor-default"}`}
                >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-neutral-700 ring-1 ring-white/10 transition-opacity group-hover:opacity-80">
                        {member.photoURL ? (
                            <img src={member.photoURL} alt={displayName} className="h-full w-full object-cover object-center" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white">
                                {initials}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="text-[15px] font-semibold text-white group-hover:underline decoration-white/50 underline-offset-2 transition-all">{displayName}</span>
                        <span className={`text-xs font-medium mt-0.5 ${isRejected ? "text-red-500" : "text-amber-500"}`}>
                            {isRejected ? "Rejected" : "Pending Request"}
                        </span>
                    </div>
                </Link >
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
                        className={`rounded-full p-2 transition-colors ${isRejected
                            ? "bg-red-500/40 text-red-300 hover:bg-red-500/50"
                            : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            }`}
                        title={isRejected ? "Already Rejected" : "Reject"}
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>
            </div >
        );
    }

    return (
        <>
            <div className="flex w-full items-center justify-between py-1">
                <Link
                    href={member.username ? `/user/u/${member.username}` : "#"}
                    className={`flex items-center gap-3 group ${member.username ? "cursor-pointer" : "cursor-default"}`}
                >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-neutral-700 ring-1 ring-white/10 transition-opacity group-hover:opacity-80">
                        {member.photoURL ? (
                            <img src={member.photoURL} alt={displayName} className="h-full w-full object-cover object-center" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white">
                                {initials}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-[15px] font-semibold text-white leading-tight group-hover:underline decoration-white/50 underline-offset-2 transition-all">{displayName}</span>
                            {member.username && (
                                <span className="text-[13px] text-neutral-500 group-hover:text-neutral-400">
                                    @{member.username}
                                </span>
                            )}
                        </div>
                    </div>
                </Link>

                <div className="flex items-center gap-2">
                    {/* Role Badge / Dropdown */}
                    {canManage ? (
                        <Menu as="div" className="relative inline-block text-left">
                            <Menu.Button
                                className={`inline-flex items-center gap-1 rounded-full pl-2 pr-1 py-0.5 text-[10px] font-bold uppercase tracking-wide border transition-all hover:brightness-110 active:scale-95 ${member.role === "owner" ? "border-amber-500/30 bg-amber-500/10 text-amber-500" :
                                    member.role === "admin" ? "border-blue-500/30 bg-blue-500/10 text-blue-400" :
                                        "border-white/10 bg-white/5 text-neutral-500"
                                    }`}
                            >
                                {member.role}
                                <ChevronUpDownIcon className="h-3 w-3 opacity-70" />
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
                                <Menu.Items className="absolute right-0 z-50 mt-2 w-32 origin-top-right divide-y divide-secondary/10 overflow-hidden cc-radius-menu cc-glass-strong cc-glass-highlight focus:outline-none">
                                    <div className="p-1.5">
                                        {(["member", "admin", "owner"] as ClubRole[]).map((role) => (
                                            <Menu.Item key={role}>
                                                {({ active }) => (
                                                    <button
                                                        onClick={() => {
                                                            if (role !== member.role) {
                                                                setTargetRole(role);
                                                            }
                                                        }}
                                                        disabled={role === member.role || (role === "owner" && !isOwner && !isGlobalAdmin)}
                                                        className={`${active ? "bg-secondary/20 text-foreground" : "text-secondary"
                                                            } ${role === member.role ? "opacity-50 cursor-default" : ""} 
                                                      group flex w-full items-center justify-between rounded-full px-3 py-2 text-[13px] font-medium transition-colors`}
                                                    >
                                                        <span className="capitalize">{role}</span>
                                                        {role === member.role && <CheckIcon className="h-3 w-3" />}
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        ))}
                                    </div>
                                </Menu.Items>
                            </Transition>
                        </Menu>
                    ) : (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${member.role === "owner" ? "border-amber-500/30 bg-amber-500/10 text-amber-500" :
                            member.role === "admin" ? "border-blue-500/30 bg-blue-500/10 text-blue-400" :
                                "border-white/10 bg-white/5 text-neutral-500"
                            }`}>
                            {member.role}
                        </span>
                    )}

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
                                <Menu.Items className="absolute right-0 z-50 mt-2 w-48 origin-top-right divide-y divide-secondary/10 overflow-hidden cc-radius-menu cc-glass-strong cc-glass-highlight focus:outline-none">
                                    <div className="p-1.5">
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button
                                                    onClick={() => onKick?.(member.uid)}
                                                    className={`${active ? "bg-red-500/20 text-red-500" : "text-red-400"
                                                        } group flex w-full items-center rounded-full px-3 py-2 text-[13px] font-medium transition-colors`}
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

                {/* Confirmation Dialog */}
                <Transition appear show={!!targetRole} as={Fragment}>
                    <Dialog as="div" className="relative z-[60]" onClose={() => setTargetRole(null)}>
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0"
                            enterTo="opacity-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                        </Transition.Child>

                        <div className="fixed inset-0 overflow-y-auto">
                            <div className="flex min-h-full items-center justify-center p-4 text-center">
                                <Transition.Child
                                    as={Fragment}
                                    enter="ease-out duration-300"
                                    enterFrom="opacity-0 scale-95"
                                    enterTo="opacity-100 scale-100"
                                    leave="ease-in duration-200"
                                    leaveFrom="opacity-100 scale-100"
                                    leaveTo="opacity-0 scale-95"
                                >
                                    <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-2xl cc-glass-strong cc-glass-highlight p-6 text-left align-middle transition-all">
                                        <Dialog.Title
                                            as="h3"
                                            className="text-lg font-medium leading-6 text-white"
                                        >
                                            Change Member Role
                                        </Dialog.Title>
                                        <div className="mt-2">
                                            <p className="text-sm text-zinc-400">
                                                Are you sure you want to change <strong className="text-white">{displayName}'s</strong> role to <strong className="text-[#ffb200] capitalize">{targetRole}</strong>?
                                            </p>
                                        </div>

                                        <div className="mt-6 flex justify-end gap-3">
                                            <button
                                                type="button"
                                                className="rounded-full px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                                                onClick={() => setTargetRole(null)}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-full bg-[#ffb200] px-5 py-2 text-sm font-bold text-black hover:bg-[#ffb200]/90 transition-colors"
                                                onClick={() => {
                                                    if (targetRole && onRoleChange) {
                                                        onRoleChange(member.uid, targetRole);
                                                        setTargetRole(null);
                                                    }
                                                }}
                                            >
                                                Confirm
                                            </button>
                                        </div>
                                    </Dialog.Panel>
                                </Transition.Child>
                            </div>
                        </div>
                    </Dialog>
                </Transition>
            </div>
        </>
    );
}
