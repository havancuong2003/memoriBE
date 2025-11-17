const Anniversary = require('../models/Anniversary');
const Image = require('../models/Image');
const Album = require('../models/Album');

// Helper function để tính số ngày từ ngày kỷ niệm đến hiện tại
// Luôn trả về số dương (số ngày đã trôi qua từ ngày kỷ niệm)
const calculateAnniversaryDays = (date) => {
  if (!date) return null;
  const now = new Date();
  const targetDate = new Date(date);
  // Reset time về 00:00:00 để tính chính xác số ngày
  now.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = now - targetDate; // Đảo ngược: hiện tại - ngày kỷ niệm
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : 0; // Luôn trả về số dương
};

// Helper function để check user có quyền xem private (admin, Cường, Linh)
const canViewPrivate = (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const specialEmails = ['cuong@123.com', 'linh@123.com'];
  return specialEmails.includes(user.email?.toLowerCase());
};

const getAllAnniversaries = async (req, res, next) => {
  try {
    const { year, search } = req.query;
    const hasPrivateAccess = canViewPrivate(req.user);

    let query = {};

    if (!hasPrivateAccess) {
      query.isPrivate = false;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      query.anniversaryDate = { $gte: startDate, $lte: endDate };
    }

    const anniversaries = await Anniversary.find(query)
      .populate('images', 'title thumbnailUrl url takenAt isPrivate type resourceType _id')
      .populate('albums', 'title coverImage isPublic _id')
      .populate('createdBy', 'email')
      .sort({ anniversaryDate: -1 }); // Sắp xếp theo ngày kỷ niệm

    // Tính lại anniversaryDays từ anniversaryDate cho mỗi anniversary
    anniversaries.forEach((anniversary) => {
      if (anniversary.anniversaryDate) {
        anniversary.anniversaryDays = calculateAnniversaryDays(anniversary.anniversaryDate);
      }
    });

    // Sắp xếp lại theo anniversaryDays sau khi tính
    anniversaries.sort((a, b) => {
      const daysA = a.anniversaryDays ?? Infinity;
      const daysB = b.anniversaryDays ?? Infinity;
      return daysA - daysB; // Số ngày nhỏ (gần nhất) lên trên
    });

    res.json({
      success: true,
      count: anniversaries.length,
      data: anniversaries,
    });
  } catch (error) {
    next(error);
  }
};

const getAnniversaryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const hasPrivateAccess = canViewPrivate(req.user);

    const anniversary = await Anniversary.findById(id)
      .populate({
        path: 'images',
        select: 'title thumbnailUrl url takenAt isPrivate type resourceType _id',
        populate: {
          path: 'album',
          select: 'title isPublic',
        },
        options: { strictPopulate: false },
      })
      .populate('albums', 'title coverImage isPublic _id')
      .populate('createdBy', 'email');

    if (!anniversary) {
      const error = new Error('Không tìm thấy kỷ niệm');
      error.statusCode = 404;
      throw error;
    }

    if (!anniversary.isPublic && !hasPrivateAccess) {
      const error = new Error('Bạn không có quyền xem kỷ niệm này');
      error.statusCode = 403;
      throw error;
    }

    // Tính lại anniversaryDays từ anniversaryDate
    if (anniversary.anniversaryDate) {
      anniversary.anniversaryDays = calculateAnniversaryDays(anniversary.anniversaryDate);
    }

    res.json({
      success: true,
      data: anniversary,
    });
  } catch (error) {
    next(error);
  }
};

const createAnniversary = async (req, res, next) => {
  try {
    const { title, description, anniversaryDate, images, albums, tags, location, isPrivate, showInTimeline } = req.body;

    if (!title) {
      const error = new Error('Tiêu đề là bắt buộc');
      error.statusCode = 400;
      throw error;
    }

    // anniversaryDate không bắt buộc, nếu không có thì dùng null
    const date = anniversaryDate ? new Date(anniversaryDate) : null;
    const anniversaryDays = anniversaryDate ? calculateAnniversaryDays(date) : null;

    // Kiểm tra images và albums có tồn tại không
    if (images && images.length > 0) {
      const existingImages = await Image.find({ _id: { $in: images } });
      if (existingImages.length !== images.length) {
        const error = new Error('Một số ảnh không tồn tại');
        error.statusCode = 400;
        throw error;
      }
    }

    if (albums && albums.length > 0) {
      const existingAlbums = await Album.find({ _id: { $in: albums } });
      if (existingAlbums.length !== albums.length) {
        const error = new Error('Một số album không tồn tại');
        error.statusCode = 400;
        throw error;
      }
    }

    const anniversary = await Anniversary.create({
      title,
      description,
      anniversaryDate: date !== null ? date : null, // Luôn set giá trị (null hoặc Date), không dùng undefined
      anniversaryDays: anniversaryDays !== null ? anniversaryDays : null, // Luôn set giá trị (null hoặc Number), không dùng undefined
      images: images || [],
      albums: albums || [],
      tags: tags || [],
      location: location ? (typeof location === 'string' ? JSON.parse(location) : location) : undefined,
      isPrivate: isPrivate !== undefined ? isPrivate : false,
      showInTimeline: showInTimeline !== undefined ? showInTimeline : true,
      createdBy: req.user.userId,
    });

    const populatedAnniversary = await Anniversary.findById(anniversary._id)
      .populate({
        path: 'images',
        select: 'title thumbnailUrl url takenAt isPrivate type resourceType _id',
        populate: {
          path: 'album',
          select: 'title isPublic',
        },
        options: { strictPopulate: false },
      })
      .populate('albums', 'title coverImage isPublic _id')
      .populate('createdBy', 'email');

    res.status(201).json({
      success: true,
      message: 'Tạo kỷ niệm thành công',
      data: populatedAnniversary,
    });
  } catch (error) {
    next(error);
  }
};

const updateAnniversary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, anniversaryDate, images, albums, tags, location, isPrivate, showInTimeline } = req.body;

    const anniversary = await Anniversary.findById(id);

    if (!anniversary) {
      const error = new Error('Không tìm thấy kỷ niệm');
      error.statusCode = 404;
      throw error;
    }

    // Chỉ admin, Cường, Linh mới được update
    const hasAdminAccess = req.user.role === 'admin' || canViewPrivate(req.user);
    if (!hasAdminAccess || anniversary.createdBy.toString() !== req.user.userId) {
      const error = new Error('Bạn không có quyền chỉnh sửa kỷ niệm này');
      error.statusCode = 403;
      throw error;
    }

    let anniversaryDays = anniversary.anniversaryDays;
    let date = anniversary.anniversaryDate;

    if (anniversaryDate) {
      date = new Date(anniversaryDate);
      anniversaryDays = calculateAnniversaryDays(date);
      if (anniversaryDays === null) {
        const error = new Error('Ngày kỷ niệm phải sau ngày 22/02/2022');
        error.statusCode = 400;
        throw error;
      }
    }

    // Kiểm tra images và albums nếu có update
    if (images !== undefined) {
      if (images.length > 0) {
        const existingImages = await Image.find({ _id: { $in: images } });
        if (existingImages.length !== images.length) {
          const error = new Error('Một số ảnh không tồn tại');
          error.statusCode = 400;
          throw error;
        }
      }
      anniversary.images = images;
    }

    if (albums !== undefined) {
      if (albums.length > 0) {
        const existingAlbums = await Album.find({ _id: { $in: albums } });
        if (existingAlbums.length !== albums.length) {
          const error = new Error('Một số album không tồn tại');
          error.statusCode = 400;
          throw error;
        }
      }
      anniversary.albums = albums;
    }

    Object.assign(anniversary, {
      title: title !== undefined ? title : anniversary.title,
      description: description !== undefined ? description : anniversary.description,
      anniversaryDate: date,
      anniversaryDays,
      tags: tags !== undefined ? tags : anniversary.tags,
      location: location !== undefined ? (typeof location === 'string' ? JSON.parse(location) : location) : anniversary.location,
      isPrivate: isPrivate !== undefined ? isPrivate : anniversary.isPrivate,
      showInTimeline: showInTimeline !== undefined ? showInTimeline : anniversary.showInTimeline,
    });

    await anniversary.save();

    const populatedAnniversary = await Anniversary.findById(anniversary._id)
      .populate({
        path: 'images',
        select: 'title thumbnailUrl url takenAt isPrivate type resourceType _id',
        populate: {
          path: 'album',
          select: 'title isPublic',
        },
        options: { strictPopulate: false },
      })
      .populate('albums', 'title coverImage isPublic _id')
      .populate('createdBy', 'email');

    res.json({
      success: true,
      message: 'Cập nhật kỷ niệm thành công',
      data: populatedAnniversary,
    });
  } catch (error) {
    next(error);
  }
};

const deleteAnniversary = async (req, res, next) => {
  try {
    const { id } = req.params;

    const anniversary = await Anniversary.findById(id);

    if (!anniversary) {
      const error = new Error('Không tìm thấy kỷ niệm');
      error.statusCode = 404;
      throw error;
    }

    // Chỉ admin, Cường, Linh mới được xóa
    const hasAdminAccess = req.user.role === 'admin' || canViewPrivate(req.user);
    if (!hasAdminAccess || anniversary.createdBy.toString() !== req.user.userId) {
      const error = new Error('Bạn không có quyền xóa kỷ niệm này');
      error.statusCode = 403;
      throw error;
    }

    await Anniversary.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Xóa kỷ niệm thành công',
    });
  } catch (error) {
    next(error);
  }
};

const getAnniversaryTimeline = async (req, res, next) => {
  try {
    const hasPrivateAccess = canViewPrivate(req.user);

    // Lấy TẤT CẢ kỷ niệm, chỉ filter theo isPrivate nếu user không có quyền
    let query = {};

    if (!hasPrivateAccess) {
      query.isPrivate = false;
    }

    const anniversaries = await Anniversary.find(query)
      .populate({
        path: 'images',
        select: 'title thumbnailUrl url takenAt isPrivate type resourceType _id',
        populate: {
          path: 'album',
          select: 'title isPublic',
        },
        // Bỏ qua các images không tồn tại (đã bị xóa)
        options: { strictPopulate: false },
      })
      .populate('albums', 'title coverImage isPublic _id')
      .sort({ anniversaryDate: -1 }); // Sắp xếp theo ngày kỷ niệm

    // Nhóm theo anniversaryDays - luôn tính lại từ anniversaryDate
    const timeline = {};

    anniversaries.forEach((anniversary) => {
      // Lọc bỏ các images null (đã bị xóa)
      if (anniversary.images) {
        anniversary.images = anniversary.images.filter(img => img !== null && img !== undefined);
      }
      
      // Luôn tính lại anniversaryDays từ anniversaryDate
      let days;
      if (anniversary.anniversaryDate) {
        days = calculateAnniversaryDays(anniversary.anniversaryDate);
        // Cập nhật giá trị anniversaryDays trong object
        anniversary.anniversaryDays = days;
      } else {
        // Nếu không có anniversaryDate, nhóm vào "null"
        days = 'null';
      }
      
      // Nếu vẫn là null/undefined sau khi tính, nhóm vào "null"
      if (days === null || days === undefined) {
        days = 'null';
      }
      
      if (!timeline[days]) {
        timeline[days] = [];
      }
      timeline[days].push(anniversary);
    });

    res.json({
      success: true,
      count: anniversaries.length,
      data: timeline,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllAnniversaries,
  getAnniversaryById,
  createAnniversary,
  updateAnniversary,
  deleteAnniversary,
  getAnniversaryTimeline,
};

