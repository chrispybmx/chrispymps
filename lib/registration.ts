import { z } from 'zod';

// Existing account policy, not an age-verification claim or worldwide legal rule.
export const MINIMUM_ACCOUNT_AGE = 14;
export const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
export const countryCode = z.string().refine(value => COUNTRY_CODES.includes(value), 'Scegli il Paese di residenza.');
export const disciplineChoices = ['bmx', 'skate', 'scooter', 'mtb', 'altro'] as const;

/** Calendar dates are compared in UTC, without local midnight/DST conversion. */
export function validBirthDate(value: unknown, now = new Date()): value is string {
 if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const date=new Date(`${value}T00:00:00Z`);
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value
  && value>'1920-01-01' && value<=now.toISOString().slice(0,10);
}
export function registrationAge(value: unknown, now = new Date()): number | null {
 if(!validBirthDate(value,now))return null;
 const today=now.toISOString().slice(0,10);
 return Number(today.slice(0,4))-Number(value.slice(0,4))-(today.slice(5)<value.slice(5)?1:0);
}
/** Nothing here may slow down signup: every field is optional. A declared birth
 *  date must still mean at least 14 years; an empty country means "not given". */
export function registrationDetails(now = new Date()) {
 return z.object({
  birthDate:z.string().refine(value=>validBirthDate(value,now),'Data di nascita non valida.')
   .refine(value=>(registrationAge(value,now)??-1)>=MINIMUM_ACCOUNT_AGE,`Per registrarti devi avere almeno ${MINIMUM_ACCOUNT_AGE} anni.`).optional(),
  countryCode:z.preprocess(value=>value===''?undefined:value,countryCode.optional()),
  disciplines:z.array(z.enum(disciplineChoices)).max(5).default([]).transform(values=>[...new Set(values)]),
  region:z.string().trim().max(60).default(''),
 }).strict();
}

