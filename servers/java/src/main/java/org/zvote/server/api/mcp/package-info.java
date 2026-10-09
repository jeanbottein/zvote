/**
 * zvote as Model Context Protocol tools, so that an agent reaches the same
 * services the HTTP API does without composing requests itself.
 *
 * It lives inside the api module rather than beside it: this is a second
 * protocol over the same services, not a layer of its own, and the api module
 * is the one that may use every other. Nothing outside api uses it.
 */
package org.zvote.server.api.mcp;
