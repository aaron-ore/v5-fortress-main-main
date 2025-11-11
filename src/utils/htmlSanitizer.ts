export const sanitizeHtml = (html: string): string => {
  // A simple, effective sanitizer for basic XSS prevention.
  // For more complex scenarios, a dedicated library like DOMPurify is recommended.
  const div = document.createElement('div');
  div.innerHTML = html;

  // Remove script tags
  const scripts = div.getElementsByTagName('script');
  for (let i = scripts.length - 1; i >= 0; i--) {
    scripts[i].remove();
  }

  // Remove event handlers (e.g., onclick, onerror)
  const allElements = div.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const element = allElements[i] as HTMLElement;
    for (let j = 0; j < element.attributes.length; j++) {
      const attr = element.attributes[j];
      if (attr.name.startsWith('on')) {
        element.removeAttribute(attr.name);
      }
    }
  }

  return div.innerHTML;
};

export const escapeHtml = (text: string): string => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
};