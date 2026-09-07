/**
 * Información de auditoría transversal a las entidades del dominio.
 * Fechas en ISO-8601 (string) para no acoplar a una librería de fechas.
 */
export interface AuditInfo {
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
