# External API broker

Reference status: manually maintained  
Tile contract checked: 2026-10-13  
Applicable skill version: 0.6.x  
Canonical sources: web/src/lib/extApiDocs.ts, web/src/sdk/tile.ts, api/src/extapi/, api/src/config.rs, deploy/k8s/pages/deployment.yaml

The broker works on private tiles only. An app admin approves an exact host (an approved base URL) under a connection name; a tile admin enables that connection. The tile's JavaScript names the connection, never an arbitrary URL. For ordinary model calls, use [AI](ai.md) instead; this broker has no USD budget or model allowlist.

## Credentials

Never embed a key or send Authorization from the tile's JavaScript; an Authorization header set there is a tagged 400. Tile drops other X-Forwarded-* headers silently; an X-Forwarded-Email that names someone other than the viewer is a tagged 400. Content-Type, Accept, Accept-Language, and X-* headers the tile sets reach the upstream, except X-Svc-*, X-Real-IP, and well-known proxy-identity and method- or path-override headers (such as X-Remote-User or X-HTTP-Method-Override), which are dropped silently. The broker sends no viewer identity or cookies, and Set-Cookie never comes back.

A credential is injected server-side only when an app admin set the connection's credential mode to per-tile ("page"; the default "none" injects nothing), a tile admin stored the secret in Manage as a header or a query parameter, and the deployment has credential injection switched on. It is off by default; while off, a connection with a stored credential refuses with a tagged 503 "credential injection is disabled" rather than calling out uncredentialed. Confirm with the user before designing around a credentialed connection.

Every viewer can call an enabled connection and spend its quotas or stored credential. Do not use a credential with an upstream that echoes request headers.

## Buffered calls

    const response = await tile.api.fetch("crm", "v1/customers/42/", {
      method: "GET",
      query: { include: "summary" },
      headers: { accept: "application/json" }
    });

method is GET, POST, PUT, PATCH, or DELETE (default GET); the SDK sends it as X-Svc-Method on a POST to the broker. Pass parameters in query, not in path. fetch takes no signal.

fetch returns Response for every status. X-Svc-Error: 1 means Tile generated the response; without it, the status came from the upstream. Read the header, not the status, to decide who refused. Tagged responses include 400 (a refused header, an unsupported method, or a path segment such as `..`), 401/403/410 (session, viewer, expired tile), 404 (connection), 405 (method the connection does not permit), 413 (body over the cap), 414 (URL too long), 429 (quota), 502 (upstream unreachable or response over the cap), 503 (kill switch or broker at capacity), and 504 (timeout). An unknown, ungranted, and revoked connection all answer the same tagged 404. Redirects are returned, not followed. Preserve required trailing slashes; only a leading slash is trimmed.

A plain-object body is JSON-encoded with a default JSON Content-Type; strings, Blob, FormData, and other BodyInit values are sent verbatim. Limits: request body 1 MiB, response 2 MiB, and an upstream deadline of 25 seconds by default (60 seconds in the current production deployment). Daily quotas apply per tile and connection (1,000 requests and 256 MiB by default; app admins may change them) plus app-wide caps. Requests are reserved before the call; bytes are counted after it and refuse the next call.

## Streaming

Use tile.api.stream for SSE or NDJSON; never hand-roll the broker route or method-tunneling protocol:

    const controller = new AbortController();
    window.addEventListener("pagehide", () => controller.abort(), { once: true });
    for await (const event of tile.api.stream("events", "v1/feed/", {
      method: "GET",
      signal: controller.signal
    })) {
      if (event.svcError) showBrokerError(event.error);
      else if (event.status && (event.status < 200 || event.status >= 300)) showUpstreamStatus(event.status, event.data);
      else render(event.data, event.event);
    }

Before the stream opens, broker failures throw tile.TileSvcError: unknown connection, quota, a connection not approved for streaming (400), streaming switched off or all stream slots busy (503), and a timeout before the first byte. An upstream non-2xx response is buffered and arrives as one untagged frame carrying status. An upstream 2xx with any content type other than text/event-stream or application/x-ndjson also arrives as one buffered frame, and that frame carries status too, so check the range rather than its presence. data is the parsed JSON frame, or the raw string; event is the SSE event name. After bytes begin, broker failures arrive as one final frame with svcError: true and error.

Streaming requires the app admin's per-connection stream opt-in. A stream is capped at 2 MiB in total, 30 seconds without a byte, and 5 minutes overall. Quotas apply to every viewer.

## Implementation example

For a streaming call, read [the external API example](../examples/external-api.html).

## Verification

- Private tier, approved connection, the tile admin's grant, and stream opt-in are prerequisites.
- Any credential dependency names the deployment switch and the tagged 503 fallback.
- No URL, key, cookie, or Authorization value is embedded.
- Trailing slash is preserved.
- Broker refusals, upstream statuses, and in-band stream errors remain distinguishable.
- Viewer-wide credential and quota use is disclosed.
