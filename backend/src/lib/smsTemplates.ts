function truncate(msg: string, maxLen: number = 160): string {
  if (msg.length <= maxLen) return msg;
  return msg.slice(0, maxLen - 1) + '\u2026';
}

export function renderShareCookForMeSms(data: {
  senderName: string | null;
  mealName: string;
  respondUrl: string;
}): string {
  const sender = data.senderName ?? 'Someone';
  return truncate(`${sender} wants you to cook ${data.mealName}! Respond: ${data.respondUrl}`);
}

export function renderShareMakeForYouSms(data: {
  senderName: string | null;
  mealName: string;
}): string {
  const sender = data.senderName ?? 'Someone';
  return truncate(`${sender} is making ${data.mealName} for you! - GroceryHack`);
}

export function renderShareAcceptedSms(data: {
  recipientName: string | null;
  mealName: string;
}): string {
  const recipient = data.recipientName ?? 'They';
  return truncate(`${recipient} said yes to ${data.mealName}! - GroceryHack`);
}

export function renderShareDeclinedSms(data: {
  recipientName: string | null;
  mealName: string;
}): string {
  const recipient = data.recipientName ?? 'They';
  return truncate(`${recipient} can't do ${data.mealName} right now. - GroceryHack`);
}

export function renderSharePlanSms(data: {
  senderName: string | null;
  planUrl: string;
}): string {
  const sender = data.senderName ?? 'Someone';
  return truncate(`${sender} shared a meal plan with you! View: ${data.planUrl}`);
}
