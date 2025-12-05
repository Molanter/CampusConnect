import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    try {
        // Validate that it's a Google Maps URL
        const urlObj = new URL(url);
        if (!urlObj.hostname.includes("goo.gl") && !urlObj.hostname.includes("google.com")) {
            return NextResponse.json({ error: "Invalid URL domain" }, { status: 400 });
        }

        // Perform a HEAD request with manual redirect handling
        const response = await fetch(url, {
            method: "HEAD",
            redirect: "manual",
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (location) {
                return NextResponse.json({ expandedUrl: location });
            }
        }

        // If no redirect or 200, return the original or response.url (which might be same)
        return NextResponse.json({ expandedUrl: response.url });
    } catch (error) {
        console.error("Error expanding URL:", error);
        return NextResponse.json({ error: "Failed to expand URL", details: String(error) }, { status: 500 });
    }
}
