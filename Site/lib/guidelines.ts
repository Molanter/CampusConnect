
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface GuidelineSection {
    title: string;
    body: string;
}

export interface CommunityGuidelines {
    title: string;
    version: number;
    lastUpdated: any;
    intro: string;
    sections: GuidelineSection[];
    outro: string;
    requiredAcceptance: boolean;
}

const DEFAULT_GUIDELINES: CommunityGuidelines = {
    title: "Community Guidelines",
    version: 1,
    lastUpdated: new Date(),
    intro: "Our goal is to create a safe, respectful, and welcoming space for everyone on campus. By using CampusConnect, you agree to follow these guidelines.",
    sections: [
        {
            title: "1. Be Respectful",
            body: "Treat others with kindness and respect. Harassment, bullying, hate speech, threats, or personal attacks are not allowed."
        },
        {
            title: "2. Keep Content Appropriate",
            body: "Do not post content that is:\n- Violent, sexually explicit, or graphic\n- Illegal or encouraging illegal activity\n- Spam, scams, or misleading information\n- Intended to provoke, intimidate, or harm others"
        },
        {
            title: "3. Authentic Participation",
            body: "- Do not impersonate individuals, clubs, or organizations.\n- Do not create fake accounts or clubs.\n- Represent your club honestly and accurately."
        },
        {
            title: "4. Campus-Relevant Use",
            body: "CampusConnect is intended for campus life:\n- Clubs, events, announcements, and discussions\n- Community building and collaboration\nContent unrelated to campus life may be removed."
        },
        {
            title: "5. Privacy & Safety",
            body: "- Do not share private or sensitive information without consent.\n- Respect others’ boundaries and personal data."
        },
        {
            title: "6. Clubs & Events",
            body: "- Club owners and admins are responsible for their club’s content.\n- Events must be truthful and not misleading.\n- Verified clubs may receive additional visibility."
        },
        {
            title: "7. Moderation & Enforcement",
            body: "CampusConnect may take action if guidelines are violated, including:\n- Content removal\n- Club hiding\n- Account restrictions\n- Permanent removal in severe or repeated cases\n\nModeration actions are logged and may be reviewed. Appeals may be available depending on the situation."
        },
        {
            title: "8. Reporting",
            body: "If you see content that violates these guidelines, please report it. Reports help keep the community safe."
        },
        {
            title: "9. Changes to Guidelines",
            body: "These guidelines may be updated over time. Continued use of CampusConnect means you accept the latest version."
        }
    ],
    outro: "Thank you for helping build a positive campus community.",
    requiredAcceptance: true
};

export async function getCommunityGuidelines(): Promise<CommunityGuidelines> {
    try {
        const docRef = doc(db, 'config', 'community_guidelines');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as CommunityGuidelines;
        }
    } catch (error) {
        console.error('Error fetching community guidelines:', error);
    }
    return DEFAULT_GUIDELINES;
}

/**
 * Seed guidelines to Firestore (only works if user has permissions)
 */
export async function seedCommunityGuidelines() {
    const docRef = doc(db, 'config', 'community_guidelines');
    await setDoc(docRef, { ...DEFAULT_GUIDELINES, lastUpdated: serverTimestamp() });
}
