export const runtime = "edge";

export async function GET() {
  try {
    const url = "https://dataminer2.pjm.com/feed/gen_by_fuel?rowCount=5";

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json,text/csv,*/*",
      },
      cache: "no-store"
    });

    const text = await res.text();

    return new Response(
      JSON.stringify({
        ok: res.ok,
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        preview: text.substring(0, 500)
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
