/**
 * Shared HTTP client — one transport, many resource managers.
 *
 * Every Brokle resource manager (prompt, scores, query, experiments,
 * annotations, datasets, scorers) uses `BrokleHttpClient` for REST
 * traffic. Error handling, retry semantics, and the Stripe/OpenAI-
 * style wire contract live in one file (`client.ts`) rather than
 * being re-implemented per manager.
 */

export { BrokleHttpClient } from './client';
export type { HttpClientOptions, RequestOptions } from './client';
