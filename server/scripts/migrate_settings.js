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
  badge: 'THỂ LỆ & QUY TRÌNH NUÔI DƯỠNG CÂY TRI THỨC',
  milestonesTitle: '🌱 5 GIAI ĐOẠN SINH TRƯỞNG CỦA CÂY TRI THỨC',
  milestones: [
    {
      level: 0,
      label: 'Giai đoạn 0 – Hạt giống tri thức 🌰',
      range: '0–49 hạt giống',
      effect: 'Mỗi câu quote được chia sẻ sẽ gieo một hạt giống tri thức xuống lòng đất, góp phần hình thành nền móng cho Cây Tri Thức. Cần tích lũy đủ 50 hạt giống để đánh thức mầm sống.'
    },
    {
      level: 1,
      label: 'Giai đoạn 1 – Mầm non 🌱',
      range: '50 hạt – dưới 150 EXP',
      effect: 'Khi đủ 50 hạt giống, Cây Tri Thức chính thức nảy mầm và chuyển sang giai đoạn nuôi dưỡng bằng EXP. Từ thời điểm này, mỗi câu quote tham gia hợp lệ sẽ tiếp tục cung cấp dưỡng chất EXP giúp cây phát triển. Những điều hay từ sách được tiếp nhận, ghi nhớ và lan tỏa, tạo nên nguồn dưỡng chất tri thức đầu tiên cho Cây Mầm Non.'
    },
    {
      level: 2,
      label: 'Giai đoạn 2 – Cây con 🌿',
      range: '150–400 EXP',
      effect: 'Mỗi câu quote mới tiếp thêm phân bón dinh dưỡng, cây bắt đầu bén rễ và vươn chồi, mỗi lượt tương tác tiếp tục bổ sung EXP, đều góp thêm dưỡng chất, giúp Cây Tri Thức ngày càng vươn cao và phát triển.'
    },
    {
      level: 3,
      label: 'Giai đoạn 3 – Cây trưởng thành 🌳',
      range: '400–1.000 EXP',
      effect: 'Cây vươn mình rộng lớn với những tầng cành sum sê, quang hợp tự nhiên theo chu kỳ ngày đêm, tạo nên một hệ sinh thái tri thức ngày càng phong phú. Tri thức bắt đầu “đơm hoa”, tạo ra những giá trị và thành quả rõ nét.'
    },
    {
      level: 4,
      label: 'Giai đoạn 4 – Cây cổ thụ 🌲',
      range: '1.000–2.500+ EXP',
      effect: 'Cây đã trưởng thành vững chãi, tỏa bóng mát và trở thành biểu tượng cho hành trình tích lũy, lan tỏa tri thức của cả đội. Mỗi giá trị được chia sẻ góp phần tạo nên một di sản văn hóa đọc bền vững.'
    }
  ],
  interactionsTitle: 'Cơ Chế Tương Tác & Điểm EXP Nuôi Cây',
  interactions: [
    {
      action: '🌱 Gieo Hạt Tri Thức',
      exp: '+1 Hạt giống Tri Thức khi Cây chưa đủ 50 hạt\nhoặc +5 EXP khi Cây đã Nảy Mầm.',
      note: 'Mỗi câu quote được chia sẻ hợp lệ là một hạt giống góp phần nuôi dưỡng Cây Tri Thức.'
    },
    {
      action: '💖 Lan Tỏa Tri Thức',
      exp: '+2 EXP / lượt thả tim',
      note: 'Mỗi lượt yêu thích dành cho một câu quote bất kỳ trong vườn Tri Thức là một lần tiếp thêm dưỡng chất, giúp Cây Tri Thức của đội được lan tỏa và phát triển.'
    },
    {
      action: '🔗 Nhật Ký Tri Thức',
      exp: '',
      note: 'Mỗi lượt tham gia và tương tác được ghi nhận minh bạch trên hệ thống, tạo thành nhật ký hành trình phát triển của từng Cây Tri Thức của mỗi đội trong vườn.'
    }
  ],
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

if (process.argv[1].endsWith('migrate_settings.js')) {
  migrateSettings().then(() => process.exit(0)).catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}
