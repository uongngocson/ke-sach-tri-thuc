/**
 * assets/data/MockDataStore.js
 * Master Mock Data & State Management Service for Cây Sách Tri Thức
 */

export class MockDataStore {
  static STORAGE_KEY_SEEDS = 'fpt_knowledge_tree_ground_seeds_v6';
  static STORAGE_KEY_LIKES = 'fpt_knowledge_tree_likes_v6';
  static STORAGE_KEY_USER_EXP = 'fpt_knowledge_tree_user_exp_v6';

  static #listeners = new Map();

  // Master Vietnamese Quotes Library for Aside Card Rotator
  static MASTER_QUOTES = [
    // Sách Tinh Hoa
    { id: 'quote-1', book: 'Nhà Giả Kim (The Alchemist)', author: 'Paulo Coelho', category: 'Sách Tinh Hoa', icon: '📚', quote: 'Khi bạn thực sự khao khát một điều gì đó, cả vũ trụ sẽ hợp lực giúp bạn đạt được nó.', chapter: 'Chương 2 - Hành trình sa mạc', tag: 'Kinh Điển', reader: 'Độc giả yêu sách', likes: 142 },
    { id: 'quote-2', book: 'Hoàng Tử Bé (Le Petit Prince)', author: 'Antoine de Saint-Exupéry', category: 'Sách Tinh Hoa', icon: '📚', quote: 'Người ta chỉ thấy rõ bằng trái tim. Điều cốt lõi thì vô hình trong mắt trần.', chapter: 'Chương 21 - Bí mật của Cáo', tag: 'Văn Học', reader: 'Bạn đọc Vườn Tri Thức', likes: 128 },
    { id: 'quote-3', book: 'Sapiens: Lược Sử Loài Người', author: 'Yuval Noah Harari', category: 'Sách Tinh Hoa', icon: '📚', quote: 'Bạn không thể thuyết phục một con khỉ cho bạn quả chuối bằng cách hứa với nó về những quả chuối vô tận trên thiên đường sau khi chết.', chapter: 'Chương 1 - Cách mạng Nhận thức', tag: 'Lịch Sử', reader: 'Độc giả gieo mầm', likes: 215 },
    { id: 'quote-4', book: 'Chiến Tranh và Hòa Bình', author: 'Lev Tolstoy', category: 'Sách Tinh Hoa', icon: '📚', quote: 'Hai chiến binh dũng cảm và mạnh mẽ nhất trên thế giới là Thời Gian và Sự Kiên Nhẫn.', chapter: 'Tập 3 - Phần kết', tag: 'Kinh Điển', reader: 'Thành viên tri thức', likes: 96 },
    { id: 'quote-5', book: 'Những Người Khốn Khổ', author: 'Victor Hugo', category: 'Sách Tinh Hoa', icon: '📚', quote: 'Học cách yêu thương là học cách sống. Tương lai thuộc về những ai tin vào cái đẹp của ước mơ.', chapter: 'Quyển 4 - Tình yêu và Hy vọng', tag: 'Nhân Văn', reader: 'Độc giả yêu sách', likes: 110 },

    // Sách Tư Duy
    { id: 'quote-6', book: 'Tư Duy Nhanh và Chậm (Thinking, Fast and Slow)', author: 'Daniel Kahneman', category: 'Sách Tư Duy', icon: '💡', quote: 'Sự tự tin quá mức của con người thường bắt nguồn từ ảo tưởng rằng chúng ta hiểu thế giới xung quanh nhiều hơn thực tế.', chapter: 'Phần 3 - Ảo tưởng về sự thấu hiểu', tag: 'Tâm Lý Học', reader: 'Bạn đọc yêu tri thức', likes: 184 },
    { id: 'quote-7', book: 'Tư Duy Ngược Dịch Chuyển Thế Giới (Originals)', author: 'Adam Grant', category: 'Sách Tư Duy', icon: '💡', quote: 'Những người độc bản không sợ thất bại trong việc thử nghiệm ý tưởng mới, họ sợ nhất là thất bại vì không dám thử.', chapter: 'Chương 4 - Sáng tạo và Đột phá', tag: 'Sáng Tạo', reader: 'Độc giả gieo mầm', likes: 137 },
    { id: 'quote-8', book: 'Tư Duy Tối Ưu (Principles)', author: 'Ray Dalio', category: 'Sách Tư Duy', icon: '💡', quote: 'Nỗi đau + Sự suy ngẫm = Tiến bộ. Đừng né tránh sai lầm, hãy coi chúng là bài học quý giá nhất.', chapter: 'Nguyên tắc cuộc sống #1', tag: 'Hệ Thống', reader: 'Độc giả yêu sách', likes: 165 },
    { id: 'quote-9', book: 'Nghệ Thuật Tư Duy Rành Mạch', author: 'Rolf Dobelli', category: 'Sách Tư Duy', icon: '💡', quote: 'Biết những gì mình không biết chính là khởi đầu của trí tuệ đích thực.', chapter: 'Chương 12 - Thiên kiến nhận thức', tag: 'Phản Biện', reader: 'Cộng đồng yêu sách', likes: 89 },

    // Sách Kỹ Năng
    { id: 'quote-10', book: 'Đắc Nhân Tâm (How to Win Friends and Influence People)', author: 'Dale Carnegie', category: 'Sách Kỹ Năng', icon: '🌱', quote: 'Một nụ cười chân thành có thể làm tan chảy sự lạnh lùng và mở lối cho những điều kỳ diệu nhất trong giao tiếp.', chapter: 'Phần 2 - Sáu cách tạo thiện cảm', tag: 'Giao Tiếp', reader: 'Độc giả yêu sách', likes: 340 },
    { id: 'quote-11', book: 'Thói Quen Nguyên Tử (Atomic Habits)', author: 'James Clear', category: 'Sách Kỹ Năng', icon: '🌱', quote: 'Bạn không vươn lên tới tầm của những mục tiêu. Bạn rơi xuống ngang hàng với các hệ thống thói quen của bạn.', chapter: 'Chương 1 - Sức mạnh bất ngờ của 1%', tag: 'Phát Triển', reader: 'Thành viên tri thức', likes: 275 },
    { id: 'quote-12', book: '7 Thói Quen Của Người Thành Đạt', author: 'Stephen R. Covey', category: 'Sách Kỹ Năng', icon: '🌱', quote: 'Cách chúng ta nhìn nhận vấn đề mới chính là vấn đề. Hãy bắt đầu bằng sự chủ động và trách nhiệm với lựa chọn của chính mình.', chapter: 'Thói quen 1 - Luôn chủ động', tag: 'Kỹ Năng Sống', reader: 'Bạn đọc Vườn Tri Thức', likes: 152 },
    { id: 'quote-13', book: 'Lối Sống Tối Giản Của Người Nhật', author: 'Sasaki Fumio', category: 'Sách Kỹ Năng', icon: '🌱', quote: 'Bằng cách giảm bớt những thứ không cần thiết, bạn có thêm không gian cho những điều thực sự quan trọng trong cuộc sống.', chapter: 'Chương 3 - Tự do và Hạnh phúc', tag: 'Lối Sống', reader: 'Độc giả gieo mầm', likes: 98 },
    { id: 'quote-14', book: 'Làm Ra Làm Chơi Ra Chơi (Deep Work)', author: 'Cal Newport', category: 'Sách Kỹ Năng', icon: '🌱', quote: 'Khả năng tập trung cao độ mà không bị xao nhãng đang trở thành siêu năng lực hiếm có và giá trị nhất trong kỷ nguyên số.', chapter: 'Quy tắc #1 - Làm việc sâu', tag: 'Năng Suất', reader: 'Độc giả yêu sách', likes: 190 },

    // Sách Triết Học
    { id: 'quote-15', book: 'Bàn Về Tự Do (On Liberty)', author: 'John Stuart Mill', category: 'Sách Triết Học', icon: '📜', quote: 'Nếu toàn thể nhân loại cùng một ý kiến và chỉ có một người có ý kiến ngược lại, nhân loại cũng không có quyền bắt người ấy im lặng.', chapter: 'Chương 2 - Tự do tư tưởng', tag: 'Khai Phóng', reader: 'Độc giả yêu sách', likes: 216 },
    { id: 'quote-16', book: 'Suy Tưởng (Meditations)', author: 'Marcus Aurelius', category: 'Sách Triết Học', icon: '📜', quote: 'Bạn có quyền kiểm soát tâm trí của mình, chứ không phải các sự kiện bên ngoài. Hãy nhận ra điều này và bạn sẽ tìm thấy sức mạnh.', chapter: 'Quyển 4 - Tâm thức tĩnh lặng', tag: 'Khắc Kỷ', reader: 'Bạn đọc yêu tri thức', likes: 204 },
    { id: 'quote-17', book: 'Đạo Đức Kinh (Tao Te Ching)', author: 'Lão Tử', category: 'Sách Triết Học', icon: '📜', quote: 'Biết người là trí, biết mình là sáng. Thắng người là có sức, thắng mình mới là kiên cường.', chapter: 'Chương 33 - Trí tuệ nội tại', tag: 'Phương Đông', reader: 'Thành viên tri thức', likes: 178 },
    { id: 'quote-18', book: 'Bức Thư Gửi Lucilius (Letters from a Stoic)', author: 'Seneca', category: 'Sách Triết Học', icon: '📜', quote: 'Chúng ta đau khổ trong tưởng tượng thường nhiều hơn là trong thực tế.', chapter: 'Bức thư XIII - Về nỗi sợ hãi', tag: 'Khắc Kỷ', reader: 'Độc giả gieo mầm', likes: 145 },
    { id: 'quote-19', book: "Đi Tìm Lẽ Sống (Man's Search for Meaning)", author: 'Viktor E. Frankl', category: 'Sách Triết Học', icon: '📜', quote: 'Người có một lý do để sống có thể chịu đựng được hầu hết mọi nghịch cảnh.', chapter: 'Phần 1 - Trải nghiệm và Thức tỉnh', tag: 'Ý Nghĩa', reader: 'Cộng đồng yêu sách', likes: 312 },

    // Sách Nghệ Thuật
    { id: 'quote-20', book: 'Lịch Sử Nghệ Thuật (The Story of Art)', author: 'E.H. Gombrich', category: 'Sách Nghệ Thuật', icon: '🎨', quote: 'Nghệ thuật không tồn tại độc lập, chỉ có các nghệ sĩ - những người đem tâm hồn và hơi thở thổi vào từng tác phẩm.', chapter: 'Lời mở đầu - Về nghệ thuật', tag: 'Hội Họa', reader: 'Độc giả yêu sách', likes: 118 },
    { id: 'quote-21', book: 'Nghệ Thuật Nhìn (Ways of Seeing)', author: 'John Berger', category: 'Sách Nghệ Thuật', icon: '🎨', quote: 'Cách chúng ta nhìn sự vật bị ảnh hưởng bởi những gì chúng ta biết hoặc những gì chúng ta tin tưởng.', chapter: 'Tiểu luận 1 - Thị giác', tag: 'Thẩm Mỹ', reader: 'Bạn đọc Vườn Tri Thức', likes: 102 },
    { id: 'quote-22', book: 'Nghệ Thuật Sống Đẹp (The Art of Living)', author: 'Epictetus', category: 'Sách Nghệ Thuật', icon: '🎨', quote: 'Đừng đòi hỏi các sự việc phải diễn ra theo ý bạn, hãy mong muốn chúng diễn ra như chúng vốn là, và cuộc sống của bạn sẽ thanh thản.', chapter: 'Cẩm nang sống', tag: 'Sống Đẹp', reader: 'Độc giả gieo mầm', likes: 135 },
    { id: 'quote-23', book: 'Bút Ký Hội Họa', author: 'Leonardo da Vinci', category: 'Sách Nghệ Thuật', icon: '🎨', quote: 'Sự đơn giản chính là đỉnh cao của sự tinh tế. Học cách quan sát thế giới với sự tò mò không ngừng nghỉ.', chapter: 'Tập bản thảo - Quan sát tự nhiên', tag: 'Mỹ Thuật', reader: 'Thành viên tri thức', likes: 167 },
    { id: 'quote-24', book: 'Âm Nhạc và Tâm Hồn', author: 'Arthur Schopenhauer', category: 'Sách Nghệ Thuật', icon: '🎨', quote: 'Âm nhạc thể hiện bản chất sâu kín nhất của cuộc sống và sự tồn tại mà ngôn từ không thể diễn đạt hết.', chapter: 'Tiểu luận - Nghệ thuật âm thanh', tag: 'Âm Nhạc', reader: 'Cộng đồng yêu sách', likes: 140 }
  ];

  // 6 Life Stages
  static LEVEL_THRESHOLDS = [
    { level: 0, name: 'Gieo Hạt Tri Thức', icon: '🌰', minEXP: 0, maxEXP: 50, desc: 'Cần gieo đủ 50 hạt giống trên mặt đất để cây nảy mầm non' },
    { level: 1, name: 'Mầm Non Mới Nhú', icon: '🌱', minEXP: 50, maxEXP: 150, desc: 'Đã đủ 50 hạt! Hạt chìm vào đất nuôi dưỡng chồi non ~150px vươn cao' },
    { level: 2, name: 'Cây Mầm Đâm Chồi', icon: '🌿', minEXP: 150, maxEXP: 400, desc: 'Cây con lớn dần, bắt đầu đâm chồi những cành nhánh xanh tươi' },
    { level: 3, name: 'Cây Tơ Vươn Cành', icon: '🌳', minEXP: 400, maxEXP: 1000, desc: 'Thân gỗ định hình vững chãi, 2-3 tầng tán cành xòe rộng tươi tốt' },
    { level: 4, name: 'Cây Trưởng Thành Rợp Bóng', icon: '🌲', minEXP: 1000, maxEXP: 2500, desc: 'Cây cổ thụ tỏa bóng râm rợp mát, xum xuê lá tri thức' },
    { level: 5, name: 'Đại Cổ Thụ Nghìn Năm', icon: '✨', minEXP: 2500, maxEXP: 5000, desc: 'Đại cổ thụ tinh hoa khổng lồ, rực rỡ đom đóm tri thức' }
  ];

  static init() {
    const rawSeeds = localStorage.getItem(this.STORAGE_KEY_SEEDS);
    if (rawSeeds === null) {
      localStorage.setItem(this.STORAGE_KEY_SEEDS, JSON.stringify([]));
    }
    const rawExp = localStorage.getItem(this.STORAGE_KEY_USER_EXP);
    if (rawExp === null) {
      localStorage.setItem(this.STORAGE_KEY_USER_EXP, '0');
    }
  }

  static subscribe(event, callback) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(callback);
    return () => this.#listeners.get(event)?.delete(callback);
  }

  static #emit(event, data) {
    if (this.#listeners.has(event)) {
      this.#listeners.get(event).forEach(cb => {
        try { cb(data); } catch (err) { console.error('Event error:', err); }
      });
    }
  }

  static async getSeeds() {
    this.init();
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY_SEEDS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  static async getMasterQuotes() {
    return [...this.MASTER_QUOTES];
  }

  static async plantSeed({ book, author, quote, category, reader }) {
    this.init();
    const seeds = await this.getSeeds();

    const x = +(10 + Math.random() * 80).toFixed(1);
    const y = +(20 + Math.random() * 55).toFixed(1);

    const icons = {
      'Sách Tinh Hoa': '📚',
      'Sách Tư Duy': '💡',
      'Sách Kỹ Năng': '🌱',
      'Sách Triết Học': '📜',
      'Sách Nghệ Thuật': '🎨'
    };

    const newSeed = {
      id: 'seed-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      book: (book || 'Sách Chưa Đặt Tên').trim(),
      author: (author || 'Khuyết danh').trim(),
      quote: (quote || 'Một trích dẫn tâm đắc...').trim(),
      category: category || 'Sách Tinh Hoa',
      icon: icons[category] || '📚',
      tag: (category ? category.replace('Sách ', '') : 'Tri Thức'),
      chapter: 'Trích dẫn bạn đọc đóng góp',
      reader: (reader && reader.trim()) ? reader.trim() : 'Độc giả gieo mầm',
      likes: 1,
      seedType: 'seed',
      x,
      y,
      createdAt: new Date().toISOString()
    };

    seeds.unshift(newSeed);
    localStorage.setItem(this.STORAGE_KEY_SEEDS, JSON.stringify(seeds));

    const currentExp = parseInt(localStorage.getItem(this.STORAGE_KEY_USER_EXP) || '0', 10);
    const expGain = currentExp < 50 ? 1 : 5;
    const newExp = currentExp + expGain;
    localStorage.setItem(this.STORAGE_KEY_USER_EXP, newExp.toString());
    sessionStorage.removeItem('fpt_tester_exp_override');

    const growth = await this.getCommunityGrowth();
    this.#emit('seeds:updated', { seeds, newSeed });
    this.#emit('growth:updated', growth);

    return { success: true, seed: newSeed, growth };
  }

  static async toggleLike(quoteOrSeedId) {
    this.init();
    const seeds = await this.getSeeds();
    let seed = seeds.find(s => s.id === quoteOrSeedId);
    
    let userLikes = {};
    try {
      userLikes = JSON.parse(localStorage.getItem(this.STORAGE_KEY_LIKES) || '{}');
    } catch (e) { }

    const isCurrentlyLiked = !userLikes[quoteOrSeedId];
    let expDelta = isCurrentlyLiked ? -2 : 2;

    if (isCurrentlyLiked) {
      delete userLikes[quoteOrSeedId];
      if (seed) seed.likes = Math.max(0, (seed.likes || 1) - 1);
    } else {
      userLikes[quoteOrSeedId] = true;
      if (seed) seed.likes = (seed.likes || 0) + 1;
    }

    if (seed) {
      localStorage.setItem(this.STORAGE_KEY_SEEDS, JSON.stringify(seeds));
    }
    localStorage.setItem(this.STORAGE_KEY_LIKES, JSON.stringify(userLikes));

    const currentExp = parseInt(localStorage.getItem(this.STORAGE_KEY_USER_EXP) || '0', 10);
    const newExp = Math.max(0, currentExp + expDelta);
    localStorage.setItem(this.STORAGE_KEY_USER_EXP, newExp.toString());
    sessionStorage.removeItem('fpt_tester_exp_override');

    const growth = await this.getCommunityGrowth();
    if (seed) this.#emit('seeds:updated', { seeds, updatedSeed: seed });
    this.#emit('growth:updated', growth);

    return {
      success: true,
      likes: seed ? seed.likes : 100,
      isLiked: !isCurrentlyLiked,
      growth
    };
  }

  static isLikedByUser(quoteOrSeedId) {
    try {
      const userLikes = JSON.parse(localStorage.getItem(this.STORAGE_KEY_LIKES) || '{}');
      return !userLikes[quoteOrSeedId];
    } catch (e) {
      return false;
    }
  }

  static async getCommunityGrowth() {
    this.init();
    const testerOverride = sessionStorage.getItem('fpt_tester_exp_override');
    let totalEXP = 0;

    if (testerOverride !== null && !isNaN(+testerOverride)) {
      totalEXP = +testerOverride;
    } else {
      totalEXP = parseInt(localStorage.getItem(this.STORAGE_KEY_USER_EXP) || '0', 10);
    }

    const seeds = await this.getSeeds();
    const totalSeeds = seeds.length;
    const totalLikes = seeds.reduce((sum, s) => sum + (s.likes || 0), 0);

    let currentLevelObj = this.LEVEL_THRESHOLDS[0];
    for (let i = this.LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalEXP >= this.LEVEL_THRESHOLDS[i].minEXP) {
        currentLevelObj = this.LEVEL_THRESHOLDS[i];
        break;
      }
    }

    const nextLevelObj = this.LEVEL_THRESHOLDS.find(lvl => lvl.level === currentLevelObj.level + 1) || null;
    let progressPercent = 100;
    let expInLevel = totalEXP - currentLevelObj.minEXP;
    let expNeededForNext = 0;

    if (nextLevelObj) {
      const levelSpan = nextLevelObj.minEXP - currentLevelObj.minEXP;
      progressPercent = Math.min(100, Math.max(0, Math.round((expInLevel / levelSpan) * 100)));
      expNeededForNext = Math.max(0, nextLevelObj.minEXP - totalEXP);
    }

    const isSprouted = totalEXP >= 50;
    const seedsOnGroundVisible = !isSprouted;
    const seedsNeededForSprout = Math.max(0, 50 - totalEXP);

    return {
      totalEXP,
      level: currentLevelObj.level,
      levelName: currentLevelObj.name,
      levelIcon: currentLevelObj.icon,
      levelDesc: currentLevelObj.desc,
      minEXP: currentLevelObj.minEXP,
      maxEXP: currentLevelObj.maxEXP,
      progressPercent,
      nextLevelName: nextLevelObj ? nextLevelObj.name : 'Cổ Thụ Tối Thượng',
      nextLevelEXP: nextLevelObj ? nextLevelObj.minEXP : currentLevelObj.maxEXP,
      expNeededForNext,
      isSprouted,
      seedsOnGroundVisible,
      seedsNeededForSprout,
      totalSeeds,
      totalLikes,
      isMaxLevel: !nextLevelObj
    };
  }

  /**
   * Tester APIs
   */
  static async setTesterLevel(targetLevel) {
    const lvlObj = this.LEVEL_THRESHOLDS.find(l => l.level === targetLevel) || this.LEVEL_THRESHOLDS[0];
    sessionStorage.setItem('fpt_tester_exp_override', lvlObj.minEXP.toString());
    localStorage.setItem(this.STORAGE_KEY_USER_EXP, lvlObj.minEXP.toString());

    if (targetLevel === 0) {
      // Level 0 with 0 seeds
      localStorage.setItem(this.STORAGE_KEY_SEEDS, JSON.stringify([]));
    } else {
      // Ensure seeds recorded in db
      const currentSeeds = await this.getSeeds();
      if (currentSeeds.length < 50) {
        await this.generateBatchSeeds(50);
      }
    }

    const growth = await this.getCommunityGrowth();
    const seeds = await this.getSeeds();
    this.#emit('seeds:updated', { seeds });
    this.#emit('growth:updated', growth);
    return growth;
  }

  static async setTesterEXP(expAmount) {
    sessionStorage.setItem('fpt_tester_exp_override', expAmount.toString());
    localStorage.setItem(this.STORAGE_KEY_USER_EXP, expAmount.toString());

    if (expAmount < 50) {
      await this.generateBatchSeeds(expAmount);
    } else {
      const currentSeeds = await this.getSeeds();
      if (currentSeeds.length < 50) {
        await this.generateBatchSeeds(50);
      }
    }

    const growth = await this.getCommunityGrowth();
    const updatedSeeds = await this.getSeeds();
    this.#emit('seeds:updated', { seeds: updatedSeeds });
    this.#emit('growth:updated', growth);
    return growth;
  }

  static async simulateAddEXP(expDelta) {
    const currentExp = parseInt(localStorage.getItem(this.STORAGE_KEY_USER_EXP) || '0', 10);
    const newExp = Math.max(0, currentExp + expDelta);
    return this.setTesterEXP(newExp);
  }

  static async generateBatchSeeds(targetCount) {
    const sampleBooks = [
      { title: 'Nhà Giả Kim', author: 'Paulo Coelho', cat: 'Sách Tinh Hoa' },
      { title: 'Đắc Nhân Tâm', author: 'Dale Carnegie', cat: 'Sách Kỹ Năng' },
      { title: 'Tư Duy Nhanh và Chậm', author: 'Daniel Kahneman', cat: 'Sách Tư Duy' },
      { title: 'Suy Tưởng', author: 'Marcus Aurelius', cat: 'Sách Triết Học' },
      { title: 'Nghệ Thuật Sống Đẹp', author: 'Epictetus', cat: 'Sách Nghệ Thuật' }
    ];

    const seeds = [];
    for (let i = 0; i < targetCount; i++) {
      const b = sampleBooks[i % sampleBooks.length];
      const x = +(8 + (i * 19.3) % 84).toFixed(1);
      const y = +(15 + (i * 27.7) % 65).toFixed(1);
      seeds.push({
        id: 'seed-batch-' + i + '-' + Date.now(),
        book: b.title,
        author: b.author,
        quote: 'Hạt giống tri thức đóng góp cho cộng đồng.',
        category: b.cat,
        icon: '📚',
        tag: 'Tri Thức',
        chapter: 'Trích dẫn cộng đồng',
        reader: 'Độc giả ' + (i + 1),
        likes: 1,
        seedType: 'seed',
        x,
        y,
        createdAt: new Date().toISOString()
      });
    }
    localStorage.setItem(this.STORAGE_KEY_SEEDS, JSON.stringify(seeds));
    return seeds;
  }

  static async resetAllData() {
    sessionStorage.removeItem('fpt_tester_exp_override');
    localStorage.removeItem(this.STORAGE_KEY_LIKES);
    localStorage.setItem(this.STORAGE_KEY_USER_EXP, '0');
    localStorage.setItem(this.STORAGE_KEY_SEEDS, JSON.stringify([]));

    const growth = await this.getCommunityGrowth();
    this.#emit('seeds:updated', { seeds: [] });
    this.#emit('growth:updated', growth);
    return growth;
  }
}
