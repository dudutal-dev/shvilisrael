import { t } from '../i18n/index.js';
// Baseline month suitability per region (1 = Jan). Refined by the research data in src/data/logistics.json when present.
export const REGION_GROUPS = {
  north: ["חרמון", "גליל", "כרמל", "עמק", "כנרת"],
  center: ["שרון", "מישור החוף", "שפלה", "שפלת", "ירושלים", "לכיש"],
  negev: ["נגב", "אילת", "ערבה", "מדבר יהודה", "ים המלח", "סדום"]
};
export function regionGroup(region = '') {
  for (const [g, list] of Object.entries(REGION_GROUPS)) if (list.some(r => region.includes(r))) return g;
  return 'center';
}
//            Jan     Feb      Mar      Apr      May     Jun     Jul      Aug      Sep     Oct      Nov      Dec
export const MONTHS = {
  north: ['ok', 'ideal', 'ideal', 'ideal', 'ok', 'hard', 'avoid', 'avoid', 'hard', 'ideal', 'ideal', 'ok'],
  center: ['ok', 'ideal', 'ideal', 'ideal', 'ok', 'hard', 'avoid', 'avoid', 'hard', 'ok', 'ideal', 'ideal'],
  negev: ['ideal', 'ideal', 'ideal', 'ok', 'hard', 'avoid', 'avoid', 'avoid', 'avoid', 'hard', 'ideal', 'ideal']
};
export const LEVEL_HE = {
  ideal: "מצוין",
  ok: "סביר",
  hard: "קשה",
  avoid: "להימנע"
};
export const LEVEL_CLS = {
  ideal: 'm-ideal',
  ok: 'm-ok',
  hard: 'm-hard',
  avoid: 'm-avoid'
};
export function monthLevel(region, date) {
  return MONTHS[regionGroup(region)][new Date(date).getMonth()];
}
export function seasonWarning(region, date) {
  const g = regionGroup(region),
    lvl = MONTHS[g][new Date(date).getMonth()];
  if (lvl === 'avoid') return g === 'negev' ? t("סכנת חיים: אין לטייל בנגב ובערבה בחודשי הקיץ. רשות הטבע והגנים סוגרת מסלולים בימי שרב.") : t("חום כבד ולחות – לא מומלץ לצעוד באמצע היום. לצאת עם שחר ולסיים עד 11:00.");
  if (lvl === 'hard') return g === 'negev' ? t("חם מאוד בנגב בעונה זו – לצאת לפני הזריחה, 5–6 ליטר מים ליום, ולהימנע מהליכה בשעות הצהריים.") : t("עונה חמה – לצאת מוקדם, להצטייד במים ולתכנן הפסקת צהריים בצל.");
  if (lvl === 'ok' && g !== 'negev' && [0, 11].includes(new Date(date).getMonth())) return t("עונת גשמים: בוץ בנחלים, סכנת שיטפונות בנחלי הצפון והמרכז, לבדוק תחזית.");
  return null;
}