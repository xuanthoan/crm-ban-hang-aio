// Vietnamese messages for browser-native validation bubbles.
//
// The browser renders constraint-validation bubbles (required, min, max)
// in its own UI language — English on this machine — so every input that
// relies on native constraints sets its own Vietnamese message here.
// The message must be cleared on change, otherwise a previously set custom
// message sticks even after the user fixes the value.
export function invalidMessage(
  target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  messages: {
    missing?: string;
    overflow?: string;
    underflow?: string;
    badInput?: string;
  },
): string {
  const v = target.validity;
  if (v.valueMissing && messages.missing) return messages.missing;
  if (v.rangeOverflow && messages.overflow) return messages.overflow;
  if (v.rangeUnderflow && messages.underflow) return messages.underflow;
  if ((v.badInput || v.typeMismatch) && messages.badInput) return messages.badInput;
  return "Giá trị chưa hợp lệ, vui lòng kiểm tra lại.";
}

export function clearCustomValidity(
  e: { currentTarget: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement },
): void {
  e.currentTarget.setCustomValidity("");
}
