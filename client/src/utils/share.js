// Native share sheet on devices that support it (mostly mobile - lets
// someone share straight into iMessage/WhatsApp/etc. without a copy-paste
// step); clipboard copy everywhere else. Either way the caller just gets
// back which one happened, so the button can show the right feedback.
export async function shareBuild({ url, title, text }) {
  if (navigator.share) {
    try {
      await navigator.share({ url, title, text });
      return "shared";
    } catch (err) {
      // AbortError just means the user closed the share sheet - not a
      // real failure, nothing to fall back to or report.
      if (err.name === "AbortError") return "cancelled";
    }
  }

  await navigator.clipboard.writeText(url);
  return "copied";
}
