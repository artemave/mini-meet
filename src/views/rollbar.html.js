import html from 'nanohtml';

/**
 * @param {{ clientAccessToken?: string, environment?: string, jsUrl?: string }} params
 */
export default function rollbarSnippet({ clientAccessToken, environment, jsUrl }) {
  if (!clientAccessToken) {
    return html``;
  }

  return html`
    <script>
      window.ROLLBAR_CLIENT_ACCESS_TOKEN = "${clientAccessToken}";
      window.ROLLBAR_ENVIRONMENT = "${environment}";
      window.ROLLBAR_CLIENT_JS_URL = "${jsUrl || '/_rb/7c.js'}";
    </script>
    <script id="rollbar-bootstrap" src="/core-9a1.js" defer></script>
  `;
}
