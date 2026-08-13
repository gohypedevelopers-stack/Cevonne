const ALLOWED_TAGS = new Set(["B", "BR", "DIV", "EM", "I", "LI", "OL", "P", "STRONG", "U", "UL"]);
const DROP_WITH_CONTENT = new Set(["EMBED", "IFRAME", "IMG", "LINK", "META", "OBJECT", "SCRIPT", "STYLE", "SVG", "TEMPLATE"]);

export const sanitizeRichTextForEditor = (value: string) => {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return value.replace(/<[^>]*>/g, "");
  }

  const document = new DOMParser().parseFromString(value, "text/html");
  for (const element of Array.from(document.body.querySelectorAll("*"))) {
    if (DROP_WITH_CONTENT.has(element.tagName)) {
      element.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      element.removeAttribute(attribute.name);
    }
  }

  return document.body.innerHTML;
};
