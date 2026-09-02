class SocketService {
  constructor() {
    this.io = null;
  }

  init(io) {
    this.io = io;
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected to Realtime Socket: ${socket.id}`);
      
      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  broadcastGrowthUpdated(growthData) {
    if (this.io) {
      this.io.emit('growth:updated', growthData);
    }
  }

  broadcastGrowthUpdate(growthData) {
    this.broadcastGrowthUpdated(growthData);
  }

  broadcastBookCreated(bookData) {
    if (this.io) {
      this.io.emit('book:created', bookData);
    }
  }

  broadcastQuoteLiked(likeData) {
    if (this.io) {
      this.io.emit('quote:liked', likeData);
    }
  }

  broadcastFruitHarvested(fruitData) {
    if (this.io) {
      this.io.emit('fruit:harvested', fruitData);
    }
  }

  broadcastAdminBookEvent(event, data) {
    if (this.io) {
      this.io.emit(`admin:book:${event}`, data);
    }
  }
}

export default new SocketService();
