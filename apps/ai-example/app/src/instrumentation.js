'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');

const exporter = new OTLPTraceExporter();

const serviceName = process.env.OTEL_SERVICE_NAME || 'api';

const sdk = new NodeSDK({
  resource: new Resource({
    'service.name': serviceName,
    'service.version': '1.0.0',
    'deployment.environment': 'demo',
  }),
  traceExporter: exporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
