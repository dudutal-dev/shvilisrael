import { useEffect } from 'react';
import { onEvent } from '../lib/group.js';
import { useToast } from '../hooks/useToast.jsx';
import { t } from '../i18n/index.js'
/** Shows a toast for incoming group activity while the user is on another screen. */
export function GroupWatcher({
  tab
}) {
  const toast = useToast();
  useEffect(() => onEvent(ev => {
    if (ev.type === 'chat' && tab !== 'chat') toast(`💬 ${ev.name}: ${ev.text.slice(0, 70)}`, 4000);
    if (ev.type === 'journal' && tab !== 'journal') toast(t("📓 {0} הוסיף/ה רשומה ליומן המשותף", ev.name), 4000);
  }), [tab, toast]);
  return null;
}
