export function focusInputAtEnd(input: HTMLInputElement | null) {
  if (input) {
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }
}
