import { useSyncExternalStore } from 'react'
import { subscribe, getSnapshot } from '../lib/group.js'
/** Live view of the trail group: { joined, code, name, id, members, msgs, shared, online, unread, rev, push } */
export const useGroup = () => useSyncExternalStore(subscribe, getSnapshot)
