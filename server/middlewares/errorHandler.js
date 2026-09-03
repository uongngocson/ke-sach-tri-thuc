export function errorHandler(err, req, res, next) {
  console.error('💥 Error caught by Centralized Error Handler:', err);

  // PostgreSQL Unique Constraint Violation (Anti-Spam)
  if (err.code === '23505') {
    if (err.constraint === 'unq_user_dew_date') {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_DEW_CLAIM',
        message: 'Bạn đã tưới cây hôm nay rồi. Hãy quay lại vào ngày mai nhé!'
      });
    }
    if (err.constraint === 'unq_user_quote_like') {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_QUOTE_LIKE',
        message: 'Bạn đã thả tim trích dẫn này rồi!'
      });
    }
    if (err.constraint === 'unq_user_fruit_harvest') {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_FRUIT_HARVEST',
        message: 'Trái tri thức này đã được hái hôm nay. Hãy đợi quả mới kết trái nhé!'
      });
    }
    return res.status(409).json({
      success: false,
      error: 'DUPLICATE_RECORD',
      message: 'Dữ liệu đã tồn tại trong hệ thống.'
    });
  }

  // Zod Validation Error
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      details: err.errors
    });
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.';
  
  res.status(statusCode).json({
    success: false,
    error: err.code || 'INTERNAL_SERVER_ERROR',
    message
  });
}
