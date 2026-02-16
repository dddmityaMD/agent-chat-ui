import { NextRequest, NextResponse } from "next/server";

// Custom LangGraph passthrough proxy that forwards the sais_session cookie
// to the LangGraph server. The original `langgraph-nextjs-api-passthrough`
// library only forwards x-api-key, which breaks cookie-based auth (C-FE-02).

const API_URL = process.env.LANGGRAPH_API_URL ?? "http://localhost:2024";
const API_KEY = process.env.LANGSMITH_API_KEY ?? "";

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

async function handleRequest(req: NextRequest, method: string) {
  try {
    let path = req.nextUrl.pathname.replace(/^\/?api\//, "");
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    searchParams.delete("_path");
    searchParams.delete("nxtP_path");
    const queryString = searchParams.toString()
      ? `?${searchParams.toString()}`
      : "";

    const headers: Record<string, string> = {};
    if (API_KEY) {
      headers["x-api-key"] = API_KEY;
    }

    // Forward the sais_session cookie to LangGraph server (C-FE-02 fix)
    const sessionCookie = req.cookies.get("sais_session")?.value;
    if (sessionCookie) {
      headers["Cookie"] = `sais_session=${sessionCookie}`;
    }

    const options: RequestInit & { headers: Record<string, string> } = {
      method,
      headers,
    };

    if (["POST", "PUT", "PATCH"].includes(method)) {
      options.body = await req.text();
    }

    const res = await fetch(`${API_URL}/${path}${queryString}`, options);

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: {
        ...Object.fromEntries(res.headers.entries()),
        ...getCorsHeaders(),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = (req: NextRequest) => handleRequest(req, "GET");
export const POST = (req: NextRequest) => handleRequest(req, "POST");
export const PUT = (req: NextRequest) => handleRequest(req, "PUT");
export const PATCH = (req: NextRequest) => handleRequest(req, "PATCH");
export const DELETE = (req: NextRequest) => handleRequest(req, "DELETE");
export const OPTIONS = () => {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
};
export const runtime = "edge";
