const mongoose = require('mongoose');
const { Schema } = mongoose;

const ImageSchema = new Schema(
  {
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['image', 'video'],
      default: 'image',
    },
    duration: {
      type: Number, // Thời lượng video (giây)
    },
    resourceType: {
      type: String,
      enum: ['image', 'video'],
      default: 'image',
    },
    album: {
      type: Schema.Types.ObjectId,
      ref: 'Album',
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    location: {
      name: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    takenAt: {
      type: Date,
    },
    metadata: {
      width: Number,
      height: Number,
      format: String,
      size: Number,
    },
    reactions: {
      hearts: {
        type: Number,
        default: 0,
      },
      likes: {
        type: Number,
        default: 0,
      },
    },
    loveNotes: [
      {
        content: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    isAnniversary: {
      type: Boolean,
      default: false,
    },
    anniversaryDate: {
      type: Date, // Ngày kỷ niệm (có thể tự ghi hoặc dùng takenAt)
    },
    anniversaryDays: {
      type: Number, // Số ngày từ ngày yêu nhau (22/02/2022)
    },
  },
  {
    timestamps: true,
  }
)

// Index để tìm kiếm và filter
ImageSchema.index({ album: 1, createdAt: -1 });
ImageSchema.index({ takenAt: -1 });
ImageSchema.index({ tags: 1 });
ImageSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Image', ImageSchema);


