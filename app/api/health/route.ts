import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json(
      { database: "ok", status: "ok" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Healthcheck: la base de datos no responde.", error);

    return Response.json(
      { database: "error", status: "error" },
      {
        headers: { "Cache-Control": "no-store" },
        status: 503
      }
    );
  }
}
