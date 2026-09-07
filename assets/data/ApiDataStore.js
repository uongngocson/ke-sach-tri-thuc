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
  const port = window.location.port;
  if (!port || port === '80' || port === '443') {
    return `${protocol}//${window.location.host}/api/v1`;
  }
  return `${protocol}//${hostname}:5000/api/v1`;
}

function getSocketUrl() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5000';
  const hostname = window.location.hostname || 'localhost';
  const protocol = window.location.protocol || 'http:';
  const port = window.location.port;
  if (!port || port === '80' || port === '443') {
    return `${protocol}//${window.location.host}`;
  }
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
    if (typeof window !== 'undefined') {
      setTimeout(() => this.recordVisit(), 150);
    }
  }

  init() {
    return this;
  }

  updateActiveReadersUI(count) {
    if (typeof document === 'undefined') return;
    const num = Math.max(1, parseInt(count, 10) || 1).toLocaleString();
    const headerReaders = document.getElementById('header-active-readers');
    if (headerReaders) headerReaders.textContent = num;
    const onchainReaders = document.getElementById('onchain-active-readers');
    if (onchainReaders) onchainReaders.textContent = num;
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

  getUserFingerprint() {
    let session = null;
    try {
      session = JSON.parse(localStorage.getItem('caosach_user_session') || 'null');
    } catch {}
    if (session && session.id && session.id !== 'guest') {
      return `user_${session.id}`;
    }
    return this.fingerprint || this.getOrCreateFingerprint();
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
          const formatted = this.formatGrowthResponse(growthData);
          this.emit('growth:updated', formatted);
        });

        this.socket.on('book:created', (bookData) => {
          console.log('📖 Realtime Book Created:', bookData);
          this.emit('book:contributed', bookData);
          this.emit('seeds:updated');
        });

        this.socket.on('quote:liked', (likeData) => {
          this.emit('quote:liked', likeData);
        });

        this.socket.on('content:updated', (contentData) => {
          console.log('🎨 Realtime Content Updated:', contentData);
          this.emit('content:updated', contentData);
        });
      } catch (err) {
        console.warn('Socket.io connection error:', err);
      }
    }
  }

  on(event, callback) {
    return this.subscribe(event, callback);
  }

  async getContentSettings() {
    try {
      const res = await fetch(`${getApiBase()}/content/settings`);
      const data = await res.json();
      if (data.success) return data.data;
    } catch (e) {
      console.warn('Error fetching content settings:', e);
    }
    return null;
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
    if (typeof window !== 'undefined') {
      if (event === 'growth:updated') {
        window.dispatchEvent(new CustomEvent('fpt-growth-updated', { detail: data }));
      }
    }
  }

  emitEvent(event, data) {
    return this.emit(event, data);
  }

  formatGrowthResponse(raw) {
    const totalExp = raw.totalEXP || raw.total_exp || 0;
    const level = raw.level || 0;
    const isSprouted = level > 0;
    const readers = raw.activeReaders || raw.active_readers || 1;
    this.updateActiveReadersUI(readers);
    return {
      totalSeeds: raw.totalBooks || raw.total_books || 0,
      targetSeeds: raw.nextLevelExp || 1200,
      currentStage: raw.levelName || raw.level_name || 'Hạt Mầm Tri Thức',
      level: level,
      levelIcon: level >= 5 ? '👑' : (level >= 4 ? '🍎' : (level >= 3 ? '🌳' : (level >= 2 ? '🌿' : (level >= 1 ? '🌱' : '🌰')))),
      levelName: raw.levelName || raw.level_name || 'Hạt Mầm Tri Thức',
      levelDesc: raw.levelDesc || raw.level_description || '',
      isSprouted: isSprouted,
      seedsOnGroundVisible: !isSprouted,
      progressPercent: raw.progressPercent || raw.progress_percent || 0,
      totalEXP: totalExp,
      nextLevelEXP: raw.nextLevelExp || (level === 0 ? 50 : 150),
      activeReaders: readers
    };
  }

  // --- API METHODS ---

  async recordVisit() {
    try {
      const res = await fetch(`${getApiBase()}/growth/visit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userFingerprint: this.fingerprint
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        if (data.data.totalVisitors) {
          this.updateActiveReadersUI(data.data.totalVisitors);
        }
        return data.data;
      }
    } catch (err) {
      console.warn('API /growth/visit offline:', err);
    }
    return null;
  }

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
      activeReaders: 1
    });
  }

  async plantSeed(seedData) {
    try {
      const idempotencyKey = this.generateIdempotencyKey();
      let session = null;
      try {
        session = JSON.parse(localStorage.getItem('caosach_user_session') || 'null');
      } catch {}

      const userId = seedData.userId || (session && session.id !== 'guest' ? session.id : null);
      const teamId = seedData.teamId || (session && session.team_id ? session.team_id : null);
      const email = seedData.email || (session && session.email ? session.email : null);

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
          category: seedData.category || null,
          reader: seedData.reader || (session?.nickname || session?.full_name) || 'Độc giả yêu sách',
          email: email,
          userId: userId,
          teamId: teamId,
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

  async getTeams(forceRefresh = true) {
    try {
      const cacheBust = forceRefresh ? `?_t=${Date.now()}` : '';
      const res = await fetch(`${getApiBase()}/teams${cacheBust}`);
      const data = await res.json();
      if (data.success) {
        this.cachedTeams = data.data;
        return data.data;
      }
    } catch (e) {
      console.warn('Error fetching teams:', e);
    }
    return this.cachedTeams || [];
  }

  async getTeam(id) {
    try {
      const res = await fetch(`${getApiBase()}/teams/${id}`);
      const data = await res.json();
      if (data.success) return data.data;
    } catch (e) {
      console.warn(`Error fetching team ${id}:`, e);
    }
    return null;
  }

  async getDailyQuoteStatus({ userId, email, userFingerprint } = {}) {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (email) params.append('email', email);
      if (userFingerprint || this.fingerprint) params.append('userFingerprint', userFingerprint || this.fingerprint);
      const res = await fetch(`${getApiBase()}/books/daily-status?${params.toString()}`);
      const data = await res.json();
      if (data.success) return data.data;
    } catch (e) {
      console.warn('Error fetching daily quote status:', e);
    }
    return { hasContributedToday: false, remainingToday: 1 };
  }

  async getCurrentRound() {
    try {
      const res = await fetch(`${getApiBase()}/rounds/current`);
      const data = await res.json();
      if (data.success) return data.data;
    } catch (e) {
      console.warn('Error fetching current round:', e);
    }
    return null;
  }

  async getMasterQuotes(forceRefresh = false) {
    try {
      const fp = this.getUserFingerprint();
      const fpParam = fp ? `&userFingerprint=${encodeURIComponent(fp)}` : '';
      const res = await fetch(`${getApiBase()}/quotes?page=1&limit=100${fpParam}&_t=${Date.now()}`);
      const data = await res.json();
      if (data.success && data.data && Array.isArray(data.data.quotes)) {
        if (typeof localStorage !== 'undefined') {
          const liked = JSON.parse(localStorage.getItem('caosach_liked_quotes') || '{}');
          let changed = false;
          for (const q of data.data.quotes) {
            const serverLiked = !!q.is_liked;
            if (!!liked[q.id] !== serverLiked) {
              liked[q.id] = serverLiked;
              changed = true;
            }
          }
          if (changed) {
            localStorage.setItem('caosach_liked_quotes', JSON.stringify(liked));
          }
        }
        const formatted = data.data.quotes.map(q => ({
          id: q.id,
          book: q.title,
          author: q.author,
          quote: q.quote,
          category: q.category,
          reader: q.reader_name,
          team_id: q.team_id,
          team_name: q.team_name,
          team_short_name: q.team_short_name,
          team_display_name: q.team_display_name,
          team_color: q.team_color,
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

  async getPublicQuotes(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.page) params.set('page', options.page);
      if (options.limit) params.set('limit', options.limit);
      if (options.category && options.category !== 'all' && options.category !== 'Tất cả') {
        params.set('category', options.category);
      }
      if (options.teamId) params.set('teamId', options.teamId);
      if (options.search) params.set('search', options.search);
      if (options.sortBy) params.set('sortBy', options.sortBy);
      const fp = options.userFingerprint || this.getUserFingerprint();
      if (fp) params.set('userFingerprint', fp);
      params.set('_t', Date.now());

      const res = await fetch(`${getApiBase()}/quotes?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.data) {
        if (typeof localStorage !== 'undefined' && Array.isArray(data.data.quotes)) {
          const liked = JSON.parse(localStorage.getItem('caosach_liked_quotes') || '{}');
          let changed = false;
          for (const q of data.data.quotes) {
            const serverLiked = !!q.is_liked;
            if (!!liked[q.id] !== serverLiked) {
              liked[q.id] = serverLiked;
              changed = true;
            }
          }
          if (changed) {
            localStorage.setItem('caosach_liked_quotes', JSON.stringify(liked));
          }
        }
        return data.data;
      }
    } catch (err) {
      console.warn('Error fetching public quotes:', err);
    }
    return { quotes: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 1 } };
  }

  async getSeeds() {
    const quotes = await this.getMasterQuotes(true);
    // Group quotes by team so that each team's seeds are ordered and clustered in that team's zone
    const teamSeedCounts = {};
    return quotes.map((q, idx) => {
      const teamId = (q.team_id && q.team_id >= 1 && q.team_id <= 8) ? q.team_id : 1;
      const teamIdx = teamId - 1; // 0 to 7
      
      const seedIndexInTeam = teamSeedCounts[teamId] || 0;
      teamSeedCounts[teamId] = seedIndexInTeam + 1;

      // Each of the 8 teams has a dedicated horizontal zone:
      // Zone span: 8 zones from left to right (2.5% to 97.5%)
      const zoneLeft = 2.5 + teamIdx * 11.9;
      const zoneWidth = 10.4;

      // Compact micro-grid inside the team zone (3 columns, up to 16 rows)
      const col = seedIndexInTeam % 3;
      const row = Math.floor(seedIndexInTeam / 3);
      
      const jitterX = ((seedIndexInTeam * 17 + teamId * 13) % 7) - 3;
      const jitterY = ((seedIndexInTeam * 23 + teamId * 19) % 9) - 4;

      const colX = zoneLeft + 1.2 + (col * (zoneWidth - 2.4) / 2.0);
      const rowY = 32 + ((row % 4) * 15.0);

      const finalX = Math.max(zoneLeft + 1.0, Math.min(zoneLeft + zoneWidth - 1.0, colX + jitterX * 0.35));
      const finalY = Math.max(22, Math.min(88, rowY + jitterY * 0.7));

      const zoneRelX = Math.max(18, Math.min(82, 22 + col * 28 + jitterX * 1.2));
      const zoneRelY = Math.max(52, Math.min(90, 55 + (row % 3) * 15 + jitterY * 0.9));

      return {
        id: q.id,
        book: q.book,
        author: q.author,
        quote: q.quote,
        reader: q.reader,
        category: q.category,
        team_id: teamId,
        team_name: q.team_name,
        team_short_name: q.team_short_name,
        team_display_name: q.team_display_name,
        team_color: q.team_color,
        likes: q.likes || 0,
        x: parseFloat(finalX.toFixed(2)),
        y: parseFloat(finalY.toFixed(2)),
        zone_x: parseFloat(zoneRelX.toFixed(2)),
        zone_y: parseFloat(zoneRelY.toFixed(2)),
        zone_index: teamIdx,
        seed_index_in_team: seedIndexInTeam
      };
    });
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
      if (res && res.success) {
        if (typeof localStorage !== 'undefined') {
          const liked = JSON.parse(localStorage.getItem('caosach_liked_quotes') || '{}');
          delete liked[id];
          localStorage.setItem('caosach_liked_quotes', JSON.stringify(liked));
        }
        return { success: true, isLiked: false, likes: res.likes };
      }
      return { success: false, isLiked: true, message: res?.message || 'Không thể bỏ thích lúc này' };
    }

    // User is liking
    const res = await this.likeQuote(id);
    if (res && res.success) {
      if (typeof localStorage !== 'undefined') {
        const liked = JSON.parse(localStorage.getItem('caosach_liked_quotes') || '{}');
        liked[id] = true;
        localStorage.setItem('caosach_liked_quotes', JSON.stringify(liked));
      }
      return { success: true, isLiked: true, likes: res.likes };
    }

    // If duplicate error from backend, mark locally as already liked
    if (res && res.error === 'DUPLICATE_QUOTE_LIKE') {
      if (typeof localStorage !== 'undefined') {
        const liked = JSON.parse(localStorage.getItem('caosach_liked_quotes') || '{}');
        liked[id] = true;
        localStorage.setItem('caosach_liked_quotes', JSON.stringify(liked));
      }
      return {
        success: false,
        isLiked: true,
        error: 'DUPLICATE_QUOTE_LIKE',
        message: res.message || 'Bạn đã thả tim trích dẫn này rồi!'
      };
    }

    return res;
  }

  async unlikeQuote(quoteId) {
    try {
      const idempotencyKey = this.generateIdempotencyKey();
      const fp = this.getUserFingerprint();
      let session = null;
      try {
        session = JSON.parse(localStorage.getItem('caosach_user_session') || 'null');
      } catch {}
      const userId = (session && session.id && session.id !== 'guest') ? session.id : null;
      const teamId = (session && session.team_id) ? session.team_id : null;

      const res = await fetch(`${getApiBase()}/quotes/${quoteId}/unlike`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ 
          userFingerprint: fp,
          userId: userId,
          teamId: teamId
        })
      });

      const data = await res.json();
      if (data && data.success && data.data) {
        if (typeof localStorage !== 'undefined') {
          const liked = JSON.parse(localStorage.getItem('caosach_liked_quotes') || '{}');
          delete liked[quoteId];
          localStorage.setItem('caosach_liked_quotes', JSON.stringify(liked));
        }
        return { success: true, likes: data.data.newLikesCount };
      } else {
        return { success: false, message: data?.message || 'Không thể bỏ thích trích dẫn' };
      }
    } catch (err) {
      console.error('Error unliking quote:', err);
      return { success: false, message: 'Lỗi kết nối máy chủ' };
    }
  }

  async likeQuote(quoteId) {
    try {
      const idempotencyKey = this.generateIdempotencyKey();
      const fp = this.getUserFingerprint();
      let session = null;
      try {
        session = JSON.parse(localStorage.getItem('caosach_user_session') || 'null');
      } catch {}
      const userId = (session && session.id && session.id !== 'guest') ? session.id : null;
      const teamId = (session && session.team_id) ? session.team_id : null;

      const res = await fetch(`${getApiBase()}/quotes/${quoteId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ 
          userFingerprint: fp,
          userId: userId,
          teamId: teamId
        })
      });

      const data = await res.json();
      if (data && data.success && data.data) {
        if (typeof localStorage !== 'undefined') {
          const liked = JSON.parse(localStorage.getItem('caosach_liked_quotes') || '{}');
          liked[quoteId] = true;
          localStorage.setItem('caosach_liked_quotes', JSON.stringify(liked));
        }
        return { success: true, likes: data.data.newLikesCount };
      } else {
        if (data && data.error === 'DUPLICATE_QUOTE_LIKE') {
          if (typeof localStorage !== 'undefined') {
            const liked = JSON.parse(localStorage.getItem('caosach_liked_quotes') || '{}');
            liked[quoteId] = true;
            localStorage.setItem('caosach_liked_quotes', JSON.stringify(liked));
          }
        }
        return { success: false, error: data?.error, message: data?.message };
      }
    } catch (err) {
      console.error('Error liking quote:', err);
      return { success: false, message: 'Lỗi kết nối máy chủ' };
    }
  }

  async getDewStatus(userId) {
    try {
      const fp = this.getUserFingerprint();
      const params = new URLSearchParams();
      if (userId && userId !== 'guest') params.append('userId', userId);
      if (fp) params.append('userFingerprint', fp);

      const res = await fetch(`${getApiBase()}/dew/status?${params.toString()}`);
      const data = await res.json();
      if (data && data.success && data.data) {
        return data.data; // { hasClaimedToday, streak, lastClaimDate }
      }
      return { hasClaimedToday: false, streak: 0 };
    } catch (e) {
      console.warn('Error fetching dew status from server:', e);
      return { hasClaimedToday: false, streak: 0 };
    }
  }

  async claimDailyDew(payload = {}) {
    try {
      const idempotencyKey = this.generateIdempotencyKey();
      const bodyPayload = {
        userId: payload.userId || null,
        teamId: payload.teamId ? parseInt(payload.teamId, 10) : null,
        email: payload.email || null,
        userFingerprint: payload.userFingerprint || this.fingerprint
      };
      const res = await fetch(`${getApiBase()}/dew/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();
      if (data.success) {
        const growth = await this.getCommunityGrowth();
        this.emit('growth:updated', growth);
        return {
          success: true,
          streak: data.data.streak,
          expEarned: data.data.expEarned || 2,
          team: data.data.team,
          growth: data.data.growth
        };
      } else {
        return {
          success: false,
          code: data.error,
          message: data.message
        };
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

  async setTesterEXP(exp, seedsCount = null, teamId = null) {
    try {
      const res = await fetch(`${getApiBase()}/tester/set-exp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exp, seedsCount, teamId })
      });
      const data = await res.json();
      if (data.success) {
        const formatted = this.formatGrowthResponse(data.data);
        this.cachedGrowth = data.data;
        this.cachedQuotes = [];
        this.cachedTeams = null; // Invalidate teams cache to fetch fresh team stats
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('caosach_cached_quotes');
        }
        await this.getTeams(true);
        this.emit('growth:updated', formatted);
        this.emit('seeds:updated');
        this.emit('teams:updated');
        return formatted;
      }
    } catch (err) {
      console.warn('Error setting tester EXP:', err);
    }
    return this.getCommunityGrowth();
  }

  async simulateSeedContribution(count = 1, teamId = null) {
    try {
      const res = await fetch(`${getApiBase()}/tester/add-seeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, teamId })
      });
      const data = await res.json();
      if (data.success) {
        const formatted = this.formatGrowthResponse(data.data);
        this.cachedGrowth = data.data;
        this.cachedQuotes = [];
        this.cachedTeams = null;
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('caosach_cached_quotes');
        }
        await this.getTeams(true);
        this.emit('growth:updated', formatted);
        this.emit('seeds:updated');
        this.emit('teams:updated');
        return formatted;
      }
    } catch (err) {
      console.warn('Error simulating seeds:', err);
    }
    return this.getCommunityGrowth();
  }

  async simulateHeart(count = 10, exp = 20, teamId = null) {
    try {
      const res = await fetch(`${getApiBase()}/tester/add-heart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, exp, teamId })
      });
      const data = await res.json();
      if (data.success) {
        this.cachedTeams = null;
        await this.getTeams(true);
        this.emit('growth:updated', { totalEXP: exp });
        this.emit('teams:updated');
        return data.data;
      }
    } catch (err) {
      console.warn('Error simulating heart:', err);
    }
    return null;
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
        this.cachedTeams = null;
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('caosach_cached_quotes');
          localStorage.removeItem('caosach_liked_quotes');
        }
        await this.getTeams(true);
        this.emit('growth:updated', data.data);
        this.emit('seeds:updated');
        this.emit('teams:updated');
        return data.data;
      }
    } catch (err) {
      console.error('Error wiping database in tester:', err);
    }
    return null;
  }

  async resetToInitialState(teamId = null) {
    try {
      const res = await fetch(`${getApiBase()}/tester/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId })
      });
      const data = await res.json();
      if (data.success) {
        const formatted = this.formatGrowthResponse(data.data);
        this.cachedGrowth = data.data;
        this.cachedQuotes = [];
        this.cachedTeams = null;
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('caosach_cached_quotes');
        }
        await this.getTeams(true);
        this.emit('growth:updated', formatted);
        this.emit('seeds:updated');
        this.emit('teams:updated');
        return formatted;
      }
    } catch (err) {
      console.warn('Error resetting state:', err);
    }
    return this.getCommunityGrowth();
  }

  async addEXP(amount) {
    if (amount === 2 || amount === 1) {
      await this.claimDailyDew();
    } else if (amount === 5) {
      await this.harvestFruit(0);
    }
    return this.getCommunityGrowth();
  }

  getState() {
    if (this.cachedGrowth) {
      return this.formatGrowthResponse(this.cachedGrowth);
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const cached = JSON.parse(localStorage.getItem('caosach_cached_growth') || 'null');
        if (cached) return this.formatGrowthResponse(cached);
      } catch (e) {}
    }
    return this.formatGrowthResponse({
      totalEXP: 0,
      level: 0,
      levelName: 'Hạt Mầm Tri Thức',
      progressPercent: 0,
      totalBooks: 0,
      totalDews: 0,
      totalLikes: 0,
      activeReaders: 1
    });
  }

  async setExp(exp, seedsCount = null) {
    return this.setTesterEXP(exp, seedsCount);
  }

  async addSeeds(count = 1) {
    return this.simulateSeedContribution(count);
  }

  async addHeart() {
    try {
      const quotes = await this.getMasterQuotes();
      if (quotes && quotes.length > 0) {
        await this.likeQuote(quotes[0].id);
      } else {
        const current = this.getState();
        await this.setTesterEXP((current.totalEXP || 0) + 20);
      }
    } catch (e) {
      console.warn('addHeart error:', e);
    }
    return this.getCommunityGrowth();
  }

  async resetDatabase() {
    return this.wipeDatabaseExceptAccounts();
  }

  async resetAll() {
    return this.resetToInitialState();
  }
}

if (typeof window !== 'undefined') {
  if (!window.__CAOSACH_DATASTORE__) {
    window.__CAOSACH_DATASTORE__ = new ApiDataStoreManager();
  }
  window.ApiDataStore = window.__CAOSACH_DATASTORE__;
  window.MockDataStore = window.__CAOSACH_DATASTORE__;
}

export const ApiDataStore = (typeof window !== 'undefined' && window.__CAOSACH_DATASTORE__) 
  ? window.__CAOSACH_DATASTORE__ 
  : new ApiDataStoreManager();
export const MockDataStore = ApiDataStore;
export default ApiDataStore;
