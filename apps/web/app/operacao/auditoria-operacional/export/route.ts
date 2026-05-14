import { exportSuiteCsv } from "../../_suite-pos-incidente/data";

export async function GET() {
  return exportSuiteCsv("auditoria-operacional");
}
