/**
 * assets/services/QuoteCardExporter.js
 * Masterpiece High-Resolution Social Story & Feed Card Exporter (9:16 Story 1080x1920)
 * Features Dynamic Vertical Centering, Luxury Twilight Nebula Glow, and Flawless Typography
 */
export class QuoteCardExporter {
  static async exportQuoteImage({
    book = 'Cây Sách Tri Thức',
    author = 'Tác Giả Tri Thức',
    quote = 'Mỗi cuốn sách bạn đọc là một hạt mầm tiếp thêm dinh dưỡng cho Cây Tri Thức vươn cao.',
    reader = 'Độc giả yêu sách',
    likes = 120,
    format = 'story'
  }) {
    const width = 1080;
    const height = format === 'story' ? 1920 : 1080;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // ----------------------------------------------------
    // 1. LUXURY BACKGROUND (DEEP MIDNIGHT NEBULA + GLOWS)
    // ----------------------------------------------------
    const bgGrad = ctx.createLinearGradient(0, 0, width * 0.9, height);
    bgGrad.addColorStop(0, '#060d1f');
    bgGrad.addColorStop(0.35, '#00183b');
    bgGrad.addColorStop(0.7, '#072426');
    bgGrad.addColorStop(1, '#051412');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Nebula Glow Spheres
    const drawGlow = (cx, cy, r, color) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    };

    drawGlow(width * 0.25, height * 0.22, 500, 'rgba(0, 84, 166, 0.45)');
    drawGlow(width * 0.82, height * 0.45, 520, 'rgba(243, 111, 33, 0.32)');
    drawGlow(width * 0.5, height * 0.85, 600, 'rgba(112, 185, 40, 0.35)');

    // Star Dust Particles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const seed = 12345;
    for (let i = 0; i < 65; i++) {
      const sx = (Math.sin(i * 99 + seed) * 0.5 + 0.5) * width;
      const sy = (Math.cos(i * 33 + seed) * 0.5 + 0.5) * height;
      const sr = (Math.sin(i * 17) * 0.5 + 0.5) * 2.2 + 0.8;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // ----------------------------------------------------
    // 2. TEXT WRAPPING & DYNAMIC VERTICAL LAYOUT ENGINE
    // ----------------------------------------------------
    const cardMarginX = 64;
    const cardW = width - cardMarginX * 2;
    const innerPadX = 64;
    const maxTextWidth = cardW - innerPadX * 2;

    // Helper: Wrap text
    ctx.font = 'italic 700 46px "Quicksand", -apple-system, sans-serif';
    const quoteWords = quote.trim().split(/\s+/);
    const quoteLines = [];
    let currentLine = '';

    for (let i = 0; i < quoteWords.length; i++) {
      const testLine = currentLine ? `${currentLine} ${quoteWords[i]}` : quoteWords[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxTextWidth && currentLine) {
        quoteLines.push(currentLine);
        currentLine = quoteWords[i];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) quoteLines.push(currentLine);

    // Calculate Dynamic Heights
    const lineHeight = 72;
    const quoteBlockHeight = quoteLines.length * lineHeight;
    
    // Components heights
    const headerHeight = 110;
    const quoteMarkHeight = 70;
    const bookBoxHeight = 150;
    const footerMetaHeight = 60;
    const spacingGaps = 48 + 36 + 56 + 48; // gaps between sections
    const innerPaddingY = 70 * 2;

    const totalCalculatedCardHeight = headerHeight + quoteMarkHeight + quoteBlockHeight + bookBoxHeight + footerMetaHeight + spacingGaps + innerPaddingY;
    
    // Clamp card height to fit gracefully inside story
    const cardH = Math.min(height - 180, Math.max(1050, totalCalculatedCardHeight));
    const cardMarginY = Math.round((height - cardH) / 2);

    // ----------------------------------------------------
    // 3. DRAW CENTRAL GLASSMORPHISM CARD
    // ----------------------------------------------------
    ctx.save();
    // Soft outer glow
    ctx.shadowColor = 'rgba(0, 84, 166, 0.4)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;

    // Card background
    ctx.beginPath();
    ctx.roundRect(cardMarginX, cardMarginY, cardW, cardH, 44);
    ctx.fillStyle = 'rgba(11, 20, 42, 0.84)';
    ctx.fill();

    // Multi-layer Border
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 3.5;
    const borderGrad = ctx.createLinearGradient(cardMarginX, cardMarginY, cardMarginX + cardW, cardMarginY + cardH);
    borderGrad.addColorStop(0, 'rgba(56, 189, 248, 0.65)');
    borderGrad.addColorStop(0.5, 'rgba(243, 111, 33, 0.45)');
    borderGrad.addColorStop(1, 'rgba(112, 185, 40, 0.55)');
    ctx.strokeStyle = borderGrad;
    ctx.stroke();
    ctx.restore();

    // ----------------------------------------------------
    // 4. DRAW HEADER BRANDING (TOP OF CARD)
    // ----------------------------------------------------
    let cursorY = cardMarginY + 70;

    // Brand Pill Badge
    const brandBadgeW = 440;
    const brandBadgeH = 52;
    const brandBadgeX = (width - brandBadgeW) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(brandBadgeX, cursorY, brandBadgeW, brandBadgeH, 9999);
    ctx.fillStyle = 'rgba(0, 84, 166, 0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 24px "Quicksand", sans-serif';
    ctx.fillText('✨ CÂY SÁCH TRI THỨC ✨', width / 2, cursorY + 35);
    ctx.restore();

    cursorY += 80;

    // Slogan Subtitle
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '700 20px "Quicksand", sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('LAN TỎA VĂN HÓA ĐỌC · VƯỜN TRI THỨC', width / 2, cursorY);
    ctx.restore();

    cursorY += 32;

    // Divider Line
    ctx.save();
    const divGrad = ctx.createLinearGradient(cardMarginX + 80, 0, cardMarginX + cardW - 80, 0);
    divGrad.addColorStop(0, 'transparent');
    divGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.22)');
    divGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardMarginX + 80, cursorY);
    ctx.lineTo(cardMarginX + cardW - 80, cursorY);
    ctx.stroke();
    ctx.restore();

    // ----------------------------------------------------
    // 5. DRAW QUOTE CONTENT (BEAUTIFULLY CENTERED)
    // ----------------------------------------------------
    cursorY += 60;

    // Large Quotation Mark
    ctx.save();
    ctx.fillStyle = '#F36F21';
    ctx.font = 'bold 110px Georgia, serif';
    ctx.fillText('“', cardMarginX + innerPadX - 8, cursorY + 30);
    ctx.restore();

    cursorY += 75;

    // Quote Lines
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 700 44px "Quicksand", -apple-system, sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 12;

    for (let i = 0; i < quoteLines.length; i++) {
      ctx.fillText(quoteLines[i], cardMarginX + innerPadX, cursorY);
      cursorY += lineHeight;
    }
    ctx.restore();

    // Closing Quotation Mark
    ctx.save();
    ctx.fillStyle = '#F36F21';
    ctx.font = 'bold 80px Georgia, serif';
    ctx.textAlign = 'right';
    ctx.fillText('”', cardMarginX + cardW - innerPadX, cursorY - 10);
    ctx.restore();

    cursorY += 40;

    // ----------------------------------------------------
    // 6. DRAW BOOK & AUTHOR BOX
    // ----------------------------------------------------
    // Anchor book box nicely towards bottom of card
    const bookBoxY = Math.max(cursorY, cardMarginY + cardH - 280);
    const bookBoxW = cardW - innerPadX * 2;
    const bookBoxX = cardMarginX + innerPadX;
    const bookBoxH = 136;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bookBoxX, bookBoxY, bookBoxW, bookBoxH, 20);
    ctx.fillStyle = 'rgba(0, 84, 166, 0.18)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0, 84, 166, 0.55)';
    ctx.stroke();

    // Orange left accent pill
    ctx.fillStyle = '#F36F21';
    ctx.beginPath();
    ctx.roundRect(bookBoxX, bookBoxY, 8, bookBoxH, [20, 0, 0, 20]);
    ctx.fill();

    // Book Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 30px "Quicksand", sans-serif';
    ctx.fillText(`📖 ${book}`, bookBoxX + 28, bookBoxY + 54);

    // Author
    ctx.fillStyle = '#F36F21';
    ctx.font = 'bold 24px "Quicksand", sans-serif';
    ctx.fillText(`✍️ Tác giả: ${author}`, bookBoxX + 28, bookBoxY + 102);
    ctx.restore();

    // ----------------------------------------------------
    // 7. DRAW FOOTER META (READER & LIKES)
    // ----------------------------------------------------
    const footerY = cardMarginY + cardH - 55;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '600 22px "Quicksand", sans-serif';
    ctx.fillText(`👤 Người chia sẻ: ${reader}`, cardMarginX + innerPadX, footerY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fb7185';
    ctx.font = '800 22px "Quicksand", sans-serif';
    ctx.fillText(`💖 ${likes.toLocaleString()} Yêu Thích`, cardMarginX + cardW - innerPadX, footerY);
    ctx.restore();

    // ----------------------------------------------------
    // 8. WATERMARK FOOTER (BELOW CARD)
    // ----------------------------------------------------
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('🌱 ke-sach-tri-thuc.vercel.app', width / 2, height - 40);
    ctx.restore();

    // ----------------------------------------------------
    // 9. TRIGGER INSTANT DOWNLOAD
    // ----------------------------------------------------
    const safeTitle = book.replace(/[^a-zA-Z0-9À-ỹ]/g, '_').substring(0, 30);
    const link = document.createElement('a');
    link.download = `Trich-Dan-${safeTitle}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();

    return true;
  }
}
