import { describe, expect, it } from 'vitest';
import { newsletterConfirmationEmail } from '@/lib/newsletter-confirmation-email';

const link = 'https://maps.chrispybmx.com/newsletter/conferma#' + 'a'.repeat(64);
const privacy = 'https://maps.chrispybmx.com/privacy#newsletter';

describe('newsletterConfirmationEmail', () => {
  it('puts the confirmation link behind a button in the html', () => {
    const { html } = newsletterConfirmationEmail(link, privacy);

    expect(html).toContain(`href="${link}"`);
    expect(html).toContain('Conferma iscrizione');
  });

  it('keeps a plain-text version with the same link', () => {
    const { text } = newsletterConfirmationEmail(link, privacy);

    expect(text).toContain(link);
    expect(text).toContain(privacy);
  });

  it('does not lead with the 24 hour deadline', () => {
    const { subject, html } = newsletterConfirmationEmail(link, privacy);

    expect(subject).not.toMatch(/24/);
    expect(html.indexOf('24 ore')).toBeGreaterThan(html.indexOf('Conferma iscrizione'));
  });

  it('escapes the link so it cannot break out of the attribute', () => {
    const { html } = newsletterConfirmationEmail('https://x.test/"><script>', privacy);

    expect(html).not.toContain('"><script>');
  });
});
