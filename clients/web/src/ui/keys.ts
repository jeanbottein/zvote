import type { KeyboardEvent } from 'react';

/**
 * Enter pressed to act, not to pick a word being composed (Chinese, Japanese,
 * Korean input). Safari ends the composition before that keydown, which then
 * only shows it through keyCode 229.
 */
export function isEnter(event: KeyboardEvent): boolean {
  return event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229;
}
