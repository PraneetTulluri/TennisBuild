import { useState } from "react";
import { shareBuild } from "../../utils/share.js";

/**
 * A durable /builds/:id link is what makes a build actually shareable -
 * the server renders that specific build's name/stats into the page's
 * Open Graph tags (see server/src/utils/renderShareMeta.js) before a
 * link-preview crawler ever sees it, so pasting this into Discord/
 * Twitter/iMessage shows a real preview card, not a bare link.
 */
export default function ShareButton({ buildId, name, className = "secondary-button" }) {
  const [status, setStatus] = useState("idle"); // idle | copied | shared

  async function handleClick() {
    const url = `${window.location.origin}/builds/${buildId}`;
    const result = await shareBuild({
      url,
      title: `${name} on TennisBuild`,
      text: `Check out my custom tennis player, ${name}, on TennisBuild.`,
    });
    if (result === "copied" || result === "shared") {
      setStatus(result);
      window.setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {status === "copied"
        ? "Link Copied ✅"
        : status === "shared"
          ? "Shared ✅"
          : "Share"}
    </button>
  );
}
