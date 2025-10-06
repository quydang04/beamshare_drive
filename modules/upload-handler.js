const multer = require('multer');
const path = require('path');
const fs = require('fs');

class UploadHandler {
    constructor() {
        this.setupMulter();
    }

    setupMulter() {
        // Multer configuration for file uploads
        const storage = multer.diskStorage({
            destination: function (req, file, cb) {
                const uploadPath = path.join(__dirname, '..', 'uploads');
                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }
                cb(null, uploadPath);
            },
            filename: function (req, file, cb) {
                // Generate unique filename with timestamp
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                const name = path.basename(file.originalname, ext);
                cb(null, name + '-' + uniqueSuffix + ext);
            }
        });

        this.upload = multer({ 
            storage: storage,
            limits: {
                fileSize: 2 * 1024 * 1024 * 1024 // 2GB limit
            },
            fileFilter: function (req, file, cb) {
                // Accept all file types for now
                cb(null, true);
            }
        });
    }

    // Enhanced file validation function
    validateUploadedFile(file) {
        const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
        const allowedTypes = [
            // Images
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml',
            // Documents
            'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain', 'text/csv', 'application/rtf',
            // Archives
            'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
            // Audio
            'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/mp4',
            // Video
            'video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska',
            // Code files
            'text/javascript', 'text/css', 'text/html', 'application/json', 'text/xml'
        ];

        // Check file size
        if (file.size > maxSize) {
            return {
                valid: false,
                error: `File "${file.originalname}" exceeds maximum size of 2GB`
            };
        }

        // Check file type (optional - can be disabled for more flexibility)
        if (process.env.STRICT_FILE_VALIDATION === 'true' && !allowedTypes.includes(file.mimetype)) {
            return {
                valid: false,
                error: `File type "${file.mimetype}" is not allowed for "${file.originalname}"`
            };
        }

        // Check filename for dangerous characters
        const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
        if (dangerousChars.test(file.originalname)) {
            return {
                valid: false,
                error: `Filename "${file.originalname}" contains invalid characters`
            };
        }

        // Check filename length
        if (file.originalname.length > 255) {
            return {
                valid: false,
                error: `Filename "${file.originalname}" is too long (max 255 characters)`
            };
        }

        return { valid: true };
    }

    // Get multer middleware for single file upload
    single(fieldName) {
        return this.upload.single(fieldName);
    }

    // Get multer middleware for multiple file upload
    array(fieldName, maxCount = 10) {
        return this.upload.array(fieldName, maxCount);
    }

    // Helper function to get original name from filename
    getOriginalName(filename) {
        // Handle files uploaded by multer (with timestamp and random numbers)
        // Format: originalname-timestamp-randomnumber.ext
        const parts = filename.split('-');

        if (parts.length >= 3) {
            // Check if last two parts are timestamp and random number
            const lastPart = parts[parts.length - 1]; // contains extension
            const secondLastPart = parts[parts.length - 2]; // random number
            const thirdLastPart = parts[parts.length - 3]; // timestamp

            // Check if they are numbers (timestamp and random)
            if (!isNaN(secondLastPart) && !isNaN(thirdLastPart)) {
                const ext = path.extname(lastPart);
                return parts.slice(0, -2).join('-') + ext;
            }
        }

        // Return filename as is if no pattern matches
        return filename;
    }
}

module.exports = UploadHandler;
