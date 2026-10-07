export default function handler(req, res) {
  res.status(200).json({
    Version: "1.0.1",
    // Bản 2024 trở xuống vẫn tải file cũ như bình thường
    Url2024: "https://github.com/trandinhnguyenqh-ui/ttfl-license-api/raw/refs/heads/main/menu_pccc.dll",
    // Bản 2025 sẽ tải file mới
    Url2025: "https://github.com/trandinhnguyenqh-ui/ttfl-license-api/raw/refs/heads/main/menu_pccc_2025.dll",
    ReleaseNotes: "Cập nhật tính năng Trợ lý AI, Fix lỗi UI và hỗ trợ AutoCAD 2025."
  });
}
