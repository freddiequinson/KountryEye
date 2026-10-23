/** Same counting as the server: 160 characters per SMS (153 when split), 70/67 with emoji or other Unicode. */
const GSM = new Set("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà")
const GSM_EXT = new Set('^{}\\[~]|€')

export function smsInfo(text: string) {
  const chars = Array.from(text || '')
  if (chars.every((c) => GSM.has(c) || GSM_EXT.has(c))) {
    const length = chars.reduce((n, c) => n + (GSM_EXT.has(c) ? 2 : 1), 0)
    return { characters: length, unicode: false, segments: Math.max(length <= 160 ? 1 : Math.ceil(length / 153), 1) }
  }
  const length = chars.length
  return { characters: length, unicode: true, segments: Math.max(length <= 70 ? 1 : Math.ceil(length / 67), 1) }
}

export const SMS_STATUS: Record<string, { label: string; color: string }> = {
  queued: { label: 'Queued', color: 'gray' },
  sent: { label: 'Sent', color: 'blue' },
  delivered: { label: 'Delivered', color: 'green' },
  failed: { label: 'Failed', color: 'red' },
  blocked: { label: 'No credit', color: 'orange' },
  dry_run: { label: 'Test (not sent)', color: 'purple' },
}

export const SMS_CATEGORY: Record<string, string> = {
  receipt: 'Receipt',
  lab: 'Glasses',
  birthday: 'Birthday',
  review: 'Review reminder',
  debt: 'Balance reminder',
  promo: 'Promotion',
  manual: 'Message',
}
