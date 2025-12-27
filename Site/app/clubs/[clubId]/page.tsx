"use client";

import { useParams } from "next/navigation";
import { ClubProfileView } from "@/components/clubs/club-profile-view";

export default function ClubPage() {
    const params = useParams();
    const clubId = params.clubId as string;

    return <ClubProfileView clubId={clubId} />;
}
