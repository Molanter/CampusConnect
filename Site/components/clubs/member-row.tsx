"use client";

import Link from "next/link";
import { ClubMember, ClubRole } from "../../lib/clubs";
import { UserCircleIcon, CheckIcon, XMarkIcon, EllipsisHorizontalIcon, ChevronUpDownIcon } from "@heroicons/react/24/solid";
import { Dialog, Transition } from "@headlessui/react";
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
    const [roleMenuOpen, setRoleMenuOpen] = useState(false);
    const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
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
                    <div className="h-10 w-10 shrink-0 cc-avatar rounded-full aspect-square transition-opacity group-hover:opacity-80">
                        {member.photoURL ? (
                            <img src={member.photoURL} alt={displayName} className="!h-full !w-full object-cover object-center" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-secondary/10 text-xs font-bold text-foreground">
                                {initials}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="text-[15px] font-semibold text-foreground group-hover:underline decoration-secondary/50 underline-offset-2 transition-all">{displayName}</span>
                        <span className={`text-xs font-medium mt-0.5 ${isRejected ? "text-red-500" : "text-brand"}`}>
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
                            ? "bg-red-500/30 text-red-300 hover:bg-red-500/40"
                            : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
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
                    <div className="h-10 w-10 shrink-0 cc-avatar rounded-full aspect-square transition-opacity group-hover:opacity-80">
                        {member.photoURL ? (
                            <img src={member.photoURL} alt={displayName} className="!h-full !w-full object-cover object-center" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-secondary/10 text-xs font-bold text-foreground">
                                {initials}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-[15px] font-semibold text-foreground leading-tight group-hover:underline decoration-secondary/50 underline-offset-2 transition-all">{displayName}</span>
                            {member.username && (
                                <span className="text-[13px] cc-muted group-hover:text-foreground/70">
                                    @{member.username}
                                </span>
                            )}
                        </div>
                    </div>
                </Link>

                <div className="flex items-center gap-2">
                    {/* Role Badge / Dropdown */}
                    {canManage ? (
                        <div className="relative inline-block text-left">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setRoleMenuOpen((v) => !v);
                                }}
                                className={`inline-flex items-center gap-1 rounded-full pl-2 pr-1 py-0.5 text-[10px] font-bold uppercase tracking-wide border transition-all hover:brightness-110 active:scale-95 ${member.role === "owner" ? "border-brand/30 bg-brand/10 text-brand" :
                                    member.role === "admin" ? "border-brand/30 bg-brand/10 text-brand" :
                                        "border-secondary/25 bg-secondary/10 text-secondary"
                                    }`}
                            >
                                {member.role}
                                <ChevronUpDownIcon className="h-3 w-3 opacity-70" />
                            </button>

                            {roleMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setRoleMenuOpen(false)} />
                                    <div className="absolute right-0 z-50 mt-2 w-32 origin-top-right divide-y divide-secondary/10 overflow-hidden cc-radius-menu cc-glass-strong">
                                        <div className="p-1.5">
                                            {(["member", "admin", "owner"] as ClubRole[]).map((role) => (
                                                <button
                                                    key={role}
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (role !== member.role) {
                                                            setTargetRole(role);
                                                        }
                                                        setRoleMenuOpen(false);
                                                    }}
                                                    disabled={role === member.role || (role === "owner" && !isOwner && !isGlobalAdmin)}
                                                    className={`${role === member.role ? "opacity-50 cursor-default text-secondary" : "text-secondary hover:bg-secondary/20 hover:text-foreground"
                                                        } group flex w-full items-center justify-between rounded-full px-3 py-2 text-[13px] font-medium transition-colors`}
                                                >
                                                    <span className="capitalize">{role}</span>
                                                    {role === member.role && <CheckIcon className="h-3 w-3" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${member.role === "owner" ? "border-brand/30 bg-brand/10 text-brand" :
                            member.role === "admin" ? "border-brand/30 bg-brand/10 text-brand" :
                                "border-secondary/25 bg-secondary/10 text-secondary"
                            }`}>
                            {member.role}
                        </span>
                    )}

                    {canManage && (
                        <div className="relative inline-block text-left">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setOptionsMenuOpen((v) => !v);
                                }}
                                className="flex items-center justify-center rounded-full p-2 text-secondary hover:bg-secondary/10 hover:text-foreground transition-colors"
                            >
                                <EllipsisHorizontalIcon className="h-5 w-5" />
                            </button>

                            {optionsMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOptionsMenuOpen(false)} />
                                    <div className="absolute right-0 z-50 mt-2 w-48 origin-top-right divide-y divide-secondary/10 overflow-hidden cc-radius-menu cc-glass-strong">
                                        <div className="p-1.5">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onKick?.(member.uid);
                                                    setOptionsMenuOpen(false);
                                                }}
                                                className="text-red-500/80 hover:bg-red-500/16 hover:text-red-500 group flex w-full items-center rounded-full px-3 py-2 text-[13px] font-medium transition-colors"
                                            >
                                                Remove from Club
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
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
                                    <Dialog.Panel className="w-full max-w-sm transform overflow-hidden cc-radius-24 cc-glass-strong cc-glass-highlight p-6 text-left align-middle transition-all">
                                        <Dialog.Title
                                            as="h3"
                                            className="text-lg font-medium leading-6 text-foreground"
                                        >
                                            Change Member Role
                                        </Dialog.Title>
                                        <div className="mt-2">
                                            <p className="text-sm cc-muted">
                                                Are you sure you want to change <strong className="text-foreground">{displayName}'s</strong> role to <strong className="text-brand capitalize">{targetRole}</strong>?
                                            </p>
                                        </div>

                                        <div className="mt-6 flex justify-end gap-3">
                                            <button
                                                type="button"
                                                className="rounded-full px-4 py-2 text-sm font-medium cc-muted hover:text-foreground transition-colors"
                                                onClick={() => setTargetRole(null)}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-brand-foreground hover:brightness-110 transition-colors"
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
