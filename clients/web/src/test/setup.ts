// DOM matchers such as toBeInTheDocument() and toBeDisabled().
import '@testing-library/jest-dom/vitest';

// jsdom has no modal dialogs: enough of one to open and close them.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event('close'));
};
