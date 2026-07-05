type LegalPageProps = {
  type: "privasi" | "syarat" | "refund";
};

function PrivacyContent() {
  return (
    <>
      <h1 className="mb-2 text-3xl font-extrabold">Kebijakan Privasi</h1>
      <p className="mb-8 text-sm text-neutral-500">Terakhir diperbarui: Juli 2026</p>

      <div className="space-y-6 text-sm leading-relaxed text-neutral-300">

        <p>
          THE HIVE - kami menghargai privasi Anda. Kebijakan ini menjelaskan data
          apa saja yang kami kumpulkan, bagaimana data itu diproses, dan hak Anda
          atas data tersebut, sesuai dengan Undang-Undang Nomor 27 Tahun 2022
          tentang Pelindungan Data Pribadi (UU PDP) Indonesia.
        </p>

        <div>
          <h2 className="mb-2 font-bold text-white">1. Data yang Kami Kumpulkan</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Data identitas: nama, profesi</li>
            <li>Data bisnis: nama bisnis, jenis bisnis, lokasi, sejak kapan berjalan atau rencana bisnis baru, target pelanggan, estimasi omset/modal</li>
            <li>Data naratif: tantangan bisnis dan target/harapan yang Anda tuliskan sendiri</li>
            <li>Data transaksi: status dan bukti pembayaran (nomor referensi transaksi), diproses oleh mitra payment gateway kami — kami tidak menyimpan detail kartu/rekening Anda</li>
            <li>Data teknis: alamat IP dan jenis perangkat, digunakan semata untuk keamanan sistem dan mencegah penyalahgunaan</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">2. Dasar & Tujuan Pemrosesan Data</h2>
          <p>Kami memproses data Anda berdasarkan persetujuan yang Anda berikan saat mengisi formulir, untuk tujuan:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Menghasilkan analisis bisnis yang Anda minta (gratis maupun berbayar)</li>
            <li>Memproses dan mengonfirmasi pembayaran laporan lengkap</li>
            <li>Menghubungi Anda terkait status laporan atau dukungan pelanggan</li>
            <li>Meningkatkan akurasi dan kualitas metodologi analisis kami secara agregat (tanpa mengidentifikasi Anda secara personal)</li>
          </ul>
          <p className="mt-2">
            Kami <strong className="text-white">tidak pernah menjual</strong> data Anda kepada
            pihak ketiga untuk kepentingan periklanan, dan tidak menggunakan data
            bisnis Anda untuk kepentingan pesaing Anda.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">3. Pihak Ketiga yang Terlibat</h2>
          <p>Untuk menjalankan layanan, data Anda dapat diproses oleh pemroses data berikut, sebatas yang diperlukan untuk fungsinya masing-masing:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong className="text-white">Penyedia layanan AI</strong> (Anthropic) — memproses data bisnis Anda untuk menghasilkan analisis</li>
            <li><strong className="text-white">Payment gateway</strong> — memproses transaksi pembayaran Anda secara aman</li>
            <li><strong className="text-white">Penyedia hosting & database</strong> — menyimpan data Anda secara terenkripsi</li>
            <li><strong className="text-white">Google Places API</strong> (jika relevan dengan jenis bisnis Anda) — digunakan untuk mencari data kompetitor publik berdasarkan lokasi yang Anda berikan, bukan data pribadi Anda</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">4. Keamanan Data</h2>
          <p>
            Kami menerapkan enkripsi saat transmisi data (HTTPS), pembatasan akses
            internal, dan pemantauan sistem untuk mencegah akses tidak sah. Namun
            perlu dipahami tidak ada sistem yang 100% bebas risiko — kami akan
            segera menginformasikan Anda apabila terjadi insiden keamanan yang
            berdampak pada data Anda, sesuai kewajiban UU PDP.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">5. Berapa Lama Data Disimpan</h2>
          <p>
            Data bisnis dan hasil analisis Anda disimpan selama akun/riwayat Anda
            aktif, agar Anda bisa mengunduh ulang laporan kapan saja. Data akan
            dihapus dari sistem kami paling lambat 30 hari setelah Anda mengajukan
            permintaan penghapusan.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">6. Hak Anda Sebagai Subjek Data</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Meminta salinan data yang kami simpan tentang Anda</li>
            <li>Meminta koreksi data yang tidak akurat atau tidak lengkap</li>
            <li>Meminta penghapusan data Anda ("hak untuk dilupakan")</li>
            <li>Menarik persetujuan penggunaan data kapan saja, tanpa mempengaruhi keabsahan pemrosesan sebelumnya</li>
            <li>Mengajukan keberatan atas keputusan yang dibuat semata berdasarkan pemrosesan otomatis</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">7. Anak di Bawah Umur</h2>
          <p>
            Layanan kami ditujukan untuk pelaku usaha berusia 18 tahun ke atas.
            Kami tidak dengan sengaja mengumpulkan data dari anak di bawah umur.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">8. Perubahan Kebijakan</h2>
          <p>
            Kami dapat memperbarui kebijakan ini sewaktu-waktu mengikuti
            perkembangan layanan atau regulasi. Perubahan material akan
            diinformasikan melalui halaman ini dengan tanggal pembaruan terbaru.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">9. Kontak</h2>
          <p>
            Pertanyaan, permintaan data, atau keluhan seputar privasi dapat
            disampaikan melalui email resmi THE HIVE.
          </p>
        </div>

      </div>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <h1 className="mb-2 text-3xl font-extrabold">Syarat & Ketentuan</h1>
      <p className="mb-8 text-sm text-neutral-500">Terakhir diperbarui: Juli 2026</p>

      <div className="space-y-6 text-sm leading-relaxed text-neutral-300">

        <p>
          Dengan mengakses atau menggunakan THE HIVE, Anda dianggap telah membaca,
          memahami, dan menyetujui syarat & ketentuan berikut secara penuh.
        </p>

        <div>
          <h2 className="mb-2 font-bold text-white">1. Tentang Layanan</h2>
          <p>
            THE HIVE adalah platform analisis bisnis berbasis kecerdasan buatan
            (AI) yang menghasilkan laporan analisis berdasarkan data yang Anda
            masukkan sendiri. Laporan ini bersifat{" "}
            <strong className="text-white">rekomendasi awal untuk membantu pengambilan
            keputusan</strong>, dan bukan merupakan nasihat hukum, keuangan,
            akuntansi, atau bisnis yang mengikat secara profesional.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">2. Kelayakan Pengguna</h2>
          <p>
            Layanan ini ditujukan untuk individu berusia 18 tahun ke atas yang
            memiliki kapasitas hukum untuk mengikatkan diri pada perjanjian ini,
            baik sebagai perorangan maupun mewakili badan usaha.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">3. Akurasi Data & Tanggung Jawab Pengguna</h2>
          <p>
            Kualitas dan akurasi hasil analisis sangat bergantung pada kelengkapan
            dan kejujuran data yang Anda masukkan. Anda bertanggung jawab penuh
            atas kebenaran data yang diberikan. THE HIVE tidak bertanggung jawab
            atas kerugian yang timbul dari keputusan bisnis yang diambil
            berdasarkan data yang tidak akurat, tidak lengkap, atau menyesatkan.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">4. Pembayaran & Harga</h2>
          <p>
            Laporan lengkap tersedia setelah pembayaran berhasil dikonfirmasi
            melalui mitra payment gateway resmi kami. Harga yang berlaku adalah
            harga yang tertera pada saat transaksi dilakukan, dan dapat berubah
            sewaktu-waktu untuk transaksi berikutnya (termasuk penyesuaian harga
            setelah masa beta berakhir sesuai informasi di halaman Paket Bisnis).
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">5. Penggunaan yang Dilarang</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Memasukkan data palsu, menyesatkan, atau data milik pihak lain tanpa izin</li>
            <li>Mencoba meretas, membebani sistem secara berlebihan (spam), atau menyalahgunakan celah teknis</li>
            <li>Menggunakan bot atau automasi untuk mengakses layanan tanpa izin tertulis</li>
            <li>Menggunakan layanan untuk tujuan ilegal atau melanggar hak pihak ketiga</li>
            <li>Menjual kembali atau mendistribusikan ulang laporan kami secara komersial tanpa izin</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">6. Hak Kekayaan Intelektual</h2>
          <p>
            Laporan analisis yang Anda terima menjadi hak Anda untuk digunakan
            dalam keperluan bisnis Anda sendiri. Sistem, kode, desain, metodologi
            analisis, dan merek THE HIVE tetap menjadi hak milik eksklusif kami
            dan dilindungi hukum kekayaan intelektual yang berlaku.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">7. Batasan Tanggung Jawab</h2>
          <p>
            Sepanjang diizinkan oleh hukum yang berlaku, THE HIVE tidak
            bertanggung jawab atas kerugian tidak langsung, kehilangan
            keuntungan, atau kerugian konsekuensial lain yang timbul dari
            penggunaan layanan ini. Tanggung jawab kami, jika ada, dibatasi
            maksimal sebesar jumlah yang Anda bayarkan untuk layanan terkait.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">8. Hukum yang Berlaku</h2>
          <p>
            Syarat & ketentuan ini diatur dan ditafsirkan berdasarkan hukum
            Republik Indonesia. Setiap perselisihan akan diupayakan diselesaikan
            secara musyawarah terlebih dahulu sebelum menempuh jalur hukum.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">9. Perubahan Layanan & Ketentuan</h2>
          <p>
            Kami dapat memperbarui fitur, harga, atau ketentuan ini sewaktu-waktu
            sesuai perkembangan produk. Perubahan material akan diinformasikan
            melalui halaman ini.
          </p>
        </div>

      </div>
    </>
  );
}

function RefundContent() {
  return (
    <>
      <h1 className="mb-2 text-3xl font-extrabold">Kebijakan Refund</h1>
      <p className="mb-8 text-sm text-neutral-500">Terakhir diperbarui: Juli 2026</p>

      <div className="space-y-6 text-sm leading-relaxed text-neutral-300">

        <p>
          Karena laporan analisis bisnis dihasilkan secara khusus (personalisasi)
          berdasarkan data yang Anda masukkan sendiri dan bersifat produk digital,
          kami menerapkan kebijakan refund yang jelas sebagai berikut.
        </p>

        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/30">
              <tr>
                <th className="p-3 font-semibold text-white">Situasi</th>
                <th className="p-3 font-semibold text-white">Berhak Refund?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              <tr>
                <td className="p-3">Pembayaran berhasil, tapi laporan gagal dibuat karena kesalahan sistem kami</td>
                <td className="p-3 text-primary">Ya, refund penuh</td>
              </tr>
              <tr>
                <td className="p-3">Laporan berhasil dibuat, tapi isinya kosong/error/tidak sesuai data yang dimasukkan</td>
                <td className="p-3 text-primary">Ya, refund penuh</td>
              </tr>
              <tr>
                <td className="p-3">Laporan berhasil dibuat dengan benar, tapi Anda berubah pikiran</td>
                <td className="p-3 text-neutral-400">Tidak</td>
              </tr>
              <tr>
                <td className="p-3">Data yang Anda masukkan ternyata salah/tidak lengkap dari pihak Anda sendiri</td>
                <td className="p-3 text-neutral-400">Tidak</td>
              </tr>
              <tr>
                <td className="p-3">Pembayaran ganda (double charge) karena kegagalan sistem</td>
                <td className="p-3 text-primary">Ya, kelebihan dikembalikan</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="mb-2 font-bold text-white">Cara Mengajukan Refund</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Hubungi kami melalui email resmi dalam waktu maksimal 3 hari sejak transaksi</li>
            <li>Sertakan bukti pembayaran (nomor referensi/invoice) dan penjelasan kendala yang dialami</li>
            <li>Tim kami akan meninjau pengajuan Anda maksimal 3 hari kerja</li>
            <li>Jika disetujui, dana dikembalikan ke metode pembayaran asal dalam 7-14 hari kerja (mengikuti kebijakan payment gateway)</li>
          </ol>
        </div>

      </div>
    </>
  );
}

function LegalPage({ type }: LegalPageProps) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      {type === "privasi" && <PrivacyContent />}
      {type === "syarat" && <TermsContent />}
      {type === "refund" && <RefundContent />}
    </section>
  );
}

export default LegalPage;
