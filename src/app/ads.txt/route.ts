export async function GET() {
  return new Response("adm.shinobi.jp,232135,DIRECT\n", {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
