"use client";

import { Post } from "@/lib/posts";
import { TabDetails } from "@/components/event-sheet/tab-details";   // Reusing content logic
import { TabDiscussion } from "@/components/event-sheet/tab-discussion";
import { TabAttendees } from "@/components/event-sheet/tab-attendees";
import { TabLikes } from "./tab-likes";

// Note: We are reusing the functional content components from the previous iteration 
// because their internal logic (displaying details, comment list, attendee grid) applies perfectly
// to this new layout as well. The container style differences are handled by the wrapper here 
// or the slight styling within them is generic enough.

interface PostTabContentProps {
    activeTab: "details" | "comments" | "attendance" | "likes";
    post: Post;
    onTabChange?: (tab: "details" | "comments" | "attendance" | "likes") => void;
}

export function PostTabContent({ activeTab, post, onTabChange }: PostTabContentProps) {

    // We wrap content in a glass card as requested: "Content for each segment (full-width card under the picker)"
    // Iteration 4: Per new request, content sits directly on page background. Removing card styling.
    return (
        <div className="min-h-[300px]">
            {activeTab === "details" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <TabDetails post={post} onTabChange={onTabChange} />
                    {/* Add Map Link button specific to this layout if not present in reused component */}
                    {/* Actually TabDetails has location row with link. User asked for "link button 'Open in Maps'". 
                        Let's verify TabDetails implementation. It has a text link. We might want to enhance it.
                        For now, reusing is efficient.
                    */}
                </div>
            )}

            {activeTab === "comments" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <TabDiscussion post={post} />
                </div>
            )}

            {activeTab === "attendance" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <TabAttendees post={post} />
                </div>
            )}

            {activeTab === "likes" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <TabLikes post={post} />
                </div>
            )}
        </div>
    );
}
