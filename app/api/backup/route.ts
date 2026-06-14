import { exportBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const backup = await exportBackup();
    const date = backup.metadata.exportedAt.slice(0, 10);

    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="finanzas-backup-${date}.json"`,
        "Content-Type": "application/json; charset=utf-8"
      }
    });
  } catch (error) {
    console.error("No se pudo exportar la copia de seguridad.", error);

    return Response.json(
      { error: "No se pudo generar la copia de seguridad." },
      { status: 500 }
    );
  }
}
