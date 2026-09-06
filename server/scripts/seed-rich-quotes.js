import db from '../config/database.js';

async function seedRichQuotes() {
  console.log('📚 Enriching database with realistic curated quotes from 8 teams...');

  // Get sample users from each team
  const teamUsers = {};
  for (let t = 1; t <= 8; t++) {
    const res = await db.query('SELECT id, full_name, email, team_id FROM users WHERE team_id = $1 ORDER BY id LIMIT 10', [t]);
    teamUsers[t] = res.rows;
  }

  const curatedBooks = [
    // Đội 1
    {
      teamId: 1,
      title: 'Tư Duy Nhanh Và Chậm (Thinking, Fast and Slow)',
      author: 'Daniel Kahneman',
      quote: 'Chúng ta có xu hướng phóng đại khả năng hiểu thế giới và đánh giá thấp vai trò của sự may rủi trong thành bại.',
      likes: 42
    },
    {
      teamId: 1,
      title: 'Nhà Giả Kim (The Alchemist)',
      author: 'Paulo Coelho',
      quote: 'Khi bạn thực sự khao khát một điều gì đó, cả vũ trụ sẽ hợp lực giúp bạn đạt được nó.',
      likes: 68
    },
    {
      teamId: 1,
      title: 'Nguyên Lý 80/20 (The 80/20 Principle)',
      author: 'Richard Koch',
      quote: '80% kết quả bạn gặt hái đến từ 20% nỗ lực và thời gian thực sự tập trung.',
      likes: 29
    },
    {
      teamId: 1,
      title: 'Từ Tốt Đến Vĩ Đại (Good to Great)',
      author: 'Jim Collins',
      quote: 'Những người lãnh đạo vĩ đại luôn nhìn vào gương khi thất bại và nhìn ra cửa sổ để ghi nhận tập thể khi thành công.',
      likes: 54
    },
    {
      teamId: 1,
      title: 'Kỳ Án Ánh Trăng',
      author: 'Quỷ Cổ Nữ',
      quote: 'Nỗi sợ lớn nhất của con người không phải là bóng tối, mà là sự hoài nghi chính bản thân mình.',
      likes: 19
    },

    // Đội 2
    {
      teamId: 2,
      title: 'Sapiens: Lược Sử Loài Người',
      author: 'Yuval Noah Harari',
      quote: 'Sức mạnh lớn nhất của loài người là khả năng tin vào những câu chuyện và huyền thoại chung do chính chúng ta tạo ra.',
      likes: 85
    },
    {
      teamId: 2,
      title: 'Đắc Nhân Tâm (How to Win Friends)',
      author: 'Dale Carnegie',
      quote: 'Muốn lấy mật thì đừng phá tổ ong. Lắng nghe chân thành là lời khen ngợi tinh tế nhất.',
      likes: 92
    },
    {
      teamId: 2,
      title: '7 Thói Quen Của Người Thành Đạt',
      author: 'Stephen R. Covey',
      quote: 'Hầu hết mọi người không lắng nghe để thấu hiểu; họ lắng nghe chỉ để chuẩn bị đối đáp.',
      likes: 63
    },
    {
      teamId: 2,
      title: 'Khởi Nghiệp Tinh Gọn (The Lean Startup)',
      author: 'Eric Ries',
      quote: 'Thước đo duy nhất của tiến độ khởi nghiệp là việc học hỏi có kiểm chứng từ người dùng thực tế.',
      likes: 38
    },

    // Đội 3
    {
      teamId: 3,
      title: 'Đi Tìm Lẽ Sống (Man’s Search for Meaning)',
      author: 'Viktor E. Frankl',
      quote: 'Người có một lý do để sống có thể chịu đựng được hầu hết mọi nghịch cảnh.',
      likes: 76
    },
    {
      teamId: 3,
      title: 'Chiến Binh Cầu Vồng (The Rainbow Troops)',
      author: 'Andrea Hirata',
      quote: 'Học tập không chỉ là con đường thoát nghèo, mà là hành trình tôn vinh phẩm giá con người.',
      likes: 58
    },
    {
      teamId: 3,
      title: 'Hiểu Về Trái Tim',
      author: 'Thích Minh Niệm',
      quote: 'Bình yên không phải là đứng giữa nơi không có tiếng ồn, mà là ở giữa giông bão mà tâm vẫn an nhiên.',
      likes: 81
    },
    {
      teamId: 3,
      title: 'Lược Sử Thời Gian (A Brief History of Time)',
      author: 'Stephen Hawking',
      quote: 'Kẻ thù lớn nhất của tri thức không phải là sự ngu dốt, mà là ảo tưởng rằng mình đã biết hết.',
      likes: 47
    },

    // Đội 4
    {
      teamId: 4,
      title: 'Suối Nguồn (The Fountainhead)',
      author: 'Ayn Rand',
      quote: 'Hàng ngàn năm trước, người đầu tiên tạo ra lửa có lẽ đã bị thiêu chết trên chính ngọn lửa ấy. Nhưng con người vẫn tiến lên vì những người dám nghĩ khác.',
      likes: 64
    },
    {
      teamId: 4,
      title: 'Tội Ác Và Trừng Phạt (Crime and Punishment)',
      author: 'Fyodor Dostoevsky',
      quote: 'Bước đi một bước mới, nói ra một lời mới là điều người ta sợ hãi nhất nhưng cũng là khởi đầu cho sự trưởng thành.',
      likes: 39
    },
    {
      teamId: 4,
      title: 'Bắt Trẻ Đồng Xanh (The Catcher in the Rye)',
      author: 'J.D. Salinger',
      quote: 'Dấu hiệu của sự trưởng thành là dám sống khiêm nhường vì một lý tưởng cao đẹp.',
      likes: 45
    },
    {
      teamId: 4,
      title: 'Một Đời Quản Trị',
      author: 'GS. Phan Văn Trường',
      quote: 'Lãnh đạo bằng tình thương và sự tôn trọng là thứ nghệ thuật bền bỉ và tạo ra sự tận tụy sâu sắc nhất.',
      likes: 72
    },

    // Đội 5
    {
      teamId: 5,
      title: 'Hành Trình Về Phương Đông',
      author: 'Baird T. Spalding',
      quote: 'Khoa học và tâm linh là hai cánh của một con chim, cùng nâng con người bay lên tầm cao của sự giác ngộ.',
      likes: 89
    },
    {
      teamId: 5,
      title: 'Dám Bị Ghét (The Courage to Be Disliked)',
      author: 'Ichiro Kishimi & Fumitake Koga',
      quote: 'Tự do không phải là làm những gì mình thích, mà là dũng cảm đón nhận sự không hài lòng từ người khác để sống thật với chính mình.',
      likes: 96
    },
    {
      teamId: 5,
      title: 'Không Diệt Không Sinh Đừng Sợ Hãi',
      author: 'Thiền sư Thích Nhất Hạnh',
      quote: 'Nụ cười đem lại sự bình an cho bạn và cho mọi người xung quanh trong từng hơi thở chánh niệm.',
      likes: 67
    },
    {
      teamId: 5,
      title: 'Tập Trung Để Đột Phá (Deep Work)',
      author: 'Cal Newport',
      quote: 'Khả năng làm việc sâu trong thế giới đầy phiền nhiễu là siêu năng lực của thế kỷ 21.',
      likes: 53
    },

    // Đội 6
    {
      teamId: 6,
      title: 'Chiến Tranh Và Hòa Bình (War and Peace)',
      author: 'Leo Tolstoy',
      quote: 'Hai chiến binh dũng cảm và vĩ đại nhất của cuộc đời chính là sự kiên nhẫn và thời gian.',
      likes: 48
    },
    {
      teamId: 6,
      title: 'Lãnh Đạo Phục Vụ (Servant Leadership)',
      author: 'Robert K. Greenleaf',
      quote: 'Người lãnh đạo thực thụ bắt đầu bằng khát khao phụng sự tập thể và nâng đỡ người khác tỏa sáng.',
      likes: 57
    },
    {
      teamId: 6,
      title: 'Nghệ Thuật Tư Duy Rành Mạch',
      author: 'Rolf Dobelli',
      quote: 'Để không phạm sai lầm ngớ ngẩn, hãy nhận diện những thiên kiến tâm lý đang âm thầm điều khiển quyết định của bạn.',
      likes: 41
    },
    {
      teamId: 6,
      title: 'Vũ Trụ Trong Vỏ Hạt Dẻ',
      author: 'Stephen Hawking',
      quote: 'Dù ta bị nhốt trong một vỏ hạt dẻ, ta vẫn có thể tự coi mình là vị vua của không gian vô tận.',
      likes: 36
    },

    // Đội 7
    {
      teamId: 7,
      title: 'Hoàng Tử Bé (Le Petit Prince)',
      author: 'Antoine de Saint-Exupéry',
      quote: 'Người ta chỉ thấy rõ bằng trái tim. Những điều cốt lõi và thiêng liêng nhất thì vô hình trong mắt trần.',
      likes: 112
    },
    {
      teamId: 7,
      title: 'Truyện Kiều (Đoạn Trường Tân Thanh)',
      author: 'Đại thi hào Nguyễn Du',
      quote: 'Thiện căn ở tại lòng ta, Chữ tâm kia mới bằng ba chữ tài. — Cội nguồn của mọi giá trị văn hóa đích thực.',
      likes: 74
    },
    {
      teamId: 7,
      title: 'Khát Vọng Sống (Lust for Life)',
      author: 'Irving Stone',
      quote: 'Không có gì làm cho tâm hồn ta thanh thản bằng việc sống trọn vẹn và cống hiến hết mình cho niềm đam mê.',
      likes: 51
    },
    {
      teamId: 7,
      title: 'Bí Mật Của May Mắn (Good Luck)',
      author: 'Alex Rovira & Fernando Trias de Bes',
      quote: 'May mắn không tự nhiên đến; may mắn là kết quả của việc ta chủ động kiến tạo những điều kiện phù hợp.',
      likes: 62
    },

    // Đội 8
    {
      teamId: 8,
      title: 'Tuần Làm Việc 4 Giờ (The 4-Hour Workweek)',
      author: 'Timothy Ferriss',
      quote: 'Thành công không đo bằng số giờ bạn ngồi làm việc, mà bằng sự tự do và giá trị thực bạn tạo ra cho cuộc sống.',
      likes: 59
    },
    {
      teamId: 8,
      title: 'Cây Cam Ngọt Của Tôi (My Sweet Orange Tree)',
      author: 'José Mauro de Vasconcelos',
      quote: 'Yêu thương là điều duy nhất làm cho cuộc đời này trở nên ấm áp và đáng sống hơn giữa muôn vàn khó khăn.',
      likes: 88
    },
    {
      teamId: 8,
      title: 'Tâm Lý Học Về Tiền (The Psychology of Money)',
      author: 'Morgan Housel',
      quote: 'Làm giàu đòi hỏi sự mạo hiểm, nhưng giữ được sự giàu có và an yên lại cần sự khiêm nhường và kỷ luật.',
      likes: 79
    },
    {
      teamId: 8,
      title: 'Đọc Vị Bất Kỳ Ai (You Can Read Anyone)',
      author: 'David J. Lieberman',
      quote: 'Sự thấu hiểu tâm lý con người bắt đầu từ việc quan sát sâu sắc và đặt mình vào góc nhìn của đối phương.',
      likes: 44
    }
  ];

  // Clean old duplicate test quotes
  await db.query(`DELETE FROM books WHERE quote = 'Khoa học và tâm linh là hai cánh của một con chim, cùng nâng con người bay lên.' OR title = 'Sách Tinh Hoa' OR quote = 'Chúng ta có xu hướng phóng đại khả năng hiểu thế giới của mình.'`);

  for (let i = 0; i < curatedBooks.length; i++) {
    const item = curatedBooks[i];
    const uList = teamUsers[item.teamId] || [];
    const assignedUser = uList[i % uList.length] || { full_name: 'Thành viên Đội ' + item.teamId, id: null };

    await db.query(`
      INSERT INTO books (title, author, quote, reader_name, team_id, user_id, likes_count, visibility_status, moderation_status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'visible', 'reviewed', NOW() - ($8 || ' hours')::INTERVAL)
    `, [
      item.title,
      item.author,
      item.quote,
      assignedUser.full_name,
      item.teamId,
      assignedUser.id,
      item.likes,
      (curatedBooks.length - i) * 2
    ]);
  }

  // Update total counts in community_growth
  await db.query(`
    UPDATE community_growth 
    SET total_books = (SELECT COUNT(*) FROM books WHERE visibility_status = 'visible'),
        total_likes = (SELECT COALESCE(SUM(likes_count), 0) FROM books WHERE visibility_status = 'visible'),
        updated_at = NOW()
    WHERE id = 1
  `);

  console.log('✅ Successfully seeded rich, realistic quotes across all 8 teams!');
  process.exit(0);
}

seedRichQuotes();
