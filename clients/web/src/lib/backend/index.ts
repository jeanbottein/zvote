/**
 * Backend Factory
 * 
 * This module provides a singleton backend instance based on configuration.
 * The rest of the app imports this and doesn't need to know which backend is being used.
 */

import { getConfig } from '../../../config';
import type { BackendAPI } from './BackendAPI';

let backendInstance: BackendAPI | null = null;

/**
 * Get the backend instance (singleton)
 * Automatically selects the correct implementation based on VITE_BACKEND_TYPE
 */
export async function getBackend(): Promise<BackendAPI> {
  if (backendInstance) {
    return backendInstance;
  }

  const config = getConfig();
  console.log(`[Backend] Initializing ${config.backendType} backend...`);

  if (config.backendType === 'spacetime') {
    // Lazy load SpacetimeDB backend
    const { SpacetimeBackend } = await import('./SpacetimeBackend');
    backendInstance = new SpacetimeBackend();
  } else {
    // Lazy load GraphQL backend
    const { GraphQLBackend } = await import('./GraphQLBackend');
    backendInstance = new GraphQLBackend();
  }

  await backendInstance.initialize();
  console.log(`[Backend] ${config.backendType} backend ready!`);

  return backendInstance;
}

/**
 * Get the current backend instance without initialization
 * Returns null if not yet initialized
 */
export function getCurrentBackend(): BackendAPI | null {
  return backendInstance;
}

/**
 * Reset the backend instance (useful for testing)
 */
export function resetBackend(): void {
  if (backendInstance) {
    backendInstance.disconnect();
    backendInstance = null;
  }
}
