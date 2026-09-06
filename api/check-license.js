const { MongoClient } = require('mongodb');

export default async function handler(req, res) {
    // 1. Chỉ nhận lệnh từ AutoCAD gửi lên
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Chỉ chấp nhận phương thức POST' });
    }

    const { key, hwid } = req.body;
    if (!key || !hwid) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin Key hoặc Mã máy (HWID)!' });
    }

    let client;

    try {
        // 2. KHỞI TẠO KẾT NỐI BÊN TRONG HÀM (Chống treo Vercel)
        const uri = process.env.MONGODB_URI;
        client = new MongoClient(uri);
        await client.connect();

        const database = client.db('TTFL_Database');
        const collection = database.collection('Licenses');

        // 3. Tìm Key trong Database
        const license = await collection.findOne({ LicenseKey: key });

        // 4. Các lớp kiểm tra bảo mật
        if (!license) {
            return res.status(404).json({ success: false, message: 'Key bản quyền không tồn tại!' });
        }

        if (license.HWID && license.HWID !== "" && license.HWID !== hwid) {
            return res.status(403).json({ success: false, message: 'Key này đã được kích hoạt trên một máy tính khác!' });
        }

        // 5. Nếu mọi thứ Ok -> Cấp phép
        return res.status(200).json({ success: true, message: 'Xác thực bản quyền TTFL thành công!' });

    } catch (error) {
        // Bắt lỗi rõ ràng nếu sai link MongoDB
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + error.message });
    } finally {
        // 6. LUÔN LUÔN ĐÓNG CỬA SAU KHI DÙNG XONG (Triệt tiêu 100% lỗi treo 30s)
        if (client) {
            await client.close();
        }
    }
}
