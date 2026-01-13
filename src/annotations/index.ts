/**
 * Annotations Module
 *
 * Provides annotation queue management for human-in-the-loop (HITL) evaluation workflows.
 *
 * Annotation queues allow human annotators to review and score AI outputs,
 * enabling quality assessment and feedback collection at scale.
 *
 * @example
 * ```typescript
 * import { Brokle } from 'brokle';
 *
 * const client = new Brokle({ apiKey: "bk_..." });
 *
 * // Add traces to annotation queue
 * const result = await client.annotations.addTraces(
 *   "queue123",
 *   ["trace1", "trace2", "trace3"],
 *   { priority: 5 }
 * );
 * console.log(`Added ${result.created} items`);
 *
 * // Add items with mixed types
 * await client.annotations.addItems("queue123", [
 *   { objectId: "trace1", objectType: "trace" },
 *   { objectId: "span1", objectType: "span", priority: 10 },
 * ]);
 * ```
 */

export { AnnotationsManager } from './manager';
export type {
  // Config
  AnnotationsManagerConfig,
  // Core types
  AnnotationQueue,
  QueueItem,
  QueueAssignment,
  QueueSettings,
  QueueStats,
  // Enums
  QueueStatus,
  ItemStatus,
  ObjectType,
  AssignmentRole,
  // Request/response
  AddItemInput,
  AddItemsResult,
  ListItemsResult,
  ListItemsOptions,
  ScoreSubmission,
  APIResponse,
} from './types';
export {
  AnnotationError,
  QueueNotFoundError,
  ItemNotFoundError,
  ItemLockedError,
  NoItemsAvailableError,
  AssignmentError,
} from './errors';
