import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse Cloudinary URL if provided
let cloudinaryConfig = null;

if (process.env.CLOUDINARY_URL) {
  const url = process.env.CLOUDINARY_URL;
  const match = url.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
  if (match) {
    cloudinaryConfig = {
      api_key: match[1],
      api_secret: match[2],
      cloud_name: match[3],
    };
  }
} else if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinaryConfig = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  };
}

if (cloudinaryConfig) {
  cloudinary.config(cloudinaryConfig);
  console.log("Cloudinary configured successfully");
}

// Local storage configuration
const uploadsDir = join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = file.originalname.split(".").pop();
    const prefix = file.mimetype.startsWith("video/") ? "video" : "image";
    cb(null, `${prefix}-${uniqueSuffix}.${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

export default upload;

// Video upload (larger size)
export const uploadVideo = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"), false);
    }
  },
});

// Combined upload for video and image (for reels: video + thumbnail)
export const uploadReelFiles = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max (for videos)
  },
  fileFilter: (req, file, cb) => {
    // Accept both video and image files
    if (file.mimetype.startsWith("video/") || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video and image files are allowed"), false);
    }
  },
});

// Product media: images + videos + color-specific photos
export const uploadProductMedia = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB for videos
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/") || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video and image files are allowed"), false);
    }
  },
}).fields([
  { name: "images", maxCount: 10 },
  { name: "colorPhotos", maxCount: 30 },
  { name: "videos", maxCount: 5 },
]);

// Helper function to upload to Cloudinary
export const uploadToCloudinary = async (filePath) => {
  if (!cloudinaryConfig) {
    return null;
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "ecommerce",
    });
    // Delete local file after upload
    fs.unlinkSync(filePath);
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return null;
  }
};

// Helper function to get image URL
export const getImageUrl = async (file) => {
  if (cloudinaryConfig) {
    const cloudinaryUrl = await uploadToCloudinary(file.path);
    if (cloudinaryUrl) {
      return cloudinaryUrl;
    }
  }
  // Return local file path
  return `/uploads/${file.filename}`;
};

export const getVideoUrl = async (file) => {
  if (cloudinaryConfig) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "ecommerce",
        resource_type: "video",
      });
      fs.unlinkSync(file.path);
      return result.secure_url;
    } catch (error) {
      console.error("Cloudinary video upload error:", error);
      // fall through to local
    }
  }
  return `/uploads/${file.filename}`;
};
