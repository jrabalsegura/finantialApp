import { validateBackup } from "@/domain/backup";
import { importBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input: unknown = await request.json();
    const validation = validateBackup(input);

    if (!validation.success) {
      return Response.json(
        {
          error: validation.errors[0],
          details: validation.errors
        },
        { status: 400 }
      );
    }

    await importBackup(validation.data);

    return Response.json({
      message: "Copia de seguridad restaurada correctamente."
    });
  } catch (error) {
    console.error("No se pudo restaurar la copia de seguridad.", error);

    return Response.json(
      {
        error:
          error instanceof SyntaxError
            ? "El archivo no contiene un JSON válido."
            : "No se pudo restaurar la copia. Los datos actuales no se han modificado."
      },
      { status: 500 }
    );
  }
}
