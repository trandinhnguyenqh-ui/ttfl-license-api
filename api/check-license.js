const { MongoClient } = require('mongodb');
const crypto = require('crypto');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Chỉ chấp nhận POST' });

    const { key, hwid } = req.body;
    if (!key || !hwid) return res.status(400).json({ success: false, message: 'Thiếu Key hoặc HWID!' });

    let client;
    try {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const collection = client.db('TTFL_Database').collection('Licenses');

        const safeKey = key.trim().toUpperCase();
        const license = await collection.findOne({ LicenseKey: safeKey });

        if (!license) return res.status(404).json({ success: false, message: 'Key bản quyền không tồn tại!' });

        // 1. Kiểm tra chống copy máy (Sai Mainboard)
        if (license.HWID && license.HWID !== "" && license.HWID !== hwid) {
            return res.status(403).json({ success: false, message: 'Key này đã kích hoạt trên thiết bị khác (Sai Mainboard)!' });
        }

        // ==========================================
        // 2. VERCEL TỰ ĐỘNG GHI CHÚ VÀO MONGODB
        // ==========================================
        const currentTime = new Date().toISOString();

        if (!license.HWID || license.HWID === "") {
            // Lần đầu kích hoạt -> Lưu HWID, Ngày Kích Hoạt và Lần Cuối Online
            await collection.updateOne(
                { LicenseKey: safeKey }, 
                { $set: { 
                    HWID: hwid, 
                    ActivationDate: currentTime,
                    LastSyncTime: currentTime
                }}
            );
        } else {
            // Đã kích hoạt rồi (AutoCAD tự đồng bộ ngầm) -> Chỉ cập nhật Lần Cuối Online
            await collection.updateOne(
                { LicenseKey: safeKey }, 
                { $set: { LastSyncTime: currentTime } }
            );
        }

        // ==========================================
        // 3. KIỂM TRA NGÀY HẾT HẠN THỰC TẾ TRONG DATABASE
        // ==========================================
        let expirationTime = null;
        if (license.ExpirationDate && license.ExpirationDate !== "") {
            expirationTime = new Date(license.ExpirationDate).getTime();
            if (Date.now() > expirationTime) {
                return res.status(403).json({ success: false, message: 'Key bản quyền của bạn đã HẾT HẠN sử dụng!' });
            }
        }

        // ==========================================
        // 4. TẠO GIẤY THÔNG HÀNH (OFFLINE TỐI ĐA 10 NGÀY)
        // ==========================================
        let offlineLimit = Date.now() + (10 * 24 * 60 * 60 * 1000); 
        
        // Nếu hạn sử dụng thật sự còn ít hơn 10 ngày -> Ép offlineLimit bằng đúng ngày hết hạn
        if (expirationTime && expirationTime < offlineLimit) {
            offlineLimit = expirationTime;
        }

        const payloadObject = {
            key: safeKey,
            hwid: hwid,
            validUntil: offlineLimit,
            realExpiration: expirationTime, // <-- THÊM DÒNG NÀY VÀO ĐÂY
            features: ["MENU_TONG", "BOCPCCC", "RAIEXIT"]
        };
        const payloadString = JSON.stringify(payloadObject);

        // KÝ BẰNG PRIVATE KEY (RSA)
        const privateKey = process.env.RSA_PRIVATE_KEY.replace(/\\n/g, '\n'); 
        const sign = crypto.createSign('SHA256');
        sign.update(payloadString);
        sign.end();
        
        return res.status(200).json({
            success: true,
            payload: payloadString,
            signature: sign.sign(privateKey, 'base64')
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + error.message });
    } finally {
        if (client) await client.close();
    }
}
