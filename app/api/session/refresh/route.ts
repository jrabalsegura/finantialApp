import { getCurrentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getCurrentUser())) return Response.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  return new Response(null, {
    headers: {
      "Cache-Control": "no-store"
    },
    status: 204
  });
}
