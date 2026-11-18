# AI

Reference status: manually maintained  
Tile contract checked: 2026-10-13  
Applicable skill version: 0.6.x  
Canonical sources: web/src/lib/aiDocs.ts, web/src/sdk/tile.ts, api/src/ai/, api/src/hosting/view.rs

## Eligibility

AI works on private, published tiles only; public tiles have no `svc/*` routes. An app admin approves a creator; that creator, as a tile admin, enables AI on the tile and acknowledges provider egress. An account token cannot enable AI. Once enabled, every authorized viewer may call AI and spend the tile's budget. canEnableAi controls enablement, not use.

### Setup and troubleshooting

If AI does not respond, tell the tile admin to:

1. If they do not yet have approval, choose **Request AI access** in Tile (the ai_access request; see [Requests](requests.md)) and wait for app-admin approval. Requesting access is not approval.
2. Once approved, enable AI for this tile under Manage → Services and acknowledge provider egress. Approval alone does not enable any tile.
3. Confirm the tile is private and published, then reload and check availability.

Include these steps in the hand-off and show an admin setup hint for not-enabled. A 404 does not establish whether approval is missing or AI is simply off; keep access refusals, outages, and exhausted budgets distinct rather than recommending another access request for every failure.

Start with:

    const availability = await tile.ai.available();
    if (!availability.ok) showFallback(availability.reason);

available() never throws and spends no budget. On success it returns { ok: true, models, default }, so no separate models() call is needed. On failure it returns { ok: false, reason, status, message }; reason is not-enabled (404), not-a-viewer (403), unavailable (503 or network), or error. Do not infer availability from tile.me().

## Choose the operation

- tile.ai.complete({ prompt, model?, system?, maxOutputTokens? }) → { text, usage, model, cost? }.
- tile.ai.object({ prompt, schema, model? }) → { object, usage, cost? }. schema must be a JSON object, at most 64 KB and 32 levels deep.
- tile.ai.chat({ messages, model?, thinking?, maxOutputTokens? }, { signal }) → async iterator of chunks. Each message is { role: "system" | "user" | "assistant", content } with non-empty content.
- tile.ai.models() → { models, default }: the live registry filtered to what this tile may use.
- tile.ai.embed({ input }) → { embeddings, usage, model, cost? }. input is a string or up to 96 non-empty strings by default.

maxOutputTokens is clamped to 1–8192. cost is { input, output, total, currency } in USD when the platform reports it.

Omit model to use the tile's default. When selection matters, read models() and offer only returned IDs; entries carry id, kind, residency, and supportsThinking, and the list can include embed models, so filter to kind "chat" for a picker. Never hardcode a model that may be disallowed or retired. A named model the tile has not been granted is a 400, not a fallback; a tile admin asks for it through [Requests](requests.md). embed takes no model: the embedding model is fixed app-wide so vectors stay comparable. The SDK sends none; a raw request that names one is a 400.

For streaming, use tile.ai.chat rather than EventSource or a handwritten SSE parser:

    for await (const chunk of tile.ai.chat({ messages }, { signal: controller.signal })) {
      if (chunk.type === "token") render(chunk.text);
      if (chunk.type === "done") finish(chunk.usage, chunk.cost);
      if (chunk.type === "error") showError(chunk.error);
    }

Pre-open refusals (400, 404, 413, 429, 503) throw tile.TileSvcError before the first chunk; check error.status. A stream that stalls or passes the server's 120-second limit ends with an error chunk and is fully refunded. Aborting stops rendering but does not refund: the server keeps reading to the end and settles the real cost. Prevent a second concurrent stream from the same control, and abort on pagehide. For a multi-turn chat, resend the whole history in messages each turn; it counts toward the body cap.

Render model text with textContent or a trusted sanitizer.

## Data and cost

Tile does not store prompts or responses from complete, object, chat, or embed. If the tile needs to keep conversation state, that is a separate storage capability with its own retention decision.

Viewer input and any tile content sent with it egress to an external model provider (AWS Bedrock or Azure, through the platform AI service). Residency comes from each model's residency field: eu is pinned to an EU region, us is not EU-guaranteed. Every Azure model is us, and the stock default, gpt-5.4-nano, is an Azure model. Where sensitive input is possible, pick an eu model from models() or tell viewers in the UI where their input goes.

Each call reserves an estimate against the app-wide daily USD cap and then the tile's daily USD budget (5 USD by default), then settles to the real cost. Every viewer can spend it. Budgets reset at the UTC day boundary; a tile admin can raise one through [Requests](requests.md). A request body is capped at 256 KiB by default.

## Failure behavior

- 400: invalid input, schema, or model; fix the request.
- 401: the viewer's session lapsed; reload the tile.
- 403: the caller is not a viewer of the tile. An app admin who is not a viewer also gets 403.
- 404: AI is not enabled, or the tile is unpublished; show a non-AI state.
- 410: the tile has expired.
- 413: request body too large; shorten the input.
- 429: the tile, app-wide, or platform budget is exhausted; do not auto-retry.
- 503/network: kill switch, AI service down, or too many concurrent chat streams; offer a fallback or tile.retry.

The tile remains usable without AI.

## Implementation example

For chat implementation, read [the complete AI chat example](../examples/ai-chat.html).

## Verification

- The tile is private and AI enablement is stated as a prerequisite.
- UI gates on tile.ai.available().
- Setup instructions distinguish Request AI access, app-admin approval, and Manage → Services enablement; failures show the appropriate next step.
- Model is omitted for the configured default or selected from models(), filtered to chat models.
- No provider credential or direct provider call exists in HTML.
- Egress, residency, viewer-wide spend, and non-persistence are accurate.
- One stream per control at a time; streams abort on page exit.
- 429 is not retried and 503 has a fallback.
