
import { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

export default function App() {
  const [data, setData] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("BIST Adı");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [minMax, setMinMax] = useState({ min: 0, max: 1 });

  // ---------- Dosya Yükleme ----------
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(ws, { defval: "" });
      setData(jsonData);
      setCurrentPage(1);
      const vals = jsonData.map((r) => toNumber(r["BIST Fiyatı"])).filter(Number.isFinite);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      setMinMax({ min, max: min === max ? min + 1 : max });
    };
    reader.readAsArrayBuffer(file);
  };

  // ---------- Sayıya Çevirme ----------
  const toNumber = (val) => {
    if (typeof val === "number") return val;
    if (typeof val !== "string") return Number(val) || 0;
    const cleaned = val.replace(/\./g, "").replace(",", ".");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  };

  // ---------- Dinamik Renk (7 skalalı) ----------
  const getColor = (value) => {
    const v = toNumber(value);
    const { min, max } = minMax;
    if (!Number.isFinite(v) || max === min) return "transparent";
    const p = Math.min(Math.max((v - min) / (max - min), 0), 1);
    const stops = [
      { p: 0.0, color: [255, 0, 0] },
      { p: 0.166, color: [255, 127, 0] },
      { p: 0.333, color: [255, 255, 0] },
      { p: 0.5, color: [0, 255, 0] },
      { p: 0.666, color: [0, 255, 255] },
      { p: 0.833, color: [0, 0, 255] },
      { p: 1.0, color: [139, 0, 255] },
    ];
    let c1 = stops[0], c2 = stops[stops.length - 1], t = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      if (p >= stops[i].p && p <= stops[i + 1].p) {
        c1 = stops[i]; c2 = stops[i + 1];
        t = (p - c1.p) / (c2.p - c1.p);
        break;
      }
    }
    const r = Math.round(c1.color[0] + (c2.color[0] - c1.color[0]) * t);
    const g = Math.round(c1.color[1] + (c2.color[1] - c1.color[1]) * t);
    const b = Math.round(c1.color[2] + (c2.color[2] - c1.color[2]) * t);
    return `rgb(${r},${g},${b})`;
  };

  // Kontrast için otomatik metin rengi
  const getTextColorForBg = (rgb) => {
    if (rgb === "transparent") return "#0f172a";
    const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!m) return "#0f172a";
    const r = +m[1], g = +m[2], b = +m[3];
    const L = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
    return L > 0.6 ? "#0f172a" : "#ffffff";
  };

  // ---------- Arama ----------
  const applySearch = () => { setSearchTerm(searchInput.trim()); setCurrentPage(1); };
  const clearSearch = () => { setSearchInput(""); setSearchTerm(""); setCurrentPage(1); };

  // ---------- Sıralama ----------
  const handleSortByName  = (order="asc") => { setSortKey("BIST Adı");   setSortOrder(order); setCurrentPage(1); };
  const handleSortByPrice = (order="asc") => { setSortKey("BIST Fiyatı"); setSortOrder(order); setCurrentPage(1); };

  // ---------- Filtre + Sıralama ----------
  const filtered = data.filter((row) => {
    if (!searchTerm) return true;
    return (row["BIST Adı"] || "").toString().toLowerCase().includes(searchTerm.toLowerCase());
  });
  const sortedFilteredData = [...filtered].sort((a,b) => {
    const aVal = a[sortKey], bVal = b[sortKey];
    if (["BIST Fiyatı","Açılış","Kapanış"].includes(sortKey)) {
      const an = toNumber(aVal), bn = toNumber(bVal);
      return sortOrder === "asc" ? an - bn : bn - an;
    }
    const as = (aVal ?? "").toString(), bs = (bVal ?? "").toString();
    return sortOrder === "asc" ? as.localeCompare(bs, "tr") : bs.localeCompare(as, "tr");
  });

  // ---------- Sayfalama ----------
  const totalPages = Math.max(1, Math.ceil(sortedFilteredData.length / itemsPerPage));
  const paginatedData = sortedFilteredData.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);
  const goFirst = () => setCurrentPage(1);
  const goPrev  = () => setCurrentPage((p) => Math.max(1, p-1));
  const goNext  = () => setCurrentPage((p) => Math.min(totalPages, p+1));
  const goLast  = () => setCurrentPage(totalPages);

  // ---------- Başlığa Tıklayarak Sıralama ----------
  const toggleSort = (key) => {
    if (sortKey === key) setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortOrder("asc"); }
    setCurrentPage(1);
  };
  const sortArrow = (key) => (sortKey === key ? (sortOrder === "asc" ? " ▲" : " ▼") : "");

  // ---------- Export ----------
  const exportToExcel = () => {
    if (!sortedFilteredData.length) return;
    const ws = XLSX.utils.json_to_sheet(sortedFilteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BIST Verileri");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" }),
      "bist_verileri.xlsx"
    );
  };
  const exportToPDF = () => {
    if (!sortedFilteredData.length) return;
    const doc = new jsPDF({ unit: "pt" });
    doc.setFontSize(14);
    doc.text("BIST Verileri", 40, 40);
    doc.autoTable({
      startY: 60,
      head: [["BIST Adı", "BIST Fiyatı", "Açılış", "Kapanış", "Görev"]],
      body: sortedFilteredData.map(r => [r["BIST Adı"], r["BIST Fiyatı"], r["Açılış"], r["Kapanış"], r["Görev"]]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [33,150,243] },
    });
    doc.save("bist_verileri.pdf");
  };

  // ---------- Stil ----------
  const page = {
    minHeight: "100vh",
    padding: 16,
    fontFamily: "Inter, system-ui, Arial",
    background: "#ffffff",
    color: "#0f172a",
    position: "relative",
    overflowX: "hidden",
  };
  const watermark = {
    position: "fixed",
    right: 0,
    top: "10vh",
    width: "65vw",
    maxWidth: 900,
    height: "70vh",
    backgroundImage: "url('/borsa-i-stanbul-logo-yatay.png')",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right center",
    backgroundSize: "contain",
    opacity: 0.12,
    pointerEvents: "none",
    zIndex: 0,
  };
  const container = { maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 };
  const header = { display: "flex", alignItems: "center", gap: 12, padding: "4px 0 12px" };
  const logoImg = { height: 28, objectFit: "contain" };

  const toolbar = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    background: "#ffffff",
    borderRadius: 10,
    padding: "12px 16px",
    boxShadow: "0 3px 10px rgba(0,0,0,0.06)",
    margin: "8px 0 12px",
  };
  const row = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, justifyContent: "center" };
  const label = { fontWeight: 700, marginRight: 6, color: "#0f172a" };
  const btn = {
    padding: "9px 12px",
    border: "1px solid #1769aa",
    background: "#ffffff",
    color: "#1769aa",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
    letterSpacing: "0.2px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  };
  const btnPrimary = { ...btn, background: "#1769aa", color: "#ffffff", border: "none" };
  const input = {
    padding: "10px 12px",
    border: "1px solid #1769aa",
    borderRadius: 8,
    minWidth: 240,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 600,
    outline: "none",
  };
  const tableWrap = { overflowX: "auto", background: "#fff", borderRadius: 8, padding: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" };
  const table = { width: "100%", borderCollapse: "collapse", minWidth: 720, background: "#fff", color: "#0f172a", fontSize: "14px" };
  const thtd = { border: "1px solid #e5e7eb", padding: "8px 10px", textAlign: "left", background: "#fff", color: "#0f172a", fontWeight: 600 };

  // ---------- Render ----------
  return (
    <div style={page}>
      <div style={watermark} />
      <div style={container}>
        <div style={header}>
          <img src="/borsa-i-stanbul-logo-yatay.png" alt="Borsa İstanbul" style={logoImg} />
          <h2 style={{ margin: 0 }}>BIST Dashboard</h2>
        </div>

        <div style={toolbar}>
          <div style={{ textAlign: "center" }}>
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
          </div>

          <div style={row}>
            <span style={label}>Arama:</span>
            <input
              style={input}
              type="text"
              placeholder="BIST adı ara..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
            />
            <button style={btnPrimary} onClick={applySearch}>Ara</button>
            <button style={btn} onClick={clearSearch}>Temizle</button>
          </div>

          <div style={row}>
            <span style={label}>Sıralama:</span>
            <button style={btn} onClick={() => handleSortByName("asc")}>Alfabetik A→Z</button>
            <button style={btn} onClick={() => handleSortByName("desc")}>Alfabetik Z→A</button>
            <button style={btn} onClick={() => handleSortByPrice("asc")}>Fiyat 1→100</button>
            <button style={btn} onClick={() => handleSortByPrice("desc")}>Fiyat 100→1</button>
          </div>

          <div style={row}>
            <button style={btnPrimary} onClick={exportToExcel}>Excel'e Aktar</button>
            <button style={btn} onClick={exportToPDF}>PDF'e Aktar</button>
          </div>
        </div>

        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          <strong>Toplam Kayıt:</strong> {sortedFilteredData.length} {" "}
          | <strong>Sayfa:</strong> {Math.min(currentPage, totalPages)} / {totalPages}
        </div>

        {paginatedData.length ? (
          <>
            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={thtd} onClick={() => toggleSort("BIST Adı")}>BIST Adı{sortArrow("BIST Adı")}</th>
                    <th style={thtd} onClick={() => toggleSort("BIST Fiyatı")}>BIST Fiyatı{sortArrow("BIST Fiyatı")}</th>
                    <th style={thtd} onClick={() => toggleSort("Açılış")}>Açılış{sortArrow("Açılış")}</th>
                    <th style={thtd} onClick={() => toggleSort("Kapanış")}>Kapanış{sortArrow("Kapanış")}</th>
                    <th style={thtd} onClick={() => toggleSort("Görev")}>Görev{sortArrow("Görev")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, i) => {
                    const bg = getColor(row["BIST Fiyatı"]);
                    const fg = getTextColorForBg(bg);
                    return (
                      <tr key={i}>
                        <td style={thtd}>{row["BIST Adı"]}</td>
                        <td style={{ ...thtd, backgroundColor: bg, color: fg, fontWeight: 700 }}>
                          {row["BIST Fiyatı"]}
                        </td>
                        <td style={thtd}>{row["Açılış"]}</td>
                        <td style={thtd}>{row["Kapanış"]}</td>
                        <td style={thtd}>{row["Görev"]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <button style={btn} onClick={goFirst} disabled={currentPage === 1}>İlk</button>
              <button style={btn} onClick={goPrev}  disabled={currentPage === 1}>←</button>
              <span>Sayfa {currentPage} / {totalPages}</span>
              <button style={btn} onClick={goNext}  disabled={currentPage === totalPages}>→</button>
              <button style={btn} onClick={goLast}  disabled={currentPage === totalPages}>Son</button>
            </div>
          </>
        ) : (
          <div style={{ marginTop: 8 }}>Görüntülenecek veri yok. Lütfen bir Excel dosyası yükleyin.</div>
        )}
      </div>
    </div>
  );
}