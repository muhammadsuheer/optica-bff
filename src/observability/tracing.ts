import { envConfig } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

let sdk: NodeSDK | null = null;

export function startTracing() {
  if (sdk || !envConfig.performance.OTEL_ENABLED || !envConfig.performance.OTEL_EXPORTER_OTLP_ENDPOINT) return;
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
  const exporter = new OTLPTraceExporter({ url: envConfig.performance.OTEL_EXPORTER_OTLP_ENDPOINT });
  sdk = new NodeSDK({
    traceExporter: exporter,
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-undici': { enabled: true },
      '@opentelemetry/instrumentation-fs': { enabled: false },
    })],
  });
  try {
    sdk.start();
  } catch (e: any) {
    logger.error('Tracing start failed', e as Error);
  }
}

export async function shutdownTracing() {
  if (!sdk) return;
  await sdk.shutdown().catch(() => {});
  sdk = null;
}