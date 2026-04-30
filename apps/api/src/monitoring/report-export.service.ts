import { execFile as execFileCallback } from 'child_process';
import { existsSync } from 'fs';
import { appendFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
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
    await this.appendMonitoringExportDebugLog(`exportReports format=${options.format} reportStyle=${options.reportStyle || 'complete'} includeCharts=${options.includeCharts} reports=${reports.length}`);
    if ((options.reportStyle || 'complete') === 'complete') {
      if (options.format === 'docx') {
        return this.buildCompleteEditableDocx(reports, options);
      }

      return this.buildCompletePdf(reports, options);
    }

    if (options.reportStyle === 'technical' && options.format === 'pdf') {
      return this.buildTechnicalPdf(reports, options);
    }

    if (options.format === 'docx') {
      return this.buildDocx(reports, options);
    }

    return this.buildPdf(reports, options);
  }

  private async appendMonitoringExportDebugLog(message: string) {
    const candidates = [
      join(process.cwd(), '.tmp'),
      join(process.cwd(), '../../.tmp'),
      join(process.cwd(), '../.tmp'),
    ];

    for (const dir of candidates) {
      try {
        await mkdir(dir, { recursive: true });
        await appendFile(
          join(dir, 'monitoring-export-debug.log'),
          `[${new Date().toISOString()}] cwd=${process.cwd()} ${message}\n`,
        );
        return;
      } catch {
        // try next
      }
    }
  }

  private async buildCompleteEditableDocx(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ): Promise<MonitoringReportExportArtifact> {
    const payload = this.buildCompleteEditableDocxPayload(reports, options);
    const official = await this.buildDocx(reports, {
      ...options,
      reportStyle: 'official',
      format: 'docx',
    });

    const dir = await mkdtemp(join(tmpdir(), 'nova-report-complete-docx-'));

    try {
      const basePath = join(dir, 'base-official.docx');
      const payloadPath = join(dir, 'payload.json');
      const outputPath = join(dir, 'complete.docx');
      const scriptPath = this.resolveMonitoringTemplatePath('render_complete_from_official_docx.py');

      await writeFile(basePath, official.buffer);
      await writeFile(payloadPath, JSON.stringify(payload));

      await this.appendMonitoringExportDebugLog(
        `complete-docx render start script=${scriptPath} base=${basePath} payload=${payloadPath} output=${outputPath}`,
      );

      try {
        await execFile('python3', [scriptPath, basePath, payloadPath, outputPath]);
      } catch (renderError) {
        const error = renderError as { message?: string; stdout?: string; stderr?: string; stack?: string; code?: unknown };
        await this.appendMonitoringExportDebugLog(
          [
            'complete-docx render failed',
            `code=${String(error.code || '')}`,
            `message=${error.message || ''}`,
            `stdout=${error.stdout || ''}`,
            `stderr=${error.stderr || ''}`,
            `stack=${error.stack || ''}`,
          ].join('\n'),
        );
        throw renderError;
      }

      await this.appendMonitoringExportDebugLog(`complete-docx render ok output=${outputPath}`);

      return {
        buffer: await readFile(outputPath),
        fileName: this.presentation
          .buildFileName(reports, 'docx')
          .replace(/\.docx$/i, '-completo.docx'),
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private buildCompleteEditableDocxPayload(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ) {
    const officialPayload = this.buildOfficialDocxTemplatePayload(reports, {
      ...options,
      reportStyle: 'official',
    });

    return {
      ...officialPayload,
      reports: reports.map((report) => ({
        unit: report.unit,
        host: report.host,
        period: report.period,
        blocks: this.sortTechnicalBlocks(report.blocks).map((block) => ({
          id: block.id,
          title: block.title,
          description: block.description,
          sensorType: block.sensorType,
          probePath: block.probePath,
          unit: block.unit,
          consumption: block.consumption
            ? {
                receivedLabel: this.presentation.formatBytes(block.consumption.receivedBytes),
                sentLabel: this.presentation.formatBytes(block.consumption.sentBytes),
                totalLabel: this.presentation.formatBytes(block.consumption.totalBytes),
                avgReceiveLabel: this.presentation.formatValue(block.consumption.avgReceiveBps, 'bps'),
                avgSendLabel: this.presentation.formatValue(block.consumption.avgSendBps, 'bps'),
                avgTotalLabel: this.presentation.formatValue(block.consumption.avgReceiveBps, 'bps'),
                peakReceiveLabel: this.presentation.formatValue(block.consumption.peakReceiveBps, 'bps'),
                peakSendLabel: this.presentation.formatValue(block.consumption.peakSendBps, 'bps'),
              }
            : null,
          series: block.series.map((series) => ({
            name: series.name,
            label: series.label,
            kind: series.kind,
            unit: series.unit,
            stats: series.stats,
            points: series.points,
          })),
        })),
      })),
    };
  }

  private resolveMonitoringTemplatePath(fileName: string) {
    const candidates = [
      join(process.cwd(), 'src/monitoring/templates', fileName),
      join(process.cwd(), 'apps/api/src/monitoring/templates', fileName),
      join(__dirname, 'templates', fileName),
      join(__dirname, '../src/monitoring/templates', fileName),
    ];

    const found = candidates.find((candidate) => existsSync(candidate));

    if (!found) {
      throw new Error(`Template não encontrado: ${fileName}`);
    }

    return found;
  }

  private async buildCompletePdf(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ): Promise<MonitoringReportExportArtifact> {
    const docx = await this.buildCompleteEditableDocx(reports, {
      ...options,
      reportStyle: 'complete',
      format: 'docx',
    });

    const pdfBuffer = await this.convertDocxBufferToPdf(docx.buffer);

    return {
      buffer: pdfBuffer,
      fileName: this.presentation
        .buildFileName(reports, 'pdf')
        .replace(/\.pdf$/i, '-completo.pdf'),
      mimeType: 'application/pdf',
    };
  }

  private async convertDocxBufferToPdf(buffer: Buffer) {
    const dir = await mkdtemp(join(tmpdir(), 'nova-report-docx-pdf-'));

    try {
      const inputPath = join(dir, 'complete.docx');
      const outputPath = join(dir, 'complete.pdf');

      await writeFile(inputPath, buffer);

      await execFile('libreoffice', [
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        dir,
        inputPath,
      ]);

      return await readFile(outputPath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async buildCoverOnlyPdf(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ): Promise<MonitoringReportExportArtifact> {
    const official = await this.buildPdf(reports, {
      ...options,
      reportStyle: 'official',
      format: 'pdf',
    });

    const coverBuffer = await this.extractFirstPdfPage(official.buffer);

    return {
      buffer: coverBuffer,
      fileName: this.presentation.buildFileName(reports, 'pdf'),
      mimeType: 'application/pdf',
    };
  }

  private async extractFirstPdfPage(buffer: Buffer) {
    const dir = await mkdtemp(join(tmpdir(), 'nova-report-cover-'));

    try {
      const inputPath = join(dir, 'input.pdf');
      const outputPattern = join(dir, 'page-%d.pdf');
      const firstPagePath = join(dir, 'page-1.pdf');

      await writeFile(inputPath, buffer);

      try {
        await execFile('pdfseparate', ['-f', '1', '-l', '1', inputPath, outputPattern]);
      } catch (pdfSeparateError) {
        try {
          await execFile('qpdf', [inputPath, '--pages', inputPath, '1', '--', firstPagePath]);
        } catch {
          throw pdfSeparateError;
        }
      }

      return await readFile(firstPagePath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async mergePdfBuffers(buffers: Buffer[]) {
    const dir = await mkdtemp(join(tmpdir(), 'nova-report-merge-'));

    try {
      const inputPaths: string[] = [];

      for (const [index, buffer] of buffers.entries()) {
        const inputPath = join(dir, `input-${index + 1}.pdf`);
        await writeFile(inputPath, buffer);
        inputPaths.push(inputPath);
      }

      const outputPath = join(dir, 'merged.pdf');

      try {
        await execFile('pdfunite', [...inputPaths, outputPath]);
      } catch (pdfUniteError) {
        try {
          await execFile('qpdf', ['--empty', '--pages', ...inputPaths, '--', outputPath]);
        } catch {
          throw pdfUniteError;
        }
      }

      return await readFile(outputPath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async buildTechnicalPdf(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ): Promise<MonitoringReportExportArtifact> {
    const html = this.buildPdfHtml(reports, {
      ...options,
      reportStyle: 'technical',
      format: 'pdf',
    });

    let bytes: Buffer;

    try {
      bytes = await this.renderPdfWithChromeCli(html);
    } catch (chromeError) {
      bytes = await this.renderPdfWithPlaywright(html, chromeError);
    }

    return {
      buffer: bytes,
      fileName: this.presentation.buildFileName(reports, 'pdf').replace('.pdf', '-tecnico.pdf'),
      mimeType: 'application/pdf',
    };
  }

  private async buildPdf(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ): Promise<MonitoringReportExportArtifact> {
    try {
      return await this.buildOfficialTemplatePdf(reports, options);
    } catch {
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
  }

  private async buildOfficialTemplatePdf(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ): Promise<MonitoringReportExportArtifact> {
    const tempDir = await mkdtemp(join(tmpdir(), 'nova-official-pdf-'));
    const docxPath = join(tempDir, 'report.docx');
    const pdfPath = join(tempDir, 'report.pdf');

    try {
      const docxArtifact = await this.buildDocx(reports, {
        ...options,
        format: 'docx',
      });

      await writeFile(docxPath, docxArtifact.buffer);

      const executables = [
        process.env.LIBREOFFICE_PATH,
        'libreoffice',
        'soffice',
      ].filter(Boolean) as string[];

      let lastError: unknown = new Error('LibreOffice/soffice indisponível para conversão PDF');

      for (const executable of executables) {
        try {
          await execFile(
            executable,
            [
              '--headless',
              '--convert-to',
              'pdf',
              '--outdir',
              tempDir,
              docxPath,
            ],
            { timeout: 45000, killSignal: 'SIGKILL' },
          );

          if (existsSync(pdfPath)) {
            return {
              buffer: await readFile(pdfPath),
              fileName: this.presentation.buildFileName(reports, options.format),
              mimeType: 'application/pdf',
            };
          }
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private buildPdfHtml(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ) {
    const title = this.presentation.escapeXml(options.title || 'Relatório de Consumo');
    const cover = options.reportStyle === 'technical' ? '' : this.buildPdfCoverHtml(reports, options);
    const reportPages = reports
      .flatMap((report) => {
        const pages = options.reportStyle === 'technical' ? [] : [this.buildPdfUnitSummaryHtml(report, options)];

        const blocks = options.reportStyle === 'technical'
          ? this.sortTechnicalBlocks(report.blocks)
          : report.blocks;

        if (blocks.length) {
          blocks.forEach((block) => {
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

            .technical-page .page-title {
              font-size: 24px;
              line-height: 1.12;
              margin-bottom: 4px;
            }
            .technical-page .page-subtitle {
              display: none;
            }
            .technical-page .layout-grid {
              gap: 12px;
              margin-bottom: 12px;
            }
            .technical-page .section-card {
              padding: 12px 14px;
              margin-bottom: 12px;
            }
            .technical-page .section-title {
              font-size: 15px;
              margin-bottom: 8px;
            }
            .technical-page .info-table th,
            .technical-page .info-table td {
              padding: 5px 8px;
              font-size: 11px;
              line-height: 1.25;
            }
            .technical-page .chart-wrap {
              padding: 8px;
              min-height: 0;
            }
            .technical-page .chart-wrap svg {
              width: 100% !important;
              height: 250px !important;
              max-height: 250px !important;
            }

            .sheet--technical .sheet-header {
              padding-bottom: 10px;
            }
            .sheet--technical .sheet-body {
              padding-bottom: 10px;
            }
            .sheet--technical .sheet-footer {
              display: none;
            }
            .sheet--technical .technical-page .page-title {
              font-size: 23px;
              margin-bottom: 4px;
            }
            .sheet--technical .technical-page .layout-grid {
              gap: 10px;
              margin-bottom: 10px;
            }
            .sheet--technical .technical-page .section-card {
              padding: 10px 12px;
              margin-bottom: 10px;
            }
            .sheet--technical .technical-page .section-title {
              font-size: 14px;
              margin-bottom: 7px;
            }
            .sheet--technical .technical-page .info-table th,
            .sheet--technical .technical-page .info-table td {
              padding: 4px 7px;
              font-size: 10.5px;
              line-height: 1.2;
            }
            .sheet--technical .technical-page .chart-wrap {
              padding: 7px;
            }
            .sheet--technical .technical-page .chart-wrap svg {
              height: 210px !important;
              max-height: 210px !important;
            }

            .sheet--technical .prtg-summary-card {
              margin-bottom: 12px;
            }
            .sheet--technical .prtg-summary-card .info-table th {
              width: 210px;
              white-space: nowrap;
            }
            .sheet--technical .prtg-summary-card .info-table td {
              width: auto;
            }
            .sheet--technical .technical-page .section-card {
              page-break-inside: avoid;
            }

            .sheet--technical .technical-page .sheet-body,
            .sheet--technical .sheet-body {
              padding-top: 10px;
              padding-bottom: 6px;
            }
            .sheet--technical .technical-page .section-card {
              padding: 8px 10px;
              margin-bottom: 8px;
            }
            .sheet--technical .technical-page .section-title {
              font-size: 13px;
              margin-bottom: 5px;
            }
            .sheet--technical .technical-page .info-table {
              table-layout: fixed;
            }
            .sheet--technical .technical-page .info-table th,
            .sheet--technical .technical-page .info-table td {
              padding: 3px 6px;
              font-size: 9.8px;
              line-height: 1.12;
              vertical-align: top;
            }
            .sheet--technical .prtg-summary-card .info-table th {
              width: 180px;
              white-space: normal;
            }
            .sheet--technical .technical-page .chart-wrap {
              padding: 5px;
              margin-bottom: 0;
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

  private sortTechnicalBlocks(blocks: MonitoringReportBlock[]) {
    const order = new Map([
      ['ping', 0],
      ['uptime', 1],
      ['traffic', 2],
      ['other', 3],
    ]);

    return [...blocks].sort((a, b) => {
      return (order.get(this.blockKind(a)) ?? 3) - (order.get(this.blockKind(b)) ?? 3);
    });
  }

  private blockKind(block: MonitoringReportBlock) {
    const searchable = [
      block.title,
      block.description,
      block.sensorType,
      block.unit,
      ...block.series.map((series) => `${series.name} ${series.label} ${series.kind}`),
    ].join(' ').toLowerCase();

    if (searchable.includes('ping') || searchable.includes('icmp') || searchable.includes('latência') || searchable.includes('latencia')) {
      return 'ping';
    }

    if (searchable.includes('uptime') || searchable.includes('tempo de atividade') || searchable.includes('disponibilidade')) {
      return 'uptime';
    }

    if (searchable.includes('traffic') || searchable.includes('tráfego') || searchable.includes('trafego') || searchable.includes('interface') || searchable.includes('link') || searchable.includes('consumo')) {
      return 'traffic';
    }

    return 'other';
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
    if (options.reportStyle === 'technical') {
      return this.buildTechnicalPdfBlockHtml(report, block, options);
    }

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

  private formatTechnicalPeriodEndpoint(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value || '-';
    }

    const two = (input: number) => String(input).padStart(2, '0');

    return `${two(date.getUTCDate())}/${two(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${two(date.getUTCHours())}:${two(date.getUTCMinutes())}:${two(date.getUTCSeconds())}`;
  }

  private technicalDataPeriodLabel(report: MonitoringPrtgStyleReport, block: MonitoringReportBlock) {
    const timestamps = block.series
      .flatMap((series) => series.points || [])
      .map((point) => point.timestamp)
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (timestamps.length >= 2) {
      const first = timestamps[0].toISOString();
      const last = timestamps[timestamps.length - 1].toISOString();

      return `${this.formatTechnicalPeriodEndpoint(first)} - ${this.formatTechnicalPeriodEndpoint(last)}`;
    }

    return `${this.formatTechnicalPeriodEndpoint(report.period.from)} - ${this.formatTechnicalPeriodEndpoint(report.period.to)}`;
  }

  private buildTechnicalExtraHeadlineRows(
    block: MonitoringReportBlock,
    primarySeries: MonitoringReportSeries | undefined,
    series: MonitoringReportSeries[],
  ): ReadonlyArray<readonly [string, string]> {
    const kind = this.blockKind(block);
    const rows: Array<readonly [string, string]> = [];

    if (primarySeries && kind !== 'traffic') {
      rows.push(['Mínimo', this.presentation.formatValue(primarySeries.stats.min, primarySeries.unit)]);
      rows.push(['Máximo', this.presentation.formatValue(primarySeries.stats.max, primarySeries.unit)]);
    }

    if (kind === 'ping') {
      const packetLoss = series.find((item) => {
        const label = `${item.label} ${item.name} ${item.kind}`.toLowerCase();
        return item.unit === '%' || label.includes('perda') || label.includes('loss');
      });

      if (packetLoss) {
        rows.push(['Perda de pacote média', this.presentation.formatValue(packetLoss.stats.avg, packetLoss.unit)]);
      }
    }

    return rows;
  }

  private technicalPointCount(series: MonitoringReportSeries[]) {
    return series.reduce((max, item) => {
      return Math.max(max, item.stats?.points || item.points?.length || 0);
    }, 0);
  }

  private technicalPacketLossSeries(series: MonitoringReportSeries[]) {
    return series.find((item) => {
      const label = `${item.label} ${item.name} ${item.kind}`.toLowerCase();
      return item.unit === '%' || label.includes('perda') || label.includes('loss');
    });
  }

  private formatTechnicalPercent(value: number) {
    return `${value.toFixed(3).replace('.', ',')} %`;
  }

  private formatTechnicalDuration(totalSeconds: number) {
    const safeSeconds = Math.max(0, Math.round(totalSeconds));
    const days = Math.floor(safeSeconds / 86400);
    const hours = Math.floor((safeSeconds % 86400) / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    return `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  private technicalDataDurationSeconds(block: MonitoringReportBlock) {
    const timestamps = block.series
      .flatMap((series) => series.points || [])
      .map((point) => point.timestamp)
      .filter(Boolean)
      .map((value) => new Date(value).getTime())
      .filter((value) => !Number.isNaN(value))
      .sort((a, b) => a - b);

    if (timestamps.length < 2) {
      return 0;
    }

    return Math.max(0, (timestamps[timestamps.length - 1] - timestamps[0]) / 1000);
  }

  private technicalGoodFailureCounts(series: MonitoringReportSeries[]) {
    const packetLoss = this.technicalPacketLossSeries(series);
    const points = (packetLoss?.points || []).filter((point) => point.value !== null && point.value !== undefined);

    if (!points.length) {
      const total = this.technicalPointCount(series);
      return { total, good: total, failed: 0 };
    }

    const failed = points.filter((point) => Number(point.value || 0) > 0).length;
    const good = Math.max(0, points.length - failed);

    return { total: points.length, good, failed };
  }

  private technicalAvailabilityStatsLabel(block: MonitoringReportBlock, series: MonitoringReportSeries[]) {
    const counts = this.technicalGoodFailureCounts(series);

    if (!counts.total) {
      return '-';
    }

    const okPercent = (counts.good / counts.total) * 100;
    const downPercent = (counts.failed / counts.total) * 100;
    const duration = this.technicalDataDurationSeconds(block);
    const okDuration = duration ? duration * (counts.good / counts.total) : 0;
    const downDuration = duration ? duration * (counts.failed / counts.total) : 0;

    return `OK: ${this.formatTechnicalPercent(okPercent)} [${this.formatTechnicalDuration(okDuration)}] Inoperante: ${this.formatTechnicalPercent(downPercent)} [${this.formatTechnicalDuration(downDuration)}]`;
  }

  private technicalRequestStatsLabel(block: MonitoringReportBlock, series: MonitoringReportSeries[]) {
    const counts = this.technicalGoodFailureCounts(series);

    if (!counts.total) {
      return '-';
    }

    const goodPercent = (counts.good / counts.total) * 100;
    const failedPercent = (counts.failed / counts.total) * 100;

    return `Bom: ${this.formatTechnicalPercent(goodPercent)} [${counts.good}] Falha: ${this.formatTechnicalPercent(failedPercent)} [${counts.failed}]`;
  }

  private technicalPdfBlockTitle(report: MonitoringPrtgStyleReport, block: MonitoringReportBlock) {
    const unitName = report.unit.name || '';
    const kind = this.blockKind(block);
    const fallbackTitle = kind === 'traffic'
      ? 'Link Traffic'
      : kind === 'ping'
        ? 'Ping'
        : kind === 'uptime'
          ? 'System Uptime'
          : 'Sensor';

    const rawTitle = (block.title || fallbackTitle).trim();
    const normalizedUnit = unitName.trim().toLowerCase();
    const normalizedTitle = rawTitle.toLowerCase();

    if (
      normalizedUnit &&
      (
        normalizedTitle === normalizedUnit ||
        normalizedTitle.startsWith(`${normalizedUnit}:`) ||
        normalizedTitle.startsWith(`${normalizedUnit} -`) ||
        normalizedTitle.startsWith(`${normalizedUnit} –`)
      )
    ) {
      return rawTitle;
    }

    return unitName ? `${unitName}: ${rawTitle}` : rawTitle;
  }

  private buildTechnicalPdfBlockHtml(
    report: MonitoringPrtgStyleReport,
    block: MonitoringReportBlock,
    options: MonitoringReportExportOptions,
  ) {
    const kind = this.blockKind(block);
    const series = block.series.slice(0, 6);
    const periodLabel = `${this.formatTechnicalPeriodEndpoint(report.period.from)} - ${this.formatTechnicalPeriodEndpoint(report.period.to)}`;

    const metadata = [
      ['Período do relatório', periodLabel],
      ['Período com dados', this.technicalDataPeriodLabel(report, block)],
      ['Horas de relatório', '24 / 7'],
      ['Tipo de sensor', block.sensorType || (kind === 'traffic' ? 'Tráfego' : kind === 'ping' ? 'Ping' : kind === 'uptime' ? 'Tempo de atividade do sistema' : '-')],
      ['Sonda, grupo, dispositivo', block.probePath || report.host?.hostName || report.host?.host || report.unit.name],
      ['Estatísticas de tempo de atividade', this.technicalAvailabilityStatsLabel(block, series)],
      ['Estatísticas de solicitação', this.technicalRequestStatsLabel(block, series)],
    ] as const;

    const primarySeries = kind === 'ping'
      ? series.find((item) => item.unit === 'ms') || series[0]
      : kind === 'uptime'
        ? series.find((item) => item.unit === 'd') || series[0]
        : kind === 'traffic'
          ? series.find((item) => item.unit === 'bps') || series[0]
          : series[0];

    const mainAverageLabel = kind === 'ping'
      ? 'Média (Tempo de ping)'
      : kind === 'uptime'
        ? 'Média (Tempo de atividade do sistema)'
        : kind === 'traffic'
          ? 'Média (Tráfego total)'
          : 'Média';

    const mainAverage = primarySeries
      ? this.presentation.formatValue(primarySeries.stats.avg, primarySeries.unit)
      : '-';

    const headlineRows: readonly (readonly [string, string])[] = [
      [mainAverageLabel, mainAverage],
      ...(kind === 'traffic' && block.consumption ? [
        ['Total (Tráfego total)', this.presentation.formatBytes(block.consumption.totalBytes)] as const,
        ['Tráfego de entrada', this.presentation.formatBytes(block.consumption.receivedBytes)] as const,
        ['Tráfego de saída', this.presentation.formatBytes(block.consumption.sentBytes)] as const,
        ['Pico download', this.presentation.formatValue(block.consumption.peakReceiveBps, 'bps')] as const,
        ['Pico upload', this.presentation.formatValue(block.consumption.peakSendBps, 'bps')] as const,
      ] : []),
    ];

    const technicalRows = [...metadata, ...headlineRows, ...this.buildTechnicalExtraHeadlineRows(block, primarySeries, series)] as ReadonlyArray<readonly [string, string]>;
    const channelRows = this.buildTechnicalChannelTableHtml(block);

    return this.wrapPdfSheetHtml(
      this.presentation.escapeXml('Relatório de Tráfego e Disponibilidade'),
      `
        <div class="technical-page">
        <section class="page-title-block">
          <h2 class="page-title">${this.presentation.escapeXml(this.technicalPdfBlockTitle(report, block))}</h2>
          <div class="page-subtitle">
            Estrutura técnica inspirada no relatório PRTG, com metadados, estatísticas, gráfico e canais.
          </div>
        </section>

                <section class="section-card prtg-summary-card">
          <h2 class="section-title">Resumo do sensor</h2>
          ${this.buildInfoTableHtml(technicalRows)}
        </section>

        ${
          options.includeCharts
            ? `
              <section class="section-card">
                <h2 class="section-title">Gráfico do sensor</h2>
                <div class="chart-wrap">
                  ${this.presentation.chartSvg(block)}
                </div>
              </section>
            `
            : ''
        }

        <section class="section-card">
          <h2 class="section-title">Canal</h2>
          ${channelRows}
        </section>
        </div>
      `,
      'technical',
    );
  }

  private buildTechnicalChannelTableHtml(block: MonitoringReportBlock) {
    const kind = this.blockKind(block);

    if (kind === 'traffic' && block.consumption) {
      const rows = [
        ['Tráfego total', '-', this.presentation.formatBytes(block.consumption.totalBytes)],
        ['Tráfego de entrada', this.presentation.formatValue(block.consumption.avgReceiveBps, 'bps'), this.presentation.formatBytes(block.consumption.receivedBytes)],
        ['Tráfego de saída', this.presentation.formatValue(block.consumption.avgSendBps, 'bps'), this.presentation.formatBytes(block.consumption.sentBytes)],
      ];

      return this.buildPlainTableHtml(['Canal', 'Média', 'Total'], rows);
    }

    const orderedSeries = kind === 'ping'
      ? [...block.series].sort((a, b) => {
          const weight = (series: MonitoringReportSeries) => series.unit === 'ms' ? 0 : series.unit === '%' ? 1 : 2;
          return weight(a) - weight(b);
        })
      : block.series;

    const rows = orderedSeries.slice(0, 8).map((series) => [
      series.label || series.name || 'Canal',
      this.presentation.formatValue(series.stats.avg, series.unit),
      this.presentation.formatValue(series.stats.min, series.unit),
      this.presentation.formatValue(series.stats.max, series.unit),
    ]);

    return this.buildPlainTableHtml(['Canal', 'Média', 'Mínimo', 'Máximo'], rows);
  }

  private buildPlainTableHtml(headers: string[], rows: string[][]) {
    return `
      <table class="info-table">
        <thead>
          <tr>
            ${headers.map((header) => `<th>${this.presentation.escapeXml(header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              ${row.map((cell) => `<td>${this.presentation.escapeXml(String(cell || '-'))}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private wrapPdfSheetHtml(
    title: string,
    body: string,
    variant: 'cover' | 'report' | 'technical' = 'report',
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
    const tempDir = await mkdtemp(join(tmpdir(), 'nova-official-docx-'));
    const payloadPath = join(tempDir, 'payload.json');
    const outputPath = join(tempDir, 'report.docx');

    try {
      const payload = this.buildOfficialDocxTemplatePayload(reports, options);
      await writeFile(payloadPath, JSON.stringify(payload), 'utf8');

      await execFile(
        'python3',
        [
          this.resolveOfficialDocxRendererPath(),
          this.resolveOfficialDocxTemplatePath(),
          payloadPath,
          outputPath,
        ],
        { timeout: 45000, killSignal: 'SIGKILL' },
      );

      return {
        buffer: await (async () => {
          const rawDocx = await readFile(outputPath);
          return options.includeCharts
            ? this.normalizeOfficialDocxWithLibreOffice(rawDocx)
            : rawDocx;
        })(),
        fileName: this.presentation.buildFileName(reports, options.format),
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private buildOfficialDocxTemplatePayload(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ) {
    type UnitReportMetadata = {
      unitId?: string;
      contractLabel?: string;
      addressLine?: string;
      contractedBandwidth?: string;
      notes?: string;
    };


    const optionalValue = (value?: string | null) => {
      const normalized = String(value || '')
        .replace(/\s+/g, ' ')
        .trim();

      return normalized && normalized !== '-' ? normalized : '';
    };

    const clean = (value?: string | null) => optionalValue(value) || '-';

    const normalizeMetadataKey = (value?: string | null) =>
      optionalValue(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    const unitMetadata = (() => {
      try {
        const parsed = JSON.parse(options.unitMetadataJson || '{}') as Record<string, UnitReportMetadata>;
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {} as Record<string, UnitReportMetadata>;
      }
    })();

    const metadataEntries = Object.values(unitMetadata).filter(Boolean);

    const metadataFrom = (
      source: Record<string, UnitReportMetadata>,
      report: MonitoringPrtgStyleReport,
    ) => {
      const displayKey = `${report.unit.code} - ${report.unit.name}`;
      const dashKey = `${report.unit.code} – ${report.unit.name}`;
      const candidates = [
        report.unit.id,
        report.unit.code,
        displayKey,
        dashKey,
        normalizeMetadataKey(report.unit.id),
        normalizeMetadataKey(report.unit.code),
        normalizeMetadataKey(displayKey),
        normalizeMetadataKey(dashKey),
      ].filter(Boolean);

      for (const candidate of candidates) {
        if (source[candidate]) return source[candidate];

        const normalizedCandidate = normalizeMetadataKey(candidate);
        if (normalizedCandidate && source[normalizedCandidate]) {
          return source[normalizedCandidate];
        }
      }

      return Object.values(source).find((entry) => {
        const entryUnitId = normalizeMetadataKey(entry?.unitId);
        return Boolean(entryUnitId && candidates.some((candidate) => entryUnitId === normalizeMetadataKey(candidate)));
      });
    };

    const formMetadataFor = (report: MonitoringPrtgStyleReport) =>
      metadataFrom(unitMetadata, report) ||
      (reports.length === 1 && metadataEntries.length === 1 ? metadataEntries[0] : {}) ||
      {};


    const metadataValue = (
      report: MonitoringPrtgStyleReport,
      field: 'contract' | 'address' | 'bandwidth',
    ) => {
      const formMetadata = formMetadataFor(report);
      if (field === 'contract') {
        return clean(formMetadata.contractLabel || report.unit.reportContractLabel || options.contractLabel);
      }

      if (field === 'bandwidth') {
        return clean(formMetadata.contractedBandwidth || report.unit.reportContractedBandwidth || options.contractedBandwidth);
      }

      return clean(
        formMetadata.addressLine ||
          report.unit.reportAddressLine ||
          options.addressLine ||
          [report.unit.city, report.unit.state].filter(Boolean).join(' - '),
      );
    };

    const monthNames = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];

    const reportDateSource = new Date(reports[0]?.period.to || new Date().toISOString());
    const reportDate = new Date(reportDateSource.getTime() - 1000);
    const automaticMonthSlashLabel = `${monthNames[reportDate.getUTCMonth()]}/${reportDate.getUTCFullYear()}`;
    const monthSlashLabel = clean(options.competenceLabel || automaticMonthSlashLabel);
    const issueDate = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date());
    const interestedParty = clean(options.interestedParty || reports[0]?.partner.name || reports[0]?.unit.name);

    return {
      monthSlashLabel,
      interestedParty,
      placeDate: clean(options.issueDateLabel || `Palmas, ${issueDate}`),
      options,
      reports: reports.map((report) => {
        const formMetadata = formMetadataFor(report);
          return {
          unit: report.unit,
          partner: report.partner,
          period: report.period,
          metadata: {
            contractLabel: metadataValue(report, 'contract'),
            addressLine: metadataValue(report, 'address'),
            contractedBandwidth: metadataValue(report, 'bandwidth'),
            notes: optionalValue(formMetadata.notes || report.unit.reportNotes),
          },
          blocks: report.blocks.map((block) => ({
            title: block.title,
            description: block.description,
            sensorType: block.sensorType,
            consumption: block.consumption
              ? {
                  receivedLabel: this.presentation.formatBytes(block.consumption.receivedBytes),
                  sentLabel: this.presentation.formatBytes(block.consumption.sentBytes),
                  totalLabel: this.presentation.formatBytes(block.consumption.totalBytes),
                  peakReceiveLabel: this.presentation.formatValue(block.consumption.peakReceiveBps, 'bps'),
                  peakSendLabel: this.presentation.formatValue(block.consumption.peakSendBps, 'bps'),
                }
              : null,
            series: options.includeCharts
              ? block.series.map((series) => ({
                  name: series.name,
                  label: series.label,
                  kind: series.kind,
                  unit: series.unit,
                  points: series.points,
                  stats: series.stats,
                }))
              : [],
          })),
        };
      }),
    };
  }

  private async normalizeOfficialDocxWithLibreOffice(input: Buffer): Promise<Buffer> {
    const tempDir = await mkdtemp(join(tmpdir(), 'nova-docx-normalize-'));
    const outputDir = join(tempDir, 'normalized');
    const inputPath = join(tempDir, 'report.docx');
    const normalizedPath = join(outputDir, 'report.docx');

    try {
      await mkdir(outputDir, { recursive: true });
      await writeFile(inputPath, input);

      const executables = [
        process.env.LIBREOFFICE_PATH,
        'libreoffice',
        'soffice',
      ].filter(Boolean) as string[];

      for (const executable of executables) {
        try {
          await execFile(
            executable,
            [
              '--headless',
              '--convert-to',
              'docx',
              '--outdir',
              outputDir,
              inputPath,
            ],
            { timeout: 45000, killSignal: 'SIGKILL' },
          );

          if (existsSync(normalizedPath)) {
            return await readFile(normalizedPath);
          }
        } catch {
          // Tenta o próximo executável.
        }
      }

      return input;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private resolveOfficialDocxTemplatePath() {
    const candidates = [
      join(process.cwd(), 'src', 'monitoring', 'templates', 'relatorio-consumo-oficial.docx'),
      join(process.cwd(), 'dist', 'src', 'monitoring', 'templates', 'relatorio-consumo-oficial.docx'),
      join(process.cwd(), 'apps', 'api', 'src', 'monitoring', 'templates', 'relatorio-consumo-oficial.docx'),
    ];

    const found = candidates.find((candidate) => existsSync(candidate));
    if (!found) {
      throw new Error('Template oficial de relatório de consumo não encontrado.');
    }

    return found;
  }

  private resolveOfficialDocxRendererPath() {
    const candidates = [
      join(process.cwd(), 'src', 'monitoring', 'templates', 'render_official_consumption_docx.py'),
      join(process.cwd(), 'dist', 'src', 'monitoring', 'templates', 'render_official_consumption_docx.py'),
      join(process.cwd(), 'apps', 'api', 'src', 'monitoring', 'templates', 'render_official_consumption_docx.py'),
    ];

    const found = candidates.find((candidate) => existsSync(candidate));
    if (!found) {
      throw new Error('Renderizador oficial de relatório de consumo não encontrado.');
    }

    return found;
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
