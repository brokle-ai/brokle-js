/**
 * Annotation Queue Type Definitions
 *
 * Types for annotation queue management in HITL evaluation workflows.
 */

/**
 * Queue status enum
 */
export type QueueStatus = 'active' | 'paused' | 'archived';

/**
 * Queue item status enum
 */
export type ItemStatus = 'pending' | 'completed' | 'skipped';

/**
 * Object type being annotated
 */
export type ObjectType = 'trace' | 'span';

/**
 * Role in annotation queue
 */
export type AssignmentRole = 'admin' | 'reviewer' | 'annotator';

/**
 * Queue settings configuration
 */
export interface QueueSettings {
  /** Lock timeout in seconds (default: 300 = 5 minutes) */
  lockTimeoutSeconds?: number;
  /** Require score config for completion */
  requireScoreConfig?: boolean;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Total items in queue */
  totalItems: number;
  /** Items pending annotation */
  pendingItems: number;
  /** Items completed */
  completedItems: number;
  /** Items skipped */
  skippedItems: number;
  /** Items currently locked */
  lockedItems: number;
}

/**
 * Annotation queue data from API
 */
export interface AnnotationQueue {
  /** Queue ID */
  id: string;
  /** Project ID */
  projectId: string;
  /** Queue name */
  name: string;
  /** Queue status */
  status: QueueStatus;
  /** Queue description */
  description?: string;
  /** Score config IDs to collect */
  scoreConfigIds?: string[];
  /** Queue settings */
  settings?: QueueSettings;
  /** Queue statistics */
  stats?: QueueStats;
  /** ISO timestamp when created */
  createdAt?: string;
  /** ISO timestamp when last updated */
  updatedAt?: string;
}

/**
 * Queue item data from API
 */
export interface QueueItem {
  /** Item ID */
  id: string;
  /** Queue ID */
  queueId: string;
  /** Object ID (trace_id or span_id) */
  objectId: string;
  /** Object type */
  objectType: ObjectType;
  /** Item status */
  status: ItemStatus;
  /** Priority (higher = processed first) */
  priority: number;
  /** When item was locked */
  lockedAt?: string;
  /** User ID who locked the item */
  lockedByUserId?: string;
  /** User ID who completed the annotation */
  annotatorUserId?: string;
  /** When item was completed */
  completedAt?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** ISO timestamp when created */
  createdAt?: string;
  /** ISO timestamp when last updated */
  updatedAt?: string;
}

/**
 * Queue assignment data
 */
export interface QueueAssignment {
  /** Queue ID */
  queueId: string;
  /** User ID */
  userId: string;
  /** Assignment role */
  role: AssignmentRole;
  /** User ID who assigned */
  assignedByUserId: string;
  /** ISO timestamp when created */
  createdAt?: string;
}

/**
 * Score submission for completing an item
 */
export interface ScoreSubmission {
  /** Score config ID */
  scoreConfigId: string;
  /** Score value */
  value: number | string | boolean;
  /** Optional comment */
  comment?: string;
}

/**
 * Input for adding items to queue
 */
export interface AddItemInput {
  /** Object ID (trace_id or span_id) */
  objectId: string;
  /** Object type (default: "trace") */
  objectType?: ObjectType;
  /** Priority (default: 0, higher = processed first) */
  priority?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of adding items to queue
 */
export interface AddItemsResult {
  /** Number of items created */
  created: number;
}

/**
 * Result of listing items in queue
 */
export interface ListItemsResult {
  /** List of items */
  items: QueueItem[];
  /** Total count of items matching filter */
  total: number;
}

/**
 * Options for listing items
 */
export interface ListItemsOptions {
  /** Filter by status */
  status?: ItemStatus;
  /** Maximum number of items to return (default: 50) */
  limit?: number;
  /** Number of items to skip for pagination (default: 0) */
  offset?: number;
}

/**
 * Configuration for the annotations manager
 */
export interface AnnotationsManagerConfig {
  /** Base URL for the API */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * API response envelope
 */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    type?: string;
  };
}
