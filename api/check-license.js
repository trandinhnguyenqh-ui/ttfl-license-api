const { MongoClient } = require('mongodb');

// Vercel sẽ tự động đọc biến môi trường MONGODB_URI (chứa mật khẩu)
const uri = process.env.MONGODB_URI; 
const client = new MongoClient(uri);

export default async function handler(req, res) {
    // Chỉ nhận request dạng POST từ file phần mềm gửi lên
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Chỉ chấp nhận phương thức POST' });
    }

    const { key, hwid } = req.body;

    if (!key || !hwid) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin Key hoặc Mã máy (HWID)!' });
    }

    try {
        await client.connect();
        // Tên Database là TTFL_Database, tên bảng là Licenses
        const database = client.db('TTFL_Database'); 
        const collection = database.collection('Licenses');

        // 1. Tìm Key trong Database
        const license = await collection.findOne({ LicenseKey: key });

        if (!license) {
            return res.status(401).json({ success: false, message: 'Key TTFL không tồn tại!' });
        }

        // 2. Kiểm tra hạn sử dụng
        const today = new Date();
        const expDate = new Date(license.ExpiryDate);
        if (today > expDate) {
            return res.status(401).json({ success: false, message: 'Key TTFL của bạn đã hết hạn!' });
        }

        // 3. Cơ chế khóa 1 máy (HWID Binding)
        if (!license.HWID || license.HWID === "") {
            // Lần đầu sử dụng -> Ghi nhận mã máy mới
            await collection.updateOne(
                { LicenseKey: key },
                { $set: { HWID: hwid } }
            );
            return res.status(200).json({ success: true, message: 'Kích hoạt TTFL trên máy mới thành công!' });
        } else if (license.HWID !== hwid) {
            // Đã có HWID nhưng không khớp máy hiện tại
            return res.status(401).json({ success: false, message: 'Key này đã được kích hoạt trên một thiết bị khác!' });
        }

        // Mọi thứ hợp lệ
        return res.status(200).json({ success: true, message: 'Xác thực bản quyền TTFL thành công!' });

    } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + error.message });
    } finally {
        await client.close();
    }
}
