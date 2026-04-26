import { z } from "zod";

/**
 * Runtime config layer.
 *
 * `clientEnv` is safe to read from anywhere (only NEXT_PUBLIC_* values).
 * `serverEnv` must only ever be imported from server code (route handlers,
 * server actions). Importing it from a client component is an error and will
 * throw at module load to fail loudly.
 */

const DEMO_CITY_VALUES = ["los-angeles", "nyc", "nha-trang"] as const;
export type DemoCitySlug = (typeof DEMO_CITY_VALUES)[number];

const clientSchema = z.object({
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is required"),
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_DEMO_CITY: z.enum(DEMO_CITY_VALUES).default("los-angeles"),
});

const serverSchema = z.object({
  GOOGLE_ROUTES_API_KEY: z
    .string()
    .min(1, "GOOGLE_ROUTES_API_KEY is required for /api/routes"),
});

const clientParsed = clientSchema.safeParse({
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
  NEXT_PUBLIC_DEMO_CITY: process.env.NEXT_PUBLIC_DEMO_CITY,
});

if (!clientParsed.success) {
  console.warn(
    "[env] Invalid client env, using fallbacks:",
    clientParsed.error.flatten().fieldErrors,
  );
}

export const clientEnv = clientParsed.success
  ? clientParsed.data
  : {
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID:
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
      NEXT_PUBLIC_DEMO_CITY: "los-angeles" as DemoCitySlug,
    };

export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("[env] getServerEnv() called from a client bundle");
  }
  // Prefer a dedicated server-only Routes key; fall back to the browser key
  // for local development convenience. In production, set the dedicated key
  // and restrict it by IP / API in Google Cloud Console.
  const key =
    process.env.GOOGLE_ROUTES_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error(
      "Set GOOGLE_ROUTES_API_KEY (or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for dev) in .env.local",
    );
  }
  if (!process.env.GOOGLE_ROUTES_API_KEY) {
    console.warn(
      "[env] GOOGLE_ROUTES_API_KEY is not set — falling back to NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. " +
        "Configure a separate server-only key for production.",
    );
  }
  return serverSchema.parse({ GOOGLE_ROUTES_API_KEY: key });
}
