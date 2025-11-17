const dotenv = require('dotenv');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Đảm bảo dotenv được load trước khi sử dụng process.env
dotenv.config();

// Cấu hình Cloudinary
const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

if (!cloudName || !apiKey || !apiSecret) {
  console.warn('⚠️  Cloudinary credentials chưa được cấu hình đầy đủ!');
  console.warn('Vui lòng set các biến môi trường: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  console.warn('Current values:', {
    CLOUDINARY_CLOUD_NAME: cloudName || 'undefined',
    CLOUDINARY_API_KEY: apiKey ? '***' + apiKey.slice(-4) : 'undefined',
    CLOUDINARY_API_SECRET: apiSecret ? '***' + apiSecret.slice(-4) : 'undefined',
  });
} else {
  console.log('✅ Cloudinary config loaded:', {
    cloud_name: cloudName,
    api_key: '***' + apiKey.slice(-4),
  });
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

// Tạo storage cho multer với Cloudinary - hỗ trợ cả ảnh và video
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype && file.mimetype.startsWith('video/');
    
    if (isVideo) {
      return {
        folder: 'memories/videos',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'avi', 'webm', 'mkv'],
        // Không dùng transformation/eager cho video lớn
        // Upload video thuần, thumbnail sẽ tạo sau bằng API
        format: 'auto',
        chunk_size: 6000000, // Chunk size 6MB để upload video lớn
      };
    } else {
      return {
        folder: 'memories/images',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'],
        transformation: [
          {
            width: 1920,
            height: 1920,
            crop: 'limit',
            quality: 'auto',
            fetch_format: 'auto',
          },
        ],
      };
    }
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB (tăng lên để hỗ trợ video)
  },
  fileFilter: (req, file, cb) => {
    // Cho phép cả ảnh và video
    const fileName = file.originalname.toLowerCase();
    const fileExt = fileName.split('.').pop() || '';
    
    // Danh sách extension được phép
    const allowedImageExts = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'heic', 'heif'];
    const allowedVideoExts = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
    
    const isImageExt = allowedImageExts.includes(fileExt);
    const isVideoExt = allowedVideoExts.includes(fileExt);
    const isValidExt = isImageExt || isVideoExt;
    
    // Kiểm tra mimetype - HEIC/HEIF có thể có nhiều mimetype khác nhau
    const isImageMime = file.mimetype.startsWith('image/');
    const isVideoMime = file.mimetype.startsWith('video/');
    // Một số browser/OS gửi HEIC với mimetype 'application/octet-stream'
    const isHeicAsOctetStream = file.mimetype === 'application/octet-stream' && 
                                 (fileExt === 'heic' || fileExt === 'heif');
    
    const isValidMime = isImageMime || isVideoMime || isHeicAsOctetStream;



    if (isValidExt && isValidMime) {
      return cb(null, true);
    } else {
      cb(new Error(`Chỉ cho phép upload file ảnh (JPEG, PNG, WEBP, GIF, HEIC, HEIF) hoặc video (MP4, MOV, AVI, WEBM, MKV). File của bạn: ${file.originalname} (${file.mimetype})`));
    }
  },
});

// Helper function để tạo thumbnail cho ảnh
const createThumbnail = (publicId, resourceType = 'image') => {
  if (resourceType === 'video') {
    // Với video, tạo thumbnail từ frame đầu tiên (giây 0)
    // Cloudinary tự động tạo thumbnail khi dùng format: 'jpg' với video
    return cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [
        {
          width: 400,
          height: 400,
          crop: 'fill',
          quality: 'auto',
          start_offset: '0', // Lấy frame ở giây 0
        },
      ],
    });
  }
  
  return cloudinary.url(publicId, {
    width: 400,
    height: 400,
    crop: 'fill',
    quality: 'auto',
    fetch_format: 'auto',
  });
};

// Helper function để lấy video URL với các options
const getVideoUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    ...options,
  });
};

// Helper function để tạo URL ảnh với preset
const getImageUrl = (publicId, preset) => {
  const transformations = {
    width: 1920,
    height: 1920,
    crop: 'limit',
    quality: 'auto',
    fetch_format: 'auto',
  };

  if (preset === 'romantic') {
    transformations.effect = 'tint:50:ff69b4';
    transformations.brightness = 1.1;
  } else if (preset === 'vintage') {
    transformations.effect = 'vignette:50';
    transformations.saturation = -20;
  } else if (preset === 'bright') {
    transformations.brightness = 1.2;
    transformations.saturation = 1.1;
  }

  return cloudinary.url(publicId, transformations);
};

module.exports = {
  storage,
  upload,
  createThumbnail,
  getImageUrl,
  getVideoUrl,
  default: cloudinary,
};


