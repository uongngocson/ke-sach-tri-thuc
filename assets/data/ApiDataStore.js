/**
 * ApiDataStore.js
 * Production Realtime Client Data Adapter for Cáo Sách
 * Connects directly to Node.js Express REST API & Socket.io Realtime Engine
 * with Offline-First Local Cache Fallback & Idempotency Protection.
 */

function getApiBase() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5000/api/v1';
  const hostname = window.location.hostname || 'localhost';
  const protocol = window.location.protocol || 'http:';
  return `${protocol}//${hostname}:5000/api/v1`;
}

function getSocketUrl() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5000';
  const hostname = window.location.hostname || 'localhost';
  const protocol = window.location.protocol || 'http:';
  return `${protocol}//${hostname}:5000`;
}

class ApiDataStoreManager {
  constructor() {
    this.listeners = new Map();
    this.fingerprint = this.getOrCreateFingerprint();
    this.socket = null;
    this.cachedGrowth = null;
    this.cachedQuotes = [];

    this.initSocket();
  }

  init() {
    return this;
  }

  getOrCreateFingerprint() {
    if (typeof localStorage === 'undefined') return 'server_fp';
    let fp = localStorage.getItem('caosach_device_fingerprint');
    if (!fp) {
      fp = 'fp_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
      localStorage.setItem('caosach_device_fingerprint', fp);
    }
    return fp;
  }

  generateIdempotencyKey() {
    return 'idemp_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
  }

  initSocket() {
    if (typeof io !== 'undefined') {
      try {
        const socketUrl = getSocketUrl();
        this.socket = io(socketUrl, {
          reconnectionAttempts: 10,
          transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
          console.log(`⚡ Connected to Cáo Sách Realtime Engine at ${socketUrl}!`);
        });

        this.socket.on('growth:updated', (growthData) => {
          console.log('🌱 Realtime Growth Received:', growthData);
          this.cachedGrowth = growthData;
          this.emit('growth:updated', this.formatGrowthResponse(growthData));
        });

        this.socket.on('book:created', (bookData) => {
          console.log('📖 Realtime Book Created:', bookData);
          this.emit('book:contributed', bookData);
          this.emit('seeds:updated');
        });

        this.socket.on('quote:liked', (likeData) => {
          this.emit('quote:liked', likeData);
        });
      } catch (err) {
        console.warn('Socket.io connection error:', err);
      }
    }
  }

  // Pub/Sub Events
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event).delete(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in event listener for ${event}:`, err);
        }
      }
    }
  }

  emitEvent(event, data) {
    return this.emit(event, data);
  }

  formatGrowthResponse(raw) {
    const totalExp = raw.totalEXP || 0;
    const level = raw.level || 0;
    const isSprouted = level > 0;
    return {
      totalSeeds: raw.totalBooks || 0,
      targetSeeds: raw.nextLevelExp || 1200,
      currentStage: raw.levelName || 'Hạt Mầm Tri Thức',
      level: level,
      levelIcon: level >= 5 ? '👑' : (level >= 4 ? '🍎' : (level >= 3 ? '🌳' : (level >= 2 ? '🌿' : (level >= 1 ? '🌱' : '🌰')))),
      levelName: raw.levelName || 'Hạt Mầm Tri Thức',
      levelDesc: raw.levelDesc || '',
      isSprouted: isSprouted,
      seedsOnGroundVisible: !isSprouted,
      progressPercent: raw.progressPercent || 0,
      totalEXP: totalExp,
      nextLevelEXP: raw.nextLevelExp || (level === 0 ? 50 : 150),
      activeReaders: raw.activeReaders || 2735
    };
  }

  // --- API METHODS ---

  async getCommunityGrowth() {
    try {
      const res = await fetch(`${getApiBase()}/growth`);
      const data = await res.json();
      if (data.success) {
        this.cachedGrowth = data.data;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('caosach_cached_growth', JSON.stringify(data.data));
        }
        return this.formatGrowthResponse(data.data);
      }
    } catch (err) {
      console.warn('API /growth offline, using local cache:', err);
    }

    if (typeof localStorage !== 'undefined') {
      const cached = JSON.parse(localStorage.getItem('caosach_cached_growth') || 'null');
      if (cached) {
        return this.formatGrowthResponse(cached);
      }
    }

    return this.formatGrowthResponse({
      totalEXP: 0,
      level: 0,
      levelName: 'Hạt Mầm Tri Thức',
      progressPercent: 0,
      totalBooks: 0,
      totalDews: 0,
      totalLikes: 0,
      activeReaders: 2735
    });
  }

  async plantSeed(seedData) {
    try {
      const idempotencyKey = this.generateIdempotencyKey();
      const res = await fetch(`${getApiBase()}/books/contribute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          title: seedData.book,
          author: seedData.author,
          quote: seedData.quote,
          category: seedData.category || 'Sách Tinh Hoa',
          reader: seedData.reader || 'Độc giả yêu sách',
          userFingerprint: this.fingerprint
        })
      });

      const data = await res.json();
      if (data.success) {
        this.emit('seed:planted', data.data.book);
        const growth = await this.getCommunityGrowth();
        this.emit('growth:updated', growth);
        this.emit('seeds:updated');
        return { success: true, book: data.data.book, growth: data.data.growth };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      console.error('Error planting seed via API:', err);
      return { success: false, message: 'Lỗi kết nối máy chủ. Vui lòng kiểm tra server Backend trên cổng 5000.' };
    }
  }

  async getMasterQuotes() {
    try {
      const res = await fetch(`${getApiBase()}/quotes?page=1&limit=100`);
      const data = await res.json();
      if (data.success && data.data && Array.isArray(data.data.quotes)) {
        const formatted = data.data.quotes.map(q => ({
          id: q.id,
          book: q.title,
          author: q.author,
          quote: q.quote,
          category: q.category,
          reader: q.reader_name,
          likes: q.likes_count || 0
        }));
        this.cachedQuotes = formatted;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('caosach_cached_quotes', JSON.stringify(formatted));
        }
        return formatted;
      }
    } catch (err) {
      console.warn('API /quotes offline, using local cache:', err);
    }

    if (typeof localStorage !== 'undefined') {
      const cached = JSON.parse(localStorage.getItem('caosach_cached_quotes') || '[]');
      return cached;
    }

    return [];
  }

  async getSeeds() {
    const quotes = await this.getMasterQuotes();
    return quotes.map((q, idx) => ({
      id: q.id,
      book: q.book,
      author: q.author,
      quote: q.quote,
      reader: q.reader,
      category: q.category,
      likes: q.likes || 0,
      x: 18 + ((idx * 27) % 64),
      y: 38 + ((idx * 19) % 38)
    }));
  }

  isLikedByUser(id) {
    if (typeof localStorage === 'undefined') return false;
    const liked = JSON.parse(localStorage.getItem('caosach_liked_quotes') || '{}');
    return !!liked[id];
  }

  async toggleLike(id) {
    const isLiked = this.isLikedByUser(id);
    if (isLiked) {
      // User is unliking
      const res = await this.unlikeQuote(id);
      if (res.success) {
        if (typeof localStorage !== 'undefined') {
          const liked = JSON.parse(localStorage.getItem('caosach_liked_quotes') || '{}');
          delete liked[id];
          localStorage.setItem('caosach_liked_quotes', JSON.stringify(liked));
        }
        return { success: true, isLiked: false, likes: res.likes };
      }
      // Fallback
      const currentQ = this.cachedQuotes.find(q => q.id === id);
      const prevLikes = Math.max(0, (currentQ?.likes || 1) - 1);
      if (typeof localStorage !== 'undefined') {
        const liked = JSON.parse(localStorage.getItem('caosach_liked_quotes') || '{}');
        delete liked[id];
        localStorage.setItem('caosach_liked_quotes', JSON.stringify(liked));
      }
      return { success: true, isLiked: false, likes: prevLikes };
    }

    // User is liking
    const res = await this.likeQuote(id);
    if (res.success) {
      if (typeof localStorage !== 'undefined') {
        const liked = JSON.parse(localStorage.getItem('caosach_liked_quotes') || '{}');
        liked[id] = true;
        localStorage.setItem('caosach_liked_quotes', JSON.stringify(liked));
      }
      return { success: true, isLiked: true, likes: res.likes };
    }
    return res;
  }

  async unlikeQuote(quoteId) {
    try {
      const idempotencyKey = this.generateIdempotencyKey();
      const res = await fetch(`${getApiBase()}/quotes/${quoteId}/unlike`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ userFingerprint: this.fingerprint })
      });

      const data = await res.json();
      if (data.success) {
        return { success: true, likes: data.data.newLikesCount };
      }
    } catch (err) {
      console.error('Error unliking quote:', err);
    }
    return { success: false };
  }

  async likeQuote(quoteId) {
    try {
      const idempotencyKey = this.generateIdempotencyKey();
      const res = await fetch(`${getApiBase()}/quotes/${quoteId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ userFingerprint: this.fingerprint })
      });

      const data = await res.json();
      if (data.success) {
        const growth = await this.getCommunityGrowth();
        this.emit('growth:updated', growth);
        return { success: true, likes: data.data.newLikesCount };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      console.error('Error liking quote:', err);
      return { success: false, message: 'Lỗi kết nối máy chủ' };
    }
  }

  async claimDailyDew() {
    try {
      const idempotencyKey = this.generateIdempotencyKey();
      const res = await fetch(`${getApiBase()}/dew/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ userFingerprint: this.fingerprint })
      });

      const data = await res.json();
      if (data.success) {
        const growth = await this.getCommunityGrowth();
        this.emit('growth:updated', growth);
        return { success: true, streak: data.data.streak, expEarned: 1 };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      console.error('Error claiming dew:', err);
      return { success: false, message: 'Lỗi kết nối máy chủ' };
    }
  }

  async harvestFruit(fruitIndex) {
    try {
      const idempotencyKey = this.generateIdempotencyKey();
      const res = await fetch(`${getApiBase()}/fruits/harvest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ fruitIndex, userFingerprint: this.fingerprint })
      });

      const data = await res.json();
      if (data.success) {
        const growth = await this.getCommunityGrowth();
        this.emit('growth:updated', growth);
        return { success: true, quote: data.data.quote, expEarned: 5 };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      console.error('Error harvesting fruit:', err);
      return { success: false, message: 'Lỗi kết nối máy chủ' };
    }
  }

  // --- TESTER INTERACTION METHODS (REAL POSTGRESQL DRIVEN) ---

  async setTesterLevel(level) {
    const thresholds = {
      0: { exp: 0, seeds: 0 },
      1: { exp: 50, seeds: 50 },
      2: { exp: 150, seeds: 57 },
      3: { exp: 400, seeds: 73 },
      4: { exp: 1000, seeds: 113 },
      5: { exp: 2500, seeds: 213 }
    };
    const target = thresholds[level] || thresholds[0];
    return this.setTesterEXP(target.exp, target.seeds);
  }

  async setTesterEXP(exp, seedsCount = null) {
    try {
      const res = await fetch(`${getApiBase()}/tester/set-exp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exp, seedsCount })
      });
      const data = await res.json();
      if (data.success) {
        const formatted = this.formatGrowthResponse(data.data);
        this.cachedGrowth = data.data;
        this.emit('growth:updated', formatted);
        this.emit('seeds:updated');
        return formatted;
      }
    } catch (err) {
      console.warn('Error setting tester EXP:', err);
    }
    return this.getCommunityGrowth();
  }

  async simulateSeedContribution(count = 1) {
    try {
      const res = await fetch(`${getApiBase()}/tester/add-seeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count })
      });
      const data = await res.json();
      if (data.success) {
        const formatted = this.formatGrowthResponse(data.data);
        this.cachedGrowth = data.data;
        this.emit('growth:updated', formatted);
        this.emit('seeds:updated');
        return formatted;
      }
    } catch (err) {
      console.warn('Error simulating seeds:', err);
    }
    return this.getCommunityGrowth();
  }

    async wipeDatabaseExceptAccounts() {
    try {
      const res = await fetch(`${getApiBase()}/tester/wipe-database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        this.cachedQuotes = [];
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('caosach_cached_quotes');
          localStorage.removeItem('caosach_liked_quotes');
        }
        this.emit('growth:updated', data.data);
        return data.data;
      }
    } catch (err) {
      console.error('Error wiping database in tester:', err);
    }
    return null;
  }

  async resetToInitialState() {
    try {
      const res = await fetch(`${getApiBase()}/tester/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        const formatted = this.formatGrowthResponse(data.data);
        this.cachedGrowth = data.data;
        this.emit('growth:updated', formatted);
        this.emit('seeds:updated');
        return formatted;
      }
    } catch (err) {
      console.warn('Error resetting state:', err);
    }
    return this.getCommunityGrowth();
  }

  async addEXP(amount) {
    if (amount === 1) {
      await this.claimDailyDew();
    } else if (amount === 5) {
      await this.harvestFruit(0);
    }
    return this.getCommunityGrowth();
  }
}

export const ApiDataStore = new ApiDataStoreManager();
export const MockDataStore = ApiDataStore;
export default ApiDataStore;
