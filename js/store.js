(function() {
  async function jsonFetch(url, opts = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `HTTP ${res.status}`);
    }
    return res.json();
  }

  const Store = {
    async getArtworks() {
      return jsonFetch('/api/artworks');
    },
    async getComments(limit = 30) {
      return jsonFetch(`/api/comments?limit=${limit}`);
    },
    async addComment(payload) {
      return jsonFetch('/api/comments', { method: 'POST', body: JSON.stringify(payload) });
    },
    async getVariants(artworkId) {
      return jsonFetch(`/api/variants?artworkId=${encodeURIComponent(artworkId)}`);
    },
    async addVariant(payload) {
      return jsonFetch('/api/variants', { method: 'POST', body: JSON.stringify(payload) });
    }
  };

  window.Store = Store;
})();
