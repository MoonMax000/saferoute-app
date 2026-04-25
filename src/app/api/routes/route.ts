import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { computeRoutes } from "@/lib/google/routes-api";

export const runtime = "nodejs";

const endpointSchema = z.union([
  z.string().min(1),
  z.object({ lat: z.number(), lng: z.number() }),
]);

const inputSchema = z.object({
  origin: endpointSchema,
  destination: endpointSchema,
  travelMode: z
    .enum(["DRIVE", "WALK", "BICYCLE", "TWO_WHEELER"])
    .optional(),
  region: z.string().length(2).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const input = inputSchema.parse(json);
    const routes = await computeRoutes(input);
    return NextResponse.json({ routes });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Routes request failed";
    const status = message.startsWith("Routes API 4") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
