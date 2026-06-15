"use client";

import { useEffect, useRef, useState } from "react";
import {
  type BackupSummary,
  type FinancialBackup,
  validateBackup
} from "@/domain/backup";
import { dateTimeFormatter } from "@/lib/formatters";

const LAST_BACKUP_STORAGE_KEY = "financial-app:last-backup-downloaded-at";
const RESTORE_WARNING =
  "Restaurar una copia reemplazará los datos actuales de la aplicación. Esta acción puede eliminar movimientos, cuentas y cierres existentes.";

type Feedback = {
  status: "idle" | "success" | "error";
  message: string;
};

export function BackupManager() {
  const [backup, setBackup] = useState<FinancialBackup | null>(null);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({
    status: "idle",
    message: ""
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLastBackupAt(window.localStorage.getItem(LAST_BACKUP_STORAGE_KEY));
  }, []);

  async function downloadBackup() {
    setIsExporting(true);
    setFeedback({ status: "idle", message: "" });

    try {
      const response = await fetch("/api/backup", { cache: "no-store" });

      if (!response.ok) {
        throw new Error(await getResponseError(response));
      }

      const blob = await response.blob();
      const fileName =
        getDownloadFileName(response.headers.get("Content-Disposition")) ??
        `finanzas-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      const downloadedAt = new Date().toISOString();
      window.localStorage.setItem(LAST_BACKUP_STORAGE_KEY, downloadedAt);
      setLastBackupAt(downloadedAt);
      setFeedback({
        status: "success",
        message: "Copia de seguridad descargada."
      });
    } catch (error) {
      setFeedback({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo descargar la copia de seguridad."
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function selectBackupFile(file: File | undefined) {
    resetSelectedBackup();
    setFeedback({ status: "idle", message: "" });

    if (!file) return;

    setSelectedFileName(file.name);

    if (!file.name.toLowerCase().endsWith(".json")) {
      setValidationErrors(["Selecciona un archivo con extensión .json."]);
      return;
    }

    try {
      const parsed: unknown = JSON.parse(await file.text());
      const validation = validateBackup(parsed);

      if (!validation.success) {
        setValidationErrors(validation.errors);
        return;
      }

      setBackup(validation.data);
      setSummary(validation.summary);
    } catch {
      setValidationErrors(["El archivo no contiene un JSON válido."]);
    }
  }

  async function restoreBackup() {
    if (!backup || !summary || !confirmed) return;

    if (!window.confirm(`${RESTORE_WARNING}\n\n¿Continuar con la restauración?`)) {
      return;
    }

    setIsImporting(true);
    setFeedback({ status: "idle", message: "" });

    try {
      const response = await fetch("/api/backup/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(backup)
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response));
      }

      setFeedback({
        status: "success",
        message: "Copia restaurada. Los datos actuales ya corresponden al backup."
      });
      resetSelectedBackup(true);
    } catch (error) {
      setFeedback({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo restaurar la copia de seguridad."
      });
    } finally {
      setIsImporting(false);
    }
  }

  function resetSelectedBackup(keepFileName = false) {
    setBackup(null);
    setSummary(null);
    setValidationErrors([]);
    setConfirmed(false);
    if (!keepFileName) setSelectedFileName("");
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Descargar copia de seguridad
            </h2>
            <p className="mt-1 text-sm text-muted">
              Exporta cuentas, movimientos, categorías, partidas, cierres,
              reembolsos, recurrentes y la configuración del objetivo semanal
              en un único JSON.
            </p>
            <p className="mt-2 text-xs text-muted">
              {lastBackupAt
                ? `Última copia descargada desde este navegador: ${formatDateTime(
                    lastBackupAt
                  )}`
                : "Todavía no se ha registrado ninguna descarga en este navegador."}
            </p>
          </div>
          <button
            className="primary-button w-full sm:w-auto"
            disabled={isExporting || isImporting}
            onClick={downloadBackup}
            type="button"
          >
            {isExporting ? "Generando copia..." : "Descargar copia de seguridad"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="text-lg font-semibold text-ink">Restaurar copia</h2>
          <p className="mt-1 text-sm text-muted">
            Selecciona un backup JSON. Se validará y podrás revisar su contenido
            antes de restaurarlo.
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <p className="font-semibold">Importante</p>
          <p className="mt-1 text-sm">{RESTORE_WARNING}</p>
          <p className="mt-2 text-sm">
            Descarga primero una copia de los datos actuales si podrías
            necesitarlos más adelante.
          </p>
        </div>

        <label className="field-label mt-5">
          Archivo de copia de seguridad
          <input
            ref={fileInputRef}
            accept="application/json,.json"
            className="block min-h-12 w-full rounded-lg border border-line bg-white p-3 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-3 file:py-2 file:font-semibold file:text-ink"
            disabled={isImporting}
            onChange={(event) =>
              void selectBackupFile(event.target.files?.[0])
            }
            type="file"
          />
        </label>

        {validationErrors.length > 0 ? (
          <div
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900"
            role="alert"
          >
            <p className="font-semibold">La copia no es válida</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {validationErrors.slice(0, 8).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
            {validationErrors.length > 8 ? (
              <p className="mt-2 text-sm">
                Hay {validationErrors.length - 8} errores adicionales.
              </p>
            ) : null}
          </div>
        ) : null}

        {backup && summary ? (
          <div className="mt-5 grid gap-4">
            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    Copia válida: {selectedFileName}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Exportada el {formatDateTime(backup.metadata.exportedAt)} ·
                    Esquema v{backup.metadata.schemaVersion}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <SummaryItem label="Cuentas" value={summary.accounts} />
                <SummaryItem label="Movimientos" value={summary.transactions} />
                <SummaryItem label="Categorías" value={summary.categories} />
                <SummaryItem label="Partidas" value={summary.savingsBuckets} />
                <SummaryItem label="Cierres" value={summary.monthlyCloses} />
              </dl>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
              <input
                checked={confirmed}
                className="mt-0.5 h-5 w-5 shrink-0"
                disabled={isImporting}
                onChange={(event) => setConfirmed(event.target.checked)}
                type="checkbox"
              />
              <span>
                Entiendo que esta restauración reemplazará todos los datos
                actuales por los contenidos en la copia seleccionada.
              </span>
            </label>

            <button
              className="danger-button w-full sm:w-fit"
              disabled={!confirmed || isImporting || isExporting}
              onClick={restoreBackup}
              type="button"
            >
              {isImporting ? "Restaurando datos..." : "Restaurar copia"}
            </button>
          </div>
        ) : null}
      </section>

      {feedback.status !== "idle" ? (
        <p
          aria-live="polite"
          className={`rounded-lg border p-4 text-sm font-semibold ${
            feedback.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
          role={feedback.status === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-ink">{value}</dd>
    </div>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return dateTimeFormatter.format(date);
}

function getDownloadFileName(contentDisposition: string | null): string | null {
  const match = contentDisposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? null;
}

async function getResponseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // El servidor puede devolver una respuesta sin cuerpo JSON.
  }

  return "La operación no se pudo completar.";
}
