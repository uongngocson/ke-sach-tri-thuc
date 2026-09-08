/**
 * server/services/credibility.service.js
 * 
 * Dịch Vụ AI Chấm Điểm Độ Uy Tín / Đáng Tin Cậy Của Trích Dẫn Sách
 * - Sử dụng Groq Model Pool tự động fallback qua 7 mô hình
 * - Đảm bảo quy chế gọi tuần tự (Pacing Queue) chống nghẽn token / rate limit
 * - Cập nhật trực tiếp kết quả vào bảng books (credibility_score, credibility_rationale, credibility_status)
 * - Độc lập hoàn toàn, không can thiệp hay thay đổi bất kỳ logic nghiệp vụ nào khác
 */

import db from '../config/database.js';
import { GroqPoolService } from './groqPool.service.js';
import GrowthService from './growth.service.js';
import socketService from './socket.service.js';

export class CredibilityService {
  /**
   * Chấm điểm độ uy tín cho một câu trích dẫn sách đơn lẻ
   * @param {string} bookId 
   * @param {Object} [options]
   * @param {string} [options.apiKey]
   * @returns {Promise<Object>} Thông tin sách sau khi chấm điểm
   */
  static async scoreQuoteCredibility(bookId, { apiKey } = {}) {
    // 1. Truy vấn sách từ Database
    const bookRes = await db.query(
      'SELECT id, title, author, quote, category, reader_name, reader_email, team_id, visibility_status, moderation_status, moderation_notes FROM books WHERE id = $1',
      [bookId]
    );

    if (bookRes.rows.length === 0) {
      const err = new Error('Không tìm thấy tác phẩm / trích dẫn cần chấm điểm.');
      err.statusCode = 404;
      err.code = 'BOOK_NOT_FOUND';
      throw err;
    }

    const book = bookRes.rows[0];

    // 2. Ghi nhận trạng thái đang chấm
    await db.query(
      "UPDATE books SET credibility_status = 'scoring' WHERE id = $1",
      [bookId]
    );

    try {
      // 3. Soạn Prompt kiểm duyệt an toàn nội dung & chuẩn mực đạo đức
      const prompt = `Bạn là Hệ thống Giám định An toàn Nội dung & Chuẩn mực Đạo đức.
Nhiệm vụ duy nhất: Đánh giá câu trích dẫn sau xem có chứa từ ngữ chửi bậy, thô tục, nội dung kích động bạo lực, hoặc hành vi thiếu đạo đức / vi phạm thuần phong mỹ tục hay không.

Nội dung trích dẫn cần kiểm duyệt:
"${book.quote}"

Thang điểm Chuẩn mực Đạo đức (0 - 100):
- 100 điểm: Hoàn toàn trong sáng, lành mạnh, không chửi bậy, không bạo lực, không vi phạm đạo đức.
- 60 - 79 điểm: Ngôn từ gây tranh cãi nhẹ nhưng chưa thô tục hay bạo lực.
- 0 - 59 điểm: Chứa từ ngữ chửi bậy, thô tục, kích động bạo lực, thù hằn, hoặc hành vi thiếu đạo đức.

YÊU CẦU BẮT BUỘC:
- Chỉ chấm điểm số nguyên từ 0 đến 100.
- Tuyệt đối KHÔNG giải thích tại sao.
- Trả về DUY NHẤT một JSON Object định dạng: {"score": <số nguyên từ 0 đến 100>}`;

      // 4. Gọi Groq AI qua Model Pool với requireJson=true và maxTokens 64 tokens
      const aiResponse = await GroqPoolService.callChatCompletion({
        apiKey,
        messages: [
          { 
            role: 'system', 
            content: 'Bạn là chuyên gia giám định an toàn nội dung. Chỉ trả về điểm số JSON {"score": <số>} không giải thích.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        maxTokens: 64,
        requireJson: true
      });

      const parsed = aiResponse.parsed || {};
      let score = parseInt(parsed.score, 10);
      if (isNaN(score) || score < 0) score = 100;
      if (score > 100) score = 100;

      let rationale = '';
      if (score >= 80) {
        rationale = 'Chuẩn mực & Lành mạnh';
      } else if (score >= 60) {
        rationale = 'Cần xem xét mức độ phù hợp';
      } else {
        rationale = `Cảnh báo: Vi phạm chuẩn mực đạo đức / ngôn từ (${score}/100 < 60 điểm)`;
      }

      // 5. Kiểm tra ngưỡng vi phạm chuẩn mực đạo đức (< 60 điểm) theo quy chuẩn Production:
      // Tự động xóa khỏi danh sách hiển thị, lưu vết audit log và đưa vào danh sách đã xóa.
      if (score < 60) {
        const deletionReason = `Tự động xóa bởi AI do vi phạm chuẩn mực đạo đức (${score}/100 điểm < 60)`;
        const autoModNote = ` [Tự động xóa bởi AI: Điểm ${score}/100 (< 60)]`;

        const deletedResult = await db.transaction(async (client) => {
          // A. Cập nhật trạng thái sách thành 'deleted' và 'rejected'
          const updateRes = await client.query(`
            UPDATE books
            SET credibility_score = $1,
                credibility_rationale = $2,
                credibility_status = 'scored',
                credibility_scored_at = NOW(),
                visibility_status = 'deleted',
                moderation_status = 'rejected',
                deleted_at = NOW(),
                deletion_reason = $3,
                moderation_notes = COALESCE(moderation_notes, '') || $4
            WHERE id = $5
            RETURNING *
          `, [score, rationale, deletionReason, autoModNote, bookId]);

          const updated = updateRes.rows[0];

          // B. Nếu sách đang hiển thị trên cây, giảm tổng số sách cộng đồng & đội
          if (book.visibility_status === 'visible') {
            await client.query(`
              UPDATE community_growth
              SET total_books = GREATEST(0, total_books - 1),
                  updated_at = NOW()
              WHERE id = 1
            `);
            if (book.team_id) {
              await client.query(`
                UPDATE teams
                SET total_books = GREATEST(0, total_books - 1)
                WHERE id = $1
              `, [book.team_id]);
            }
          }

          // C. Lưu trữ bản sao vào bảng lưu trữ vĩnh viễn (Enterprise Deleted Quotes Archive)
          await client.query(`
            INSERT INTO deleted_quotes_archive (
              book_id, title, author, quote, category, reader_name, reader_email,
              team_id, credibility_score, credibility_rationale, deletion_source, deletion_reason, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'AI_AUTO', $11, $12)
          `, [
            bookId, book.title, book.author, book.quote, book.category,
            book.reader_name, book.reader_email, book.team_id,
            score, rationale, deletionReason,
            JSON.stringify({ previous_visibility: book.visibility_status, scored_at: new Date().toISOString() })
          ]);

          // D. Ghi nhận Audit Log
          await client.query(`
            INSERT INTO audit_logs (admin_id, action, target_type, target_id, metadata, ip_address)
            VALUES (NULL, 'AI_AUTO_DELETE_BOOK', 'books', $1, $2, '127.0.0.1')
          `, [bookId, JSON.stringify({ score, rationale, reason: 'CREDIBILITY_SCORE_UNDER_60', title: book.title })]);

          return updated;
        });

        // Broadcast realtime cập nhật
        try {
          const fullGrowth = await GrowthService.getCommunityGrowth();
          socketService.broadcastGrowthUpdated(fullGrowth);
          socketService.broadcastBookCredibilityScored({ ...deletedResult, is_deleted: true });
          socketService.broadcastAdminBookEvent('book_deleted', deletedResult);
        } catch (e) {
          console.error('[CredibilityService] Broadcast error:', e.message);
        }

        console.log(`⚠️ [CredibilityService] ĐÃ TỰ ĐỘNG XÓA sách "${book.title}" (ID: ${bookId}) do điểm chuẩn mực ${score}/100 < 60.`);
        return deletedResult;
      }

      // 6. Điểm >= 60: Lưu kết quả bình thường, giữ nguyên visibility_status
      const updateRes = await db.query(`
        UPDATE books
        SET credibility_score = $1,
            credibility_rationale = $2,
            credibility_status = 'scored',
            credibility_scored_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [score, rationale, bookId]);

      const updatedBook = updateRes.rows[0];
      try {
        socketService.broadcastBookCredibilityScored(updatedBook);
      } catch (e) {}

      return updatedBook;
    } catch (err) {
      console.error(`[CredibilityService] Lỗi chấm điểm sách ${bookId}:`, err.message);
      
      // 6. Ghi nhận trạng thái thất bại vào DB để cho phép bấm nút "Chấm lại"
      await db.query(`
        UPDATE books
        SET credibility_status = 'failed',
            credibility_rationale = $1
        WHERE id = $2
      `, [`Lỗi thẩm định: ${err.message}`, bookId]);

      throw err;
    }
  }

  /**
   * Chấm điểm tuần tự một danh sách trích dẫn (Sequential Batch Queue)
   * Đảm bảo khoảng cách an toàn (delayMs) giữa các request để KHÔNG BAO GIỜ vượt quá RPM/TPM của Groq
   * 
   * @param {Object} [params]
   * @param {number} [params.limit=15] - Số lượng sách cần chấm mỗi đợt
   * @param {number} [params.delayMs=800] - Khoảng nghỉ an toàn giữa 2 lần gọi (ms)
   * @param {boolean} [params.forceRescore=false] - Có chấm lại sách đã có điểm hay không
   * @param {string} [params.apiKey]
   * @returns {Promise<Object>} Báo cáo tổng kết đợt chấm điểm
   */
  static async batchScoreQuotes({ limit = 15, delayMs = 800, forceRescore = false, apiKey } = {}) {
    let query = `
      SELECT id, title, author, quote 
      FROM books 
      WHERE visibility_status != 'deleted'
    `;

    if (!forceRescore) {
      query += ` AND (credibility_status IS NULL OR credibility_status IN ('unscored', 'failed'))`;
    }

    query += ` ORDER BY created_at DESC LIMIT $1`;

    const candidatesRes = await db.query(query, [Math.min(limit, 50)]);
    const candidates = candidatesRes.rows;

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      
      // Giữ nhịp độ an toàn giữa các request (Inter-request pacing)
      if (i > 0 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      try {
        const scoredBook = await this.scoreQuoteCredibility(item.id, { apiKey });
        results.push({
          id: item.id,
          title: item.title,
          success: true,
          score: scoredBook.credibility_score,
          rationale: scoredBook.credibility_rationale
        });
        successCount++;
      } catch (err) {
        results.push({
          id: item.id,
          title: item.title,
          success: false,
          error: err.message
        });
        failCount++;
      }
    }

    return {
      totalRequested: candidates.length,
      successCount,
      failCount,
      results
    };
  }
}

export default CredibilityService;
