/**
 * IOC country codes (what Sackmann's data uses) to flag emoji.
 * Covers the 50 nations present in data/players.json.
 */
const IOC_TO_ISO2 = {
  ARG: "AR", AUS: "AU", AUT: "AT", BEL: "BE", BLR: "BY", BRA: "BR", BUL: "BG",
  CAN: "CA", CHI: "CL", CRO: "HR", CYP: "CY", CZE: "CZ", DEN: "DK", ECU: "EC",
  ESP: "ES", FIN: "FI", FRA: "FR", GBR: "GB", GEO: "GE", GER: "DE", GRE: "GR",
  HUN: "HU", IND: "IN", ISR: "IL", ITA: "IT", JPN: "JP", KAZ: "KZ", KOR: "KR",
  LAT: "LV", LUX: "LU", MAR: "MA", MEX: "MX", NED: "NL", NOR: "NO", NZL: "NZ",
  PAR: "PY", PER: "PE", POL: "PL", ROU: "RO", RSA: "ZA", RUS: "RU", SRB: "RS",
  SUI: "CH", SVK: "SK", SWE: "SE", THA: "TH", UKR: "UA", URU: "UY", USA: "US",
  // YUG (Yugoslavia) has no flag emoji; it falls through to the empty default.
};

export function flagFor(iocCode) {
  const iso2 = IOC_TO_ISO2[iocCode];
  if (!iso2) return "";
  return String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
