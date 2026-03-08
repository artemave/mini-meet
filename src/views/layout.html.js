import html from 'nanohtml';

/**
 * @param {{
 *   title?: string,
 *   head?: string | any,
 *   body?: string | any
 * }} params
 */
export default function layout({
  title = 'Mini Meet',
  head = '',
  body = '',
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
        <script>
          (function () {
            function send(event, context) {
              var payload = JSON.stringify({ event: event, context: context });

              try {
                if (navigator.sendBeacon) {
                  var blob = new Blob([payload], { type: 'application/json' });
                  navigator.sendBeacon('/log', blob);
                  return;
                }
              } catch (_) {}

              try {
                fetch('/log', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: payload,
                  keepalive: true
                });
              } catch (_) {}
            }

            window.addEventListener('error', function (event) {
              var target = event.target;
              if (!target || target === window) return;

              var tagName = target.tagName ? String(target.tagName).toLowerCase() : '';
              if (!tagName) return;

              var url = target.src || target.href || target.currentSrc || '';
              if (!url) return;

              send('client_resource_error', {
                tagName: tagName,
                url: url,
                id: target.id || '',
                className: typeof target.className === 'string' ? target.className : '',
                page: location.pathname
              });
            }, true);

            window.addEventListener('securitypolicyviolation', function (event) {
              send('client_securitypolicyviolation', {
                blockedUri: event.blockedURI || '',
                directive: event.effectiveDirective || event.violatedDirective || '',
                sourceFile: event.sourceFile || '',
                page: location.pathname
              });
            });
          }());
        </script>
        ${head}
      </head>
      <body>
        ${body}
      </body>
    </html>
  `;
}
