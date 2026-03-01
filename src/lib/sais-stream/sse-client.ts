/**
 * Low-level SSE client for LangGraph streaming endpoints.
 *
 * Replaces the LangGraph SDK's internal SSE handling with a custom
 * implementation that correctly handles subgraph `values` events
 * (which the SDK drops due to strict equality checks).
 *
 * Two entry points:
 * - `streamRun()`: POST to start a new run and stream events
 * - `joinStream()`: GET to reconnect to an existing run (Last-Event-ID)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SSEEvent {
  id?: string;
  event: string;
  data: unknown; // JSON-parsed
}

export interface StreamRunOptions {
  apiUrl: string;
  threadId: string;
  assistantId: string;
  input: unknown;
  command?: { resume?: unknown; goto?: unknown };
  streamMode?: string[];
  streamSubgraphs?: boolean;
  streamResumable?: boolean;
  onDisconnect?: string;
  checkpoint?: unknown;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export interface JoinStreamOptions {
  apiUrl: string;
  threadId: string;
  runId: string;
  lastEventId?: string;
  streamMode?: string[];
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

// ---------------------------------------------------------------------------
// SSE Decoders (ported from eventsource-parser patterns)
// ---------------------------------------------------------------------------

/**
 * Splits a byte stream into lines. Handles \r\n, \r, and \n line endings
 * and buffers partial lines across chunks.
 */
class ByteLineDecoder {
  private buffer = "";

  decode(chunk: string): string[] {
    this.buffer += chunk;
    const lines: string[] = [];
    let idx: number;

    while (true) {
      // Find the next line terminator (\r\n, \r, or \n)
      const crIdx = this.buffer.indexOf("\r");
      const nlIdx = this.buffer.indexOf("\n");

      if (crIdx === -1 && nlIdx === -1) break;

      if (crIdx !== -1 && (nlIdx === -1 || crIdx < nlIdx)) {
        idx = crIdx;
        // \r\n counts as one line ending
        const skip = this.buffer[crIdx + 1] === "\n" ? 2 : 1;
        lines.push(this.buffer.slice(0, idx));
        this.buffer = this.buffer.slice(idx + skip);
      } else {
        idx = nlIdx;
        lines.push(this.buffer.slice(0, idx));
        this.buffer = this.buffer.slice(idx + 1);
      }
    }

    return lines;
  }

  flush(): string[] {
    if (this.buffer.length > 0) {
      const line = this.buffer;
      this.buffer = "";
      return [line];
    }
    return [];
  }
}

/**
 * Parses SSE protocol lines into SSEEvent objects.
 * Handles multi-line `data:` fields by joining with newlines.
 */
class SSEDecoder {
  private eventType = "";
  private data: string[] = [];
  private lastEventId: string | undefined;

  /**
   * Feed a single line. Returns an SSEEvent when a complete event
   * is received (empty line terminates an event), or null otherwise.
   */
  feedLine(line: string): SSEEvent | null {
    // Empty line = event dispatch
    if (line === "") {
      if (this.data.length === 0) {
        // No data accumulated — reset and skip
        this.eventType = "";
        return null;
      }

      const rawData = this.data.join("\n");
      const event: SSEEvent = {
        event: this.eventType || "message",
        data: tryParseJSON(rawData),
        ...(this.lastEventId !== undefined && { id: this.lastEventId }),
      };

      // Reset for next event
      this.eventType = "";
      this.data = [];

      return event;
    }

    // Comment line (starts with :)
    if (line.startsWith(":")) return null;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      // Field name only, no value
      this.processField(line, "");
    } else {
      const field = line.slice(0, colonIdx);
      // Skip optional space after colon
      let value = line.slice(colonIdx + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      this.processField(field, value);
    }

    return null;
  }

  private processField(field: string, value: string): void {
    switch (field) {
      case "event":
        this.eventType = value;
        break;
      case "data":
        this.data.push(value);
        break;
      case "id":
        // Per spec, id must not contain null
        if (!value.includes("\0")) {
          this.lastEventId = value;
        }
        break;
      // retry, other fields: ignored
    }
  }
}

function tryParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

// ---------------------------------------------------------------------------
// Core streaming functions
// ---------------------------------------------------------------------------

/**
 * Start a new run and stream SSE events.
 *
 * POST /threads/{threadId}/runs/stream
 */
export async function* streamRun(
  options: StreamRunOptions,
): AsyncGenerator<SSEEvent> {
  const {
    apiUrl,
    threadId,
    assistantId,
    input,
    command,
    streamMode = ["values", "custom"],
    streamSubgraphs = true,
    streamResumable = true,
    onDisconnect = "continue",
    checkpoint,
    signal,
    fetchImpl = fetch,
  } = options;

  const url = `${apiUrl}/threads/${threadId}/runs/stream`;

  const body: Record<string, unknown> = {
    assistant_id: assistantId,
    stream_mode: streamMode,
    stream_subgraphs: streamSubgraphs,
    stream_resumable: streamResumable,
    on_disconnect: onDisconnect,
  };

  if (input !== undefined) body.input = input;
  if (command) body.command = command;
  if (checkpoint) body.checkpoint = checkpoint;

  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Stream request failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`,
    );
  }

  // Extract run_id from Content-Location header
  const contentLocation = response.headers.get("Content-Location");
  if (contentLocation) {
    // Format: /threads/{threadId}/runs/{runId}/stream
    const match = contentLocation.match(/\/runs\/([^/]+)/);
    if (match) {
      yield { event: "metadata", data: { run_id: match[1] } };
    }
  }

  yield* parseSSEResponse(response, signal);
}

/**
 * Reconnect to an existing run's stream.
 *
 * GET /threads/{threadId}/runs/{runId}/stream
 */
export async function* joinStream(
  options: JoinStreamOptions,
): AsyncGenerator<SSEEvent> {
  const {
    apiUrl,
    threadId,
    runId,
    lastEventId,
    streamMode,
    signal,
    fetchImpl = fetch,
  } = options;

  const params = new URLSearchParams();
  if (streamMode) {
    for (const mode of streamMode) {
      params.append("stream_mode", mode);
    }
  }
  const qs = params.toString();
  const url = `${apiUrl}/threads/${threadId}/runs/${runId}/stream${qs ? `?${qs}` : ""}`;

  const headers: Record<string, string> = {};
  if (lastEventId) {
    headers["Last-Event-ID"] = lastEventId;
  }

  const response = await fetchImpl(url, {
    method: "GET",
    headers,
    credentials: "include",
    signal,
  });

  console.log("[joinStream] URL:", url);
  console.log("[joinStream] response:", response.status, response.statusText);
  console.log("[joinStream] content-type:", response.headers.get("content-type"));

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Join stream failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`,
    );
  }

  yield* parseSSEResponse(response, signal);
}

/**
 * Parse SSE events from a fetch Response body.
 */
async function* parseSSEResponse(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const decoder = new TextDecoder();
  const lineDecoder = new ByteLineDecoder();
  const sseDecoder = new SSEDecoder();

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      console.log("[parseSSEResponse] chunk received, done:", done, "bytes:", value?.length ?? 0);
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = lineDecoder.decode(text);

      for (const line of lines) {
        const event = sseDecoder.feedLine(line);
        if (event) {
          yield event;
        }
      }
    }

    // Flush remaining
    const remaining = lineDecoder.flush();
    for (const line of remaining) {
      const event = sseDecoder.feedLine(line);
      if (event) {
        yield event;
      }
    }
    // Final empty line to flush last event
    const lastEvent = sseDecoder.feedLine("");
    if (lastEvent) {
      yield lastEvent;
    }
    console.log("[parseSSEResponse] stream ended");
  } finally {
    reader.releaseLock();
  }
}
