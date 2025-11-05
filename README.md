# BeamShare Drive

Một ứng dụng Cloud Storage (Drive) đơn giản — giao diện tĩnh + backend Express. README này giới thiệu nhanh về dự án, cách cài đặt, chạy và cấu trúc mã nguồn.

## Tổng quan

BeamShare Drive là một project mẫu cung cấp chức năng lưu trữ/chia sẻ tệp, quản lý người dùng, và xử lý upload/recycle. Frontend được phục vụ từ thư mục `public/` và các route API được xử lý bởi `server.js` cùng các module trong `modules/`.

Kỹ thuật chính:
- Node.js (Express)
- MongoDB (sử dụng `mongoose` để quản lý dữ liệu)
- Multer cho upload tệp
- WebSocket (`ws`) cho một số tính năng chia sẻ/notify
- Vue (tương tác phía client được phục vụ trong `public/js`)

Phiên bản và script (tham khảo `package.json`):

- name: `beamshare-drive`
- version: `1.0.0`
- scripts:
  - `start`: `node server.js`
  - `dev`: `node server.js --dev`

## Yêu cầu

- Node.js >= 14
- MongoDB chạy cục bộ hoặc qua URI kết nối

## Cài đặt

Mở terminal (PowerShell trên Windows) tại thư mục dự án và chạy:

```powershell
npm install
```

Sau khi cài xong, cần đặt biến môi trường (hoặc tạo file `.env`) cho kết nối MongoDB, secret JWT, và các cấu hình khác. Ví dụ (tạo file `.env`):

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/beamshare
JWT_SECRET=your_jwt_secret_here
```

## Chạy ứng dụng

- Chạy ở chế độ production:

```powershell
npm start
```

- Chạy ở chế độ dev (nếu cần):

```powershell
npm run dev
```

Theo mặc định server sẽ lắng nghe cổng được cấu hình trong biến môi trường `PORT` hoặc cổng mặc định trong `server.js`.

## Cấu trúc chính của dự án

- `server.js` - entrypoint của server Express.
- `package.json` - phụ thuộc và script chạy.
- `modules/` - các module chính:
  - `file-service/` - logic upload, conflict handling, file DB, WS server
  - `middleware/` - middleware (ví dụ: `auth-middleware.js`)
  - `models/` - các schema mongoose (user, file metadata, payment...)
  - `services/` - dịch vụ phụ trợ (email, payment)
- `public/` - tài nguyên tĩnh (HTML, CSS, JS client)
- `uploads/` - thư mục lưu trữ file upload (ví dụ các folder theo uuid)

## Biến môi trường quan trọng

- `PORT` - cổng server
- `MONGODB_URI` - URI kết nối MongoDB
- `JWT_SECRET` - secret để ký JWT
- Các biến cho email/stripe/vnpay nếu dự án sử dụng dịch vụ bên thứ 3 (tham khảo `modules/services`)

## Phát triển & đóng góp

- Thêm issue hoặc PR nếu bạn muốn đóng góp.
- Kiểm tra `modules/` để hiểu luồng upload và xử lý xung đột (`conflict-handler.js`).

## Lưu ý

- Thư mục `uploads/` có thể chứa tệp người dùng; sao lưu và quản lý quyền truy cập thật cẩn thận khi triển khai thực tế.

## License

Theo `package.json` mặc định là `ISC` (bạn có thể đổi sang license phù hợp trước khi public dự án).

---
