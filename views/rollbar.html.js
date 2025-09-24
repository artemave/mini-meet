import html from 'nanohtml';

export default function rollbarSnippet({ clientAccessToken, environment }) {
  if (!clientAccessToken) {
    return html``;
  }

  return html`
    <script>
      window.ROLLBAR_CLIENT_ACCESS_TOKEN = "${clientAccessToken}";
      window.ROLLBAR_ENVIRONMENT = "${environment}";
    </script>
    <script src="/rollbar-snippet.js"></script>
  `;
}