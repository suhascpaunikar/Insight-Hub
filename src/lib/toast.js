/* ==========================================================================
   toast.js — toasts, on Kumo's Toasty.

   Kept as a plain function rather than a hook because most callers are not
   components: the store's delete/restore pair, the publish flow, and the
   "not part of the prototype" stubs all fire from event handlers and module
   scope. `createKumoToastManager()` is Kumo's own answer to exactly that —
   a manager instantiated outside the tree, handed to <Toasty> at the root,
   and dispatched to from anywhere.
   ========================================================================== */
import { createKumoToastManager } from '@cloudflare/kumo';

export const toastManager = createKumoToastManager();

/* The vanilla build's kinds, onto Kumo's variants. `danger` was ours; Kumo
   calls the same thing `error`. */
const VARIANT = {
  success: 'success',
  danger: 'error',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

/**
 * `action` is the one place a toast is more than a notice: `{ label, onClick }`
 * renders a button under the description and dismisses the toast when it is
 * pressed. It exists for undo — the pattern where the confirmation and the way
 * back are the same object, and where making the reader hunt for a way back
 * after the fact is what makes a delete feel dangerous.
 *
 * A toast carrying an action holds longer than one that does not: four seconds
 * is enough to read a confirmation and not enough to decide you meant it.
 *
 * `bump` is Kumo's own `animate-toast-bump`, for the case where a toast that
 * is already up says the same thing again — the stack nudges rather than
 * growing a second identical row. The vanilla build reimplemented it.
 */
export function toast(title, description = '', kind = 'success', action = null) {
  return toastManager.add({
    title,
    description: description || undefined,
    variant: VARIANT[kind] || 'default',
    timeout: action ? 8000 : 4000,
    bump: true,
    actions: action
      ? [{
          children: action.label,
          variant: 'secondary',
          size: 'sm',
          onClick: action.onClick,
        }]
      : undefined,
  });
}
