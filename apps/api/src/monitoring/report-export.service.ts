import { Injectable } from "@nestjs/common";
import { requireRuntimeModule } from "../common/runtime-node-modules";
import {
  MonitoringPrtgStyleReport,
  MonitoringReportBlock,
  MonitoringReportExportArtifact,
  MonitoringReportExportOptions,
  MonitoringReportPoint,
  MonitoringReportSeries,
} from "./report.types";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 42;
const HEADER_BAND_HEIGHT = 18;
const FOOTER_HEIGHT = 48;
const CONTENT_TOP = 86;
const CONTENT_BOTTOM = 68;
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
  "base64",
);
const NOVA_FOOTER_LINES = [
  "Q. 106 Norte, Alameda 2, Lote 04, Sala 1001, 10o Andar, Edificio Palmas Business",
  "CEP 77.006-054 - Palmas - Tocantins",
  "sac@novatelecom.com.br | 0800 494 0103 | www.novatelecom.com.br",
];

@Injectable()
export class MonitoringReportExportService {
  async exportReports(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ): Promise<MonitoringReportExportArtifact> {
    if (options.format === "docx") {
      return this.buildDocx(reports, options);
    }

    return this.buildPdf(reports, options);
  }

  private async buildPdf(
    reports: MonitoringPrtgStyleReport[],
    options: MonitoringReportExportOptions,
  ): Promise<MonitoringReportExportArtifact> {
    const { PDFDocument, StandardFonts, rgb } = requireRuntimeModule<any>("pdf-lib");
    const pdf = await PDFDocument.create();
    const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    let cursorY = this.drawPdfHeader(page, boldFont, regularFont, rgb, options.title || "Relatório de Consumo");
    cursorY = this.drawPdfCover(page, cursorY, reports, options, regularFont, boldFont, rgb);
    this.drawPdfFooter(page, regularFont, rgb);

    for (const report of reports) {
      page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
      cursorY = this.drawPdfHeader(page, boldFont, regularFont, rgb, options.title || "Relatório de Consumo");
      cursorY = this.drawPdfUnitSummary(page, cursorY, report, options, regularFont, boldFont, rgb);

      for (const block of report.blocks) {
        const estimatedHeight = options.includeCharts ? 268 : 126;
        if (cursorY - estimatedHeight < CONTENT_BOTTOM) {
          this.drawPdfFooter(page, regularFont, rgb);
          page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
          cursorY = this.drawPdfHeader(page, boldFont, regularFont, rgb, options.title || "Relatório de Consumo");
        }

        cursorY = this.drawPdfBlock(page, cursorY, block, options.includeCharts, regularFont, boldFont, rgb);
      }

      if (!report.blocks.length && report.warnings.length) {
        cursorY = this.drawPdfWarnings(page, cursorY, report.warnings, regularFont, boldFont, rgb);
      }

      this.drawPdfFooter(page, regularFont, rgb);
    }

    const bytes = await pdf.save({
      // Older desktop readers can reject PDF object streams as "corrupted".
      // Saving with classic cross-reference tables broadens compatibility.
      useObjectStreams: false,
    });
    return {
      buffer: Buffer.from(bytes),
      fileName: this.buildFileName(reports, options.format),
      mimeType: "application/pdf",
    };
  }

  private drawPdfHeader(page: any, boldFont: any, regularFont: any, rgb: any, title: string) {
    page.drawRectangle({ x: 0, y: A4_HEIGHT - HEADER_BAND_HEIGHT, width: A4_WIDTH, height: HEADER_BAND_HEIGHT, color: rgb(0.34, 0.34, 0.34) });
    page.drawText("NOVA TELECOM", {
      x: PAGE_MARGIN,
      y: A4_HEIGHT - 46,
      size: 9,
      font: regularFont,
      color: rgb(0.11, 0.2, 0.34),
    });
    page.drawText(title, {
      x: PAGE_MARGIN,
      y: A4_HEIGHT - 66,
      size: 18,
      font: boldFont,
      color: rgb(0.12, 0.5, 0.82),
    });
    page.drawText(this.monthLabel(new Date()), {
      x: PAGE_MARGIN,
      y: A4_HEIGHT - 82,
      size: 10,
      font: regularFont,
      color: rgb(0.28, 0.33, 0.38),
    });

    return CONTENT_TOP;
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
      ["Interessado", options.interestedParty || reports[0]?.partner.name || "-"],
      ["Data de emissão", this.formatDate(new Date().toISOString())],
      ["Período", period ? `${this.formatDate(period.from)} a ${this.formatDate(period.to)}` : "-"],
      ["Contrato", options.contractLabel || "-"],
      ["Endereço", options.addressLine || "-"],
      ["Banda contratada", options.contractedBandwidth || "-"],
      ["Unidades selecionadas", `${reports.length}`],
      ["Formato", options.format.toUpperCase()],
    ] as const;

    page.drawText("Resumo da exportação", {
      x: PAGE_MARGIN,
      y: cursorY - 4,
      size: 13,
      font: boldFont,
      color: rgb(0.18, 0.22, 0.26),
    });
    cursorY -= 24;

    rows.forEach(([label, value]) => {
      page.drawText(`${label}:`, {
        x: PAGE_MARGIN,
        y: cursorY,
        size: 10,
        font: boldFont,
        color: rgb(0.32, 0.36, 0.4),
      });
      page.drawText(String(value), {
        x: PAGE_MARGIN + 122,
        y: cursorY,
        size: 10,
        font: regularFont,
        color: rgb(0.16, 0.19, 0.23),
      });
      cursorY -= 18;
    });

    page.drawText("Unidades incluídas", {
      x: PAGE_MARGIN,
      y: cursorY - 10,
      size: 12,
      font: boldFont,
      color: rgb(0.18, 0.22, 0.26),
    });
    cursorY -= 30;

    reports.slice(0, 18).forEach((report, index) => {
      page.drawText(`${index + 1}. ${report.unit.code} - ${report.unit.name}`, {
        x: PAGE_MARGIN,
        y: cursorY,
        size: 10,
        font: regularFont,
        color: rgb(0.16, 0.19, 0.23),
      });
      cursorY -= 15;
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
      ["Período do relatório", `${this.formatDate(report.period.from)} - ${this.formatDate(report.period.to)}`],
      ["Horas de relatório", "24 / 7"],
      ["Parceiro", `${report.partner.code} - ${report.partner.name}`],
      ["Unidade", `${report.unit.code} - ${report.unit.name}`],
      ["Cidade/UF", [report.unit.city, report.unit.state].filter(Boolean).join("/") || "-"],
      ["Host Zabbix", report.host?.hostName || report.host?.host || "Não localizado"],
      ["Integração", report.integration?.name || "-"],
      ["Contrato", options.contractLabel || "-"],
      ["Endereço", options.addressLine || "-"],
      ["Banda contratada", options.contractedBandwidth || "-"],
    ] as const;

    for (const [label, value] of rows) {
      page.drawText(`${label}:`, {
        x: PAGE_MARGIN,
        y: cursorY,
        size: 9.3,
        font: boldFont,
        color: rgb(0.36, 0.39, 0.43),
      });
      page.drawText(String(value), {
        x: PAGE_MARGIN + 140,
        y: cursorY,
        size: 9.3,
        font: regularFont,
        color: rgb(0.14, 0.17, 0.2),
      });
      cursorY -= 16;
    }

    if (report.warnings.length) {
      cursorY = this.drawPdfWarnings(page, cursorY - 6, report.warnings, regularFont, boldFont, rgb);
    }

    return cursorY - 4;
  }

  private drawPdfWarnings(page: any, cursorY: number, warnings: string[], regularFont: any, boldFont: any, rgb: any) {
    const boxHeight = 26 + warnings.length * 13;
    page.drawRectangle({
      x: PAGE_MARGIN,
      y: cursorY - boxHeight + 6,
      width: A4_WIDTH - PAGE_MARGIN * 2,
      height: boxHeight,
      color: rgb(0.98, 0.94, 0.95),
      borderColor: rgb(0.86, 0.45, 0.49),
      borderWidth: 1,
    });
    page.drawText("Observações", {
      x: PAGE_MARGIN + 12,
      y: cursorY - 12,
      size: 10,
      font: boldFont,
      color: rgb(0.62, 0.19, 0.23),
    });

    warnings.forEach((warning, index) => {
      page.drawText(`• ${warning}`, {
        x: PAGE_MARGIN + 12,
        y: cursorY - 28 - index * 13,
        size: 8.8,
        font: regularFont,
        color: rgb(0.41, 0.18, 0.2),
      });
    });

    return cursorY - boxHeight - 10;
  }

  private drawPdfBlock(page: any, cursorY: number, block: MonitoringReportBlock, includeCharts: boolean, regularFont: any, boldFont: any, rgb: any) {
    page.drawRectangle({
      x: PAGE_MARGIN,
      y: cursorY - 16,
      width: A4_WIDTH - PAGE_MARGIN * 2,
      height: 18,
      color: rgb(0.95, 0.97, 0.99),
      borderColor: rgb(0.86, 0.89, 0.93),
      borderWidth: 0.8,
    });
    page.drawText(block.title, {
      x: PAGE_MARGIN + 10,
      y: cursorY - 11,
      size: 11,
      font: boldFont,
      color: rgb(0.16, 0.19, 0.23),
    });
    cursorY -= 30;

    const metadata = [
      ["Tipo de sensor", block.sensorType],
      ["Origem", block.probePath],
      ["Descrição", block.description],
    ] as const;

    metadata.forEach(([label, value]) => {
      page.drawText(`${label}:`, {
        x: PAGE_MARGIN,
        y: cursorY,
        size: 8.7,
        font: boldFont,
        color: rgb(0.36, 0.39, 0.43),
      });
      page.drawText(String(value), {
        x: PAGE_MARGIN + 96,
        y: cursorY,
        size: 8.7,
        font: regularFont,
        color: rgb(0.14, 0.17, 0.2),
      });
      cursorY -= 14;
    });

    block.series.forEach((series, index) => {
      const summary = `${series.label}: ultimo ${this.formatValue(series.stats.last, series.unit)} | min ${this.formatValue(series.stats.min, series.unit)} | media ${this.formatValue(series.stats.avg, series.unit)} | max ${this.formatValue(series.stats.max, series.unit)}`;
      page.drawText(summary, {
        x: PAGE_MARGIN,
        y: cursorY - index * 12,
        size: 8.2,
        font: regularFont,
        color: this.pdfColor(rgb, series.color),
      });
    });
    cursorY -= block.series.length * 12 + 8;

    if (block.consumption) {
      const consumptionLine = `Recebido ${this.formatBytes(block.consumption.receivedBytes)} | Enviado ${this.formatBytes(block.consumption.sentBytes)} | Total ${this.formatBytes(block.consumption.totalBytes)} | Pico down ${this.formatValue(block.consumption.peakReceiveBps, "bps")} | Pico up ${this.formatValue(block.consumption.peakSendBps, "bps")}`;
      page.drawText(consumptionLine, {
        x: PAGE_MARGIN,
        y: cursorY,
        size: 8.2,
        font: regularFont,
        color: rgb(0.12, 0.22, 0.36),
      });
      cursorY -= 16;
    }

    if (includeCharts) {
      const chartBounds = { x: PAGE_MARGIN, y: cursorY - 150, width: A4_WIDTH - PAGE_MARGIN * 2, height: 142 };
      this.drawPdfChart(page, chartBounds, block, regularFont, boldFont, rgb);
      cursorY -= 168;
    }

    return cursorY - 10;
  }

  private drawPdfChart(page: any, bounds: { x: number; y: number; width: number; height: number }, block: MonitoringReportBlock, regularFont: any, boldFont: any, rgb: any) {
    const model = this.chartModel(block);
    const plotX = bounds.x + 48;
    const plotY = bounds.y + 28;
    const plotWidth = bounds.width - 72;
    const plotHeight = bounds.height - 48;

    page.drawRectangle({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, color: rgb(1, 1, 1), borderColor: rgb(0.84, 0.87, 0.91), borderWidth: 0.9 });
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

    page.drawLine({ start: { x: plotX, y: plotY }, end: { x: plotX, y: plotY + plotHeight }, thickness: 0.9, color: rgb(0.5, 0.54, 0.59) });
    page.drawLine({ start: { x: plotX, y: plotY }, end: { x: plotX + plotWidth, y: plotY }, thickness: 0.9, color: rgb(0.5, 0.54, 0.59) });

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
          thickness: series.unit === "d" ? 1.7 : 1.05,
          color: this.pdfColor(rgb, series.color),
        });
      }
    }

    model.labels.forEach((label, index) => {
      page.drawText(label, {
        x: plotX + (index / Math.max(model.labels.length - 1, 1)) * plotWidth - 6,
        y: bounds.y + 6,
        size: 6.5,
        font: regularFont,
        color: rgb(0.34, 0.37, 0.42),
        rotate: { type: "degrees", angle: 65 },
      });
    });

    let legendX = bounds.x + 12;
    const legendY = bounds.y + bounds.height - 30;
    model.series.forEach((series) => {
      page.drawRectangle({ x: legendX, y: legendY, width: 8, height: 8, color: this.pdfColor(rgb, series.color) });
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
    const docx = requireRuntimeModule<any>("docx");
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
        text: options.title || "Relatório de Consumo",
        heading: HeadingLevel.TITLE,
        spacing: { after: 120 },
      }),
      new Paragraph({ text: this.monthLabel(new Date()), spacing: { after: 80 } }),
      this.docxInfoTable(docx, [
        ["Interessado", options.interestedParty || reports[0]?.partner.name || "-"],
        ["Data de emissão", this.formatDate(new Date().toISOString())],
        ["Período", reports[0] ? `${this.formatDate(reports[0].period.from)} a ${this.formatDate(reports[0].period.to)}` : "-"],
        ["Contrato", options.contractLabel || "-"],
        ["Endereço", options.addressLine || "-"],
        ["Banda contratada", options.contractedBandwidth || "-"],
        ["Unidades selecionadas", String(reports.length)],
        ["Formato", options.format.toUpperCase()],
      ]),
      new Paragraph({ text: " " }),
      new Paragraph({ text: "Unidades incluídas", heading: HeadingLevel.HEADING_2, spacing: { before: 100, after: 80 } }),
      ...reports.map((report) => new Paragraph({ text: `${report.unit.code} - ${report.unit.name}` })),
      new Paragraph({ children: [new PageBreak()] }),
    ];

    for (const report of reports) {
      children.push(new Paragraph({ text: `${report.partner.name}: ${report.unit.name}`, heading: HeadingLevel.HEADING_1, spacing: { before: 140, after: 100 } }));
      children.push(this.docxInfoTable(docx, [
        ["Período do relatório", `${this.formatDate(report.period.from)} - ${this.formatDate(report.period.to)}`],
        ["Parceiro", `${report.partner.code} - ${report.partner.name}`],
        ["Unidade", `${report.unit.code} - ${report.unit.name}`],
        ["Cidade/UF", [report.unit.city, report.unit.state].filter(Boolean).join("/") || "-"],
        ["Host Zabbix", report.host?.hostName || report.host?.host || "Não localizado"],
        ["Integração", report.integration?.name || "-"],
        ["Contrato", options.contractLabel || "-"],
        ["Endereço", options.addressLine || "-"],
        ["Banda contratada", options.contractedBandwidth || "-"],
      ]));

      if (report.warnings.length) {
        children.push(new Paragraph({ text: "Observações", heading: HeadingLevel.HEADING_3, spacing: { before: 80, after: 60 } }));
        report.warnings.forEach((warning) => {
          children.push(new Paragraph({ text: `• ${warning}` }));
        });
      }

      for (const block of report.blocks) {
        children.push(new Paragraph({ text: block.title, heading: HeadingLevel.HEADING_2, spacing: { before: 120, after: 60 } }));
        children.push(this.docxInfoTable(docx, [
          ["Tipo de sensor", block.sensorType],
          ["Origem", block.probePath],
          ["Descrição", block.description],
        ]));

        block.series.forEach((series) => {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${series.label}: `, bold: true }),
              new TextRun(`ultimo ${this.formatValue(series.stats.last, series.unit)} | min ${this.formatValue(series.stats.min, series.unit)} | media ${this.formatValue(series.stats.avg, series.unit)} | max ${this.formatValue(series.stats.max, series.unit)}`),
            ],
          }));
        });

        if (block.consumption) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: "Consumo: ", bold: true }),
              new TextRun(`Recebido ${this.formatBytes(block.consumption.receivedBytes)} | Enviado ${this.formatBytes(block.consumption.sentBytes)} | Total ${this.formatBytes(block.consumption.totalBytes)} | Pico down ${this.formatValue(block.consumption.peakReceiveBps, "bps")} | Pico up ${this.formatValue(block.consumption.peakSendBps, "bps")}`),
            ],
            spacing: { after: 60 },
          }));
        }

        if (options.includeCharts) {
          const svg = this.chartSvg(block);
          children.push(new Paragraph({
            children: [
              new ImageRun({
                type: "svg",
                data: Buffer.from(svg),
                fallback: { type: "png", data: TRANSPARENT_PNG },
                transformation: { width: 520, height: 210 },
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
          }));
        }
      }

      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    const doc = new Document({
      creator: "NOVA Telecom",
      title: options.title || "Relatório de Consumo",
      description: "Relatório de monitoramento exportado pelo NOVA",
      sections: [
        {
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: options.title || "Relatório de Consumo", bold: true, color: "1E7CB6", size: 24 })],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: NOVA_FOOTER_LINES.map((line) => new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: line, color: "5F6873", size: 16 })],
              })),
            }),
          },
          properties: {},
          children,
        },
      ],
      styles: {
        paragraphStyles: [
          {
            id: "Normal",
            name: "Normal",
            run: { font: "Arial", size: 21, color: "28333F" },
            paragraph: { spacing: { after: 90, line: 276 } },
          },
        ],
      },
    });

    const buffer = await Packer.toBuffer(doc);
    return {
      buffer,
      fileName: this.buildFileName(reports, options.format),
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  private docxInfoTable(docx: any, rows: Array<[string, string]>) {
    const { Table, TableCell, TableRow, WidthType, BorderStyle, Paragraph, TextRun } = docx;

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, color: "D6DCE3", size: 1 },
        bottom: { style: BorderStyle.SINGLE, color: "D6DCE3", size: 1 },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideHorizontal: { style: BorderStyle.SINGLE, color: "E6EBF1", size: 1 },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      },
      rows: rows.map(([label, value]) => new TableRow({
        children: [
          new TableCell({
            width: { size: 32, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: "4D5863" })] })],
          }),
          new TableCell({
            width: { size: 68, type: WidthType.PERCENTAGE },
            children: [new Paragraph(String(value || "-"))],
          }),
        ],
      })),
    });
  }

  private chartModel(block: MonitoringReportBlock) {
    const unit = block.series[0]?.unit || "bps";
    const values = block.series
      .flatMap((series) => series.points.map((point) => point.value))
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const min = unit === "d" && values.length ? Math.max(0, Math.min(...values) * 0.96) : 0;
    const max = values.length ? Math.max(...values, min + 1) : 1;

    const series = block.series.map((entry) => {
      const points = this.slimPoints(entry.points, 120).map((point, index, items) => ({
        value: point.value ?? 0,
        ratioX: items.length <= 1 ? 0 : index / (items.length - 1),
        ratioY: (Number(point.value || 0) - min) / Math.max(max - min, 1),
      }));

      return {
        label: entry.label,
        color: entry.color,
        unit: entry.unit,
        points,
      };
    });

    const labelsSource = this.slimPoints(block.series[0]?.points || [], 6);
    const labels = labelsSource.map((point) => this.formatShortLabel(point.timestamp));

    return { unit, min, max, series, labels: labels.length ? labels : ["-"] };
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

    const linesY = Array.from({ length: 6 }).map((_, index) => {
      const y = top + (index / 5) * plotHeight;
      const value = model.max - (index / 5) * (model.max - model.min);
      return `<g><line x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}" stroke="#d7dde4" stroke-width="1" /><text x="${left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#42505c">${this.escapeXml(this.formatValue(value, model.unit))}</text></g>`;
    }).join("");

    const linesX = Array.from({ length: 8 }).map((_, index) => {
      const x = left + (index / 7) * plotWidth;
      return `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="#e6ebf1" stroke-width="1" />`;
    }).join("");

    const seriesPaths = model.series.map((series) => {
      const d = series.points
        .map((point, index) => {
          const x = left + point.ratioX * plotWidth;
          const y = top + (1 - point.ratioY) * plotHeight;
          return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ");
      return `<path d="${d}" fill="none" stroke="${series.color}" stroke-width="${series.unit === "d" ? 3 : 1.6}" />`;
    }).join("");

    const labels = model.labels.map((label, index) => {
      const x = left + (index / Math.max(model.labels.length - 1, 1)) * plotWidth;
      return `<text x="${x}" y="${bottom + 28}" text-anchor="middle" font-size="10" fill="#4a5561" transform="rotate(65 ${x} ${bottom + 28})">${this.escapeXml(label)}</text>`;
    }).join("");

    const legend = model.series.map((series, index) => {
      const x = left + index * 180;
      return `<g><rect x="${x}" y="${height - 30}" width="10" height="10" fill="${series.color}" /><text x="${x + 16}" y="${height - 21}" font-size="11" fill="#1f2630">${this.escapeXml(series.label)}</text></g>`;
    }).join("");

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
    const valid = points.filter((point) => typeof point.value === "number" && Number.isFinite(point.value));
    if (valid.length <= maxPoints) {
      return valid;
    }

    const step = Math.ceil(valid.length / maxPoints);
    return valid.filter((_, index) => index % step === 0);
  }

  private formatValue(value: number | null | undefined, unit: MonitoringReportSeries["unit"] | "bps") {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return "-";
    }

    if (unit === "bps") {
      const abs = Math.abs(value);
      if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} Gbit/s`;
      if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} Mbit/s`;
      if (abs >= 1_000) return `${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} Kbit/s`;
      return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} bit/s`;
    }

    if (unit === "ms") {
      return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ms`;
    }

    if (unit === "%") {
      return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} %`;
    }

    if (unit === "d") {
      const days = Math.floor(value);
      const hours = Math.round((value - days) * 24);
      return `${days}d ${hours}h`;
    }

    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
  }

  private formatBytes(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return "-";
    }

    const abs = Math.abs(value);
    if (abs >= 1024 ** 4) return `${(value / 1024 ** 4).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} TB`;
    if (abs >= 1024 ** 3) return `${(value / 1024 ** 3).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GB`;
    if (abs >= 1024 ** 2) return `${(value / 1024 ** 2).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MB`;
    if (abs >= 1024) return `${(value / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} KB`;
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} B`;
  }

  private formatDate(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Araguaina",
    }).format(new Date(value));
  }

  private formatShortLabel(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Araguaina",
    }).format(new Date(value));
  }

  private monthLabel(value: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "America/Araguaina",
    }).format(value);
  }

  private buildFileName(reports: MonitoringPrtgStyleReport[], format: "pdf" | "docx") {
    const stamp = new Intl.DateTimeFormat("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Araguaina",
    }).format(new Date()).replaceAll("-", "");
    const scope = reports.length === 1 ? reports[0].unit.code.toLowerCase() : `${reports.length}-unidades`;
    return `nova-relatorio-consumo-${scope}-${stamp}.${format}`;
  }

  private pdfColor(rgb: (...args: number[]) => unknown, hex: string) {
    const clean = String(hex || "#23416b").replace("#", "");
    const normalized = clean.length === 3 ? clean.split("").map((item) => item + item).join("") : clean.padEnd(6, "0").slice(0, 6);
    const red = parseInt(normalized.slice(0, 2), 16) / 255;
    const green = parseInt(normalized.slice(2, 4), 16) / 255;
    const blue = parseInt(normalized.slice(4, 6), 16) / 255;
    return rgb(red, green, blue);
  }

  private escapeXml(value: string) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
}
