// Helper navigasi bersama, dipakai Navbar & Footer.
// Selalu reload penuh supaya semua state (wizard, dsb) benar-benar reset
// dan halaman tujuan (termasuk halaman legal/ulasan/referensi) pasti tampil.
export function hardNavigate(hash: string) {
  const base = window.location.origin + window.location.pathname;
  const target = base + "?r=" + Date.now() + (hash ? "#" + hash : "");
  window.location.href = target;
}
