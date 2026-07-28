import { adsenseClientId } from "@/lib/adsense";

const GOOGLE_ADSENSE_CERTIFICATION_ID = "f08c47fec0942fa0";

export async function GET() {
  if (adsenseClientId === null) {
    return new Response("AdSense is not configured.\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const publisherId = adsenseClientId.replace(/^ca-/, "");
  return new Response(
    `google.com, ${publisherId}, DIRECT, ${GOOGLE_ADSENSE_CERTIFICATION_ID}\n`,
    {
      headers: {
        "cache-control": "public, max-age=3600",
        "content-type": "text/plain; charset=utf-8",
      },
    },
  );
}
