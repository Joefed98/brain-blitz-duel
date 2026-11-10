/**
 * Country (10 Nov 2026, accounts): an ISO 3166-1 alpha-2 code, set at sign-up from the phone's region setting and
 * changeable later in Settings. Never from an IP address. Nullable: a phone with no region (or one that isn't a
 * country, such as "419" for Latin America) leaves it empty.
 */

/** The 249 officially assigned ISO 3166-1 alpha-2 codes. */
export const COUNTRY_CODES: ReadonlySet<string> = new Set(
  (
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
    "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
    "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO " +
    "JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR " +
    "MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO " +
    "RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV " +
    "TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
  ).split(" "),
);

/** A country code as stored (upper case), or null when it isn't one. */
export function countryCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return COUNTRY_CODES.has(code) ? code : null;
}

/**
 * The country of the phone's region setting: the region of the first language tag that names one
 * (navigator.languages, then the formatter's own locale). Never guessed from the language alone ("en" gives null).
 */
export function regionCountry(languageTags?: readonly string[]): string | null {
  const tags: string[] = [];
  if (languageTags) tags.push(...languageTags);
  else {
    if (typeof navigator !== "undefined") tags.push(...(navigator.languages ?? []), navigator.language);
    try {
      tags.push(new Intl.DateTimeFormat().resolvedOptions().locale);
    } catch {
      /* no Intl locale data */
    }
  }
  for (const tag of tags) {
    if (!tag) continue;
    try {
      const region = new Intl.Locale(tag).region;
      const code = countryCode(region);
      if (code) return code;
    } catch {
      /* not a valid tag */
    }
  }
  return null;
}
