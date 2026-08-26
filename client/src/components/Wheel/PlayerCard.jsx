import BustAvatar from "./BustAvatar.jsx";
import { getCountryFlag } from "../../utils/countryFlags.js";

/**
 * A single player card: real ESPN headshot when available, illustrated
 * bust silhouette otherwise (see BustAvatar.jsx). Used both in the spin
 * strip (Wheel.jsx) and the revealed-player panel (AttributeCard.jsx), so
 * its look stays identical no matter where a player currently appears.
 */
export default function PlayerCard({ player, highlighted = false }) {
  return (
    <div
      className={`player-card tier-${player.tier}${highlighted ? " highlighted" : ""}`}
    >
      <div className="player-card-avatar">
        {player.imageUrl ? (
          <img src={player.imageUrl} alt="" loading="lazy" />
        ) : (
          <BustAvatar slug={player.slug} />
        )}
      </div>
      <div className="player-card-name">{player.name}</div>
      <div className="player-card-meta">
        <span>{getCountryFlag(player.country)}</span>
        <span className="player-card-tier">{player.tier}</span>
      </div>
    </div>
  );
}
