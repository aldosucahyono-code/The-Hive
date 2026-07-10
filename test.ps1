[System.Net.ServicePointManager]::Expect100Continue = $false

$body = @{
  tier = "pro"
  wizardData = @{
    jenisAnalisis = "berjalan"
    nama = "Aldo"
    email = "test@test.com"
    namaBisnis = "Apotek Sehat"
    jenisBisnis = "Apotek"
    lokasi = "Pasar Besar, Malang"
    tantangan = "Omset turun karena banyak apotek baru buka di sekitar lokasi"
    target = "Omset naik 30% dalam 6 bulan ke depan"
  }
} | ConvertTo-Json

Write-Host "Mengirim permintaan ke server production, tunggu 15-60 detik..."
Invoke-WebRequest -Uri "https://the-hive-khaki.vercel.app/api/generate-report" -Method POST -Body $body -ContentType "application/json" -OutFile "test-laporan-pro.pdf"
Write-Host "Selesai! Cek file test-laporan-pro.pdf"