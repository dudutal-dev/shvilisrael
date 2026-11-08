// Plan readiness "traffic lights": evaluates an itinerary against season, live forecast, water, firing zones,
// lodging, Shabbat/holidays, daylight and gear. Each check → { key, title, level: 'ok'|'warn'|'bad'|'info', summary, details[] , link? }
import { MONTHS, LEVEL_HE } from './season.js';
import { HE_MONTHS, isShabbat } from './dates.js';
import { sunTimes } from './sun.js';
import { t, locale } from '../i18n/index.js';

// Israeli holidays with limited transport / closed shops (approximate civil dates; verify)
export const HOLIDAYS = [['2026-04-01', '2026-04-09', "פסח"], ['2026-04-21', '2026-04-22', "יום הזיכרון ויום העצמאות"], ['2026-05-21', '2026-05-22', "שבועות"], ['2026-09-11', '2026-09-13', "ראש השנה"], ['2026-09-20', '2026-09-21', "יום כיפור"], ['2026-09-25', '2026-10-04', "סוכות ושמחת תורה"], ['2027-04-21', '2027-04-29', "פסח"], ['2027-05-11', '2027-05-12', "יום הזיכרון ויום העצמאות"], ['2027-06-10', '2027-06-11', "שבועות"], ['2027-10-01', '2027-10-03', "ראש השנה"], ['2027-10-10', '2027-10-11', "יום כיפור"], ['2027-10-15', '2027-10-24', "סוכות ושמחת תורה"]];
const inRange = (d, a, b) => {
  const x = d.toISOString().slice(0, 10);
  return x >= a && x <= b;
};
const GROUP_HE = {
  north: 'צפון',
  center: 'מרכז',
  negev: 'נגב ומדבר'
};
const worst = levels => levels.includes('bad') ? 'bad' : levels.includes('warn') ? 'warn' : 'ok';
export function evaluatePlan({
  days,
  segments,
  wx = {},
  angels = [],
  caches = []
}) {
  if (!days?.length) return null;
  const seg = id => segments.find(s => s.id === id);
  const walking = days.filter(d => !d.rest);
  const checks = [];

  // 1. season per region
  {
    const byGroup = {};
    for (const d of walking) {
      const g = d.group || 'center';
      const m = d.date.getMonth();
      byGroup[g] ??= {};
      byGroup[g][m] = (byGroup[g][m] || 0) + 1;
    }
    const details = [],
      levels = [];
    for (const [g, months] of Object.entries(byGroup)) for (const [m, n] of Object.entries(months)) {
      const lvl = MONTHS[g][m];
      levels.push(lvl === 'avoid' ? 'bad' : lvl === 'hard' ? 'warn' : 'ok');
      details.push(t("{0} ב{1} ({2} ימים): {3}{4}", t(GROUP_HE[g]), t(HE_MONTHS[m]), n, t(LEVEL_HE[lvl]), lvl === 'avoid' ? t("– סכנת חיים בחום/שרב, לא לצאת") : lvl === 'hard' ? t("– חם מאוד/גשום, לצאת עם שחר") : lvl === 'ok' && [10, 11, 0, 1, 2].includes(Number(m)) && g !== 'negev' ? t("– עונת גשמים: בוץ, נחלים זורמים, ימים קצרים") : ''));
    }
    checks.push({
      key: 'season',
      title: t("עונה מול אזור"),
      level: worst(levels),
      summary: worst(levels) === 'ok' ? t("התזמון מתאים לאזורים שתעברו בהם") : worst(levels) === 'warn' ? t("חלק מהימים בעונה קשה") : t("ימים בעונה מסוכנת – שקלו לשנות תאריך או כיוון"),
      details,
      link: 'guide/seasons'
    });
  }

  // 2. live forecast (first ~16 days)
  {
    const got = walking.filter(d => wx[d.day]);
    if (got.length) {
      const bad = got.filter(d => wx[d.day].v.score >= 3),
        warn = got.filter(d => wx[d.day].v.score === 2);
      const details = [...bad, ...warn].slice(0, 8).map(d => t("יום {0} ({1}) {2}: {3} {4}°{5} – {6}", d.day, d.date.toLocaleDateString(locale(), {
        day: 'numeric',
        month: 'short'
      }), d.title.split(' ← ')[0], wx[d.day].icon, wx[d.day].tmax, wx[d.day].rain > 15 ? ` ☔${wx[d.day].rain}%` : '', wx[d.day].v.flags.map(f => f.t).join(', ')));
      checks.push({
        key: 'forecast',
        title: t("תחזית חיה ({0} הימים הקרובים)", got.length),
        level: bad.length ? 'bad' : warn.length ? 'warn' : 'ok',
        summary: bad.length ? t("{0} ימים עם תנאים מסוכנים (חום קיצוני / שיטפון / סופה)", bad.length) : warn.length ? t("{0} ימים דורשים זהירות (גשם משמעותי / חום / רוח)", warn.length) : t("התחזית לימים הקרובים נוחה להליכה"),
        details,
        link: 'weather'
      });
    } else checks.push({
      key: 'forecast',
      title: t("תחזית חיה"),
      level: 'info',
      summary: t("היציאה רחוקה מ-16 יום – התחזית תופיע כשתתקרבו"),
      details: []
    });
  }

  // 3. flash floods
  {
    const wet = walking.filter(d => [10, 11, 0, 1, 2, 3].includes(d.date.getMonth()) && d.notes?.some(n => n.includes(t("שיטפון"))));
    const rainy = wet.filter(d => wx[d.day] && wx[d.day].rain >= 40);
    checks.push({
      key: 'floods',
      title: t("שיטפונות בנחלים"),
      level: rainy.length ? 'bad' : wet.length ? 'warn' : 'ok',
      summary: rainy.length ? t("גשם צפוי בימי נחל/מכתש: {0} – לא להיכנס לנחלים", rainy.map(d => t("יום") + d.day).join(', ')) : wet.length ? t("{0} ימים בנחלי מדבר בעונת הגשמים – לבדוק אזהרות רט\"ג בבוקר", wet.length) : t("אין ימי נחל בעונת שיטפונות"),
      details: wet.slice(0, 6).map(d => t("יום {0}: {1}", d.day, d.title)),
      link: 'guide/safety'
    });
  }

  // 4. heat
  {
    const hot = walking.filter(d => d.group === 'negev' && [4, 5, 6, 7, 8].includes(d.date.getMonth()));
    const warm = walking.filter(d => d.group === 'negev' && [3, 9].includes(d.date.getMonth()));
    checks.push({
      key: 'heat',
      title: t("חום במדבר"),
      level: hot.length ? 'bad' : warm.length ? 'warn' : 'ok',
      summary: hot.length ? t("{0} ימי מדבר בין מאי לספטמבר – אסור ומסוכן", hot.length) : warm.length ? t("{0} ימי מדבר באפריל/אוקטובר – לצאת לפני הזריחה, 6 ליטר מים", warm.length) : t("אין ימי מדבר בחודשי החום"),
      details: hot.slice(0, 5).map(d => t("יום {0}: {1}", d.day, d.title)),
      link: 'guide/water'
    });
  }

  // 5. water caching
  checks.push({
    key: 'water',
    title: t("מים והטמנות"),
    level: caches.length ? 'warn' : 'ok',
    summary: caches.length ? t("{0} ימים ללא מים בתוואי – לתאם הטמנות או ספק", caches.length) : t("אין ימים הדורשים הטמנה"),
    details: caches.slice(0, 8).map(c => t("יום {0}: {1}", c.day, c.overnight)),
    link: 'guide/water'
  });

  // 6. firing zones
  {
    const fz = walking.filter(d => d.notes?.some(n => n.includes(t("שטח אש"))));
    const weekend = fz.filter(d => [5, 6].includes(d.date.getDay()));
    checks.push({
      key: 'firing',
      title: t("שטחי אש"),
      level: fz.length ? weekend.length === fz.length ? 'ok' : 'warn' : 'ok',
      summary: fz.length ? t("{0} ימים ליד שטחי אש ({1} בסופ\"ש) – להישאר על הסימון, לתאם במידת הצורך", fz.length, weekend.length) : t("אין מקטעים בשטחי אש"),
      details: fz.slice(0, 6).map(d => t("יום {0} ({1}׳): {2}", d.day, [t("א"), t("ב"), t("ג"), t("ד"), t("ה"), t("ו"), t("ש")][d.date.getDay()], d.title)),
      link: 'guide/safety'
    });
  }

  // 7. lodging / angels
  {
    const angelDays = walking.filter(d => /מלאכ/.test(d.overnight || ''));
    const missing = angelDays.filter(d => !angels.some(a => d.segments.includes(Number(a.segId))));
    const wild = walking.filter(d => /לינת שטח|חניון/.test(d.overnight || ''));
    checks.push({
      key: 'lodging',
      title: t("לינה ומלאכי שביל"),
      level: missing.length ? 'warn' : 'ok',
      summary: angelDays.length ? t("{0} לילות אצל מלאכי שביל, {1} עדיין בלי איש קשר · {2} לילות שטח", angelDays.length, missing.length, wild.length) : t("{0} לילות שטח, {1} לילות ביישובים", wild.length, walking.length - wild.length),
      details: missing.slice(0, 6).map(d => t("יום {0}: {1}", d.day, d.overnight)),
      link: 'guide/angels'
    });
  }

  // 8. Shabbat & holidays
  {
    const shab = walking.filter(d => isShabbat(d.date));
    const hol = [];
    for (const d of days) for (const [a, b, name] of HOLIDAYS) if (inRange(d.date, a, b)) hol.push(t("יום {0}: {1}", d.day, t(name)));
    checks.push({
      key: 'shabbat',
      title: t("שבת וחגים"),
      level: hol.length ? 'warn' : shab.length ? 'info' : 'ok',
      summary: t("{0} ימי הליכה בשבת (אין תחבורה ציבורית, חנויות סגורות){1}", shab.length, hol.length ? t("· {0} ימים בחגים – חניונים עמוסים ותחבורה מוגבלת", hol.length) : ''),
      details: [...new Set(hol)].slice(0, 6),
      link: 'guide/transport'
    });
  }

  // 9. daylight
  {
    const tight = walking.filter(d => {
      const s = seg(d.segments[0]);
      const sun = sunTimes(d.date, s?.start?.lat ?? 31.5, s?.start?.lon ?? 34.9);
      return d.hours > sun.dayLength - 1;
    });
    checks.push({
      key: 'daylight',
      title: t("שעות אור"),
      level: tight.length ? 'warn' : 'ok',
      summary: tight.length ? t("{0} ימים שבהם ההליכה כמעט כאורך היום – לצאת עם הזריחה או לפצל", tight.length) : t("כל הימים נכנסים בשעות האור"),
      details: tight.slice(0, 6).map(d => t("יום {0}: {1} ק\"מ (~{2} שע׳)", d.day, d.km, d.hours))
    });
  }

  // 10. gear hint
  {
    const coldNegev = walking.some(d => d.group === 'negev' && [11, 0, 1, 2].includes(d.date.getMonth()));
    const wetNorth = walking.some(d => d.group !== 'negev' && [10, 11, 0, 1, 2].includes(d.date.getMonth()));
    const items = [];
    if (coldNegev) items.push(t("שק שינה 0°C עד -5°C ללילות הנגב"));
    if (wetNorth) items.push(t("מעיל גשם, כיסוי לתרמיל וגייטרים לבוץ"));
    if (caches.length) items.push(t("ג'ריקנים/בקבוקים להטמנה"));
    checks.push({
      key: 'gear',
      title: t("ציוד לעונה"),
      level: 'info',
      summary: items.length ? items.join(' · ') : t("ציוד בסיסי"),
      details: [],
      link: 'guide/gear'
    });
  }
  const overall = worst(checks.map(c => c.level));
  return {
    checks,
    overall
  };
}
export const PREP_STEPS = [{
  key: 'route',
  title: "לבדוק עדכוני תוואי וסגירות",
  link: 'guide/spni'
}, {
  key: 'maps',
  title: "להוריד תוואי OSM ומפות למקטעים (לשימוש לא מקוון)",
  link: 'map'
}, {
  key: 'angels',
  title: "לתאם מלאכי שביל ולהוסיף אנשי קשר",
  link: 'guide/angels'
}, {
  key: 'water',
  title: "להזמין הטמנות מים / לתכנן מילוי",
  link: 'guide/water'
}, {
  key: 'gear',
  title: "לעבור על רשימת הציוד לפי העונה",
  link: 'guide/gear'
}, {
  key: 'weather',
  title: "לבדוק תחזית ואזהרות שיטפונות יום לפני כל מקטע",
  link: 'weather'
}, {
  key: 'contact',
  title: "לקבוע איש קשר לצ'ק-אין יומי ולהעביר לו את התוכנית",
  link: 'nav'
}, {
  key: 'transport',
  title: "לתכנן הגעה לנקודת ההתחלה וחזרה",
  link: 'guide/transport'
}];