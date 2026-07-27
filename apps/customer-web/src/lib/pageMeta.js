export function setPageMeta({
  title,
  description,
  robots = "index,follow",
  canonical,
}) {
  document.title = title;
  upsertMeta("description", description);
  upsertMeta("robots", robots);

  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;
  } else {
    canonicalLink?.remove();
  }
}

function upsertMeta(name, content) {
  let element = document.querySelector(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}
