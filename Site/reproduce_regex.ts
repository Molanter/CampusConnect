const url = "https://maps.app.goo.gl/L8ucyW75NSGR8ur46";

async function testExpand() {
    try {
        const response = await fetch(url, {
            method: "HEAD",
            redirect: "manual",
            headers: {}
        });
        console.log("Status:", response.status);
        console.log("Location Header:", response.headers.get("location"));

        const targetUrl = response.headers.get("location") || response.url;
        const googleSearchRegex = /search\/(-?\d+\.\d+)[, ]\+?(-?\d+\.\d+)/;
        const googleSearchMatch = targetUrl.match(googleSearchRegex);

        console.log("Match:", googleSearchMatch);
    } catch (error) {
        console.error("Error:", error);
    }
}

testExpand();
