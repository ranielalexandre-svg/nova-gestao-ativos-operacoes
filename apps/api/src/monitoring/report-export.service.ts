import { execFile as execFileCallback } from 'child_process';
import { existsSync } from 'fs';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { Injectable } from '@nestjs/common';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { requireRuntimeModule } from '../common/runtime-node-modules';
import {
  MonitoringPrtgStyleReport,
  MonitoringReportBlock,
  MonitoringReportExportArtifact,
  MonitoringReportExportOptions,
  MonitoringReportPoint,
  MonitoringReportSeries,
} from './report.types';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 42;
const HEADER_BAND_HEIGHT = 18;
const CONTENT_TOP = 86;
const CONTENT_BOTTOM = 68;
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;
const INFO_GAP = 10;
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
  'base64',
);
const NOVA_FOOTER_LINES = [
  'Q. 106 Norte, Alameda 2, Lote 04, Sala 1001, 10o Andar, Edificio Palmas Business',
  'CEP 77.006-054 - Palmas - Tocantins',
  'sac@novatelecom.com.br | 0800 494 0103 | www.novatelecom.com.br',
];
const execFile = promisify(execFileCallback);

@Injectable()
export class MonitoringReportExportService {
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
      fileName: this.buildFileName(reports, options.format),
      mimeType: 'application/pdf',
    };
  }

  private buildPdfHtml(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ) {
    const title = this.escapeXml(options.title || 'Relatório de Consumo');
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
                  <h2 class="section-title">${this.escapeXml(
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
      ['Data de emissão', this.formatDate(new Date().toISOString())],
      [
        'Período',
        period
          ? `${this.formatDate(period.from)} a ${this.formatDate(period.to)}`
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
            <strong>${index + 1}.</strong> ${this.escapeXml(
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
      this.escapeXml(options.title || 'Relatório de Consumo'),
      `
        <section class="cover-hero">
          <div class="cover-kicker">Monitoramento corporativo</div>
          <h2 class="cover-heading">${this.escapeXml(options.title || 'Relatório de Consumo')}</h2>
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
                  <div class="meta-card-label">${this.escapeXml(label)}</div>
                  <div class="meta-card-value">${this.escapeXml(String(value))}</div>
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
        `${this.formatDate(report.period.from)} - ${this.formatDate(report.period.to)}`,
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
      this.escapeXml(options.title || 'Relatório de Consumo'),
      `
        <section class="page-title-block">
          <h2 class="page-title">${this.escapeXml(`${report.partner.name}: ${report.unit.name}`)}</h2>
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
              <span class="stat-color" style="background:${this.escapeXml(series.color)}"></span>
              <div class="stat-title">${this.escapeXml(series.label)}</div>
            </div>
            <div class="stat-values">
              <div><span>Último</span><strong>${this.escapeXml(this.formatValue(series.stats.last, series.unit))}</strong></div>
              <div><span>Mínimo</span><strong>${this.escapeXml(this.formatValue(series.stats.min, series.unit))}</strong></div>
              <div><span>Média</span><strong>${this.escapeXml(this.formatValue(series.stats.avg, series.unit))}</strong></div>
              <div><span>Máximo</span><strong>${this.escapeXml(this.formatValue(series.stats.max, series.unit))}</strong></div>
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
            Recebido ${this.escapeXml(this.formatBytes(block.consumption.receivedBytes))}
            | Enviado ${this.escapeXml(this.formatBytes(block.consumption.sentBytes))}
            | Total ${this.escapeXml(this.formatBytes(block.consumption.totalBytes))}
            | Pico down ${this.escapeXml(
              this.formatValue(block.consumption.peakReceiveBps, 'bps'),
            )}
            | Pico up ${this.escapeXml(
              this.formatValue(block.consumption.peakSendBps, 'bps'),
            )}
          </div>
        </div>
      `
      : '';

    return this.wrapPdfSheetHtml(
      this.escapeXml(options.title || 'Relatório de Consumo'),
      `
        <section class="page-title-block">
          <h2 class="page-title">${this.escapeXml(block.title)}</h2>
          <div class="page-subtitle">
            Unidade ${this.escapeXml(report.unit.name)} • Sensor ${this.escapeXml(block.sensorType)}
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
                  ${this.chartSvg(block)}
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
          <div class="sheet-month">${this.escapeXml(this.monthLabel(new Date()))}</div>
        </header>
        <main class="sheet-body">
          ${body}
        </main>
        <footer class="sheet-footer">
          ${NOVA_FOOTER_LINES.map(
            (line) => `<p class="footer-line">${this.escapeXml(line)}</p>`,
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
                  <th>${this.escapeXml(label)}</th>
                  <td>${this.escapeXml(String(value || '-'))}</td>
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
                `<div class="warning-item">• ${this.escapeXml(warning)}</div>`,
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

  private drawPdfHeader(
    page: any,
    boldFont: any,
    regularFont: any,
    rgb: any,
    title: string,
  ) {
    page.drawRectangle({
      x: 0,
      y: A4_HEIGHT - HEADER_BAND_HEIGHT,
      width: A4_WIDTH,
      height: HEADER_BAND_HEIGHT,
      color: rgb(0.34, 0.34, 0.34),
    });
    page.drawText('NOVA TELECOM', {
      x: PAGE_MARGIN,
      y: A4_HEIGHT - 46,
      size: 9,
      font: regularFont,
      color: rgb(0.11, 0.2, 0.34),
    });
    const titleLines = this.wrapPdfText(title, boldFont, 18, CONTENT_WIDTH);
    titleLines.slice(0, 2).forEach((line, index) => {
      page.drawText(line, {
        x: PAGE_MARGIN,
        y: A4_HEIGHT - 66 - index * 18,
        size: 18,
        font: boldFont,
        color: rgb(0.12, 0.5, 0.82),
      });
    });
    page.drawText(this.monthLabel(new Date()), {
      x: PAGE_MARGIN,
      y: A4_HEIGHT - 82 - Math.max(0, titleLines.length - 1) * 18,
      size: 10,
      font: regularFont,
      color: rgb(0.28, 0.33, 0.38),
    });

    return CONTENT_TOP - Math.max(0, titleLines.length - 1) * 18;
  }

  private drawPdfFooter(page: any, regularFont: any, rgb: any) {
    const footerY = 28;
    page.drawLine({
      start: { x: PAGE_MARGIN, y: footerY + 24 },
      end: { x: A4_WIDTH - PAGE_MARGIN, y: footerY + 24 },
      thickness: 0.8,
      color: rgb(0.86, 0.89, 0.93),
    });

    NOVA_FOOTER_LINES.forEach((line, index) => {
      page.drawText(line, {
        x: PAGE_MARGIN,
        y: footerY + 12 - index * 10,
        size: 8.2,
        font: regularFont,
        color: rgb(0.38, 0.42, 0.47),
      });
    });
  }

  private drawPdfCover(
    page: any,
    cursorY: number,
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
    regularFont: any,
    boldFont: any,
    rgb: any,
  ) {
    const period = reports[0]?.period;
    const rows = [
      [
        'Interessado',
        options.interestedParty || reports[0]?.partner.name || '-',
      ],
      ['Data de emissão', this.formatDate(new Date().toISOString())],
      [
        'Período',
        period
          ? `${this.formatDate(period.from)} a ${this.formatDate(period.to)}`
          : '-',
      ],
      ['Contrato', options.contractLabel || '-'],
      ['Endereço', options.addressLine || '-'],
      ['Banda contratada', options.contractedBandwidth || '-'],
      ['Unidades selecionadas', `${reports.length}`],
      ['Formato', options.format.toUpperCase()],
    ] as const;

    page.drawText('Resumo da exportação', {
      x: PAGE_MARGIN,
      y: cursorY - 4,
      size: 13,
      font: boldFont,
      color: rgb(0.18, 0.22, 0.26),
    });
    cursorY -= 24;
    cursorY = this.drawPdfInfoRows(
      page,
      cursorY,
      rows,
      regularFont,
      boldFont,
      rgb,
      {
        labelWidth: 112,
        fontSize: 10,
        lineHeight: 13,
        separator: false,
      },
    );

    page.drawText('Unidades incluídas', {
      x: PAGE_MARGIN,
      y: cursorY - 10,
      size: 12,
      font: boldFont,
      color: rgb(0.18, 0.22, 0.26),
    });
    cursorY -= 30;

    reports.slice(0, 18).forEach((report, index) => {
      const lines = this.wrapPdfText(
        `${index + 1}. ${report.unit.code} - ${report.unit.name}`,
        regularFont,
        10,
        CONTENT_WIDTH,
      );
      lines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: PAGE_MARGIN,
          y: cursorY - lineIndex * 12,
          size: 10,
          font: regularFont,
          color: rgb(0.16, 0.19, 0.23),
        });
      });
      cursorY -= lines.length * 12 + 4;
    });

    if (reports.length > 18) {
      page.drawText(`+ ${reports.length - 18} unidade(s) adicional(is)`, {
        x: PAGE_MARGIN,
        y: cursorY,
        size: 10,
        font: regularFont,
        color: rgb(0.38, 0.42, 0.47),
      });
      cursorY -= 18;
    }

    return cursorY;
  }

  private drawPdfUnitSummary(
    page: any,
    cursorY: number,
    report: MonitoringPrtgStyleReport,
    options: MonitoringReportExportOptions,
    regularFont: any,
    boldFont: any,
    rgb: any,
  ) {
    page.drawText(`${report.partner.name}: ${report.unit.name}`, {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 15,
      font: boldFont,
      color: rgb(0.12, 0.5, 0.82),
    });
    cursorY -= 22;

    const rows = [
      [
        'Período do relatório',
        `${this.formatDate(report.period.from)} - ${this.formatDate(report.period.to)}`,
      ],
      ['Horas de relatório', '24 / 7'],
      ['Parceiro', `${report.partner.code} - ${report.partner.name}`],
      ['Unidade', `${report.unit.code} - ${report.unit.name}`],
      [
        'Cidade/UF',
        [report.unit.city, report.unit.state].filter(Boolean).join('/') || '-',
      ],
      [
        'Host Zabbix',
        report.host?.hostName || report.host?.host || 'Não localizado',
      ],
      ['Integração', report.integration?.name || '-'],
      ['Contrato', options.contractLabel || '-'],
      ['Endereço', options.addressLine || '-'],
      ['Banda contratada', options.contractedBandwidth || '-'],
    ] as const;
    cursorY = this.drawPdfInfoRows(
      page,
      cursorY,
      rows,
      regularFont,
      boldFont,
      rgb,
      {
        labelWidth: 132,
        fontSize: 9.3,
        lineHeight: 12,
        separator: true,
      },
    );

    if (report.warnings.length) {
      cursorY = this.drawPdfWarnings(
        page,
        cursorY - 6,
        report.warnings,
        regularFont,
        boldFont,
        rgb,
      );
    }

    return cursorY - 4;
  }

  private drawPdfWarnings(
    page: any,
    cursorY: number,
    warnings: string[],
    regularFont: any,
    boldFont: any,
    rgb: any,
  ) {
    const warningLines = warnings.flatMap((warning) =>
      this.wrapPdfText(`• ${warning}`, regularFont, 8.8, CONTENT_WIDTH - 24),
    );
    const boxHeight = 30 + warningLines.length * 11;
    page.drawRectangle({
      x: PAGE_MARGIN,
      y: cursorY - boxHeight + 6,
      width: A4_WIDTH - PAGE_MARGIN * 2,
      height: boxHeight,
      color: rgb(0.98, 0.94, 0.95),
      borderColor: rgb(0.86, 0.45, 0.49),
      borderWidth: 1,
    });
    page.drawText('Observações', {
      x: PAGE_MARGIN + 12,
      y: cursorY - 12,
      size: 10,
      font: boldFont,
      color: rgb(0.62, 0.19, 0.23),
    });

    warningLines.forEach((line, index) => {
      page.drawText(line, {
        x: PAGE_MARGIN + 12,
        y: cursorY - 28 - index * 11,
        size: 8.8,
        font: regularFont,
        color: rgb(0.41, 0.18, 0.2),
      });
    });

    return cursorY - boxHeight - 10;
  }

  private drawPdfBlock(
    page: any,
    cursorY: number,
    block: MonitoringReportBlock,
    includeCharts: boolean,
    regularFont: any,
    boldFont: any,
    rgb: any,
  ) {
    const titleLines = this.wrapPdfText(
      block.title,
      boldFont,
      11,
      CONTENT_WIDTH - 20,
    );
    const headerHeight = Math.max(18, 10 + titleLines.length * 12);
    page.drawRectangle({
      x: PAGE_MARGIN,
      y: cursorY - headerHeight + 2,
      width: CONTENT_WIDTH,
      height: headerHeight,
      color: rgb(0.95, 0.97, 0.99),
      borderColor: rgb(0.86, 0.89, 0.93),
      borderWidth: 0.8,
    });
    titleLines.forEach((line, index) => {
      page.drawText(line, {
        x: PAGE_MARGIN + 10,
        y: cursorY - 11 - index * 12,
        size: 11,
        font: boldFont,
        color: rgb(0.16, 0.19, 0.23),
      });
    });
    cursorY -= headerHeight + 12;

    const metadata = [
      ['Tipo de sensor', block.sensorType],
      ['Origem', block.probePath],
      ['Descrição', block.description],
    ] as const;
    cursorY = this.drawPdfInfoRows(
      page,
      cursorY,
      metadata,
      regularFont,
      boldFont,
      rgb,
      {
        labelWidth: 88,
        fontSize: 8.7,
        lineHeight: 11,
        separator: true,
      },
    );

    for (const series of block.series) {
      const summary = `${series.label}: último ${this.formatValue(series.stats.last, series.unit)} | min ${this.formatValue(series.stats.min, series.unit)} | média ${this.formatValue(series.stats.avg, series.unit)} | máx ${this.formatValue(series.stats.max, series.unit)}`;
      const lines = this.wrapPdfText(summary, regularFont, 8.2, CONTENT_WIDTH);
      lines.forEach((line, index) => {
        page.drawText(line, {
          x: PAGE_MARGIN,
          y: cursorY - index * 10,
          size: 8.2,
          font: regularFont,
          color: this.pdfColor(rgb, series.color),
        });
      });
      cursorY -= lines.length * 10 + 4;
    }
    cursorY -= 4;

    if (block.consumption) {
      const consumptionLine = `Recebido ${this.formatBytes(block.consumption.receivedBytes)} | Enviado ${this.formatBytes(block.consumption.sentBytes)} | Total ${this.formatBytes(block.consumption.totalBytes)} | Pico down ${this.formatValue(block.consumption.peakReceiveBps, 'bps')} | Pico up ${this.formatValue(block.consumption.peakSendBps, 'bps')}`;
      const lines = this.wrapPdfText(
        consumptionLine,
        regularFont,
        8.2,
        CONTENT_WIDTH,
      );
      lines.forEach((line, index) => {
        page.drawText(line, {
          x: PAGE_MARGIN,
          y: cursorY - index * 10,
          size: 8.2,
          font: regularFont,
          color: rgb(0.12, 0.22, 0.36),
        });
      });
      cursorY -= lines.length * 10 + 8;
    }

    if (includeCharts) {
      const chartBounds = {
        x: PAGE_MARGIN,
        y: cursorY - 150,
        width: A4_WIDTH - PAGE_MARGIN * 2,
        height: 142,
      };
      this.drawPdfChart(page, chartBounds, block, regularFont, boldFont, rgb);
      cursorY -= 168;
    }

    return cursorY - 10;
  }

  private drawPdfInfoRows(
    page: any,
    cursorY: number,
    rows: ReadonlyArray<readonly [string, string]>,
    regularFont: any,
    boldFont: any,
    rgb: any,
    options: {
      labelWidth: number;
      fontSize: number;
      lineHeight: number;
      separator: boolean;
    },
  ) {
    const labelX = PAGE_MARGIN;
    const valueX = PAGE_MARGIN + options.labelWidth + INFO_GAP;
    const valueWidth = CONTENT_WIDTH - options.labelWidth - INFO_GAP;

    rows.forEach(([label, value], index) => {
      const valueLines = this.wrapPdfText(
        String(value || '-'),
        regularFont,
        options.fontSize,
        valueWidth,
      );
      page.drawText(`${label}:`, {
        x: labelX,
        y: cursorY,
        size: options.fontSize,
        font: boldFont,
        color: rgb(0.36, 0.39, 0.43),
      });

      valueLines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: valueX,
          y: cursorY - lineIndex * options.lineHeight,
          size: options.fontSize,
          font: regularFont,
          color: rgb(0.14, 0.17, 0.2),
        });
      });

      const rowHeight = Math.max(1, valueLines.length) * options.lineHeight + 4;
      cursorY -= rowHeight;

      if (options.separator && index < rows.length - 1) {
        page.drawLine({
          start: { x: PAGE_MARGIN, y: cursorY + 2 },
          end: { x: A4_WIDTH - PAGE_MARGIN, y: cursorY + 2 },
          thickness: 0.55,
          color: rgb(0.9, 0.92, 0.95),
        });
        cursorY -= 4;
      }
    });

    return cursorY;
  }

  private estimatePdfBlockHeight(
    block: MonitoringReportBlock,
    includeCharts: boolean,
    regularFont: any,
    boldFont: any,
  ) {
    let height = 22;
    const titleLines = this.wrapPdfText(
      block.title,
      boldFont,
      11,
      CONTENT_WIDTH - 20,
    );
    height += Math.max(18, 10 + titleLines.length * 12) + 12;

    height += this.estimatePdfInfoRowsHeight(
      [
        ['Tipo de sensor', block.sensorType],
        ['Origem', block.probePath],
        ['Descrição', block.description],
      ],
      regularFont,
      8.7,
      CONTENT_WIDTH - 88 - INFO_GAP,
      11,
      true,
    );

    block.series.forEach((series) => {
      const summary = `${series.label}: último ${this.formatValue(series.stats.last, series.unit)} | min ${this.formatValue(series.stats.min, series.unit)} | média ${this.formatValue(series.stats.avg, series.unit)} | máx ${this.formatValue(series.stats.max, series.unit)}`;
      const lines = this.wrapPdfText(summary, regularFont, 8.2, CONTENT_WIDTH);
      height += lines.length * 10 + 4;
    });
    height += 4;

    if (block.consumption) {
      const consumptionLine = `Recebido ${this.formatBytes(block.consumption.receivedBytes)} | Enviado ${this.formatBytes(block.consumption.sentBytes)} | Total ${this.formatBytes(block.consumption.totalBytes)} | Pico down ${this.formatValue(block.consumption.peakReceiveBps, 'bps')} | Pico up ${this.formatValue(block.consumption.peakSendBps, 'bps')}`;
      const lines = this.wrapPdfText(
        consumptionLine,
        regularFont,
        8.2,
        CONTENT_WIDTH,
      );
      height += lines.length * 10 + 8;
    }

    if (includeCharts) {
      height += 168;
    }

    return height + 10;
  }

  private estimatePdfInfoRowsHeight(
    rows: ReadonlyArray<readonly [string, string]>,
    regularFont: any,
    fontSize: number,
    valueWidth: number,
    lineHeight: number,
    separator: boolean,
  ) {
    return rows.reduce((total, [, value], index) => {
      const lines = this.wrapPdfText(
        String(value || '-'),
        regularFont,
        fontSize,
        valueWidth,
      );
      const rowHeight = Math.max(1, lines.length) * lineHeight + 4;
      return total + rowHeight + (separator && index < rows.length - 1 ? 4 : 0);
    }, 0);
  }

  private drawPdfChart(
    page: any,
    bounds: { x: number; y: number; width: number; height: number },
    block: MonitoringReportBlock,
    regularFont: any,
    boldFont: any,
    rgb: any,
  ) {
    const model = this.chartModel(block);
    const plotX = bounds.x + 48;
    const plotY = bounds.y + 28;
    const plotWidth = bounds.width - 72;
    const plotHeight = bounds.height - 48;

    page.drawRectangle({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.84, 0.87, 0.91),
      borderWidth: 0.9,
    });
    page.drawText(block.title, {
      x: bounds.x + 12,
      y: bounds.y + bounds.height - 16,
      size: 10,
      font: boldFont,
      color: rgb(0.16, 0.19, 0.23),
    });

    for (let index = 0; index <= 5; index += 1) {
      const lineY = plotY + (index / 5) * plotHeight;
      page.drawLine({
        start: { x: plotX, y: lineY },
        end: { x: plotX + plotWidth, y: lineY },
        thickness: 0.5,
        color: rgb(0.86, 0.89, 0.93),
      });

      const value = model.max - (index / 5) * (model.max - model.min);
      page.drawText(this.formatValue(value, model.unit), {
        x: bounds.x + 4,
        y: lineY - 3,
        size: 7,
        font: regularFont,
        color: rgb(0.34, 0.37, 0.42),
      });
    }

    for (let index = 0; index <= 7; index += 1) {
      const lineX = plotX + (index / 7) * plotWidth;
      page.drawLine({
        start: { x: lineX, y: plotY },
        end: { x: lineX, y: plotY + plotHeight },
        thickness: 0.5,
        color: rgb(0.9, 0.92, 0.95),
      });
    }

    page.drawLine({
      start: { x: plotX, y: plotY },
      end: { x: plotX, y: plotY + plotHeight },
      thickness: 0.9,
      color: rgb(0.5, 0.54, 0.59),
    });
    page.drawLine({
      start: { x: plotX, y: plotY },
      end: { x: plotX + plotWidth, y: plotY },
      thickness: 0.9,
      color: rgb(0.5, 0.54, 0.59),
    });

    for (const series of model.series) {
      for (let index = 1; index < series.points.length; index += 1) {
        const previous = series.points[index - 1];
        const current = series.points[index];
        page.drawLine({
          start: {
            x: plotX + previous.ratioX * plotWidth,
            y: plotY + (1 - previous.ratioY) * plotHeight,
          },
          end: {
            x: plotX + current.ratioX * plotWidth,
            y: plotY + (1 - current.ratioY) * plotHeight,
          },
          thickness: series.unit === 'd' ? 1.7 : 1.05,
          color: this.pdfColor(rgb, series.color),
        });
      }
    }

    model.labels.forEach((label, index) => {
      page.drawText(label, {
        x:
          plotX +
          (index / Math.max(model.labels.length - 1, 1)) * plotWidth -
          6,
        y: bounds.y + 6,
        size: 6.5,
        font: regularFont,
        color: rgb(0.34, 0.37, 0.42),
        rotate: { type: 'degrees', angle: 65 },
      });
    });

    let legendX = bounds.x + 12;
    const legendY = bounds.y + bounds.height - 30;
    model.series.forEach((series) => {
      page.drawRectangle({
        x: legendX,
        y: legendY,
        width: 8,
        height: 8,
        color: this.pdfColor(rgb, series.color),
      });
      page.drawText(series.label, {
        x: legendX + 12,
        y: legendY + 1,
        size: 7.4,
        font: regularFont,
        color: rgb(0.16, 0.19, 0.23),
      });
      legendX += 88;
    });
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
        spacing: { after: 120 },
      }),
      new Paragraph({
        text: this.monthLabel(new Date()),
        spacing: { after: 80 },
      }),
      this.docxInfoTable(docx, [
        [
          'Interessado',
          options.interestedParty || reports[0]?.partner.name || '-',
        ],
        ['Data de emissão', this.formatDate(new Date().toISOString())],
        [
          'Período',
          reports[0]
            ? `${this.formatDate(reports[0].period.from)} a ${this.formatDate(reports[0].period.to)}`
            : '-',
        ],
        ['Contrato', options.contractLabel || '-'],
        ['Endereço', options.addressLine || '-'],
        ['Banda contratada', options.contractedBandwidth || '-'],
        ['Unidades selecionadas', String(reports.length)],
        ['Formato', options.format.toUpperCase()],
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
        this.docxInfoTable(docx, [
          [
            'Período do relatório',
            `${this.formatDate(report.period.from)} - ${this.formatDate(report.period.to)}`,
          ],
          ['Parceiro', `${report.partner.code} - ${report.partner.name}`],
          ['Unidade', `${report.unit.code} - ${report.unit.name}`],
          [
            'Cidade/UF',
            [report.unit.city, report.unit.state].filter(Boolean).join('/') ||
              '-',
          ],
          [
            'Host Zabbix',
            report.host?.hostName || report.host?.host || 'Não localizado',
          ],
          ['Integração', report.integration?.name || '-'],
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
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 120, after: 60 },
          }),
        );
        children.push(
          this.docxInfoTable(docx, [
            ['Tipo de sensor', block.sensorType],
            ['Origem', block.probePath],
            ['Descrição', block.description],
          ]),
        );

        block.series.forEach((series) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${series.label}: `, bold: true }),
                new TextRun(
                  `ultimo ${this.formatValue(series.stats.last, series.unit)} | min ${this.formatValue(series.stats.min, series.unit)} | media ${this.formatValue(series.stats.avg, series.unit)} | max ${this.formatValue(series.stats.max, series.unit)}`,
                ),
              ],
            }),
          );
        });

        if (block.consumption) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Consumo: ', bold: true }),
                new TextRun(
                  `Recebido ${this.formatBytes(block.consumption.receivedBytes)} | Enviado ${this.formatBytes(block.consumption.sentBytes)} | Total ${this.formatBytes(block.consumption.totalBytes)} | Pico down ${this.formatValue(block.consumption.peakReceiveBps, 'bps')} | Pico up ${this.formatValue(block.consumption.peakSendBps, 'bps')}`,
                ),
              ],
              spacing: { after: 60 },
            }),
          );
        }

        if (options.includeCharts) {
          const svg = this.chartSvg(block);
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
      fileName: this.buildFileName(reports, options.format),
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

  private chartModel(block: MonitoringReportBlock) {
    const unit = block.series[0]?.unit || 'bps';
    const values = block.series
      .flatMap((series) => series.points.map((point) => point.value))
      .filter(
        (value): value is number =>
          typeof value === 'number' && Number.isFinite(value),
      );
    const min =
      unit === 'd' && values.length
        ? Math.max(0, Math.min(...values) * 0.96)
        : 0;
    const max = values.length ? Math.max(...values, min + 1) : 1;

    const series = block.series.map((entry) => {
      const points = this.slimPoints(entry.points, 120).map(
        (point, index, items) => ({
          value: point.value ?? 0,
          ratioX: items.length <= 1 ? 0 : index / (items.length - 1),
          ratioY: (Number(point.value || 0) - min) / Math.max(max - min, 1),
        }),
      );

      return {
        label: entry.label,
        color: entry.color,
        unit: entry.unit,
        points,
      };
    });

    const labelsSource = this.slimPoints(block.series[0]?.points || [], 6);
    const labels = labelsSource.map((point) =>
      this.formatShortLabel(point.timestamp),
    );

    return { unit, min, max, series, labels: labels.length ? labels : ['-'] };
  }

  private chartSvg(block: MonitoringReportBlock) {
    const model = this.chartModel(block);
    const width = 900;
    const height = 330;
    const left = 62;
    const top = 28;
    const plotWidth = width - 108;
    const plotHeight = 190;
    const bottom = top + plotHeight;

    const linesY = Array.from({ length: 6 })
      .map((_, index) => {
        const y = top + (index / 5) * plotHeight;
        const value = model.max - (index / 5) * (model.max - model.min);
        return `<g><line x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}" stroke="#d7dde4" stroke-width="1" /><text x="${left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#42505c">${this.escapeXml(this.formatValue(value, model.unit))}</text></g>`;
      })
      .join('');

    const linesX = Array.from({ length: 8 })
      .map((_, index) => {
        const x = left + (index / 7) * plotWidth;
        return `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="#e6ebf1" stroke-width="1" />`;
      })
      .join('');

    const seriesPaths = model.series
      .map((series) => {
        const d = series.points
          .map((point, index) => {
            const x = left + point.ratioX * plotWidth;
            const y = top + (1 - point.ratioY) * plotHeight;
            return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
          })
          .join(' ');
        return `<path d="${d}" fill="none" stroke="${series.color}" stroke-width="${series.unit === 'd' ? 3 : 1.6}" />`;
      })
      .join('');

    const labels = model.labels
      .map((label, index) => {
        const x =
          left + (index / Math.max(model.labels.length - 1, 1)) * plotWidth;
        return `<text x="${x}" y="${bottom + 28}" text-anchor="middle" font-size="10" fill="#4a5561" transform="rotate(65 ${x} ${bottom + 28})">${this.escapeXml(label)}</text>`;
      })
      .join('');

    const legend = model.series
      .map((series, index) => {
        const x = left + index * 180;
        return `<g><rect x="${x}" y="${height - 30}" width="10" height="10" fill="${series.color}" /><text x="${x + 16}" y="${height - 21}" font-size="11" fill="#1f2630">${this.escapeXml(series.label)}</text></g>`;
      })
      .join('');

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#ffffff" />
        <rect x="0" y="0" width="100%" height="24" fill="#f2f6fb" />
        <text x="20" y="17" fill="#25303a" font-size="13" font-weight="700">${this.escapeXml(block.title)}</text>
        <rect x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}" fill="#fbfcfd" stroke="#d7dde4" stroke-width="1" />
        ${linesY}
        ${linesX}
        ${seriesPaths}
        ${labels}
        ${legend}
      </svg>
    `.trim();
  }

  private slimPoints(points: MonitoringReportPoint[], maxPoints: number) {
    const valid = points.filter(
      (point) =>
        typeof point.value === 'number' && Number.isFinite(point.value),
    );
    if (valid.length <= maxPoints) {
      return valid;
    }

    const step = Math.ceil(valid.length / maxPoints);
    return valid.filter((_, index) => index % step === 0);
  }

  private formatValue(
    value: number | null | undefined,
    unit: MonitoringReportSeries['unit'] | 'bps',
  ) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '-';
    }

    if (unit === 'bps') {
      const abs = Math.abs(value);
      if (abs >= 1_000_000_000)
        return `${(value / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} Gbit/s`;
      if (abs >= 1_000_000)
        return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} Mbit/s`;
      if (abs >= 1_000)
        return `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} Kbit/s`;
      return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} bit/s`;
    }

    if (unit === 'ms') {
      return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ms`;
    }

    if (unit === '%') {
      return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} %`;
    }

    if (unit === 'd') {
      const days = Math.floor(value);
      const hours = Math.round((value - days) * 24);
      return `${days}d ${hours}h`;
    }

    return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
  }

  private formatBytes(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '-';
    }

    const abs = Math.abs(value);
    if (abs >= 1024 ** 4)
      return `${(value / 1024 ** 4).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} TB`;
    if (abs >= 1024 ** 3)
      return `${(value / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GB`;
    if (abs >= 1024 ** 2)
      return `${(value / 1024 ** 2).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MB`;
    if (abs >= 1024)
      return `${(value / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} KB`;
    return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} B`;
  }

  private formatDate(value: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Araguaina',
    }).format(new Date(value));
  }

  private formatShortLabel(value: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Araguaina',
    }).format(new Date(value));
  }

  private monthLabel(value: Date) {
    return new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Araguaina',
    }).format(value);
  }

  private buildFileName(
    reports: MonitoringPrtgStyleReport[],
    format: 'pdf' | 'docx',
  ) {
    const stamp = new Intl.DateTimeFormat('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'America/Araguaina',
    })
      .format(new Date())
      .replaceAll('-', '');
    const scope =
      reports.length === 1
        ? reports[0].unit.code.toLowerCase()
        : `${reports.length}-unidades`;
    return `nova-relatorio-consumo-${scope}-${stamp}.${format}`;
  }

  private pdfColor(rgb: (...args: number[]) => unknown, hex: string) {
    const clean = String(hex || '#23416b').replace('#', '');
    const normalized =
      clean.length === 3
        ? clean
            .split('')
            .map((item) => item + item)
            .join('')
        : clean.padEnd(6, '0').slice(0, 6);
    const red = parseInt(normalized.slice(0, 2), 16) / 255;
    const green = parseInt(normalized.slice(2, 4), 16) / 255;
    const blue = parseInt(normalized.slice(4, 6), 16) / 255;
    return rgb(red, green, blue);
  }

  private escapeXml(value: string) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private wrapPdfText(
    value: string,
    font: any,
    fontSize: number,
    maxWidth: number,
  ) {
    const text =
      String(value || '-')
        .replace(/\s+/g, ' ')
        .trim() || '-';
    if (!maxWidth || font.widthOfTextAtSize(text, fontSize) <= maxWidth) {
      return [text];
    }

    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
        current = next;
        continue;
      }

      if (current) {
        lines.push(current);
        current = '';
      }

      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        current = word;
        continue;
      }

      let fragment = '';
      for (const char of word) {
        const candidate = `${fragment}${char}`;
        if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
          fragment = candidate;
          continue;
        }
        if (fragment) {
          lines.push(fragment);
        }
        fragment = char;
      }
      current = fragment;
    }

    if (current) {
      lines.push(current);
    }

    return lines.length ? lines : ['-'];
  }
}
