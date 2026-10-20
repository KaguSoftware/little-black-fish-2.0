/**
 * Support page helpers: the long-form body parser and the two payment links.
 * Supersedes SITE.support in shared/content/site.ts.
 */

/**
 * Splits a support_body into sections. A block starting "## " opens a section heading;
 * blank lines separate paragraphs; text before the first heading is an untitled section.
 */
export function parseSupportBody(body?: string | null) {
  const sections: { heading: string | null; paragraphs: string[] }[] = [];
  for (const block of (body ?? '').replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    const text = block.trim(); if (!text) continue;
    if (text.startsWith('## ')) { const [h, ...rest] = text.split('\n'); sections.push({ heading: h.slice(3).trim(), paragraphs: rest.length ? [rest.join(' ').trim()] : [] }); }
    else if (sections.length) sections[sections.length - 1].paragraphs.push(text.replace(/\n/g, ' '));
    else sections.push({ heading: null, paragraphs: [text.replace(/\n/g, ' ')] });
  }
  return sections;
}

export type PaymentMethod = "worldwide" | "iran";

/** Payment pages; copy for each lives in messages/<locale>/support.json under the same key. */
export const PAYMENT_LINKS: Record<PaymentMethod, string> = {
  worldwide: "https://lbfstudios.gumroad.com/coffee",
  iran: "https://tlcard.ir/charge/7603/8565",
};

/** Visitors reading Persian are most likely paying from inside Iran, so that option leads on fa. */
export function paymentOrder(locale: string): PaymentMethod[] {
  return locale === "fa" ? ["iran", "worldwide"] : ["worldwide", "iran"];
}
