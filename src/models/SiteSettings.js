const mongoose = require('mongoose');
const { Schema } = mongoose;

const SiteSettingsSchema = new Schema(
  {
    backgroundImage: {
      type: String, // URL của ảnh background
      default: null,
    },
    backgroundImageUrl: {
      type: String, // Cloudinary URL
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Chỉ có 1 document duy nhất
SiteSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('SiteSettings', SiteSettingsSchema);

