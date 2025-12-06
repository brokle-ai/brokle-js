/**
 * Transport types for OTLP export.
 */

/**
 * Transport protocol for OTLP exports.
 */
export enum TransportType {
  /** HTTP/Protobuf transport (default) */
  HTTP = 'http',
  /** gRPC transport */
  GRPC = 'grpc',
}

/**
 * Compression type for OTLP exports.
 */
export enum CompressionType {
  /** No compression */
  NONE = 'none',
  /** Gzip compression (default) */
  GZIP = 'gzip',
}
