// Gear recommendations tailored to a segment and a month.
import { regionGroup } from './season.js'

export const BASE_GEAR = [
  { cat: 'נשיאה ולינה', items: ['תרמיל 45–65 ל\' עם חגורת מותן', 'כיסוי גשם לתרמיל / שק פנימי אטום', 'אוהל קל / טארפ', 'מזרן מתנפח/מתקפל', 'שק שינה (לפי עונה – ראו למטה)'] },
  { cat: 'מים', items: ['קיבולת מים לפי המקטע (ראו המלצה)', 'מלחים / אבקת אלקטרוליטים'] },
  { cat: 'ביגוד', items: ['נעלי הליכה מוכרות (לא חדשות!)', 'סנדלים לערב ולמעברי מים', '2–3 זוגות גרביים (מרינו)', 'חולצה ארוכה בהירה נגד שמש', 'מכנסי הליכה + מכנסיים קצרים', 'כובע רחב שוליים + באף', 'פליז / שכבת חום'] },
  { cat: 'ניווט ותקשורת', items: ['טלפון + מפות לא-מקוונות (האפליקציה הזו + Israel Hiking Map)', 'סוללת גיבוי 10,000–20,000mAh + כבלים', 'מפת סימון שבילים מודפסת / ספר השביל', 'מצפן גיבוי', 'פנס ראש + סוללות', 'משרוקית'] },
  { cat: 'בישול ואוכל', items: ['גזייה קטנה + מיכל גז (לקנות בארץ)', 'סיר קטן + כף', 'מצית + גפרורים עמידים למים', 'שקיות אשפה (משאירים נקי)'] },
  { cat: 'בריאות והיגיינה', items: ['ערכת עזרה ראשונה (פלסטרים לשלפוחיות, תחבושת אלסטית, משככי כאבים, אנטיהיסטמין)', 'קרם הגנה SPF50 + שפתון', 'נייר טואלט + כף חפירה קטנה', 'סבון ביולוגי, מברשת + משחת שיניים', 'תרופות אישיות', 'משחת אנטי-שפשוף', 'ג\'ל חיטוי ידיים'] },
  { cat: 'שונות', items: ['מקלות הליכה', 'משקפי שמש', 'סכין רב-שימושית', 'חבל דק / חוטי כביסה + אטבים', 'תעודת זהות, כרטיס אשראי, מזומן', 'ערכת תיקונים: סרט דביק, חוט ומחט', 'פנקס ועט ליומן'] },
]

const hasAny = (seg, re) => [seg.name_he, ...(seg.hazards || []), ...(seg.highlights || []), seg.description_he || ''].join(' ').match(re)

/**
 * Returns { extras: [{item, why, level}], sleepingBag, waterLiters, foodDays, warnings[] } for a segment in a given month (0-11).
 */
export function gearFor(seg, month) {
  if (!seg) return null
  const g = regionGroup(seg.region || '')
  const winter = [11, 0, 1].includes(month), shoulder = [2, 3, 9, 10].includes(month), summer = [4, 5, 6, 7, 8].includes(month)
  const extras = [], warnings = []
  const add = (item, why, level = 'rec') => extras.push({ item, why, level })

  // sleeping bag
  let sleepingBag = 'שק שינה +5°C'
  if (g === 'negev' && (winter || month === 2)) sleepingBag = 'שק שינה 0°C עד -5°C (לילות קפואים בהר הנגב)'
  else if (g === 'north' && winter) sleepingBag = 'שק שינה 0°C (קור ולחות בגליל ובחרמון)'
  else if (summer) sleepingBag = 'שק קיץ +10°C / ליינר בלבד'
  else sleepingBag = 'שק שינה +5°C עד 0°C'

  // water
  let liters = g === 'negev' ? 5 : 3
  if (summer) liters += 2; else if (shoulder && g === 'negev') liters += 1
  if (seg.water?.availability === 'none' || seg.water_caching_needed) liters = Math.max(liters, 6)
  if (seg.distance_km > 25) liters += 1
  if (seg.water_caching_needed) add('בקבוקים/ג\'ריקנים להטמנה + כף חפירה, שקיות סימון', 'המקטע ללא מקורות מים – נדרשת הטמנה', 'must')
  if (seg.water?.availability === 'springs') add('פילטר / טבליות כלור לטיהור מים', 'מקורות המים במקטע הם מעיינות', 'must')

  // terrain
  if (hasAny(seg, /סולמ|ידיות|יתדות|חבלים|קניון|תלול|מצוק|כרבולת|גשרון|ארבל|עקב|ברק|שלמה/)) add('כפפות עבודה קלות + נעליים עם אחיזה טובה; לארוז את התרמיל קומפקטי (לקטעי סולמות)', 'קטעי סולמות/ידיות וירידות תלולות במקטע', 'must')
  if (hasAny(seg, /חוף|ים|חולות|דיונ/)) add('גרביים נוספות ואבקת טלק – חול וחיכוך; נעליים אווריריות', 'הליכה בחולות/חוף', 'rec')
  if (hasAny(seg, /שיטפ|נחל/) && (winter || shoulder)) add('לבדוק תחזית שיטפונות בבוקר; שקיות אטומות לציוד', 'מעבר בנחלים בעונת גשמים', 'must')
  if (hasAny(seg, /שטח אש|שטחי אש/)) add('אישור תיאום / לוודא ימי פתיחה; להישאר על הסימון', 'המקטע גובל בשטחי אש', 'must')
  if (hasAny(seg, /שלג|קרח|חרמון|מירון/) && (winter || month === 2)) add('שכבות חמות, כפפות, כובע צמר; לבדוק שלג בחרמון/מירון', 'שלג אפשרי', 'must')
  if (seg.distance_km >= 26) add('אוכל קל ועתיר אנרגיה ליום ארוך; יציאה עם אור ראשון', `מקטע ארוך (${seg.distance_km} ק"מ)`, 'rec')
  if (!seg.overnight?.trail_angels && !seg.overnight?.paid) add('אוהל/טארפ חובה – אין לינה מסודרת בסיום', 'לינת שטח בלבד', 'must')
  if (seg.overnight?.trail_angels) add('בגד נקי לערב + מתנה קטנה למלאך שביל', 'אירוח אצל מלאכי שביל', 'nice')

  // season
  if (summer && g === 'negev') warnings.push('סכנת חיים: אין לטייל בנגב בחודשי הקיץ.')
  if (summer) { add('כובע רחב + חולצה ארוכה + משקפי שמש + קרם SPF50', 'קיץ – קרינה וחום', 'must'); add('מטריית טיולים / יריעת צל להפסקת צהריים', 'חום', 'nice') }
  if (winter || shoulder) add('מעיל גשם קל + כיסוי לתרמיל', 'עונת גשמים', g === 'negev' ? 'rec' : 'must')
  if (winter && g !== 'negev') add('גייטרים / מכנסיים עמידים לבוץ', 'בוץ בשבילי הצפון והמרכז', 'rec')
  if (g === 'negev') add('רשת/כיסוי לאוכל נגד עורבים ושועלים; לא להשאיר אוכל פתוח (צבועים)', 'חיות בר בחניוני הלילה', 'rec')
  if (g === 'north' && (shoulder || summer)) add('דוחה יתושים; בדיקת קרציות בערב', 'צמחייה וקרציות', 'rec')

  const foodDays = seg.water_caching_needed || g === 'negev' ? 'אוכל ל-2–4 ימים (הצטיידות מוגבלת בנגב)' : 'אוכל ליום-יומיים (חנויות ביישובים)'
  return { extras, sleepingBag, waterLiters: liters, foodDays, warnings, group: g }
}

/** Pack weight helper (kg): base + water + food */
export function packWeight({ baseKg = 8, liters = 4, foodDays = 2 }) {
  return +(baseKg + liters * 1 + foodDays * 0.7).toFixed(1)
}
