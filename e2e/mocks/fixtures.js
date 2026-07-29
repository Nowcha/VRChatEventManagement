/**
 * Seed data for the E2E build.
 *
 * Values are deliberately awkward — long Japanese names, many staff, several
 * events on one day — because the layout bugs worth catching only appear when
 * content is bigger than the happy path.
 */

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-07-30T12:00:00+09:00')

/** @param {number} offsetDays @param {number} hour */
function at(offsetDays, hour, minute = 0) {
    const d = new Date(now.getTime() + offsetDays * DAY)
    d.setHours(hour, minute, 0, 0)
    return d
}

export const TEST_UID = 'user-akari'

export const users = [
    { id: TEST_UID, displayName: 'あかり', authProvider: 'twitter' },
    { id: 'user-yui', displayName: 'ゆい', authProvider: 'discord' },
    { id: 'user-mio', displayName: 'みお', authProvider: 'twitter' },
    { id: 'user-long', displayName: 'とてもながいなまえのキャストさん', authProvider: 'twitter' },
    { id: 'user-ren', displayName: 'れん', authProvider: 'discord' },
    { id: 'user-sora', displayName: 'そら', authProvider: 'twitter' },
]

export const events = [
    { id: 'ev-1', date: at(0, 21), timeSlot: '21:00', status: 'confirmed', title: '夏の夜の星空バー', createdBy: TEST_UID, memo: '' },
    { id: 'ev-2', date: at(0, 24), timeSlot: '24:00', status: 'confirmed', title: '深夜のまったり回', createdBy: 'user-yui', memo: '' },
    { id: 'ev-3', date: at(2, 21), timeSlot: '21:00', status: 'candidate', createdBy: TEST_UID, memo: '' },
    { id: 'ev-4', date: at(2, 24), timeSlot: '24:00', status: 'candidate', createdBy: 'user-yui', memo: '' },
    { id: 'ev-5', date: at(5, 21), timeSlot: '21:00', status: 'candidate', createdBy: 'user-mio', memo: '' },
    { id: 'ev-6', date: at(-3, 21), timeSlot: '21:00', status: 'cancelled', createdBy: TEST_UID, memo: '人数不足のため' },
    { id: 'ev-7', date: at(7, 21), timeSlot: '21:00', status: 'confirmed', title: '記念すべき第100回開催スペシャル', createdBy: TEST_UID, memo: '' },
]

export const shifts = [
    { id: 'sh-1', eventId: 'ev-1', userId: TEST_UID, status: 'confirmed' },
    { id: 'sh-2', eventId: 'ev-1', userId: 'user-yui', status: 'available' },
    { id: 'sh-3', eventId: 'ev-1', userId: 'user-long', status: 'available' },
    { id: 'sh-4', eventId: 'ev-3', userId: TEST_UID, status: 'available' },
    { id: 'sh-5', eventId: 'ev-3', userId: 'user-yui', status: 'unavailable' },
    { id: 'sh-6', eventId: 'ev-3', userId: 'user-mio', status: 'available' },
    { id: 'sh-7', eventId: 'ev-4', userId: 'user-long', status: 'unavailable' },
    { id: 'sh-8', eventId: 'ev-5', userId: TEST_UID, status: 'unavailable' },
]

export const customers = [
    { id: 'cus-1', vrchatName: 'ほしぞらさん', firstVisitDate: at(-40, 21), visitCount: 12, tags: ['常連', 'VIP'], notes: '星の話が好き。お酒はほどほど。' },
    { id: 'cus-2', vrchatName: 'とてもながいなまえのおきゃくさま', firstVisitDate: at(-10, 21), visitCount: 3, tags: ['新規'], notes: '初回来店時にワールド案内済み。次回は席の希望を確認する。' },
    { id: 'cus-3', vrchatName: 'みかづき', firstVisitDate: at(-120, 24), visitCount: 47, tags: ['常連', 'リピーター', 'VIP'], notes: '' },
    { id: 'cus-4', vrchatName: 'Nova', firstVisitDate: at(-5, 21), visitCount: 1, tags: [], notes: '英語話者。翻訳ツール利用。' },
]

export const feedbacks = [
    { id: 'fb-1', eventId: 'ev-1', customerIds: ['cus-1', 'cus-2'], assignedCastId: TEST_UID, status: 'written', content: 'とても楽しいイベントでした。またぜひ参加したいと思います。次回は友人も連れてきたいです。', createdAt: at(0, 23) },
    { id: 'fb-2', eventId: 'ev-1', customerIds: ['cus-3'], assignedCastId: 'user-yui', status: 'unwritten', content: '', createdAt: at(0, 23) },
    { id: 'fb-3', eventId: 'ev-2', customerIds: ['cus-4'], assignedCastId: 'user-long', status: 'posted', content: 'Great atmosphere!', createdAt: at(0, 26) },
    { id: 'fb-4', eventId: 'ev-7', customerIds: ['cus-1', 'cus-2', 'cus-3', 'cus-4'], assignedCastId: 'user-mio', status: 'unwritten', content: '', createdAt: at(-1, 23) },
]

export const photos = [
    { id: 'ph-1', eventId: 'ev-1', imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23cfd8e3"/></svg>', uploadedAt: at(0, 23), uploadedBy: TEST_UID },
    { id: 'ph-2', eventId: 'ev-1', imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23e3cfd8"/></svg>', uploadedAt: at(0, 23), uploadedBy: TEST_UID },
    { id: 'ph-3', eventId: 'ev-2', imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23d8e3cf"/></svg>', uploadedAt: at(0, 26), uploadedBy: 'user-yui' },
]

export const ideas = [
    { id: 'id-1', title: '夏の夜の星空バーイベント', description: '星空をテーマにしたゆったり過ごせるバーイベント。BGMはアンビエント中心で。', authorId: TEST_UID, authorName: 'あかり', status: 'unused', createdAt: at(-2, 12), reactions: { '👍': [TEST_UID, 'user-yui', 'user-mio'], '🎉': ['user-yui'], '🕐': [], '❌': [] } },
    { id: 'id-2', title: 'レトロゲーム大会', description: '', authorId: 'user-yui', authorName: 'ゆい', status: 'used', createdAt: at(-9, 12), reactions: { '👍': ['user-mio'], '🎉': [], '🕐': ['user-long'], '❌': [] } },
    { id: 'id-3', title: 'とてもながいイベントタイトルのアイデアで折り返しを確認するためのもの', description: '説明文も長めにしておく。'.repeat(4), authorId: 'user-long', authorName: 'とてもながいなまえのキャストさん', status: 'unused', createdAt: at(-1, 12), reactions: { '👍': [], '🎉': [], '🕐': [], '❌': ['user-ren'] } },
]

export const externalEvents = [
    { id: 'xe-1', title: '定例コラボイベント', startAt: at(1, 21), endAt: at(1, 23), joinMethod: 'join', isRecurring: true, recurringId: 'rg-1', recurringRule: { frequency: 'weekly', weekdays: [5], endType: 'never' }, note: '' },
    { id: 'xe-2', title: 'ReqIn限定の少人数回', startAt: at(1, 22), endAt: at(1, 23, 30), joinMethod: 'reqin', reqInLimit: 5, isRecurring: false, note: '先着5名' },
    { id: 'xe-3', title: 'グループ公開イベント', startAt: at(3, 20), endAt: at(3, 22), joinMethod: 'group', isRecurring: false, note: '' },
    { id: 'xe-4', title: '同時刻かさなり確認用', startAt: at(1, 21, 30), endAt: at(1, 22, 30), joinMethod: 'group', isRecurring: false, note: '' },
]

export const recurringGroups = [
    { id: 'rg-1', managedUntil: at(60, 0), title: '定例コラボイベント' },
]

export const collections = {
    users,
    events,
    shifts,
    customers,
    feedbacks,
    photos,
    ideas,
    externalEvents,
    recurringGroups,
}
