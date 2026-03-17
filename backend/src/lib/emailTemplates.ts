export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

// ────────────────────────────────────────────────────────────
// Shared layout wrapper
// ────────────────────────────────────────────────────────────

interface LayoutData {
  appUrl: string;
  userId?: string;
  emailToken?: string;
}

function wrapInLayout(bodyContent: string, data: LayoutData): string {
  const trackingPixel =
    data.userId && data.emailToken
      ? `<img src="${data.appUrl}/api/v1/events/pixel?token=${encodeURIComponent(data.emailToken)}&user=${encodeURIComponent(data.userId)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GroceryHack</title>
  <style>
    body { margin: 0; padding: 0; background-color: #FAF9F6; font-family: 'Inter', Arial, sans-serif; color: #2D2D2D; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
    .header { text-align: center; padding-bottom: 24px; border-bottom: 1px solid rgba(61,123,123,0.12); margin-bottom: 24px; }
    .logo { font-family: 'Sora', Arial, sans-serif; font-size: 24px; font-weight: 700; color: #3D7B7B; text-decoration: none; }
    .content { padding: 0 0 24px; }
    .cta-button { display: inline-block; background-color: #3D7B7B; color: #FFFFFF; text-decoration: none; padding: 14px 28px; border-radius: 99px; font-weight: 600; font-size: 16px; }
    .cta-wrap { text-align: center; margin: 24px 0; }
    .footer { border-top: 1px solid rgba(61,123,123,0.12); padding-top: 24px; text-align: center; font-size: 12px; color: #5A5A5A; }
    h1 { font-family: 'Sora', Arial, sans-serif; font-size: 22px; font-weight: 700; color: #2D2D2D; }
    .savings { font-family: 'Sora', Arial, sans-serif; font-size: 28px; font-weight: 700; color: #3D7B7B; }
    .meal-item { padding: 8px 0; border-bottom: 1px solid rgba(61,123,123,0.08); }
    .meal-savings { color: #1A7F37; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="${data.appUrl}" class="logo">GroceryHack</a>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p>GroceryHack &mdash; Save more, eat better.</p>
    </div>
    ${trackingPixel}
  </div>
</body>
</html>`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function trackedLink(url: string, data: LayoutData): string {
  if (data.userId && data.emailToken) {
    return `${data.appUrl}/api/v1/r?url=${encodeURIComponent(url)}&token=${encodeURIComponent(data.emailToken)}&user=${encodeURIComponent(data.userId)}`;
  }
  return url;
}

function greeting(name: string | null): string {
  return name ? `Hi ${name}` : 'Hi there';
}

// ────────────────────────────────────────────────────────────
// a) Welcome Email
// ────────────────────────────────────────────────────────────

export function renderWelcomeEmail(data: {
  displayName: string | null;
  appUrl: string;
}): EmailContent {
  const layoutData: LayoutData = { appUrl: data.appUrl };
  const body = `
    <h1>Welcome to GroceryHack!</h1>
    <p>${greeting(data.displayName)},</p>
    <p>We find the best grocery deals in your area and build personalized meal plans that save you real money every week.</p>
    <p>Your first meal plan is just around the corner. We'll match sales from your local stores to delicious recipes and send you a plan optimized for savings.</p>
    <div class="cta-wrap">
      <a href="${data.appUrl}" class="cta-button">Open GroceryHack</a>
    </div>`;

  const html = wrapInLayout(body, layoutData);
  return {
    subject: 'Welcome to GroceryHack! \uD83C\uDF89',
    html,
    text: stripHtml(html),
  };
}

// ────────────────────────────────────────────────────────────
// b) Weekly Plan Email
// ────────────────────────────────────────────────────────────

export function renderWeeklyPlanEmail(data: {
  displayName: string | null;
  weekOf: string;
  planToken: string;
  totalSavings: number;
  mealCount: number;
  topMeals: { name: string; savings: number }[];
  appUrl: string;
  userId: string;
  emailToken: string;
}): EmailContent {
  const layoutData: LayoutData = { appUrl: data.appUrl, userId: data.userId, emailToken: data.emailToken };
  const planUrl = `${data.appUrl}/plan/${data.planToken}`;

  const mealList = data.topMeals
    .map(
      (m) =>
        `<div class="meal-item">${m.name} <span class="meal-savings">save $${m.savings.toFixed(2)}</span></div>`
    )
    .join('\n      ');

  const body = `
    <h1>Your meal plan is ready!</h1>
    <p>${greeting(data.displayName)},</p>
    <p>Your plan for the week of <strong>${data.weekOf}</strong> is here with <strong>${data.mealCount} meals</strong>.</p>
    <p class="savings">Save $${data.totalSavings.toFixed(2)} this week</p>
    <div>${mealList}</div>
    <div class="cta-wrap">
      <a href="${trackedLink(planUrl, layoutData)}" class="cta-button">View Your Plan</a>
    </div>`;

  const html = wrapInLayout(body, layoutData);
  return {
    subject: `Your meal plan is ready \u2014 save $${data.totalSavings.toFixed(2)} this week`,
    html,
    text: stripHtml(html),
  };
}

// ────────────────────────────────────────────────────────────
// c) Share Meal — Cook For Me
// ────────────────────────────────────────────────────────────

export function renderShareCookForMeEmail(data: {
  senderName: string | null;
  recipientName: string | null;
  mealName: string;
  shareToken: string;
  date: string | null;
  time: string | null;
  appUrl: string;
}): EmailContent {
  const layoutData: LayoutData = { appUrl: data.appUrl };
  const sender = data.senderName ?? 'Someone';
  const respondUrl = `${data.appUrl}/share/${data.shareToken}`;
  const when = formatWhen(data.date, data.time);

  const body = `
    <h1>${sender} wants you to cook ${data.mealName}!</h1>
    <p>${greeting(data.recipientName)},</p>
    <p><strong>${sender}</strong> would love it if you made <strong>${data.mealName}</strong>${when}.</p>
    <div class="cta-wrap">
      <a href="${respondUrl}" class="cta-button">View &amp; Respond</a>
    </div>
    <p style="text-align:center;font-size:14px;color:#5A5A5A;">You can accept or decline from the link above.</p>`;

  const html = wrapInLayout(body, layoutData);
  return {
    subject: `${sender} wants you to cook ${data.mealName}!`,
    html,
    text: stripHtml(html),
  };
}

// ────────────────────────────────────────────────────────────
// d) Share Meal — Make For You
// ────────────────────────────────────────────────────────────

export function renderShareMakeForYouEmail(data: {
  senderName: string | null;
  recipientName: string | null;
  mealName: string;
  date: string | null;
  time: string | null;
  appUrl: string;
}): EmailContent {
  const layoutData: LayoutData = { appUrl: data.appUrl };
  const sender = data.senderName ?? 'Someone';
  const when = formatWhen(data.date, data.time);

  const body = `
    <h1>${sender} is making ${data.mealName} for you!</h1>
    <p>${greeting(data.recipientName)},</p>
    <p><strong>${sender}</strong> is planning to make <strong>${data.mealName}</strong> for you${when}. Lucky you!</p>
    <div class="cta-wrap">
      <a href="${data.appUrl}" class="cta-button">Open GroceryHack</a>
    </div>`;

  const html = wrapInLayout(body, layoutData);
  return {
    subject: `${sender} is making ${data.mealName} for you!`,
    html,
    text: stripHtml(html),
  };
}

// ────────────────────────────────────────────────────────────
// e) Share Response — Accepted
// ────────────────────────────────────────────────────────────

export function renderShareAcceptedEmail(data: {
  recipientName: string | null;
  mealName: string;
  date: string | null;
  time: string | null;
  calendarUrl: string | null;
  appUrl: string;
}): EmailContent {
  const layoutData: LayoutData = { appUrl: data.appUrl };
  const recipient = data.recipientName ?? 'They';
  const when = formatWhen(data.date, data.time);

  const calendarLink = data.calendarUrl
    ? `<div class="cta-wrap"><a href="${data.calendarUrl}" class="cta-button">Add to Calendar</a></div>`
    : '';

  const body = `
    <h1>${recipient} said yes!</h1>
    <p><strong>${data.mealName}</strong> is happening${when}.</p>
    ${calendarLink}
    <div class="cta-wrap">
      <a href="${data.appUrl}" class="cta-button">Open GroceryHack</a>
    </div>`;

  const html = wrapInLayout(body, layoutData);
  return {
    subject: `They said yes! \uD83C\uDF89 ${data.mealName} is happening`,
    html,
    text: stripHtml(html),
  };
}

// ────────────────────────────────────────────────────────────
// f) Share Response — Declined
// ────────────────────────────────────────────────────────────

export function renderShareDeclinedEmail(data: {
  recipientName: string | null;
  mealName: string;
  appUrl: string;
}): EmailContent {
  const layoutData: LayoutData = { appUrl: data.appUrl };
  const recipient = data.recipientName ?? 'They';

  const body = `
    <h1>Maybe next time</h1>
    <p><strong>${recipient}</strong> can't do <strong>${data.mealName}</strong> right now. No worries — there's always next week!</p>
    <div class="cta-wrap">
      <a href="${data.appUrl}" class="cta-button">Open GroceryHack</a>
    </div>`;

  const html = wrapInLayout(body, layoutData);
  return {
    subject: `${recipient} can't do ${data.mealName} right now`,
    html,
    text: stripHtml(html),
  };
}

// ────────────────────────────────────────────────────────────
// g) Password Reset Email
// ────────────────────────────────────────────────────────────

export function renderPasswordResetEmail(data: {
  resetUrl: string;
  appUrl: string;
}): EmailContent {
  const layoutData: LayoutData = { appUrl: data.appUrl };

  const body = `
    <h1>Reset your password</h1>
    <p>We received a request to reset your GroceryHack password. Click the button below to choose a new one.</p>
    <div class="cta-wrap">
      <a href="${data.resetUrl}" class="cta-button">Reset Password</a>
    </div>
    <p style="font-size:14px;color:#5A5A5A;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`;

  const html = wrapInLayout(body, layoutData);
  return {
    subject: 'Reset your GroceryHack password',
    html,
    text: stripHtml(html),
  };
}

// ────────────────────────────────────────────────────────────
// h) Share Plan Email
// ────────────────────────────────────────────────────────────

export function renderSharePlanEmail(data: {
  senderName: string | null;
  recipientName: string | null;
  planToken: string;
  totalSavings: number;
  mealCount: number;
  appUrl: string;
}): EmailContent {
  const layoutData: LayoutData = { appUrl: data.appUrl };
  const sender = data.senderName ?? 'Someone';
  const planUrl = `${data.appUrl}/plan/${data.planToken}`;

  const body = `
    <h1>${sender} shared a meal plan with you</h1>
    <p>${greeting(data.recipientName)},</p>
    <p><strong>${sender}</strong> shared their weekly meal plan with <strong>${data.mealCount} meals</strong> and <strong>$${data.totalSavings.toFixed(2)}</strong> in savings.</p>
    <div class="cta-wrap">
      <a href="${planUrl}" class="cta-button">View the Plan</a>
    </div>`;

  const html = wrapInLayout(body, layoutData);
  return {
    subject: `${sender} shared their meal plan with you`,
    html,
    text: stripHtml(html),
  };
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function formatWhen(date: string | null, time: string | null): string {
  if (date && time) return ` on ${date} at ${time}`;
  if (date) return ` on ${date}`;
  if (time) return ` at ${time}`;
  return '';
}
