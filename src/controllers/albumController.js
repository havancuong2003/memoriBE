const Album = require('../models/Album');
const Image = require('../models/Image');

// Helper function để check user có quyền xem private (admin, Cường, Linh)
const canViewPrivate = (user) => {
  if (!user) return false;
  // Admin luôn có quyền xem tất cả
  if (user.role === 'admin') return true;
  // Cường và Linh có quyền xem private
  const specialEmails = ['cuong@123.com', 'linh@123.com'];
  return specialEmails.includes(user.email?.toLowerCase());
};

const getAllAlbums = async (req, res, next) => {
  try {
    const { search, tag, year, isPublic, hasVideo, hasImage, startDate, endDate } = req.query;
    const hasPrivateAccess = canViewPrivate(req.user);

    let query = {};

    // Filter theo private/public - chỉ áp dụng nếu user không có quyền xem private
    if (isPublic !== undefined) {
      const isPublicValue = isPublic === 'true' || isPublic === true;
      query.isPublic = isPublicValue;
    } else if (!hasPrivateAccess) {
      // Nếu không có quyền và không filter cụ thể, chỉ hiển thị public
      query.isPublic = true;
    }

    // Tìm kiếm theo text
    if (search) {
      query.$text = { $search: search };
    }

    // Filter theo tag
    if (tag) {
      query.tags = { $in: [tag] };
    }

    // Filter theo date range (ưu tiên date range hơn year)
    if (startDate || endDate) {
      const dateQuery = {};
      if (startDate) {
        dateQuery.$gte = new Date(startDate);
      }
      if (endDate) {
        dateQuery.$lte = new Date(endDate);
      }
      query.$or = [
        { eventDate: dateQuery },
        { createdAt: dateQuery },
      ];
    } else if (year) {
      // Filter theo năm nếu không có date range
      const yearStartDate = new Date(`${year}-01-01`);
      const yearEndDate = new Date(`${year}-12-31`);
      query.$or = [
        { eventDate: { $gte: yearStartDate, $lte: yearEndDate } },
        { createdAt: { $gte: yearStartDate, $lte: yearEndDate } },
      ];
    }

    const albums = await Album.find(query)
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 });

    // Thêm số lượng ảnh/video cho mỗi album và check hasVideo/hasImage
    const albumsWithCount = await Promise.all(
      albums.map(async (album) => {
        const imageCount = await Image.countDocuments({ album: album._id, type: 'image' });
        const videoCount = await Image.countDocuments({ album: album._id, type: 'video' });
        const totalCount = imageCount + videoCount;
        
        // Filter theo hasVideo/hasImage
        if (hasVideo === 'true' && videoCount === 0) {
          return null;
        }
        if (hasImage === 'true' && imageCount === 0) {
          return null;
        }
        if (hasVideo === 'false' && videoCount > 0) {
          return null;
        }
        if (hasImage === 'false' && imageCount > 0) {
          return null;
        }

        return {
          ...album.toObject(),
          imageCount: totalCount,
          imageOnlyCount: imageCount,
          videoCount,
          hasVideo: videoCount > 0,
          hasImage: imageCount > 0,
        };
      })
    );

    // Loại bỏ null values
    const filteredAlbums = albumsWithCount.filter(album => album !== null);

    res.json({
      success: true,
      count: filteredAlbums.length,
      data: filteredAlbums,
    });
  } catch (error) {
    next(error);
  }
};

const getAlbumById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.query;

    const album = await Album.findById(id).populate('createdBy', 'email');

    if (!album) {
      const error = new Error('Không tìm thấy album');
      error.statusCode = 404;
      throw error;
    }

    // Kiểm tra quyền xem private album
    const hasPrivateAccess = canViewPrivate(req.user);
    if (!album.isPublic && !hasPrivateAccess) {
      const error = new Error('Bạn không có quyền xem album này');
      error.statusCode = 403;
      throw error;
    }

    // Kiểm tra password nếu album có password
    if (album.password && album.password !== password) {
      const error = new Error('Mật khẩu album không đúng');
      error.statusCode = 403;
      throw error;
    }

    // Lấy images - filter private nếu không có quyền
    let imageQuery = { album: id };
    if (!hasPrivateAccess) {
      imageQuery.isPrivate = false;
    }

    const images = await Image.find(imageQuery).sort({ takenAt: -1, createdAt: -1 });

    res.json({
      success: true,
      data: {
        ...album.toObject(),
        images,
      },
    });
  } catch (error) {
    next(error);
  }
};

const createAlbum = async (req, res, next) => {
  try {
    const { title, description, password, tags, eventDate, location, isPublic } = req.body;

    const album = await Album.create({
      title,
      description,
      password,
      tags: tags || [],
      eventDate: eventDate ? new Date(eventDate) : undefined,
      location,
      isPublic: isPublic !== undefined ? isPublic : true,
      createdBy: req.user.userId,
    });

    res.status(201).json({
      success: true,
      message: 'Tạo album thành công',
      data: album,
    });
  } catch (error) {
    next(error);
  }
};

const updateAlbum = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, password, tags, eventDate, location, isPublic, coverImage } = req.body;

    const album = await Album.findById(id);

    if (!album) {
      const error = new Error('Không tìm thấy album');
      error.statusCode = 404;
      throw error;
    }

    // Chỉ admin, Cường, Linh mới được update
    const hasAdminAccess = req.user.role === 'admin' || canViewPrivate(req.user);
    if (!hasAdminAccess) {
      const error = new Error('Không có quyền chỉnh sửa album này');
      error.statusCode = 403;
      throw error;
    }

    Object.assign(album, {
      title: title || album.title,
      description: description !== undefined ? description : album.description,
      password: password !== undefined ? password : album.password,
      tags: tags || album.tags,
      eventDate: eventDate ? new Date(eventDate) : album.eventDate,
      location: location !== undefined ? location : album.location,
      isPublic: isPublic !== undefined ? isPublic : album.isPublic,
      coverImage: coverImage || album.coverImage,
    });

    await album.save();

    res.json({
      success: true,
      message: 'Cập nhật album thành công',
      data: album,
    });
  } catch (error) {
    next(error);
  }
};

const updateCoverImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { imageId } = req.body; // Nếu chọn từ ảnh trong album

    const album = await Album.findById(id);

    if (!album) {
      const error = new Error('Không tìm thấy album');
      error.statusCode = 404;
      throw error;
    }

    // Chỉ admin, Cường, Linh mới được update
    const hasAdminAccess = req.user.role === 'admin' || canViewPrivate(req.user);
    if (!hasAdminAccess) {
      const error = new Error('Không có quyền chỉnh sửa album này');
      error.statusCode = 403;
      throw error;
    }

    let coverImageUrl = null;

    // Nếu có imageId, lấy từ ảnh trong album
    if (imageId) {
      const Image = require('../models/Image');
      const image = await Image.findById(imageId);
      if (image && image.album?.toString() === id) {
        coverImageUrl = image.thumbnailUrl || image.url;
      } else {
        const error = new Error('Ảnh không thuộc album này');
        error.statusCode = 400;
        throw error;
      }
    } 
    // Nếu có file upload, upload lên Cloudinary
    else if (req.file) {
      coverImageUrl = req.file.secure_url || req.file.url;
    } else {
      const error = new Error('Vui lòng chọn ảnh hoặc upload file');
      error.statusCode = 400;
      throw error;
    }

    album.coverImage = coverImageUrl;
    await album.save();

    res.json({
      success: true,
      message: 'Đã cập nhật ảnh đại diện album',
      data: album,
    });
  } catch (error) {
    next(error);
  }
};

const deleteAlbum = async (req, res, next) => {
  try {
    const { id } = req.params;

    const album = await Album.findById(id);

    if (!album) {
      const error = new Error('Không tìm thấy album');
      error.statusCode = 404;
      throw error;
    }

    // Chỉ admin, Cường, Linh mới được xóa
    const hasAdminAccess = req.user.role === 'admin' || canViewPrivate(req.user);
    if (!hasAdminAccess) {
      const error = new Error('Không có quyền xóa album này');
      error.statusCode = 403;
      throw error;
    }

    // Xóa tất cả ảnh trong album
    await Image.deleteMany({ album: id });

    // Xóa album
    await Album.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Xóa album thành công',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllAlbums,
  getAlbumById,
  createAlbum,
  updateAlbum,
  updateCoverImage,
  deleteAlbum,
};


