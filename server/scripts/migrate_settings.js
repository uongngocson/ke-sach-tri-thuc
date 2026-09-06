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
  badge: 'THỂ LỆ & QUY TRÌNH THI ĐUA 15 LƯỢT • FOXREAD 2026',
  mission: {
    title: 'Sứ Mệnh Hội Đồng FoxREAD & 8 Vườn Tri Thức',
    desc: 'Chương trình dành riêng cho 288 thành viên Ban Giám Đốc, Trưởng Đơn Vị và CLB Sách FPT thuộc 8 Đội thi đua. Mỗi cuốn sách được gieo mầm, mỗi trích dẫn tâm đắc và mỗi lượt thả tim lan tỏa chính là nguồn dưỡng chất quý báu nuôi dưỡng Cây Tri Thức của từng đội sinh trưởng qua 15 lượt hành trình.'
  },
  timeline: {
    title: 'Lộ Trình 15 Lượt Thi Đua (05/09/2026 – 17/10/2026)',
    desc: 'Hành trình kéo dài 45 ngày với chu kỳ 3 ngày / 1 lượt, gồm 2 giai đoạn chiến lược:',
    phase1Title: 'GIAI ĐOẠN 1: GIEO HẠT MẦM (Lượt 1 – 2)',
    phase1Rounds: '• Lượt 1: 05/09 – 07/09/2026\n• Lượt 2: 08/09 – 10/09/2026',
    phase1Note: '* 1 người tham gia = 1 hạt giống hữu cơ. Cần tích lũy đủ 50 hạt để Cây chính thức 🌱 Nảy mầm 3D. Chưa tính EXP ở 2 lượt này để đảm bảo công bằng.',
    phase2Title: 'GIAI ĐOẠN 2: TÍNH EXP CHUẨN HÓA (Lượt 3 – 15)',
    phase2Rounds: '• Lượt 3 (11/09): Tất cả 8 đội đồng loạt tính EXP!\n• Lượt 4 – 14: 14/09, 17/09, 20/09, 23/09, 26/09, 29/09, 02/10, 05/10, 08/10, 11/10, 14/10\n• Lượt 15 (17/10 – 19/10): Tổng kết chung cuộc & Gala vinh danh'
  },
  formula: {
    title: 'Công Thức Quy Đổi Chuẩn Hóa 40 Người (Tuyệt Đối Công Bằng)',
    desc: 'Do quy mô các đội không đồng đều (từ 26 đến 49 thành viên), hệ thống áp dụng công thức chuẩn hóa quy mô 40 người:',
    formulaText: 'EXP Lượt = (Số thành viên tham gia / Tổng quân số đội) × 40 × 5 = Tỷ lệ % × 200 EXP',
    maxText: 'Tối đa mỗi lượt: 100% quân số tham gia = 200 EXP',
    example1Title: 'Ví dụ Đội 4 (26 người):',
    example1Text: 'Nếu 26/26 thành viên tham gia (100%):\n(26 / 26) × 40 × 5 = 200 EXP',
    example2Title: 'Ví dụ Đội 2 (49 người):',
    example2Text: 'Nếu 49/49 thành viên tham gia (100%):\n(49 / 49) × 40 × 5 = 200 EXP',
    note: '💡 Đội ít người không bị thiệt thòi về tổng điểm, và đội đông người cần duy trì tỷ lệ gắn kết cao để tối đa hóa điểm số.'
  },
  milestones: [
    {
      level: 0,
      title: 'Ủ Mầm Lòng Đất (0 – 49 Hạt Giống 🌰)',
      desc: 'Các hạt giống hữu cơ nằm ủ mình dưới bề mặt đất. Cần đủ 50 hạt giống đầu tiên để đánh thức mầm sống.'
    },
    {
      level: 1,
      title: 'Nảy Mầm Non (Cột mốc Đủ 50 Hạt 🌱)',
      desc: 'Cây mầm non 3D vươn lên đón nắng với chồi xanh tươi mát.'
    },
    {
      level: 2,
      title: 'Đâm Chồi (150 – 400 EXP 🌿)',
      desc: 'Thân cây hóa gỗ non, bung nở 2 tầng cành rợp sắc xanh.'
    },
    {
      level: 3,
      title: 'Cây Tơ Vươn Cành (400 – 1.000 EXP 🌳)',
      desc: '3 tầng cành sum sê, bóng mát rợp cả một góc vườn.'
    },
    {
      level: 4,
      title: 'Trưởng Thành Rợp Bóng (1.000 – 2.500 EXP 🌲)',
      desc: 'Thân đại mộc vững chắc, tán lá tầng tầng lớp lớp.'
    },
    {
      level: 5,
      title: 'Đại Cổ Thụ Ngàn Năm (2.500+ EXP ✨👑)',
      desc: 'Cây đại thụ ngàn năm vĩ đại, tỏa đom đóm tri thức lung linh về đêm.'
    }
  ],
  interactions: [
    {
      icon: '📖',
      title: 'Gieo Sách Nuôi Cây',
      desc: 'Mỗi thành viên gieo mầm trong lượt giúp đội tăng tỷ lệ tham gia và cộng dồn điểm EXP'
    },
    {
      icon: '💖',
      title: 'Thả Tim Liên Đội',
      desc: 'Đội nào cũng có thể đọc và thả tim trích dẫn của đội khác — mỗi tim tặng +2 EXP cho cây của đội bạn!'
    },
    {
      icon: '👁️',
      title: 'Thăm Cây 8 Đội',
      desc: 'Ghé thăm toàn cảnh 8 Cây Tri Thức bất cứ lúc nào qua nút Toàn Cảnh 8 Cây'
    }
  ],
  tieBreakers: {
    title: '4 Tiêu Chí Phá Hòa & Cơ Cấu Giải Thưởng',
    rules: [
      '1. 🥇 Tổng EXP tích lũy: Đội có tổng điểm sinh trưởng cao nhất.',
      '2. 🥈 Tỷ lệ tham gia trung bình: Đo lường độ gắn kết bền bỉ của tập thể.',
      '3. 🥉 Tốc độ đạt mốc: Đội nào cán mốc sinh trưởng sớm hơn.',
      '4. 🏅 Số lượt đạt 100%: Số lượt có toàn bộ quân số cùng tham gia.'
    ],
    awards: [
      '👑 Cây Tri Thức Xuất Sắc',
      '🛡️ Cây Bền Bỉ',
      '🚀 Cây Bứt Phá',
      '🌱 Cây Khởi Đầu Tốt'
    ]
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
    ON CONFLICT (key) DO NOTHING;
  `, [JSON.stringify(DEFAULT_WELCOME_SETTINGS)]);

  // Seed default rules_content
  await db.query(`
    INSERT INTO system_settings (key, value)
    VALUES ('rules_content', $1)
    ON CONFLICT (key) DO NOTHING;
  `, [JSON.stringify(DEFAULT_RULES_SETTINGS)]);

  console.log('✅ System Settings migration & seeding completed successfully!');
}

if (process.argv[1].endsWith('migrate_settings.js')) {
  migrateSettings().then(() => process.exit(0)).catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}
