/** Gemini API egress — locationHint(enam)로 HKG 등 미지원 지역 우회 */
export class GeminiProxy {
  constructor(_state, _env) {}

  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("method_not_allowed", { status: 405 });
    }
    let url;
    let body;
    try {
      const parsed = await request.json();
      url = String(parsed.url || "");
      body = parsed.body;
    } catch {
      return new Response(JSON.stringify({ ok: false, status: 400, data: { error: "invalid_json" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!url) {
      return new Response(JSON.stringify({ ok: false, status: 400, data: { error: "url_required" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: response.ok, status: response.status, data }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
