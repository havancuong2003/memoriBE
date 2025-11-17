const Image = require('../models/Image');
const Album = require('../models/Album');
const { createThumbnail, getVideoUrl } = require('../config/cloudinary');

// Helper function để check user có quyền xem private (admin, Cường, Linh)
const canViewPrivate = (user) => {
  if (!user) return false;
  // Admin luôn có quyền xem tất cả
  if (user.role === 'admin') return true;
  // Cường và Linh có quyền xem private
  const specialEmails = ['cuong@123.com', 'linh@123.com'];
  return specialEmails.includes(user.email?.toLowerCase());
};

const getAllImages = async (req, res, next) => {
  try {
    const { album, tag, search, year, month } = req.query;
    const hasPrivateAccess = canViewPrivate(req.user);

    let query = {};

    // Chỉ admin, Cường, Linh mới thấy private images
    if (!hasPrivateAccess) {
      query.isPrivate = false;
    }

    if (album) {
      // Kiểm tra quyền xem album nếu filter theo album
      const albumDoc = await Album.findById(album);
      if (albumDoc && !albumDoc.isPublic && !hasPrivateAccess) {
        const error = new Error('Bạn không có quyền xem album này');
        error.statusCode = 403;
        throw error;
      }
      query.album = album;
    }

    if (tag) {
      query.tags = { $in: [tag] };
    }

    // Filter theo anniversary
    if (req.query.anniversary === 'true') {
      query.isAnniversary = true;
    }

    if (search) {
      query.$text = { $search: search };
    }

    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      query.takenAt = { $gte: startDate, $lte: endDate };
    }

    if (month) {
      const [year, monthNum] = month.split('-');
      const startDate = new Date(`${year}-${monthNum}-01`);
      const endDate = new Date(`${year}-${monthNum}-31`);
      query.takenAt = { $gte: startDate, $lte: endDate };
    }

    const images = await Image.find(query)
      .populate('album', 'title')
      .sort({ takenAt: -1, createdAt: -1 });

    res.json({
      success: true,
      count: images.length,
      data: images,
    });
  } catch (error) {
    next(error);
  }
};

const getImageById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const image = await Image.findById(id).populate('album', 'title description');

    if (!image) {
      const error = new Error('Không tìm thấy ảnh');
      error.statusCode = 404;
      throw error;
    }

    // Kiểm tra quyền xem private image
    const hasPrivateAccess = canViewPrivate(req.user);
    if (image.isPrivate && !hasPrivateAccess) {
      const error = new Error('Bạn không có quyền xem ảnh này');
      error.statusCode = 403;
      throw error;
    }

    // Kiểm tra album có private không
    const album = await Album.findById(image.album);
    if (album && !album.isPublic && !hasPrivateAccess) {
      const error = new Error('Bạn không có quyền xem album chứa ảnh này');
      error.statusCode = 403;
      throw error;
    }

    res.json({
      success: true,
      data: image,
    });
  } catch (error) {
    next(error);
  }
};

const uploadImages = async (req, res, next) => {
  try {
    // Với upload.fields(), files sẽ là object với key là field name
    const files = req.files?.images || req.files || [];
    const { albumId, titles, descriptions, tags, takenAt } = req.body;

    if (!files || files.length === 0) {
      const error = new Error('Không có file nào được upload');
      error.statusCode = 400;
      throw error;
    }

    // Kiểm tra Cloudinary config
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    
    if (!cloudName || !apiKey || !apiSecret) {
      const error = new Error('Cloudinary chưa được cấu hình. Vui lòng set các biến môi trường CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET trong file .env');
      error.statusCode = 500;
      throw error;
    }

    // Kiểm tra album tồn tại
    const album = await Album.findById(albumId);
    if (!album) {
      const error = new Error('Không tìm thấy album');
      error.statusCode = 404;
      throw error;
    }

    // Chỉ admin, Cường, Linh mới được upload
    const hasAdminAccess = req.user.role === 'admin' || canViewPrivate(req.user);
    if (!hasAdminAccess) {
      const error = new Error('Chỉ admin, Cường, Linh mới được upload');
      error.statusCode = 403;
      throw error;
    }

    const titlesArray = titles ? JSON.parse(titles) : [];
    const descriptionsArray = descriptions ? JSON.parse(descriptions) : [];
    const tagsArray = tags ? JSON.parse(tags) : [];

    // Upload từng file (ảnh hoặc video)
    const uploadedImages = await Promise.all(
      files.map(async (file, index) => {
        const isVideo = file.mimetype && file.mimetype.startsWith('video/');
        const resourceType = isVideo ? 'video' : 'image';
        
        // Cloudinary trả về file object với các thuộc tính:
        // - file.public_id: public ID của file
        // - file.secure_url: URL đầy đủ của file
        // - file.url: URL không secure
        // - file.path: đường dẫn (có thể là public_id)
        // - file.folder: folder chứa file
        
        // Lấy publicId từ Cloudinary response
        let publicId = file.public_id || file.path;
        if (!publicId) {
          throw new Error(`Không thể lấy public_id từ file ${file.originalname}`);
        }
        
        // Nếu publicId có folder prefix, giữ nguyên hoặc bỏ tùy ý
        // Cloudinary trả về public_id có thể có format: "memories/images/abc123"
        
        // Tạo thumbnail
        let thumbnailUrl;
        let videoUrl;
        
        if (isVideo) {
          // Với video, dùng eager transformation đã tạo sẵn hoặc tạo mới
          thumbnailUrl = createThumbnail(publicId, 'video');
          videoUrl = getVideoUrl(publicId);
        } else {
          thumbnailUrl = createThumbnail(publicId, 'image');
        }

        // Lấy URL đầy đủ từ Cloudinary - ưu tiên secure_url
        const fullUrl = isVideo 
          ? videoUrl 
          : (file.secure_url || file.url || file.path);
        
        if (!fullUrl) {
          throw new Error(`Không thể lấy URL từ file ${file.originalname}`);
        }

        const image = await Image.create({
          title: titlesArray[index] || file.originalname,
          description: descriptionsArray[index] || '',
          url: fullUrl,
          thumbnailUrl,
          publicId,
          type: resourceType,
          resourceType,
          album: albumId,
          tags: tagsArray[index] || [],
          takenAt: takenAt ? new Date(takenAt) : new Date(),
          duration: file.duration || (isVideo && file.metadata?.duration ? file.metadata.duration : undefined),
          metadata: {
            width: file.width || file.metadata?.width,
            height: file.height || file.metadata?.height,
            format: file.format || file.metadata?.format,
            size: file.size || file.bytes,
          },
          uploadedBy: req.user.userId,
        });

        return image;
      })
    );

    // Cập nhật cover image cho album nếu chưa có
    // Nếu album toàn video, lấy thumbnail của video đầu tiên
    if (!album.coverImage && uploadedImages[0]) {
      const firstImage = uploadedImages[0];
      // Nếu là video và có thumbnailUrl, dùng thumbnailUrl
      // Nếu không có thumbnailUrl, tạo thumbnail từ video
      if (firstImage.type === 'video' || firstImage.resourceType === 'video') {
        if (firstImage.thumbnailUrl) {
          album.coverImage = firstImage.thumbnailUrl;
        } else {
          // Tạo thumbnail từ video đầu tiên
          album.coverImage = createThumbnail(firstImage.publicId, 'video');
        }
      } else {
        album.coverImage = firstImage.thumbnailUrl;
      }
      await album.save();
    }

    const imageCount = uploadedImages.filter(img => img.type === 'image').length;
    const videoCount = uploadedImages.filter(img => img.type === 'video').length;
    let message = `Upload thành công `;
    if (imageCount > 0) message += `${imageCount} ảnh`;
    if (imageCount > 0 && videoCount > 0) message += ` và `;
    if (videoCount > 0) message += `${videoCount} video`;
    
    res.status(201).json({
      success: true,
      message,
      data: uploadedImages,
    });
  } catch (error) {
    next(error);
  }
};

// Helper function để tính số ngày từ hiện tại (now)
// Số âm = quá khứ (đã qua), số dương = tương lai (chưa đến)
const calculateAnniversaryDays = (date) => {
  if (!date) return null;
  const now = new Date();
  const targetDate = new Date(date);
  // Reset time về 00:00:00 để tính chính xác số ngày
  now.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate - now;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays; // Số âm = quá khứ, số dương = tương lai
};

const updateImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, tags, takenAt, location, isPrivate, isAnniversary, anniversaryDate } = req.body;

    const image = await Image.findById(id);

    if (!image) {
      const error = new Error('Không tìm thấy ảnh');
      error.statusCode = 404;
      throw error;
    }

    // Chỉ admin, Cường, Linh mới được update
    const hasAdminAccess = req.user.role === 'admin' || canViewPrivate(req.user);
    if (!hasAdminAccess) {
      const error = new Error('Chỉ admin, Cường, Linh mới được chỉnh sửa ảnh');
      error.statusCode = 403;
      throw error;
    }

    // Tính anniversaryDays nếu có isAnniversary hoặc anniversaryDate
    let anniversaryDays = null;
    if (isAnniversary !== undefined && isAnniversary) {
      // Nếu có anniversaryDate thì dùng, không thì dùng takenAt
      const dateToUse = anniversaryDate ? new Date(anniversaryDate) : (image.takenAt || image.anniversaryDate || new Date());
      anniversaryDays = calculateAnniversaryDays(dateToUse);
    }

    Object.assign(image, {
      title: title !== undefined ? title : image.title,
      description: description !== undefined ? description : image.description,
      tags: tags || image.tags,
      takenAt: takenAt ? new Date(takenAt) : image.takenAt,
      location: location ? (typeof location === 'string' ? JSON.parse(location) : location) : image.location,
      isPrivate: isPrivate !== undefined ? isPrivate : image.isPrivate,
      isAnniversary: isAnniversary !== undefined ? isAnniversary : image.isAnniversary,
      anniversaryDate: anniversaryDate ? new Date(anniversaryDate) : (isAnniversary && !anniversaryDate && image.takenAt ? image.takenAt : image.anniversaryDate),
      anniversaryDays: anniversaryDays !== null ? anniversaryDays : (isAnniversary === false ? null : image.anniversaryDays),
    });

    await image.save();

    res.json({
      success: true,
      message: 'Cập nhật ảnh thành công',
      data: image,
    });
  } catch (error) {
    next(error);
  }
};

const moveImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { albumId } = req.body;

    if (!albumId) {
      const error = new Error('Vui lòng cung cấp albumId');
      error.statusCode = 400;
      throw error;
    }

    const image = await Image.findById(id);
    if (!image) {
      const error = new Error('Không tìm thấy ảnh');
      error.statusCode = 404;
      throw error;
    }

    // Chỉ admin, Cường, Linh mới được move
    const hasAdminAccess = req.user.role === 'admin' || canViewPrivate(req.user);
    if (!hasAdminAccess) {
      const error = new Error('Chỉ admin, Cường, Linh mới được di chuyển ảnh');
      error.statusCode = 403;
      throw error;
    }

    // Kiểm tra album đích tồn tại
    const targetAlbum = await Album.findById(albumId);
    if (!targetAlbum) {
      const error = new Error('Không tìm thấy album đích');
      error.statusCode = 404;
      throw error;
    }

    // Di chuyển ảnh
    const oldAlbumId = image.album;
    image.album = albumId;
    await image.save();

    res.json({
      success: true,
      message: 'Di chuyển ảnh thành công',
      data: image,
    });
  } catch (error) {
    next(error);
  }
};

const deleteImage = async (req, res, next) => {
  try {
    const { id } = req.params;

    const image = await Image.findById(id);

    if (!image) {
      const error = new Error('Không tìm thấy ảnh');
      error.statusCode = 404;
      throw error;
    }

    // Chỉ admin, Cường, Linh mới được xóa
    const hasAdminAccess = req.user.role === 'admin' || canViewPrivate(req.user);
    if (!hasAdminAccess) {
      const error = new Error('Không có quyền xóa ảnh này');
      error.statusCode = 403;
      throw error;
    }

    // TODO: Xóa ảnh trên Cloudinary
    // await cloudinary.uploader.destroy(image.publicId);

    await Image.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Xóa ảnh thành công',
    });
  } catch (error) {
    next(error);
  }
};

const reactToImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // 'heart' hoặc 'like'

    const image = await Image.findById(id);

    if (!image) {
      const error = new Error('Không tìm thấy ảnh');
      error.statusCode = 404;
      throw error;
    }

    if (type === 'heart') {
      image.reactions.hearts += 1;
    } else if (type === 'like') {
      image.reactions.likes += 1;
    }

    await image.save();

    res.json({
      success: true,
      message: 'Đã thêm reaction',
      data: image.reactions,
    });
  } catch (error) {
    next(error);
  }
};

const addLoveNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const image = await Image.findById(id);

    if (!image) {
      const error = new Error('Không tìm thấy ảnh');
      error.statusCode = 404;
      throw error;
    }

    image.loveNotes.push({
      content,
      createdAt: new Date(),
    });

    await image.save();

    res.json({
      success: true,
      message: 'Đã thêm love note',
      data: image.loveNotes,
    });
  } catch (error) {
    next(error);
  }
};

const getTimeline = async (req, res, next) => {
  try {
    const { year, anniversary } = req.query;
    const hasPrivateAccess = canViewPrivate(req.user);

    let query = {};

    // Chỉ admin, Cường, Linh mới thấy private images trong timeline
    if (!hasPrivateAccess) {
      query.isPrivate = false;
    }

    // Filter theo anniversary nếu có
    if (anniversary === 'true') {
      query.isAnniversary = true;
    }

    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      query.takenAt = { $gte: startDate, $lte: endDate };
    }

    const images = await Image.find(query)
      .populate('album', 'title')
      .sort({ takenAt: -1, createdAt: -1 });

    // Nhóm theo tháng
    const timeline = {};

    images.forEach((image) => {
      const date = image.takenAt || image.createdAt;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!timeline[monthKey]) {
        timeline[monthKey] = [];
      }

      timeline[monthKey].push(image);
    });

    res.json({
      success: true,
      data: timeline,
    });
  } catch (error) {
    next(error);
  }
};

const getTodayInPast = async (req, res, next) => {
  try {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const hasPrivateAccess = canViewPrivate(req.user);

    // Tìm ảnh có cùng ngày tháng trong các năm trước
    let query = {
      $expr: {
        $and: [
          { $eq: [{ $month: '$takenAt' }, month] },
          { $eq: [{ $dayOfMonth: '$takenAt' }, day] },
        ],
      },
    };

    // Chỉ admin, Cường, Linh mới thấy private images
    if (!hasPrivateAccess) {
      query.isPrivate = false;
    }

    const images = await Image.find(query)
      .populate('album', 'title')
      .sort({ takenAt: -1 });

    res.json({
      success: true,
      count: images.length,
      data: images,
    });
  } catch (error) {
    next(error);
  }
};

const getAnniversaryTimeline = async (req, res, next) => {
  try {
    const hasPrivateAccess = canViewPrivate(req.user);

    let query = {
      isAnniversary: true,
    };

    // Chỉ admin, Cường, Linh mới thấy private images
    if (!hasPrivateAccess) {
      query.isPrivate = false;
    }

    const images = await Image.find(query)
      .populate('album', 'title')
      .sort({ anniversaryDays: 1, anniversaryDate: 1, takenAt: 1 });

    // Nhóm theo anniversaryDays
    const timeline = {};

    images.forEach((image) => {
      const days = image.anniversaryDays;
      if (days !== null && days !== undefined) {
        if (!timeline[days]) {
          timeline[days] = [];
        }
        timeline[days].push(image);
      }
    });

    res.json({
      success: true,
      count: images.length,
      data: timeline,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllImages,
  getImageById,
  uploadImages,
  updateImage,
  deleteImage,
  moveImage,
  reactToImage,
  addLoveNote,
  getTimeline,
  getTodayInPast,
  getAnniversaryTimeline,
};


