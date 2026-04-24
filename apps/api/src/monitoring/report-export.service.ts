import { execFile as execFileCallback } from 'child_process';
import { existsSync } from 'fs';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { Injectable } from '@nestjs/common';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { requireRuntimeModule } from '../common/runtime-node-modules';
import { NOVA_FOOTER_LINES, TRANSPARENT_PNG } from './report-export.constants';
import { MonitoringReportPresentationService } from './report-presentation.service';
import {
  MonitoringPrtgStyleReport,
  MonitoringReportBlock,
  MonitoringReportExportArtifact,
  MonitoringReportExportOptions,
  MonitoringReportSeries,
} from './report.types';

const execFile = promisify(execFileCallback);

@Injectable()
export class MonitoringReportExportService {
  constructor(
    private readonly presentation: MonitoringReportPresentationService,
  ) {}

  /**
   * Exporta um ou mais relatórios no formato solicitado, preservando
   * o contrato atual de artefato retornado para a camada de aplicação.
   */
  async exportReports(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ): Promise<MonitoringReportExportArtifact> {
    if (options.format === 'docx') {
      return this.buildDocx(reports, options);
    }

    return this.buildPdf(reports, options);
  }

  private async buildPdf(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ): Promise<MonitoringReportExportArtifact> {
    const html = this.buildPdfHtml(reports, options);
    let bytes: Buffer;

    try {
      bytes = await this.renderPdfWithChromeCli(html);
    } catch (chromeError) {
      bytes = await this.renderPdfWithPlaywright(html, chromeError);
    }

    return {
      buffer: bytes,
      fileName: this.presentation.buildFileName(reports, options.format),
      mimeType: 'application/pdf',
    };
  }

  private buildPdfHtml(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ) {
    const title = this.presentation.escapeXml(options.title || 'Relatório de Consumo');
    const cover = this.buildPdfCoverHtml(reports, options);
    const reportPages = reports
      .flatMap((report) => {
        const pages = [this.buildPdfUnitSummaryHtml(report, options)];

        if (report.blocks.length) {
          report.blocks.forEach((block) => {
            pages.push(this.buildPdfBlockHtml(report, block, options));
          });
        } else if (report.warnings.length) {
          pages.push(
            this.wrapPdfSheetHtml(
              title,
              `
                <section class="section-card">
                  <h2 class="section-title">${this.presentation.escapeXml(
                    `${report.partner.name}: ${report.unit.name}`,
                  )}</h2>
                  ${this.buildWarningsHtml(report.warnings)}
                </section>
              `,
            ),
          );
        }

        return pages;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            @page {
              size: A4;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            html, body {
              margin: 0;
              padding: 0;
              background: #eef2f7;
              font-family: "Segoe UI", Arial, Helvetica, sans-serif;
              color: #1f2933;
            }

            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .sheet {
              width: 210mm;
              min-height: 297mm;
              padding: 12mm 14mm 16mm;
              margin: 0 auto;
              background: #ffffff;
              display: flex;
              flex-direction: column;
              page-break-after: always;
              break-after: page;
            }

            .sheet:last-child {
              page-break-after: auto;
              break-after: auto;
            }

            .sheet-header-band {
              height: 6mm;
              background: #575757;
              margin: -12mm -14mm 6mm;
            }

            .sheet-header {
              margin-bottom: 6mm;
            }

            .sheet--cover .sheet-header {
              margin-bottom: 9mm;
            }

            .brand {
              font-size: 9px;
              color: #1b3357;
              letter-spacing: 0.08em;
              margin-bottom: 2mm;
            }

            .sheet-title {
              margin: 0;
              font-size: 20px;
              line-height: 1.15;
              color: #177bb9;
              font-weight: 700;
            }

            .sheet--report .sheet-title {
              font-size: 17px;
            }

            .sheet-month {
              margin-top: 1.5mm;
              font-size: 11px;
              color: #4a5661;
              text-transform: capitalize;
            }

            .sheet-body {
              flex: 1;
            }

            .cover-hero {
              background: linear-gradient(135deg, #f5f9ff 0%, #eef5fb 100%);
              border: 1px solid #d6e2ee;
              border-radius: 8px;
              padding: 7mm;
              margin-bottom: 5mm;
            }

            .cover-kicker {
              font-size: 10px;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #5c6b78;
              margin-bottom: 2.5mm;
            }

            .cover-heading {
              margin: 0 0 2mm;
              font-size: 24px;
              line-height: 1.1;
              color: #184f87;
            }

            .cover-subtitle {
              font-size: 11px;
              line-height: 1.5;
              color: #43515d;
              max-width: 145mm;
            }

            .cover-meta-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 3mm;
              margin-bottom: 5mm;
            }

            .meta-card {
              border: 1px solid #d8e0e8;
              border-radius: 6px;
              padding: 3mm;
              background: #fff;
            }

            .meta-card-label {
              font-size: 9px;
              letter-spacing: 0.06em;
              text-transform: uppercase;
              color: #637180;
              margin-bottom: 1.2mm;
            }

            .meta-card-value {
              font-size: 12px;
              line-height: 1.35;
              color: #1b2733;
              font-weight: 600;
              word-break: break-word;
            }

            .layout-grid {
              display: grid;
              gap: 5mm;
            }

            .layout-grid--double {
              grid-template-columns: 1.1fr 0.9fr;
            }

            .page-title-block {
              margin-bottom: 4mm;
            }

            .page-title {
              margin: 0;
              font-size: 19px;
              line-height: 1.15;
              color: #183b63;
            }

            .page-subtitle {
              margin-top: 1.5mm;
              font-size: 11px;
              line-height: 1.45;
              color: #55626f;
            }

            .section-card {
              border: 1px solid #d8e0e8;
              background: #fff;
              border-radius: 4px;
              overflow: hidden;
              margin-bottom: 5mm;
            }

            .section-title {
              margin: 0;
              padding: 3mm 4mm;
              font-size: 14px;
              line-height: 1.25;
              color: #1f2933;
              background: #f4f7fb;
              border-bottom: 1px solid #d8e0e8;
            }

            .info-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }

            .info-table th,
            .info-table td {
              padding: 2.1mm 3mm;
              border-bottom: 1px solid #e8edf2;
              vertical-align: top;
              text-align: left;
            }

            .info-table th {
              width: 33%;
              color: #4b5763;
              font-weight: 700;
            }

            .info-table td {
              color: #18222c;
              word-break: break-word;
            }

            .stats-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 3mm;
              padding: 4mm;
            }

            .stat-card {
              border: 1px solid #dee6ee;
              border-radius: 6px;
              background: #fafcff;
              padding: 3mm;
            }

            .stat-card-head {
              display: flex;
              align-items: center;
              gap: 2mm;
              margin-bottom: 2.2mm;
            }

            .stat-color {
              width: 10px;
              height: 10px;
              border-radius: 999px;
              flex: 0 0 auto;
            }

            .stat-title {
              font-size: 11px;
              font-weight: 700;
              color: #21303d;
            }

            .stat-values {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 2mm 4mm;
              font-size: 10px;
            }

            .stat-values span {
              display: block;
              color: #62707c;
              margin-bottom: 0.5mm;
            }

            .stat-values strong {
              display: block;
              color: #1a2630;
              font-size: 11px;
            }

            .summary-list,
            .warning-list,
            .unit-list {
              margin: 0;
              padding: 4mm;
              display: grid;
              gap: 2.5mm;
            }

            .unit-item {
              padding-bottom: 2.5mm;
              border-bottom: 1px solid #edf2f6;
              font-size: 11px;
            }

            .unit-item:last-child {
              border-bottom: 0;
              padding-bottom: 0;
            }

            .metric-line {
              font-size: 11px;
              line-height: 1.45;
              color: #1e395c;
              word-break: break-word;
            }

            .consumption-banner {
              margin: 0 4mm 4mm;
              padding: 3mm 3.5mm;
              border-radius: 6px;
              border: 1px solid #d7e1ee;
              background: linear-gradient(135deg, #eef6ff 0%, #f7fbff 100%);
            }

            .metric-line strong {
              color: inherit;
            }

            .warning-box {
              margin: 4mm;
              padding: 3mm 3.5mm;
              background: #fff2f3;
              border: 1px solid #dc8a93;
              border-radius: 4px;
            }

            .warning-title {
              font-size: 11px;
              font-weight: 700;
              color: #9b3340;
              margin-bottom: 2mm;
            }

            .warning-item {
              font-size: 10px;
              line-height: 1.45;
              color: #6e2430;
            }

            .chart-wrap {
              padding: 4mm;
            }

            .unit-list--compact {
              gap: 2mm;
            }

            .unit-item--compact {
              display: flex;
              gap: 2mm;
              align-items: baseline;
            }

            .chart-wrap svg {
              width: 100%;
              height: auto;
              display: block;
            }

            .sheet-footer {
              margin-top: 6mm;
              padding-top: 3mm;
              border-top: 1px solid #d8e0e8;
              font-size: 8.5px;
              line-height: 1.45;
              color: #5f6873;
            }

            .footer-line {
              margin: 0;
            }
          </style>
        </head>
        <body>
          ${cover}
          ${reportPages}
        </body>
      </html>
    `.trim();
  }

  private buildPdfCoverHtml(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ) {
    const period = reports[0]?.period;
    const rows = [
      [
        'Interessado',
        options.interestedParty || reports[0]?.partner.name || '-',
      ],
      ['Data de emissão', this.presentation.formatDate(new Date().toISOString())],
      [
        'Período',
        period
          ? `${this.presentation.formatDate(period.from)} a ${this.presentation.formatDate(period.to)}`
          : '-',
      ],
      ['Contrato', options.contractLabel || '-'],
      ['Endereço', options.addressLine || '-'],
      ['Banda contratada', options.contractedBandwidth || '-'],
    ] as const;

    const coverStats = [
      ['Unidades', `${reports.length}`],
      ['Formato', options.format.toUpperCase()],
      ['Gráficos', options.includeCharts ? 'Incluídos' : 'Resumo geral'],
      [
        'Parceiro base',
        reports.length === 1 ? reports[0]?.partner.name || '-' : 'Lote misto',
      ],
    ] as const;

    const units = reports
      .slice(0, 24)
      .map(
        (report, index) => `
          <div class="unit-item unit-item--compact">
            <strong>${index + 1}.</strong> ${this.presentation.escapeXml(
              `${report.unit.code} - ${report.unit.name}`,
            )}
          </div>
        `,
      )
      .join('');

    const extra =
      reports.length > 24
        ? `<div class="unit-item">+ ${reports.length - 24} unidade(s) adicional(is)</div>`
        : '';

    return this.wrapPdfSheetHtml(
      this.presentation.escapeXml(options.title || 'Relatório de Consumo'),
      `
        <section class="cover-hero">
          <div class="cover-kicker">Monitoramento corporativo</div>
          <h2 class="cover-heading">${this.presentation.escapeXml(options.title || 'Relatório de Consumo')}</h2>
          <div class="cover-subtitle">
            Relatório consolidado gerado pelo NOVA Telecom com base nas coletas do Zabbix,
            estruturado para emissão corporativa com contexto operacional e comercial.
          </div>
        </section>
        <section class="cover-meta-grid">
          ${coverStats
            .map(
              ([label, value]) => `
                <article class="meta-card">
                  <div class="meta-card-label">${this.presentation.escapeXml(label)}</div>
                  <div class="meta-card-value">${this.presentation.escapeXml(String(value))}</div>
                </article>
              `,
            )
            .join('')}
        </section>
        <section class="layout-grid layout-grid--double">
          <section class="section-card">
            <h2 class="section-title">Dados da exportação</h2>
            ${this.buildInfoTableHtml(rows)}
          </section>
          <section class="section-card">
            <h2 class="section-title">Unidades incluídas</h2>
            <div class="unit-list unit-list--compact">
              ${units}
              ${extra}
            </div>
          </section>
        </section>
      `,
      'cover',
    );
  }

  private buildPdfUnitSummaryHtml(
    report: MonitoringPrtgStyleReport,
    options: MonitoringReportExportOptions,
  ) {
    const operationalRows = [
      [
        'Período do relatório',
        `${this.presentation.formatDate(report.period.from)} - ${this.presentation.formatDate(report.period.to)}`,
      ],
      ['Horas de relatório', '24 / 7'],
      [
        'Host Zabbix',
        report.host?.hostName || report.host?.host || 'Não localizado',
      ],
      ['Integração', report.integration?.name || '-'],
    ] as const;

    const registryRows = [
      ['Parceiro', `${report.partner.code} - ${report.partner.name}`],
      ['Unidade', `${report.unit.code} - ${report.unit.name}`],
      [
        'Cidade/UF',
        [report.unit.city, report.unit.state].filter(Boolean).join('/') || '-',
      ],
      ['Contrato', options.contractLabel || '-'],
      ['Endereço', options.addressLine || '-'],
      ['Banda contratada', options.contractedBandwidth || '-'],
    ] as const;

    return this.wrapPdfSheetHtml(
      this.presentation.escapeXml(options.title || 'Relatório de Consumo'),
      `
        <section class="page-title-block">
          <h2 class="page-title">${this.presentation.escapeXml(`${report.partner.name}: ${report.unit.name}`)}</h2>
          <div class="page-subtitle">
            Visão consolidada da unidade monitorada com informações operacionais,
            vínculo de host e dados comerciais de referência.
          </div>
        </section>
        <section class="layout-grid layout-grid--double">
          <section class="section-card">
            <h2 class="section-title">Contexto operacional</h2>
            ${this.buildInfoTableHtml(operationalRows)}
          </section>
          <section class="section-card">
            <h2 class="section-title">Cadastro e contrato</h2>
            ${this.buildInfoTableHtml(registryRows)}
          </section>
        </section>
        ${report.warnings.length ? this.buildWarningsHtml(report.warnings) : ''}
      `,
    );
  }

  private buildPdfBlockHtml(
    report: MonitoringPrtgStyleReport,
    block: MonitoringReportBlock,
    options: MonitoringReportExportOptions,
  ) {
    const metadata = [
      ['Tipo de sensor', block.sensorType],
      ['Origem', block.probePath],
      ['Descrição', block.description],
    ] as const;

    const seriesCards = block.series
      .map(
        (series) => `
          <article class="stat-card">
            <div class="stat-card-head">
              <span class="stat-color" style="background:${this.presentation.escapeXml(series.color)}"></span>
              <div class="stat-title">${this.presentation.escapeXml(series.label)}</div>
            </div>
            <div class="stat-values">
              <div><span>Último</span><strong>${this.presentation.escapeXml(this.presentation.formatValue(series.stats.last, series.unit))}</strong></div>
              <div><span>Mínimo</span><strong>${this.presentation.escapeXml(this.presentation.formatValue(series.stats.min, series.unit))}</strong></div>
              <div><span>Média</span><strong>${this.presentation.escapeXml(this.presentation.formatValue(series.stats.avg, series.unit))}</strong></div>
              <div><span>Máximo</span><strong>${this.presentation.escapeXml(this.presentation.formatValue(series.stats.max, series.unit))}</strong></div>
            </div>
          </article>
        `,
      )
      .join('');

    const consumption = block.consumption
      ? `
        <div class="consumption-banner">
          <div class="metric-line">
            <strong>Consumo:</strong>
            Recebido ${this.presentation.escapeXml(this.presentation.formatBytes(block.consumption.receivedBytes))}
            | Enviado ${this.presentation.escapeXml(this.presentation.formatBytes(block.consumption.sentBytes))}
            | Total ${this.presentation.escapeXml(this.presentation.formatBytes(block.consumption.totalBytes))}
            | Pico down ${this.presentation.escapeXml(
              this.presentation.formatValue(block.consumption.peakReceiveBps, 'bps'),
            )}
            | Pico up ${this.presentation.escapeXml(
              this.presentation.formatValue(block.consumption.peakSendBps, 'bps'),
            )}
          </div>
        </div>
      `
      : '';

    return this.wrapPdfSheetHtml(
      this.presentation.escapeXml(options.title || 'Relatório de Consumo'),
      `
        <section class="page-title-block">
          <h2 class="page-title">${this.presentation.escapeXml(block.title)}</h2>
          <div class="page-subtitle">
            Unidade ${this.presentation.escapeXml(report.unit.name)} • Sensor ${this.presentation.escapeXml(block.sensorType)}
          </div>
        </section>
        <section class="layout-grid layout-grid--double">
          <section class="section-card">
            <h2 class="section-title">Contexto do sensor</h2>
            ${this.buildInfoTableHtml(metadata)}
          </section>
          <section class="section-card">
            <h2 class="section-title">Indicadores</h2>
            <div class="stats-grid">
              ${seriesCards}
            </div>
            ${consumption}
          </section>
        </section>
        ${
          options.includeCharts
            ? `
              <section class="section-card">
                <h2 class="section-title">Gráfico consolidado</h2>
                <div class="chart-wrap">
                  ${this.presentation.chartSvg(block)}
                </div>
              </section>
            `
            : ''
        }
      `,
    );
  }

  private wrapPdfSheetHtml(
    title: string,
    body: string,
    variant: 'cover' | 'report' = 'report',
  ) {
    return `
      <section class="sheet sheet--${variant}">
        <div class="sheet-header-band"></div>
        <header class="sheet-header">
          <div class="brand">NOVA TELECOM</div>
          <h1 class="sheet-title">${title}</h1>
          <div class="sheet-month">${this.presentation.escapeXml(this.presentation.monthLabel(new Date()))}</div>
        </header>
        <main class="sheet-body">
          ${body}
        </main>
        <footer class="sheet-footer">
          ${NOVA_FOOTER_LINES.map(
            (line) => `<p class="footer-line">${this.presentation.escapeXml(line)}</p>`,
          ).join('')}
        </footer>
      </section>
    `;
  }

  private buildInfoTableHtml(rows: ReadonlyArray<readonly [string, string]>) {
    return `
      <table class="info-table">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <th>${this.presentation.escapeXml(label)}</th>
                  <td>${this.presentation.escapeXml(String(value || '-'))}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  private buildWarningsHtml(warnings: string[]) {
    return `
      <section class="warning-box">
        <div class="warning-title">Observações</div>
        <div class="warning-list">
          ${warnings
            .map(
              (warning) =>
                `<div class="warning-item">• ${this.presentation.escapeXml(warning)}</div>`,
            )
            .join('')}
        </div>
      </section>
    `;
  }

  private async renderPdfWithChromeCli(html: string) {
    const executable = this.findChromeCliExecutable();
    if (!executable) {
      throw new Error('Chrome CLI indisponível para exportação PDF');
    }

    const tempDir = await mkdtemp(join(tmpdir(), 'nova-report-'));
    const htmlPath = join(tempDir, 'report.html');
    const pdfPath = join(tempDir, 'report.pdf');

    try {
      await writeFile(htmlPath, html, 'utf8');
      const windowsHtmlPath = await this.toWindowsPath(htmlPath);
      const windowsPdfPath = await this.toWindowsPath(pdfPath);
      const fileUrl = `file:///${windowsHtmlPath.replace(/\\/g, '/')}`;

      await execFile(executable, [
        '--headless=new',
        '--disable-gpu',
        '--no-pdf-header-footer',
        `--print-to-pdf=${windowsPdfPath}`,
        fileUrl,
      ]);

      return await readFile(pdfPath);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async renderPdfWithPlaywright(html: string, previousError?: unknown) {
    const { chromium } = requireRuntimeModule<any>('playwright');
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const bytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '0',
          right: '0',
          bottom: '0',
          left: '0',
        },
      });
      return Buffer.from(bytes);
    } catch (error) {
      if (previousError instanceof Error) {
        throw new Error(
          `Falha ao exportar PDF via Chrome e Playwright. Chrome: ${previousError.message}. Playwright: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      throw error;
    } finally {
      await browser.close();
    }
  }

  private findChromeCliExecutable() {
    const candidates = [
      '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
      '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      '/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe',
      '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ];

    return candidates.find((candidate) => existsSync(candidate)) || null;
  }

  private async toWindowsPath(path: string) {
    const { stdout } = await execFile('wslpath', ['-w', path]);
    return stdout.trim();
  }


  private async buildDocx(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ): Promise<MonitoringReportExportArtifact> {
    const docx = requireRuntimeModule<any>('docx');
    const {
      Document,
      Packer,
      Paragraph,
      TextRun,
      HeadingLevel,
      AlignmentType,
      Table,
      TableCell,
      TableRow,
      WidthType,
      BorderStyle,
      Header,
      Footer,
      ImageRun,
      PageBreak,
    } = docx;

    const children: any[] = [
      new Paragraph({
        text: options.title || 'Relatório de Consumo',
        heading: HeadingLevel.TITLE,
        spacing: { after: 80 },
      }),
      new Paragraph({
        text: 'Relatório consolidado com base nas coletas do Zabbix, estruturado para emissão corporativa.',
        spacing: { after: 160 },
      }),
      this.docxSummaryTable(docx, [
        ['Unidades', String(reports.length)],
        ['Formato', options.format.toUpperCase()],
        ['Gráficos', options.includeCharts ? 'Incluídos' : 'Resumo geral'],
        [
          'Parceiro base',
          reports.length === 1 ? reports[0]?.partner.name || '-' : 'Lote misto',
        ],
      ]),
      new Paragraph({
        text: 'Dados da exportação',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 140, after: 70 },
      }),
      this.docxInfoTable(docx, [
        [
          'Interessado',
          options.interestedParty || reports[0]?.partner.name || '-',
        ],
        ['Data de emissão', this.presentation.formatDate(new Date().toISOString())],
        [
          'Período',
          reports[0]
            ? `${this.presentation.formatDate(reports[0].period.from)} a ${this.presentation.formatDate(reports[0].period.to)}`
            : '-',
        ],
        ['Contrato', options.contractLabel || '-'],
        ['Endereço', options.addressLine || '-'],
        ['Banda contratada', options.contractedBandwidth || '-'],
      ]),
      new Paragraph({ text: ' ' }),
      new Paragraph({
        text: 'Unidades incluídas',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 100, after: 80 },
      }),
      ...reports.map(
        (report) =>
          new Paragraph({ text: `${report.unit.code} - ${report.unit.name}` }),
      ),
      new Paragraph({ children: [new PageBreak()] }),
    ];

    for (const report of reports) {
      children.push(
        new Paragraph({
          text: `${report.partner.name}: ${report.unit.name}`,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 140, after: 100 },
        }),
      );
      children.push(
        new Paragraph({
          text: 'Visão consolidada da unidade monitorada com informações operacionais, vínculo de host e dados comerciais de referência.',
          spacing: { after: 80 },
        }),
      );
      children.push(
        new Paragraph({
          text: 'Contexto operacional',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 80, after: 60 },
        }),
      );
      children.push(
        this.docxInfoTable(docx, [
          [
            'Período do relatório',
            `${this.presentation.formatDate(report.period.from)} - ${this.presentation.formatDate(report.period.to)}`,
          ],
          ['Horas de relatório', '24 / 7'],
          [
            'Host Zabbix',
            report.host?.hostName || report.host?.host || 'Não localizado',
          ],
          ['Integração', report.integration?.name || '-'],
        ]),
      );
      children.push(
        new Paragraph({
          text: 'Cadastro e contrato',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 80, after: 60 },
        }),
      );
      children.push(
        this.docxInfoTable(docx, [
          ['Parceiro', `${report.partner.code} - ${report.partner.name}`],
          ['Unidade', `${report.unit.code} - ${report.unit.name}`],
          [
            'Cidade/UF',
            [report.unit.city, report.unit.state].filter(Boolean).join('/') ||
              '-',
          ],
          ['Contrato', options.contractLabel || '-'],
          ['Endereço', options.addressLine || '-'],
          ['Banda contratada', options.contractedBandwidth || '-'],
        ]),
      );

      if (report.warnings.length) {
        children.push(
          new Paragraph({
            text: 'Observações',
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 80, after: 60 },
          }),
        );
        report.warnings.forEach((warning) => {
          children.push(new Paragraph({ text: `• ${warning}` }));
        });
      }

      for (const block of report.blocks) {
        children.push(
          new Paragraph({
            text: block.title,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 120, after: 40 },
          }),
        );
        children.push(
          new Paragraph({
            text: `Unidade ${report.unit.name} • Sensor ${block.sensorType}`,
            spacing: { after: 70 },
          }),
        );
        children.push(
          new Paragraph({
            text: 'Contexto do sensor',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 40, after: 50 },
          }),
        );
        children.push(
          this.docxInfoTable(docx, [
            ['Tipo de sensor', block.sensorType],
            ['Origem', block.probePath],
            ['Descrição', block.description],
          ]),
        );
        children.push(
          new Paragraph({
            text: 'Indicadores',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 80, after: 50 },
          }),
        );
        children.push(this.docxSeriesStatsTable(docx, block.series));

        if (block.consumption) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Consumo: ', bold: true }),
                new TextRun(
                  `Recebido ${this.presentation.formatBytes(block.consumption.receivedBytes)} | Enviado ${this.presentation.formatBytes(block.consumption.sentBytes)} | Total ${this.presentation.formatBytes(block.consumption.totalBytes)} | Pico down ${this.presentation.formatValue(block.consumption.peakReceiveBps, 'bps')} | Pico up ${this.presentation.formatValue(block.consumption.peakSendBps, 'bps')}`,
                ),
              ],
              spacing: { after: 60 },
            }),
          );
        }

        if (options.includeCharts) {
          const svg = this.presentation.chartSvg(block);
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  type: 'svg',
                  data: Buffer.from(svg),
                  fallback: { type: 'png', data: TRANSPARENT_PNG },
                  transformation: { width: 520, height: 210 },
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 80 },
            }),
          );
        }
      }

      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    const doc = new Document({
      creator: 'NOVA Telecom',
      title: options.title || 'Relatório de Consumo',
      description: 'Relatório de monitoramento exportado pelo NOVA',
      sections: [
        {
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: options.title || 'Relatório de Consumo',
                      bold: true,
                      color: '1E7CB6',
                      size: 24,
                    }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: NOVA_FOOTER_LINES.map(
                (line) =>
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: line, color: '5F6873', size: 16 }),
                    ],
                  }),
              ),
            }),
          },
          properties: {},
          children,
        },
      ],
      styles: {
        paragraphStyles: [
          {
            id: 'Normal',
            name: 'Normal',
            run: { font: 'Arial', size: 21, color: '28333F' },
            paragraph: { spacing: { after: 90, line: 276 } },
          },
        ],
      },
    });

    const buffer = await Packer.toBuffer(doc);
    return {
      buffer,
      fileName: this.presentation.buildFileName(reports, options.format),
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  private docxInfoTable(docx: any, rows: Array<[string, string]>) {
    const {
      Table,
      TableCell,
      TableRow,
      WidthType,
      BorderStyle,
      Paragraph,
      TextRun,
    } = docx;

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, color: 'D6DCE3', size: 1 },
        bottom: { style: BorderStyle.SINGLE, color: 'D6DCE3', size: 1 },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideHorizontal: {
          style: BorderStyle.SINGLE,
          color: 'E6EBF1',
          size: 1,
        },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      rows: rows.map(
        ([label, value]) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 32, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: label, bold: true, color: '4D5863' }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 68, type: WidthType.PERCENTAGE },
                children: [new Paragraph(String(value || '-'))],
              }),
            ],
          }),
      ),
    });
  }

  private docxSummaryTable(docx: any, rows: Array<[string, string]>) {
    const {
      Table,
      TableCell,
      TableRow,
      WidthType,
      BorderStyle,
      Paragraph,
      TextRun,
    } = docx;

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      rows: [
        new TableRow({
          children: rows.map(
            ([label, value]) =>
              new TableCell({
                width: {
                  size: Math.floor(100 / rows.length),
                  type: WidthType.PERCENTAGE,
                },
                borders: {
                  top: { style: BorderStyle.SINGLE, color: 'D6DCE3', size: 1 },
                  bottom: {
                    style: BorderStyle.SINGLE,
                    color: 'D6DCE3',
                    size: 1,
                  },
                  left: { style: BorderStyle.SINGLE, color: 'D6DCE3', size: 1 },
                  right: {
                    style: BorderStyle.SINGLE,
                    color: 'D6DCE3',
                    size: 1,
                  },
                },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: label, bold: true, color: '687583' }),
                    ],
                    spacing: { after: 60 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: value,
                        bold: true,
                        color: '203242',
                        size: 24,
                      }),
                    ],
                  }),
                ],
              }),
          ),
        }),
      ],
    });
  }

  private docxSeriesStatsTable(
    docx: any,
    seriesList: MonitoringReportSeries[],
  ) {
    const {
      Table,
      TableCell,
      TableRow,
      WidthType,
      BorderStyle,
      Paragraph,
      TextRun,
    } = docx;

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, color: 'D6DCE3', size: 1 },
        bottom: { style: BorderStyle.SINGLE, color: 'D6DCE3', size: 1 },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideHorizontal: {
          style: BorderStyle.SINGLE,
          color: 'E6EBF1',
          size: 1,
        },
        insideVertical: { style: BorderStyle.SINGLE, color: 'E6EBF1', size: 1 },
      },
      rows: [
        new TableRow({
          children: ['Indicador', 'Último', 'Mínimo', 'Média', 'Máximo'].map(
            (label) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: label, bold: true, color: '3B4956' }),
                    ],
                  }),
                ],
              }),
          ),
        }),
        ...seriesList.map(
          (series) =>
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 30, type: WidthType.PERCENTAGE },
                  children: [new Paragraph(series.label)],
                }),
                new TableCell({
                  width: { size: 17, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph(
                      this.presentation.formatValue(series.stats.last, series.unit),
                    ),
                  ],
                }),
                new TableCell({
                  width: { size: 17, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph(
                      this.presentation.formatValue(series.stats.min, series.unit),
                    ),
                  ],
                }),
                new TableCell({
                  width: { size: 18, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph(
                      this.presentation.formatValue(series.stats.avg, series.unit),
                    ),
                  ],
                }),
                new TableCell({
                  width: { size: 18, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph(
                      this.presentation.formatValue(series.stats.max, series.unit),
                    ),
                  ],
                }),
              ],
            }),
        ),
      ],
    });
  }

}
