import { Component, type ErrorInfo, type ReactNode } from "react";

// Audit pra-soft-launch (19 Jul 2026): ditemukan crash nyata di production
// (ReferenceError di dalam chunk Workspace, kemungkinan dipicu kombinasi
// state ganti-bisnis) yang membuat SELURUH halaman menjadi kosong putih
// total -- tidak ada pesan error, tidak ada tombol, pengguna benar-benar
// buntu (harus tahu sendiri untuk reload). Root cause spesifiknya belum
// bisa dipastikan dari bundle production yang sudah di-minify (perlu
// source map/reproduksi di lokal) -- TAPI terlepas dari root cause itu,
// tidak adanya Error Boundary sama sekali di seluruh codebase adalah
// masalah tersendiri: React akan selalu unmount seluruh tree begitu ada
// error render yang tidak tertangkap, di MANA PUN persisnya bug itu ada
// sekarang atau nanti. Ini pagar pengaman generik, bukan pengganti dari
// memperbaiki bug aslinya.
//
// Sengaja class component (bukan hook) -- ini SATU-SATUNYA cara React
// menyediakan error boundary, tidak ada versi hooks-nya.
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught a render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
          <p className="text-4xl" aria-hidden="true">
            ⚠️
          </p>
          <h1 className="text-xl font-bold">Terjadi kesalahan tak terduga</h1>
          <p className="max-w-sm text-sm text-neutral-400">
            Halaman ini gagal dimuat. Datamu aman -- coba muat ulang. Kalau masalah berlanjut, hubungi kami lewat
            halaman Kontak.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-2xl bg-primary px-6 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
          >
            Muat Ulang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
