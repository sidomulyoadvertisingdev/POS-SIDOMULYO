const PRINT_IFRAME_ID = 'pos-browser-print-frame';

export const injectPrintScript = (html: string): string => {
  const script = '<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 150); });</script>';
  if (html.includes('</body>')) {
    return html.replace('</body>', `${script}</body>`);
  }
  return `${html}${script}`;
};

export const loadHtmlIntoWindow = (windowRef: Window, html: string): void => {
  const blob = new Blob([injectPrintScript(html)], { type: 'text/html;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  windowRef.location.replace(objectUrl);
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 60000);
};

export const printHtmlWithIframe = (html: string): boolean => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const markup = injectPrintScript(html);
  const existing = document.getElementById(PRINT_IFRAME_ID);
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const iframe = document.createElement('iframe');
  iframe.id = PRINT_IFRAME_ID;
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.srcdoc = markup;
  document.body.appendChild(iframe);

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1000);
  };

  iframe.onload = () => {
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
      }
    } catch (_error) {
      // Ignore focus errors on embedded print frame.
    }
    cleanup();
  };

  return true;
};
