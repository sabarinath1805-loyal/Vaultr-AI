function isGeminiResponseWithText(value: any): value is { text: () => string } {
  return typeof value === "object" && value !== null && typeof value.text === "function";
}
