/**
 * Annotation Queue Errors
 *
 * Custom error classes for annotation queue operations.
 */

/**
 * Base error for annotation operations
 */
export class AnnotationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnnotationError';
  }
}

/**
 * Queue not found error
 */
export class QueueNotFoundError extends AnnotationError {
  constructor(message: string) {
    super(message);
    this.name = 'QueueNotFoundError';
  }
}

/**
 * Item not found error
 */
export class ItemNotFoundError extends AnnotationError {
  constructor(message: string) {
    super(message);
    this.name = 'ItemNotFoundError';
  }
}

/**
 * Item locked by another user error
 */
export class ItemLockedError extends AnnotationError {
  constructor(message: string) {
    super(message);
    this.name = 'ItemLockedError';
  }
}

/**
 * No items available for annotation error
 */
export class NoItemsAvailableError extends AnnotationError {
  constructor(message: string) {
    super(message);
    this.name = 'NoItemsAvailableError';
  }
}

/**
 * Assignment operation failed error
 */
export class AssignmentError extends AnnotationError {
  constructor(message: string) {
    super(message);
    this.name = 'AssignmentError';
  }
}
