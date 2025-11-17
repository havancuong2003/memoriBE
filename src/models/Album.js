const mongoose = require('mongoose');
const { Schema } = mongoose;

const AlbumSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Tên album là bắt buộc'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    coverImage: {
      type: String,
    },
    password: {
      type: String,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    eventDate: {
      type: Date,
    },
    location: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index để tìm kiếm nhanh
AlbumSchema.index({ title: 'text', description: 'text', tags: 'text' });
AlbumSchema.index({ eventDate: -1 });
AlbumSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Album', AlbumSchema);


