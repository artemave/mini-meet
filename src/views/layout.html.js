import html from 'nanohtml';
import rollbarSnippet from './rollbar.html.js';
import posthogSnippet from './posthog.html.js';

export default function layout({
  title = 'Mini Meet',
  head = '',
  body = '',
  rollbar = {
    clientAccessToken: process.env.ROLLBAR_CLIENT_ACCESS_TOKEN,
    environment: process.env.ROLLBAR_ENVIRONMENT || 'development',
  },
  posthog = {
    apiKey: process.env.POSTHOG_API_KEY,
    apiHost: process.env.POSTHOG_API_HOST || '/ph',
  }
}) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <title>${title}</title>
        <link rel="stylesheet" href="/styles.css" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.webmanifest" />
        ${rollbarSnippet(rollbar)}
        ${posthogSnippet(posthog)}
        ${head}
      </head>
      <body>
        ${body}
      </body>
    </html>
  `;
}
