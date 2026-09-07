const { MongoClient } = require('mongodb');
const crypto = require('crypto');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Chỉ chấp nhận POST' });
    }

    const { key, hwid } = req.body;
    if (!key || !hwid) {
        return res.status(400).json({ success: false, message: 'Thiếu Key hoặc HWID!' });
    }

    let client;
    try {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const collection = client.db('TTFL_Database').collection('Licenses');

        const safeKey = key.trim().toUpperCase();
        const license = await collection.findOne({ LicenseKey: safeKey });

        if (!license) {
            return res.status(404).json({ success: false, message: 'Key bản quyền không tồn tại!' });
        }

        // Kiểm tra HWID (Chỉ khóa Mainboard)
        if (license.HWID && license.HWID !== "" && license.HWID !== hwid) {
            return res.status(403).json({ success: false, message: 'Key này đã được kích hoạt trên thiết bị khác (Sai Mainboard)!' });
        }

        // Lần đầu kích hoạt -> Lưu HWID vào Database
        if (!license.HWID || license.HWID === "") {
            await collection.updateOne({ LicenseKey: safeKey }, { $set: { HWID: hwid } });
        }

        // 1. TẠO PAYLOAD (Giấy thông hành offline 10 ngày)
        const payloadObject = {
            key: safeKey,
            hwid: hwid,
            validUntil: Date.now() + (10 * 24 * 60 * 60 * 1000),
            features: ["MENU_TONG", "BOCPCCC", "RAIEXIT"]
        };
        const payloadString = JSON.stringify(payloadObject);

        // 2. KÝ BẰNG PRIVATE KEY
        const privateKey = process.env.RSA_PRIVATE_KEY.replace(/\\n/g, '\n'); 
        
        const sign = crypto.createSign('SHA256');
        sign.update(payloadString);
        sign.end();
        const signature = sign.sign(privateKey, 'base64');

        // 3. TRẢ VỀ CHO C#
        return res.status(200).json({
            success: true,
            payload: payloadString,
            signature: signature
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + error.message });
    } finally {
        if (client) {
            await client.close();
        }
    }
}
