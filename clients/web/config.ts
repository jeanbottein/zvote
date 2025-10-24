/**
 * Application Configuration
 * Centralized configuration for backend and module settings
 */

export interface AppConfig {
  backendType: 'spacetime' | 'graphql';
  backendPort: number;
  backendSpacetimeDbName: string;
}

/**
 * Get configuration from environment variables
 */
export function getConfig(): AppConfig {
  const backendType = (import.meta.env.VITE_BACKEND_TYPE || 'spacetime') as 'spacetime' | 'graphql';
  
  // Smart default: use provided port or default based on backend type
  const defaultPort = backendType === 'graphql' ? '8080' : '3000';
  const backendPort = parseInt(import.meta.env.VITE_BACKEND_PORT || defaultPort, 10);
  
  const backendSpacetimeDbName = import.meta.env.VITE_SPACETIME_DB_NAME || 'zvote-proto1';

  return {
    backendType,
    backendPort,
    backendSpacetimeDbName,
  };
}

/**
 * Get the backend URL
 */
export function getBackendUrl(): string {
  const config = getConfig();
  if (config.backendType === 'graphql') {
    return `/graphql`;
  }
  return `ws://localhost:${config.backendPort}`;
}

/**
 * Check if using SpacetimeDB backend
 */
export function isSpacetimeBackend(): boolean {
  return getConfig().backendType === 'spacetime';
}

/**
 * Check if using GraphQL backend
 */
export function isGraphQLBackend(): boolean {
  return getConfig().backendType === 'graphql';
}
