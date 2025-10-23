# Caro AI Arena - Hướng dẫn Tùy chỉnh & Cài đặt Online

Chào mừng bạn đến với Caro AI Arena! Tài liệu này sẽ hướng dẫn bạn cách tùy chỉnh tài sản và **thiết lập chế độ chơi online** bằng Firebase.

## Phần 1: Tùy chỉnh Tài sản (Avatar, Âm thanh)

### 1. Cấu trúc Thư mục Tài sản

Tất cả các tài sản công cộng (hình ảnh, âm thanh) nên được đặt trong thư mục `public`. Nếu thư mục này chưa tồn tại ở gốc dự án của bạn, hãy tạo nó. Bên trong `public`, hãy tạo các thư mục con sau:

```
/public
|-- /assets
|   |-- /avatars
|   |   |-- avatar_1.png
|   |   |-- bot_1.png
|   |   |-- ...
|   |-- /sounds
|   |   |-- music.mp3
|   |   |-- move.mp3
|   |   |-- ...
|   |-- /themes
|   |   |-- ice.png
|   |   |-- ...
```

### 2. Thêm Avatar Tùy chỉnh

**Bước 1:** Chuẩn bị hình ảnh (PNG, 128x128 pixels).

**Bước 2:** Sao chép tệp vào thư mục `/public/assets/avatars/`.

**Bước 3:** Đăng ký Avatar trong tệp `constants.tsx` trong mảng `AVATARS`, chỉ định `id`, `name`, và `url` (đường dẫn từ thư mục `public`).

**Ví dụ:**
```typescript
// Trong file: constants.tsx
export const AVATARS: Avatar[] = [
    // ...
    { id: 'avatar_my_cool_one', name: 'Cool Avatar', url: 'assets/avatars/my_cool_avatar.png' },
];
```

### 3. Thêm Âm thanh và Nhạc nền

**Hiệu ứng Âm thanh:**
Sao chép các tệp âm thanh (`.mp3`, `.wav`) vào `/public/assets/sounds/`. Tên tệp phải khớp chính xác với danh sách trong `hooks/useSound.ts` (ví dụ: `move.mp3`, `win.mp3`).

**Nhạc nền:**
Sao chép tệp nhạc vào `/public/assets/sounds/` và đăng ký trong `constants.tsx` trong mảng `MUSIC_TRACKS`.

---

## Phần 2: Cài đặt Chế độ Chơi Online (Bắt buộc)

Chế độ online yêu cầu một dự án Firebase. Hãy làm theo các bước sau một cách cẩn thận.

### Bước 1: Tạo Dự án Firebase

1.  Truy cập [Firebase Console](https://console.firebase.google.com/).
2.  Nhấp vào "Add project" (Thêm dự án) và làm theo hướng dẫn để tạo một dự án mới. Đặt tên bất kỳ bạn muốn.

### Bước 2: Tạo một Ứng dụng Web

1.  Trong trang tổng quan dự án của bạn, nhấp vào biểu tượng Web `</>`.
2.  Đặt tên cho ứng dụng của bạn (ví dụ: "Caro Arena Web").
3.  Nhấp vào "Register app" (Đăng ký ứng dụng).
4.  Bạn sẽ thấy một đối tượng cấu hình `firebaseConfig`. **SAO CHÉP TOÀN BỘ ĐỐI TƯỢNG NÀY.** Bạn sẽ cần nó ở Bước 6.

### Bước 3: Kích hoạt Authentication

1.  Trong menu bên trái, đi tới "Authentication".
2.  Nhấp vào "Get started" (Bắt đầu).
3.  Trong tab "Sign-in method" (Phương thức đăng nhập), kích hoạt hai nhà cung cấp sau:
    *   **Email/Password** (Email/Mật khẩu)
    *   **Anonymous** (Ẩn danh)

### Bước 4: Thiết lập Cơ sở dữ liệu (Firestore & Realtime Database)

Bạn sẽ cần cả hai cơ sở dữ liệu cho hệ thống online.

**A. Firestore Database:**
1.  Trong menu bên trái, đi tới "Firestore Database".
2.  Nhấp vào "Create database" (Tạo cơ sở dữ liệu).
3.  Chọn **Start in production mode** (Bắt đầu ở chế độ sản xuất).
4.  Chọn một vị trí máy chủ (thường là khu vực gần bạn nhất).
5.  Nhấp "Enable" (Kích hoạt).
6.  Sau khi tạo xong, đi tới tab **Rules** (Quy tắc) và dán toàn bộ nội dung sau, sau đó nhấp **Publish**:
    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        // User profiles: can be read publicly, but only the owner can write.
        match /users/{userId} {
          allow read: if true;
          allow write: if request.auth != null && request.auth.uid == userId;

          // Match history can only be written and read by the user themselves.
          match /matchHistory/{gameId} {
            allow read, write: if request.auth != null && request.auth.uid == userId;
          }
        }

        // Online user presence:
        match /onlineUsers/{userId} {
            // Any authenticated user can read the presence information of any other user.
            // This is necessary for the lobby to display who is online.
            allow read: if request.auth != null;

            // A user can create or delete their OWN presence document.
            allow create, delete: if request.auth != null && request.auth.uid == userId;
            
            // Update permissions:
            // 1. A user can update their own document.
            // 2. Any user can update another user's status to 'in_game' for matchmaking.
            allow update: if request.auth != null && (
                (request.auth.uid == userId) ||
                (
                    request.resource.data.status == 'in_game' &&
                    (resource.data.status == 'idle' || resource.data.status == 'in_queue')
                )
            );
        }
        
        // Matchmaking queue: Authenticated users can create their own queue entry.
        // Any authenticated user can delete any entry. This is necessary for matchmaking
        // where one user removes both themselves and their opponent from the queue.
        match /matchmakingQueue/{userId} {
            allow read: if request.auth != null;
            allow create: if request.auth.uid == userId;
            allow delete: if request.auth != null;
        }

        // Invitations: Can be read/deleted by invitee, created/updated by inviter.
        match /invitations/{inviteeId} {
            allow read, delete: if request.auth != null && request.auth.uid == inviteeId;
            allow create, update: if request.auth != null && request.auth.uid == request.resource.data.from;
        }

        // Games: Only players involved can interact with a game document.
        match /games/{gameId} {
            // Helper function to check if the requesting user is a player in the game
            function isPlayer(docData) {
              return request.auth != null && (request.auth.uid == docData.players.X || request.auth.uid == docData.players.O);
            }

            // Allow players to read and update an existing game.
            allow read, update, delete: if isPlayer(resource.data);

            // Allow a user to create a game only if they are one of the players listed in the new document.
            allow create: if isPlayer(request.resource.data);
        }
      }
    }
    ```

**B. Realtime Database (dành cho Presence System):**
1.  Trong menu bên trái, bên dưới "Firestore Database", nhấp vào **Realtime Database**.
2.  Nhấp vào "Create Database" (Tạo cơ sở dữ liệu).
3.  Chọn một vị trí máy chủ.
4.  Chọn **Start in locked mode** (Bắt đầu ở chế độ khóa).
5.  Nhấp "Enable" (Kích hoạt).
6.  Sau khi tạo xong, đi tới tab **Rules** (Quy tắc) và dán toàn bộ nội dung sau, sau đó nhấp **Publish**:
    ```json
    {
      "rules": {
        "status": {
          ".read": "auth != null",
          "$uid": {
            ".write": "auth != null && auth.uid == $uid"
          }
        }
      }
    }
    ```

### Bước 5: Thêm Gói Firebase vào Dự án

Mở terminal trong thư mục dự án của bạn và chạy lệnh sau:
```bash
npm install firebase
```

### Bước 6: Cấu hình Ứng dụng

1.  Mở tệp `firebaseConfig.ts` trong dự án của bạn.
2.  Bạn sẽ thấy một đối tượng `firebaseConfig` mẫu. **THAY THẾ NÓ** bằng đối tượng bạn đã sao chép ở Bước 2.

**Ví dụ:**
```typescript
// Trong file: firebaseConfig.ts

// Dán cấu hình Firebase của bạn vào đây
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project-id.firebaseapp.com",
  databaseURL: "https://your-project-id.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
```

### Bước 7: Chạy Ứng dụng

Sau khi hoàn thành tất cả các bước trên, bạn có thể chạy ứng dụng. Chế độ online giờ đây sẽ hoạt động! Mở hai tab trình duyệt để tự kiểm tra các tính năng như mời và chơi game.

---

## Phần 3: Ghi chú cho Môi trường Production

### Dọn dẹp Dữ liệu Tự động

Trong môi trường thực tế, người chơi có thể bỏ ngang trận đấu, để lại các phòng game "mồ côi" trong cơ sở dữ liệu của bạn. Mặc dù ứng dụng có cơ chế dọn dẹp phía client, cách tốt nhất để xử lý việc này là sử dụng **Firebase Cloud Functions**.

Bạn có thể viết một hàm Cloud Function chạy theo lịch (ví dụ, mỗi giờ một lần) để quét và xóa các phòng game cũ chưa được hoàn thành. Điều này giúp giữ cho cơ sở dữ liệu của bạn gọn gàng và hiệu quả.

Chúc bạn tùy chỉnh và thi đấu vui vẻ!