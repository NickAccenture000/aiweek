# Vector search and RAG

Reference status: manually maintained  
Tile contract checked: 2026-10-13  
Applicable skill version: 0.6.x  
Canonical sources: web/src/lib/vectorDocs.ts, web/src/sdk/tile.ts, api/src/vector/, api/src/extract/

## Eligibility and roles

Vector search works on private tiles only, depends on the tile's AI enablement and budget, and has its own app kill switch and document quota. With AI off, every verb except formats() answers 404. Gate the UI on tile.ai.available().

- Tile admin: tile.vector.index(), ingest(), and list(). An app admin who does not administer the tile gets 403.
- Any authorized viewer: tile.vector.query() and formats().

Use tile.role() and its isPageAdmin to hide admin controls, while relying on the server to authorize every operation.

## Ingest and query

- index({ documents }) → { indexed }. Each document is { id, text, metadata? } with non-empty id and text; metadata must be an object. At most 100 documents per call and a 1 MiB body.
- ingest(file, { filename, id?, contentType? }) → { indexed, id, format, units, chars }. Send the raw File or Blob. filename drives format detection and is the default citation ID; id overrides it.
- query({ query, answer? }) → { answer, sources, chunks, usage }. answer is null unless answer: true. query takes no other options; the answer model and result count are fixed by the platform.
- list() → { documents: [{ docId, filename, format, source, units, chunks, indexedBy, indexedAt }] }, newest first, no budget.
- formats() → { formats: [{ ext, mime, label }] }: pdf, pptx, docx, xlsx, html, md, csv, txt.

Ingest splits a file into source units (a PDF page, a PPTX slide, an XLSX sheet; other formats are one unit) and indexes each as document `<id>#<n>`. The platform splits every document into chunks, so indexed counts chunks, not documents. Each source is { id, score, metadata }: id is `<document id>#<chunk>`, and metadata holds yours plus docId and chunk; ingested sources add filename, format, unit (for example "page 3"), and unitIndex. Render citations from that metadata; never invent a citation absent from the result.

Managed RAG persists extracted document text in the platform vector store. Extraction is local, then text leaves Accenture for embedding. Ingest, index, and query spend the tile's AI budget; list and formats do not.

Limits: about 26 MiB per ingest and one million extracted characters (413 over either), and a standing quota of 10,000 indexed chunks per tile by default (429). An unsupported format, including legacy .doc and .ppt, returns 415. There is no OCR; an image-only or unreadable file returns 422. A 429 is either the AI budget or the chunk quota; read error.error. Vector has its own app kill switch, so a 503 can occur while plain AI still works.

The catalog lists documents recorded after catalog support landed. It is not guaranteed to enumerate older store content.

## No per-document delete

The shipped tile.vector surface has no per-document delete or deindex method. Do not generate a Delete button or invent tile.vector.delete. Deleting the tile removes its store; an expired tile's store is removed when the tile is swept after its grace period. Turning AI off hides the store but keeps it. Selective removal requires a separate platform feature.

## Implementation example

For admin ingest and viewer query, read [the complete RAG example](../examples/vector-rag.html).

## Verification

- Private tier, AI enablement, egress, persistence, budget, and quota are explicit.
- Admin-only controls use role presentation plus server-enforced methods.
- Scanned PDFs receive an honest no-OCR state.
- Answers distinguish model output from citations.
- No unsupported per-document delete control exists.
