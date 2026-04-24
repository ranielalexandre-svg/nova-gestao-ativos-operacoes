import { Injectable } from '@nestjs/common';
import {
  MonitoringPrtgStyleReport,
  MonitoringReportBlock,
  MonitoringReportPoint,
  MonitoringReportSeries,
} from './report.types';
import { REPORT_TIMEZONE } from './report-export.constants';

type ChartAxis = {
  unit: MonitoringReportSeries['unit'];
  min: number;
  max: number;
};

@Injectable()
export class MonitoringReportPresentationService {
  /**
   * Renderiza o SVG de um bloco de monitoramento com suporte a eixos mistos.
   */
  chartSvg(block: MonitoringReportBlock) {
    const model = this.chartModel(block);
    const width = 900;
    const height = 330;
    const left = 70;
    const top = 28;
    const rightGutter = model.secondaryAxis ? 74 : 38;
    const plotWidth = width - left - rightGutter;
    const plotHeight = 190;
    const bottom = top + plotHeight;

    const linesY = Array.from({ length: 6 })
      .map((_, index) => {
        const y = top + (index / 5) * plotHeight;
        const primaryValue =
          model.primaryAxis.max -
          (index / 5) * (model.primaryAxis.max - model.primaryAxis.min);
        const secondaryValue = model.secondaryAxis
          ? model.secondaryAxis.max -
            (index / 5) * (model.secondaryAxis.max - model.secondaryAxis.min)
          : null;

        return `
          <g>
            <line x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}" stroke="#d7dde4" stroke-width="1" />
            <text x="${left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#42505c">${this.escapeXml(this.formatValue(primaryValue, model.primaryAxis.unit))}</text>
            ${
              secondaryValue === null
                ? ''
                : `<text x="${left + plotWidth + 8}" y="${y + 4}" text-anchor="start" font-size="11" fill="#42505c">${this.escapeXml(this.formatValue(secondaryValue, model.secondaryAxis.unit))}</text>`
            }
          </g>
        `;
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
        const x = left + (index / Math.max(model.labels.length - 1, 1)) * plotWidth;
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

  /**
   * Formata um valor numérico com a unidade de exibição usada nos relatórios.
   */
  formatValue(
    value: number | null | undefined,
    unit: MonitoringReportSeries['unit'] | 'bps',
  ) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '-';
    }

    if (unit === 'bps') {
      const abs = Math.abs(value);
      if (abs >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} Gbit/s`;
      }
      if (abs >= 1_000_000) {
        return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} Mbit/s`;
      }
      if (abs >= 1_000) {
        return `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} Kbit/s`;
      }
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

  /**
   * Formata bytes em KB/MB/GB/TB para a apresentação do relatório.
   */
  formatBytes(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '-';
    }

    const abs = Math.abs(value);
    if (abs >= 1024 ** 4) {
      return `${(value / 1024 ** 4).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} TB`;
    }
    if (abs >= 1024 ** 3) {
      return `${(value / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GB`;
    }
    if (abs >= 1024 ** 2) {
      return `${(value / 1024 ** 2).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MB`;
    }
    if (abs >= 1024) {
      return `${(value / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} KB`;
    }
    return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} B`;
  }

  /**
   * Formata uma data para o fuso operacional padrão do projeto.
   */
  formatDate(value: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: REPORT_TIMEZONE,
    }).format(new Date(value));
  }

  formatShortLabel(value: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: REPORT_TIMEZONE,
    }).format(new Date(value));
  }

  monthLabel(value: Date) {
    return new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
      timeZone: REPORT_TIMEZONE,
    }).format(value);
  }

  /**
   * Gera um nome de arquivo estável para o artefato exportado.
   */
  buildFileName(
    reports: MonitoringPrtgStyleReport[],
    format: 'pdf' | 'docx',
  ) {
    const stamp = new Intl.DateTimeFormat('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: REPORT_TIMEZONE,
    })
      .format(new Date())
      .replaceAll('-', '');
    const scope =
      reports.length === 1
        ? reports[0].unit.code.toLowerCase()
        : `${reports.length}-unidades`;
    return `nova-relatorio-consumo-${scope}-${stamp}.${format}`;
  }

  escapeXml(value: string) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private chartModel(block: MonitoringReportBlock) {
    const units = Array.from(
      new Set(block.series.map((series) => series.unit)),
    ).sort(
      (left, right) => this.chartUnitPriority(left) - this.chartUnitPriority(right),
    );
    const axes = units.map((unit) => {
      const values = block.series
        .filter((series) => series.unit === unit)
        .flatMap((series) => series.points.map((point) => point.value))
        .filter(
          (value): value is number =>
            typeof value === 'number' && Number.isFinite(value),
        );

      const min =
        unit === 'd' && values.length
          ? Math.max(0, Math.min(...values) * 0.96)
          : 0;
      const observedMax = values.length ? Math.max(...values) : 1;
      const max =
        unit === '%'
          ? Math.max(100, observedMax, min + 1)
          : Math.max(observedMax, min + 1);

      return { unit, min, max };
    });
    const axisMap = new Map(axes.map((axis) => [axis.unit, axis] as const));

    const series = block.series.map((entry) => {
      const axis = axisMap.get(entry.unit) || axes[0] || { unit: entry.unit, min: 0, max: 1 };
      const points = this.slimPoints(entry.points, 120).map(
        (point, index, items) => ({
          value: point.value ?? 0,
          ratioX: items.length <= 1 ? 0 : index / (items.length - 1),
          ratioY: Math.min(
            1,
            Math.max(
              0,
              (Number(point.value || 0) - axis.min) /
                Math.max(axis.max - axis.min, 1),
            ),
          ),
        }),
      );

      return {
        label: entry.label,
        color: entry.color,
        unit: entry.unit,
        axis,
        points,
      };
    });

    const labelsSource = this.slimPoints(block.series[0]?.points || [], 6);
    const labels = labelsSource.map((point) =>
      this.formatShortLabel(point.timestamp),
    );

    return {
      primaryAxis: axes[0] || { unit: block.series[0]?.unit || 'bps', min: 0, max: 1 },
      secondaryAxis: axes[1] || null,
      series,
      labels: labels.length ? labels : ['-'],
    };
  }

  private chartUnitPriority(unit: MonitoringReportSeries['unit']) {
    if (unit === 'ms') return 0;
    if (unit === 'bps') return 1;
    if (unit === 'd') return 2;
    if (unit === '%') return 3;
    return 9;
  }

  private slimPoints(points: MonitoringReportPoint[], maxPoints: number) {
    const valid = points.filter(
      (point) => typeof point.value === 'number' && Number.isFinite(point.value),
    );
    if (valid.length <= maxPoints) {
      return valid;
    }

    const step = Math.ceil(valid.length / maxPoints);
    return valid.filter((_, index) => index % step === 0);
  }
}
