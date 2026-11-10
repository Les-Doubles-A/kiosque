export const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Flux de test</title>
    <item>
      <title>Premier article</title>
      <link>https://exemple.fr/a1</link>
      <guid>guid-1</guid>
      <pubDate>Fri, 16 Oct 2026 08:00:00 GMT</pubDate>
      <description>&lt;p&gt;Résumé du &lt;b&gt;premier&lt;/b&gt; article.&lt;/p&gt;</description>
    </item>
    <item>
      <title>Second article</title>
      <link>https://exemple.fr/a2</link>
      <guid>guid-2</guid>
      <pubDate>Sat, 17 Oct 2026 09:30:00 GMT</pubDate>
      <description>Texte simple.</description>
    </item>
  </channel>
</rss>`;

export const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Flux Atom</title>
  <entry>
    <title>Entrée Atom</title>
    <link rel="alternate" href="https://atom.exemple.fr/e1"/>
    <link rel="self" href="https://atom.exemple.fr/e1.atom"/>
    <id>urn:uuid:e1</id>
    <updated>2026-10-15T10:00:00Z</updated>
    <summary>Résumé Atom</summary>
  </entry>
</feed>`;

export const HTML_PAGE = `<!doctype html><html><head><title>Page</title></head><body><p>Pas un flux</p></body></html>`;

export const RDF = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/"><channel><title>RSS 1.0</title></channel></rdf:RDF>`;

export const HOSTILE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Flux hostile</title>
    <item>
      <title><![CDATA[<script>alert(1)</script>Titre piégé]]></title>
      <link>https://exemple.fr/h1</link>
      <guid>h1</guid>
      <description><![CDATA[<img src="https://tracker.example/pixel.gif" onerror="alert(2)"><script>alert(3)</script>Extrait <b>piégé</b>]]></description>
    </item>
    <item>
      <title>Lien dangereux</title>
      <link>javascript:alert(4)</link>
      <guid>h2</guid>
    </item>
    <item>
      <title></title>
      <link>https://exemple.fr/h3</link>
      <guid>h3</guid>
    </item>
    <item>
      <title>Sans lien</title>
      <guid>h4</guid>
    </item>
    <item>
      <title>Sans date</title>
      <link>https://exemple.fr/h5</link>
      <guid>h5</guid>
    </item>
  </channel>
</rss>`;

/** Réponse fetch factice. */
export function fakeResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    text: async () => body,
  };
}
