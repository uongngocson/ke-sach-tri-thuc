import db from '../config/database.js';

export const DEFAULT_WELCOME_SETTINGS = {
  badge: 'VƯỜN TRI THỨC',
  title: 'Mỗi Cuốn Sách Là Một Hạt Mầm',
  subtitle: 'Mỗi Độc Giả Là Một Người Gieo Tri Thức',
  metaphor: '“Một Cây Tri Thức lớn lên từ những hạt mầm nhỏ bé.\nMỗi lượt tham gia là một lần gieo hạt, mỗi trích dẫn được lan tỏa là một dòng dưỡng chất — cùng cộng đồng vun bồi để Cây Tri Thức vươn mình thành đại cổ thụ.”',
  pillar1: 'Gieo Hạt Tri Thức',
  pillar2: 'Lan Tỏa Tri Thức',
  pillar3: 'Nhật Ký Tri Thức',
  buttonText: 'Khám Phá Vườn Tri Thức'
};

export const DEFAULT_RULES_SETTINGS = {
  badge: 'THỂ LỆ',
  milestonesTitle: '4 GIAI ĐOẠN PHÁT TRIỂN CỦA CÂY TRI THỨC',
  milestones: [
    {
      level: 1,
      label: 'Giai đoạn 1 – Mầm Non 🌱',
      range: '50 EXP – dưới 150 EXP',
      effect: 'Cây Tri Thức chính thức nảy mầm khi đạt 50 EXP. Từ thời điểm này, mỗi câu quote tham gia hợp lệ sẽ tiếp tục cung cấp dưỡng chất EXP giúp cây phát triển.'
    },
    {
      level: 2,
      label: 'Giai đoạn 2 – Cây Con 🌿',
      range: '150 EXP – dưới 300 EXP',
      effect: 'Cây tiếp tục phát triển và mở tính năng Tưới cây. Mỗi thành viên tiếp tục viết câu quote và được tưới cây của đội mình tối đa 3 lần/ngày để tích lũy EXP'
    },
    {
      level: 3,
      label: 'Giai đoạn 3 – Cây Trưởng Thành 🌳',
      range: '300 – dưới 600 EXP',
      effect: 'Tiếp tục tạo Quote, Reaction quote và Tưới cây để tích lũy EXP.'
    },
    {
      level: 4,
      label: 'Giai đoạn 4 – Cây Cổ Thụ 🌲',
      range: '600 – dưới 1.200 EXP',
      effect: 'Cây bắt đầu có Quả. Thành viên có thể tương tác với Quả để khám phá Quote và tiếp tục đóng góp EXP.'
    },
    {
      level: 5,
      label: 'Đại Cổ Thụ Tri Thức ✨',
      range: 'từ 1.200 EXP',
      effect: 'Đạt 1.200 EXP để chạm mốc Đại Cổ Thụ Tri Thức. Sau mốc này, các đội vẫn tiếp tục tích lũy EXP để cạnh tranh thứ hạng chung cuộc.'
    }
  ],
  interactionsTitle: 'CƠ CHẾ TƯƠNG TÁC & TÍCH LŨY EXP',
  interactions: [
    {
      action: '🌱 Gieo Hạt Tri Thức',
      exp: '+5 EXP/Quote hợp lệ',
      note: 'Mỗi thành viên được tạo tối đa 3 Quote/ngày.'
    },
    {
      action: '💖 Lan Tỏa Tri Thức',
      exp: '+2 EXP/Reaction thả tim hợp lệ cho mỗi câu quote',
      note: 'Mỗi người chỉ được thả tim 1 lần trên mỗi Quote. Có thể tương tác với Quote của đội mình hoặc đội khác; EXP được tính cho đội sở hữu Quote.'
    },
    {
      action: '💧 Tưới Cây',
      exp: '+2 EXP/lần tưới',
      note: 'Mỗi thành viên được tưới cây của đội mình tối đa 3 lần/ngày. Tính năng mở từ Giai đoạn cây con về sau.'
    },
    {
      action: '🍎 Hái Quả cây tri thức',
      exp: '+5 EXP cho đội sở hữu Quote',
      note: 'Mở khi cây đạt Cây Cổ Thụ. Mỗi thành viên được hái tối đa 5 Quả trong toàn chương trình, mỗi Quả chỉ được hái 1 lần. Hái Quả sẽ mở một Quote và +5 EXP cho đội sở hữu Quote.'
    }
  ],
  regulationsTitle: 'QUY ĐỊNH THAM GIA',
  regulations: {
    time: 'Thời gian: 10/09/2026 – 05/10/2026',
    rules: 'Mỗi ngày là một lượt chơi. Các hoạt động chỉ được tính khi đáp ứng điều kiện hợp lệ của chương trình. EXP vẫn tiếp tục được tích lũy sau khi đội đạt 1.200 EXP.'
  },
  confirmButton: '🌱 Đã Hiểu & Bắt Đầu Gieo Mầm Nuôi Cây'
};

async function migrateSettings() {
  console.log('🚀 Running System Settings Table Migration...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_by UUID REFERENCES admin_users(id),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Seed default welcome_content
  await db.query(`
    INSERT INTO system_settings (key, value)
    VALUES ('welcome_content', $1)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
  `, [JSON.stringify(DEFAULT_WELCOME_SETTINGS)]);

  // Seed default rules_content
  await db.query(`
    INSERT INTO system_settings (key, value)
    VALUES ('rules_content', $1)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
  `, [JSON.stringify(DEFAULT_RULES_SETTINGS)]);

  console.log('✅ System Settings migration & seeding completed successfully!');
}

if (process.argv[1] && process.argv[1].endsWith('migrate_settings.js')) {
  migrateSettings().then(() => process.exit(0)).catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}
