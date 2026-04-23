export type MonitoringReportPoint = {
  timestamp: string;
  value: number | null;
};

export type MonitoringReportSeries = {
  id: string;
  name: string;
  key: string;
  label: string;
  kind: string;
  color: string;
  unit: "bps" | "ms" | "%" | "d";
  zabbixUnits: string;
  points: MonitoringReportPoint[];
  stats: {
    last: number | null;
    min: number | null;
    avg: number | null;
    max: number | null;
    points: number;
  };
};

export type MonitoringTrafficConsumption = {
  receivedBytes: number | null;
  sentBytes: number | null;
  totalBytes: number | null;
  avgReceiveBps: number | null;
  avgSendBps: number | null;
  peakReceiveBps: number | null;
  peakSendBps: number | null;
  coveredSeconds: number;
};

export type MonitoringReportBlock = {
  id: string;
  title: string;
  description: string;
  sensorType: string;
  probePath: string;
  unit: string;
  series: MonitoringReportSeries[];
  consumption?: MonitoringTrafficConsumption | null;
};

export type MonitoringPrtgStyleReport = {
  generatedAt: string;
  source: "zabbix";
  deliveryStyle: "prtg-like";
  period: {
    from: string;
    to: string;
    timezone: string;
  };
  unit: {
    id: string;
    code: string;
    name: string;
    city: string | null;
    state: string | null;
  };
  partner: {
    id: string;
    code: string;
    name: string;
  };
  integration: {
    id: string;
    code: string;
    name: string;
  } | null;
  host: {
    status?: string;
    score?: number;
    confidence?: number;
    integrationCode?: string;
    integrationName?: string;
    hostId?: string;
    host?: string;
    hostName?: string;
    hostStatus?: string;
    matchedBy?: string;
    candidates?: unknown[];
    syncReady?: boolean;
  } | null;
  blocks: MonitoringReportBlock[];
  warnings: string[];
};

export type MonitoringReportExportArtifact = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

export type MonitoringReportExportOptions = {
  format: "pdf" | "docx";
  includeCharts: boolean;
  title?: string;
  interestedParty?: string;
  contractLabel?: string;
  addressLine?: string;
  contractedBandwidth?: string;
};
