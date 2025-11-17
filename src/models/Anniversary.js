const mongoose = require('mongoose');
const { Schema } = mongoose;

const AnniversarySchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    anniversaryDate: {
      type: Date,
      required: false, // Không bắt buộc
    },
    anniversaryDays: {
      type: Number, // Số ngày từ 22/02/2022 (có thể âm hoặc null)
      required: false,
    },
    images: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Image',
      },
    ],
    albums: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Album',
      },
    ],
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
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    showInTimeline: {
      type: Boolean,
      default: true, // Mặc định hiển thị trên timeline
    },
  },
  {
    timestamps: true,
  }
);

// Index
AnniversarySchema.index({ anniversaryDays: 1 });
AnniversarySchema.index({ anniversaryDate: 1 });
AnniversarySchema.index({ isPrivate: 1 });

module.exports = mongoose.model('Anniversary', AnniversarySchema);

