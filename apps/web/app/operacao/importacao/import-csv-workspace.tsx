"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ActionForm } from "@/components/action-form";
import type { ActionFeedbackState } from "@/lib/action-state";

type Resource = "partners" | "units" | "equipments" | "starlinks";
type Tone = "green" | "orange" | "blue" | "red" | "slate";

type ResourceConfig = {
  key: Resource;
  label: string;
  short: string;
  description: string;
  target: string;
  tone: Tone;
};

type TemplateResponse = {
  resource: Resource;
  csv: string;
};

type ImportCsvWorkspaceProps = {
  action: (
    state: ActionFeedbackState,
    formData: FormData,
  ) => Promise<ActionFeedbackState>;
  resources: ResourceConfig[];
  selected: Resource;
  templates: TemplateResponse[];
};

const REQUIRED_HEADERS: Record<Resource, string[]> = {
  partners: ["code", "name"],
  units: ["code", "name", "partnerCode"],
  equipments: ["tag", "name", "type", "unitCode"],
  starlinks: ["tag", "name", "unitCode"],
};

const RESOURCE_HELP: Record<Resource, { dependency: string; key: string; upsert: string }> = {
  partners: {
    dependency: "Sem dependencia previa",
    key: "code",
    upsert: "Atualiza parceiro por codigo",
  },
  units: {
    dependency: "Parceiros precisam existir",
    key: "code + partnerCode",
    upsert: "Atualiza unidade por codigo",
  },
  equipments: {
    dependency: "Unidades precisam existir",
    key: "tag + unitCode",
    upsert: "Atualiza ativo por tag",
  },
  starlinks: {
    dependency: "Unidades precisam existir",
    key: "tag + unitCode",
    upsert: "Atualiza Starlink por tag",
  },
};

const HEADER_ALIASES: Record<Resource, Record<string, string>> = {
  partners: {
    codigo: "code",
    cod: "code",
    id: "code",
    nome: "name",
    parceiro: "name",
    ativo: "isActive",
    status: "isActive",
  },
  units: {
    codigo: "code",
    cod: "code",
    id: "code",
    idcliente: "code",
    idclienteunidade: "code",
    nome: "name",
    cliente: "name",
    unidade: "name",
    cidade: "city",
    municipio: "city",
    uf: "state",
    estado: "state",
    parceiro: "partnerCode",
    codigoparceiro: "partnerCode",
    partner: "partnerCode",
    ativo: "isActive",
    status: "isActive",
  },
  equipments: {
    codigo: "tag",
    cod: "tag",
    id: "tag",
    etiqueta: "tag",
    nome: "name",
    ativo: "name",
    tipo: "type",
    categoria: "type",
    serial: "serialNumber",
    numerodeserie: "serialNumber",
    ns: "serialNumber",
    status: "status",
    unidade: "unitCode",
    codigounidade: "unitCode",
    unit: "unitCode",
    ativoestado: "isActive",
  },
  starlinks: {
    codigo: "tag",
    cod: "tag",
    id: "tag",
    etiqueta: "tag",
    nome: "name",
    serial: "serialNumber",
    numerodeserie: "serialNumber",
    ns: "serialNumber",
    status: "status",
    unidade: "unitCode",
    codigounidade: "unitCode",
    unit: "unitCode",
    ativo: "isActive",
  },
};

function Dot({ tone }: { tone: Tone }) {
  return <span className={`nova-import-dot is-${tone}`} />;
}

function Badge({ tone, children }: { tone: Tone; children: string | number }) {
  return <span className={`nova-import-badge is-${tone}`}>{children}</span>;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(value.trim());
      value = "";
      continue;
    }

    value += char;
  }

  cells.push(value.trim());
  return cells;
}

function parseCsvRows(input: string) {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/);
  return lines
    .map(splitCsvLine)
    .filter((row, index) => index === 0 || row.some((cell) => cell.trim()));
}

function escapeCsvCell(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(rows: string[][]) {
  return `${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function guessTargetHeader(resource: Resource, source: string, templateHeaders: string[]) {
  const normalizedSource = normalizeHeader(source);
  const direct = templateHeaders.find((header) => normalizeHeader(header) === normalizedSource);
  if (direct) return direct;
  return HEADER_ALIASES[resource][normalizedSource] || "";
}

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function ImportCsvWorkspace({
  action,
  resources,
  selected,
  templates,
}: ImportCsvWorkspaceProps) {
  const [resource, setResource] = useState<Resource>(selected);
  const [csv, setCsv] = useState(() => templates.find((template) => template.resource === selected)?.csv || "");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [mappingOverrides, setMappingOverrides] = useState<Record<string, string>>({});
  const [clientNotice, setClientNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedResource = resources.find((item) => item.key === resource) || resources[0];
  const selectedTemplate = templates.find((template) => template.resource === resource)?.csv || "";
  const templateHeaders = useMemo(() => parseCsvRows(selectedTemplate)[0] || [], [selectedTemplate]);
  const requiredHeaders = REQUIRED_HEADERS[resource];
  const parsedRows = useMemo(() => parseCsvRows(csv), [csv]);
  const sourceHeaders = useMemo(() => parsedRows[0] || [], [parsedRows]);
  const dataRows = useMemo(() => parsedRows.slice(1), [parsedRows]);

  const mapping = useMemo(() => {
    const next: Record<string, string> = {};
    for (const sourceHeader of sourceHeaders) {
      next[sourceHeader] =
        mappingOverrides[sourceHeader] ?? guessTargetHeader(resource, sourceHeader, templateHeaders);
    }
    return next;
  }, [mappingOverrides, resource, sourceHeaders, templateHeaders]);

  const mappedTargets = useMemo(
    () => new Set(Object.values(mapping).filter(Boolean)),
    [mapping],
  );
  const requiredReady = requiredHeaders.filter((header) => mappedTargets.has(header)).length;
  const readiness = requiredHeaders.length ? Math.round((requiredReady / requiredHeaders.length) * 100) : 0;

  const mappedCsv = useMemo(() => {
    if (!templateHeaders.length) return csv;
    const rows = [
      templateHeaders,
      ...dataRows.map((row) =>
        templateHeaders.map((targetHeader) => {
          const sourceIndex = sourceHeaders.findIndex((sourceHeader) => mapping[sourceHeader] === targetHeader);
          return sourceIndex >= 0 ? row[sourceIndex] || "" : "";
        }),
      ),
    ];
    return toCsv(rows);
  }, [csv, dataRows, mapping, sourceHeaders, templateHeaders]);

  const previewRows = useMemo(() => parseCsvRows(mappedCsv).slice(1, 6), [mappedCsv]);

  function loadTemplate(nextResource = resource) {
    const template = templates.find((item) => item.resource === nextResource)?.csv || "";
    setCsv(template);
    setFileName("");
    setFileSize("");
    setClientNotice("Template carregado no editor.");
    setMappingOverrides({});
  }

  function changeResource(nextResource: Resource) {
    setResource(nextResource);
    const template = templates.find((item) => item.resource === nextResource)?.csv || "";
    setCsv(template);
    setFileName("");
    setFileSize("");
    setClientNotice("");
    setMappingOverrides({});
  }

  async function loadFile(file: File | null | undefined) {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    setFileName(file.name);
    setFileSize(formatBytes(file.size));

    if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".txt")) {
      setClientNotice("Use CSV UTF-8. XLSX e API externa devem ser convertidos antes desta etapa.");
      return;
    }

    const text = await file.text();
    setCsv(text);
    setClientNotice(`${file.name} carregado para mapeamento e validacao.`);
    setMappingOverrides({});
  }

  return (
    <div className="nova-importacao-lit-page">
      <input
        ref={fileInputRef}
        className="nova-import-file-input"
        type="file"
        accept=".csv,text/csv,text/plain"
        onChange={(event) => loadFile(event.target.files?.[0])}
      />

      <header className="nova-import-hero">
        <div>
          <div className="nova-import-breadcrumb">Configurações / Importação</div>
          <h1>Importação de dados</h1>
          <p>Envie CSV, mapeie os campos, valide a estrutura e execute a carga operacional com controle de upsert.</p>
        </div>
        <div className="nova-import-actions">
          <Link href="/operacao/importacao">Atualizar dados</Link>
          <button type="button" className="is-primary" onClick={() => fileInputRef.current?.click()}>
            Nova importação
          </button>
        </div>
      </header>

      <section className="nova-import-top-grid">
        <div className="nova-import-card nova-import-origin-card">
          <div className="nova-import-section-head">
            <div>
              <span>Origem da importação</span>
              <h2>Selecione a entrada da carga</h2>
            </div>
            <Badge tone={selectedResource.tone}>{selectedResource.label}</Badge>
          </div>
          <div className="nova-import-source-grid">
            <button type="button" className="is-active" onClick={() => fileInputRef.current?.click()}>
              Arquivo CSV
            </button>
            <button type="button" onClick={() => loadTemplate()}>
              Template CSV
            </button>
            <Link href="/integracoes">API externa</Link>
          </div>
          <div className="nova-import-resource-strip">
            {resources.map((item) => (
              <button
                type="button"
                key={item.key}
                className={item.key === resource ? "is-active" : ""}
                onClick={() => changeResource(item.key)}
              >
                <Dot tone={item.tone} />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="nova-import-card nova-import-run-card">
          <div>
            <span>Status da carga local</span>
            <strong>{dataRows.length ? (readiness === 100 ? "Pronta para validar" : "Mapeamento pendente") : "Aguardando CSV"}</strong>
          </div>
          <div>
            <span>Registros detectados</span>
            <strong>{dataRows.length.toLocaleString("pt-BR")}</strong>
          </div>
          <div>
            <span>Campos obrigatórios</span>
            <strong>{requiredReady}/{requiredHeaders.length}</strong>
          </div>
          <Link href={`/export/${resource}`}>Baixar base atual</Link>
        </div>
      </section>

      <section className="nova-import-main-grid">
        <div className="nova-import-left">
          <div
            className="nova-import-upload-panel"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              loadFile(event.dataTransfer.files?.[0]);
            }}
          >
            <div className="nova-import-upload-head">
              <div>
                <span>Arquivo de importação</span>
                <h2>Arraste ou selecione um CSV</h2>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                Selecionar arquivo
              </button>
            </div>
            <div className="nova-import-upload-drop">
              <strong>{fileName || "Nenhum arquivo selecionado"}</strong>
              <span>{fileName ? `${fileSize} carregado no navegador` : "CSV UTF-8, separado por virgulas, ate 50MB"}</span>
              <div className="nova-import-progress">
                <i style={{ width: `${readiness}%` }} />
              </div>
              <small>{readiness}% dos campos obrigatórios mapeados</small>
            </div>
            {clientNotice ? <div className="nova-import-client-notice">{clientNotice}</div> : null}
          </div>

          <div className="nova-import-card">
            <div className="nova-import-section-head">
              <div>
                <span>Mapeamento de campos</span>
                <h2>Conecte colunas do arquivo aos campos do sistema</h2>
              </div>
              <Badge tone={readiness === 100 ? "green" : "orange"}>{`${readiness}%`}</Badge>
            </div>
            <div className="nova-import-map-table">
              <div className="nova-import-map-head">
                <span>Campo de origem</span>
                <span>Campo de destino</span>
                <span>Tipo</span>
              </div>
              {(sourceHeaders.length ? sourceHeaders : templateHeaders).map((sourceHeader) => {
                const currentTarget = mapping[sourceHeader] || guessTargetHeader(resource, sourceHeader, templateHeaders);
                return (
                  <div className="nova-import-map-row" key={sourceHeader}>
                    <b>{sourceHeader}</b>
                    <select
                      value={currentTarget}
                      onChange={(event) =>
                        setMappingOverrides((current) => ({
                          ...current,
                          [sourceHeader]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Ignorar coluna</option>
                      {templateHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                    <span>{requiredHeaders.includes(currentTarget) ? "Obrigatorio" : "Opcional"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="nova-import-right">
          <div className="nova-import-card">
            <div className="nova-import-section-head">
              <div>
                <span>Resumo da importação</span>
                <h2>Pré-validação local</h2>
              </div>
            </div>
            <div className="nova-import-summary-grid">
              <div><span>Registros</span><b>{dataRows.length}</b><small>linhas</small></div>
              <div><span>Mapeados</span><b>{mappedTargets.size}</b><small>campos</small></div>
              <div><span>Obrigatórios</span><b>{requiredReady}</b><small>de {requiredHeaders.length}</small></div>
              <div><span>Recurso</span><b>{selectedResource.short}</b><small>destino</small></div>
            </div>
          </div>

          <div className="nova-import-card nova-import-quick-preview">
            <div className="nova-import-section-head">
              <div>
                <span>Prévia rápida</span>
                <h2>Linhas mapeadas</h2>
              </div>
            </div>
            <div className="nova-import-preview-table is-compact">
              <table>
                <thead>
                  <tr>
                    {templateHeaders.slice(0, 4).map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.length ? (
                    previewRows.slice(0, 3).map((row, rowIndex) => (
                      <tr key={`${rowIndex}-${row.join("-")}`}>
                        {templateHeaders.slice(0, 4).map((header, headerIndex) => (
                          <td key={header}>{row[headerIndex] || "-"}</td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={Math.max(1, templateHeaders.slice(0, 4).length)}>Carregue um CSV para visualizar.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="nova-import-quick-rules">
              <span>{RESOURCE_HELP[resource].key}</span>
              <span>{RESOURCE_HELP[resource].dependency}</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="nova-import-card">
        <div className="nova-import-section-head">
          <div>
            <span>Pré-visualização dos dados</span>
            <h2>Primeiras linhas enviadas ao backend</h2>
            <p>Esta tabela já considera o mapeamento acima. Validar usa o mesmo CSV transformado.</p>
          </div>
          <button type="button" className="nova-import-soft-button" onClick={() => setCsv(csv)}>
            Atualizar pré-visualização
          </button>
        </div>

        <div className="nova-import-preview-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                {templateHeaders.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.length ? (
                previewRows.map((row, index) => (
                  <tr key={`${index}-${row.join("-")}`}>
                    <td>{index + 1}</td>
                    {templateHeaders.map((header, headerIndex) => (
                      <td key={header}>{row[headerIndex] || "-"}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={templateHeaders.length + 1}>Carregue um CSV com linhas para visualizar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <ActionForm
          action={action}
          submitLabel="Processar"
          pendingLabel="Processando..."
          hideSubmit
          className="nova-import-form"
        >
          <input type="hidden" name="resource" value={resource} />
          <textarea name="csv" value={mappedCsv} readOnly />
          <div className="nova-import-editor-row">
            <label>
              <span>Editor CSV de origem</span>
              <textarea
                value={csv}
                onChange={(event) => {
                  setCsv(event.target.value);
                  setFileName("");
                  setFileSize("");
                  setClientNotice("CSV editado manualmente.");
                }}
                rows={8}
                spellCheck={false}
              />
            </label>
          </div>
          <div className="nova-import-form-actions">
            <button type="submit" name="actionType" value="preview">
              Validar CSV
            </button>
            <button type="submit" name="actionType" value="execute" className="is-primary" disabled={!dataRows.length}>
              Processar lote
            </button>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
