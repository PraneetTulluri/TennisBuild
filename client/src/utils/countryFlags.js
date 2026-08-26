// Small local lookup from the `country` values used in our seed data to a
// flag emoji, for player card flavor. Covers exactly the countries present
// in server/src/seed/players.data.js - not meant to be a general country
// database, so add an entry here if a new country shows up in the roster.
const COUNTRY_FLAGS = {
  Argentina: "🇦🇷",
  Australia: "🇦🇺",
  Austria: "🇦🇹",
  Brazil: "🇧🇷",
  Bulgaria: "🇧🇬",
  Canada: "🇨🇦",
  China: "🇨🇳",
  Croatia: "🇭🇷",
  // Czechoslovakia dissolved in 1993 and has no flag of its own anymore;
  // the Czech Republic's flag is the closest modern equivalent.
  Czechoslovakia: "🇨🇿",
  "Czech Republic": "🇨🇿",
  Denmark: "🇩🇰",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Greece: "🇬🇷",
  Italy: "🇮🇹",
  Kazakhstan: "🇰🇿",
  Norway: "🇳🇴",
  Poland: "🇵🇱",
  Russia: "🇷🇺",
  Serbia: "🇷🇸",
  Spain: "🇪🇸",
  Sweden: "🇸🇪",
  Switzerland: "🇨🇭",
  "United Kingdom": "🇬🇧",
  "United States": "🇺🇸",
};

export function getCountryFlag(country) {
  return COUNTRY_FLAGS[country] ?? "🎾";
}
