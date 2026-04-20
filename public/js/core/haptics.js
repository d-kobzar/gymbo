/**
 * Semantic haptic helpers over telegram.js. Page code calls
 * `haptics.tap()` etc. instead of knowing about impact/notification/
 * selection APIs.
 */

import { telegram } from './telegram.js';

export const haptics = {
  tap() {
    telegram.hapticImpact('light');
  },
  bump() {
    telegram.hapticImpact('medium');
  },
  heavy() {
    telegram.hapticImpact('heavy');
  },
  success() {
    telegram.hapticNotification('success');
  },
  error() {
    telegram.hapticNotification('error');
  },
  warning() {
    telegram.hapticNotification('warning');
  },
  select() {
    telegram.hapticSelection();
  },
};
