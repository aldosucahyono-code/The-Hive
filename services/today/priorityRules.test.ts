// services/today/priorityRules.test.ts
//
// Test otomatis untuk Rule Engine Mission Today (audit Juli 2026 -- lihat
// catatan lengkap di priorityRules.ts kenapa logika ini diekstrak jadi
// fungsi murni). Dijalankan via Node.js built-in test runner (`node --test`,
// tersedia sejak Node 18+, mendukung TypeScript langsung sejak Node 22 tanpa
// perlu ts-node/vitest/jest) -- SENGAJA tidak menambah dependency npm baru,
// konsisten dengan gaya proyek ini yang minim dependensi.
//
// Jalankan: npm test  (lihat "test" script di package.json)
//
// Cakupan: setiap skenario di sini mewakili satu kondisi nyata yang pernah
// (atau berpotensi) terjadi di data pengguna sungguhan -- bukan skenario
// abstrak. Kalau nanti Rule Engine diubah, test ini yang pertama kali akan
// bicara kalau ada perilaku yang tidak sengaja berubah.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
// Catatan: seluruh proyek ini memakai ekstensi ".js" di import (konvensi
// TypeScript+ESM standar, di-resolve tsc saat build) -- tapi file test ini
// dijalankan LANGSUNG oleh Node.js (bukan lewat tsc dulu, lihat komentar di
// atas), dan Node hanya mengenali ".ts" secara native, bukan ".js" yang
// menunjuk ke ".ts". Makanya khusus baris import ini pakai ".ts" eksplisit.
import { computeBusinessPulse, computePriorities, type PriorityRulesInput } from "./priorityRules.ts";

// Input dasar "bisnis sehat, baru saja update" -- tiap test men-override
// cuma field yang relevan, supaya niat tiap skenario jelas dari yang
// di-override-nya saja (bukan mengulang semua field tiap kali).
function baseInput(overrides: Partial<PriorityRulesInput> = {}): PriorityRulesInput {
  return {
    stageGroup: "running",
    daysSinceUpdate: 1,
    latestUpdatePencapaian: null,
    pendingFollowUpQuestion: null,
    targetStalled: false,
    newCompetitorName: null,
    healthDimensions: { marketing: 70, sales: 65, finance: 60, customer: 75, operations: 68, brand: 72 },
    nextMilestone: null,
    periodDelta: 0,
    ...overrides,
  };
}

describe("computeBusinessPulse", () => {
  test("fase persiapan -> selalu 'preparation', tanpa reason", () => {
    const { pulseLevel, pulseReasons } = computeBusinessPulse({
      stageGroup: "preparation",
      daysSinceUpdate: null,
      periodDelta: null,
    });
    assert.equal(pulseLevel, "preparation");
    assert.deepEqual(pulseReasons, []);
  });

  test("belum pernah update sama sekali -> action_required + reason neverUpdated", () => {
    const { pulseLevel, pulseReasons } = computeBusinessPulse({
      stageGroup: "running",
      daysSinceUpdate: null,
      periodDelta: null,
    });
    assert.equal(pulseLevel, "action_required");
    assert.deepEqual(pulseReasons, [{ key: "neverUpdated" }]);
  });

  test("update sudah >14 hari -> action_required + updateOverdue", () => {
    const { pulseLevel, pulseReasons } = computeBusinessPulse({
      stageGroup: "running",
      daysSinceUpdate: 15,
      periodDelta: 0,
    });
    assert.equal(pulseLevel, "action_required");
    assert.deepEqual(pulseReasons, [{ key: "updateOverdue", params: { days: 15 } }]);
  });

  test("tepat di batas 14 hari -> BUKAN action_required (masih 'attention', >14 baru action_required)", () => {
    const { pulseLevel } = computeBusinessPulse({ stageGroup: "running", daysSinceUpdate: 14, periodDelta: 0 });
    assert.equal(pulseLevel, "attention");
  });

  test("update 8 hari (di antara 7-14) -> attention + updateOverdue", () => {
    const { pulseLevel, pulseReasons } = computeBusinessPulse({
      stageGroup: "running",
      daysSinceUpdate: 8,
      periodDelta: 0,
    });
    assert.equal(pulseLevel, "attention");
    assert.deepEqual(pulseReasons, [{ key: "updateOverdue", params: { days: 8 } }]);
  });

  test("skor turun walau update masih baru -> attention + scoreDown", () => {
    const { pulseLevel, pulseReasons } = computeBusinessPulse({
      stageGroup: "running",
      daysSinceUpdate: 2,
      periodDelta: -5,
    });
    assert.equal(pulseLevel, "attention");
    assert.deepEqual(pulseReasons, [{ key: "scoreDown", params: { points: 5 } }]);
  });

  test("update baru + skor turun -> attention dengan DUA reason (updateOverdue tidak muncul karena <=7 hari)", () => {
    const { pulseReasons } = computeBusinessPulse({ stageGroup: "running", daysSinceUpdate: 9, periodDelta: -3 });
    assert.deepEqual(pulseReasons, [
      { key: "updateOverdue", params: { days: 9 } },
      { key: "scoreDown", params: { points: 3 } },
    ]);
  });

  test("update baru, skor naik -> stable + scoreUp", () => {
    const { pulseLevel, pulseReasons } = computeBusinessPulse({
      stageGroup: "running",
      daysSinceUpdate: 1,
      periodDelta: 4,
    });
    assert.equal(pulseLevel, "stable");
    assert.deepEqual(pulseReasons, [{ key: "scoreUp", params: { points: 4 } }]);
  });

  test("update baru, skor datar -> stable, tanpa reason", () => {
    const { pulseLevel, pulseReasons } = computeBusinessPulse({
      stageGroup: "running",
      daysSinceUpdate: 1,
      periodDelta: 0,
    });
    assert.equal(pulseLevel, "stable");
    assert.deepEqual(pulseReasons, []);
  });
});

describe("computePriorities — fase persiapan (cold-start)", () => {
  test("bisnis baru selalu dapat prioritas tunggal startFirstUpdate, tanpa risk/opportunity", () => {
    const { priorities, topRisk, opportunity } = computePriorities(
      baseInput({ stageGroup: "preparation", daysSinceUpdate: null, healthDimensions: null })
    );
    assert.deepEqual(priorities, [{ key: "startFirstUpdate", whyKey: "whyStartFirstUpdate" }]);
    assert.equal(topRisk, null);
    assert.equal(opportunity, null);
  });
});

describe("computePriorities — fase berjalan: kondisi data update", () => {
  test("belum pernah update (running) -> neverUpdatedYet, bukan inactivityWarning", () => {
    const { priorities } = computePriorities(baseInput({ daysSinceUpdate: null }));
    assert.equal(priorities[0].key, "neverUpdatedYet");
  });

  test("8 hari sejak update -> fillBusinessUpdate (pengingat lembut)", () => {
    const { priorities } = computePriorities(baseInput({ daysSinceUpdate: 8 }));
    assert.equal(priorities[0].key, "fillBusinessUpdate");
    assert.deepEqual(priorities[0].params, { days: 8 });
  });

  test("tepat 7 hari -> BELUM masuk fillBusinessUpdate (ambang > 7, bukan >=)", () => {
    const { priorities } = computePriorities(baseInput({ daysSinceUpdate: 7 }));
    assert.notEqual(priorities[0]?.key, "fillBusinessUpdate");
  });

  test("10 hari sejak update -> inactivityWarning (peringatan lebih keras)", () => {
    const { priorities } = computePriorities(baseInput({ daysSinceUpdate: 10 }));
    assert.equal(priorities[0].key, "inactivityWarning");
    assert.deepEqual(priorities[0].params, { days: 10 });
  });

  test("9 hari -> masih fillBusinessUpdate, BELUM inactivityWarning (ambang >=10)", () => {
    const { priorities } = computePriorities(baseInput({ daysSinceUpdate: 9 }));
    assert.equal(priorities[0].key, "fillBusinessUpdate");
  });

  test("update overdue >14 hari -> topRisk riskUpdateOverdue (prioritas tertinggi di antara risk lain)", () => {
    const { topRisk } = computePriorities(baseInput({ daysSinceUpdate: 20, periodDelta: -10 }));
    assert.equal(topRisk?.key, "riskUpdateOverdue");
    assert.deepEqual(topRisk?.params, { days: 20 });
  });
});

describe("computePriorities — apresiasi pencapaian", () => {
  test("update <=2 hari + pencapaian substantif -> celebrateAchievement masuk daftar", () => {
    const { priorities } = computePriorities(
      baseInput({ daysSinceUpdate: 1, latestUpdatePencapaian: "Omzet naik drastis minggu ini" })
    );
    assert.ok(priorities.some((p) => p.key === "celebrateAchievement"));
  });

  test("pencapaian terlalu pendek (<10 karakter/<2 kata) -> TIDAK dianggap substantif", () => {
    const { priorities } = computePriorities(baseInput({ daysSinceUpdate: 1, latestUpdatePencapaian: "lumayan" }));
    assert.ok(!priorities.some((p) => p.key === "celebrateAchievement"));
  });

  test("pencapaian ada tapi update sudah >2 hari -> TIDAK muncul (harus terbaru)", () => {
    const { priorities } = computePriorities(
      baseInput({ daysSinceUpdate: 5, latestUpdatePencapaian: "Omzet naik drastis minggu ini" })
    );
    assert.ok(!priorities.some((p) => p.key === "celebrateAchievement"));
  });

  test("pencapaian kosong ('') -> tidak dianggap substantif", () => {
    const { priorities } = computePriorities(baseInput({ daysSinceUpdate: 0, latestUpdatePencapaian: "" }));
    assert.ok(!priorities.some((p) => p.key === "celebrateAchievement"));
  });
});

describe("computePriorities — sinyal Business OS Engine", () => {
  test("ada pendingFollowUpQuestion -> decisionFollowUp masuk, pertanyaan dipotong 120 karakter", () => {
    const longQuestion = "x".repeat(200);
    const { priorities } = computePriorities(baseInput({ pendingFollowUpQuestion: longQuestion }));
    const item = priorities.find((p) => p.key === "decisionFollowUp");
    assert.ok(item);
    assert.equal((item!.params!.question as string).length, 120);
  });

  test("targetStalled true -> targetStalled masuk daftar prioritas", () => {
    const { priorities } = computePriorities(baseInput({ targetStalled: true }));
    assert.ok(priorities.some((p) => p.key === "targetStalled"));
  });

  test("newCompetitorName terisi -> newCompetitorDetected masuk dengan nama kompetitor", () => {
    const { priorities } = computePriorities(baseInput({ newCompetitorName: "Kaisar Salon" }));
    const item = priorities.find((p) => p.key === "newCompetitorDetected");
    assert.deepEqual(item?.params, { name: "Kaisar Salon" });
  });
});

describe("computePriorities — dimensi terlemah & peluang", () => {
  test("dimensi terlemah selalu masuk sebagai focusWeakDimension dengan skor terendah", () => {
    const { priorities } = computePriorities(
      baseInput({ healthDimensions: { marketing: 90, sales: 30, finance: 60 } })
    );
    const item = priorities.find((p) => p.key === "focusWeakDimension");
    assert.deepEqual(item?.params, { dimension: "sales", score: 30 });
  });

  test("dimensi terlemah <45 -> JUGA jadi topRisk riskWeakDimension (kalau tidak ada risk lebih mendesak)", () => {
    const { topRisk } = computePriorities(baseInput({ healthDimensions: { marketing: 90, sales: 40 } }));
    assert.equal(topRisk?.key, "riskWeakDimension");
    assert.deepEqual(topRisk?.params, { dimension: "sales", score: 40 });
  });

  test("dimensi terlemah >=45 -> TIDAK jadi topRisk (masih di atas ambang bahaya)", () => {
    const { topRisk } = computePriorities(baseInput({ healthDimensions: { marketing: 90, sales: 45 } }));
    assert.notEqual(topRisk?.key, "riskWeakDimension");
  });

  test("opportunity mengikuti lookup tetap sesuai dimensi terlemah (marketing -> opportunityMarketing)", () => {
    const { opportunity } = computePriorities(
      baseInput({ healthDimensions: { marketing: 20, sales: 80, finance: 80 } })
    );
    assert.equal(opportunity?.key, "opportunityMarketing");
  });

  test("dimensi tidak ada di lookup -> jatuh ke opportunityGeneric", () => {
    const { opportunity } = computePriorities(baseInput({ healthDimensions: { entahApa: 10, sales: 90 } }));
    assert.equal(opportunity?.key, "opportunityGeneric");
  });

  test("healthDimensions null (belum ada data Business Health) -> tidak ada focusWeakDimension/opportunity", () => {
    const { priorities, opportunity } = computePriorities(baseInput({ healthDimensions: null }));
    assert.ok(!priorities.some((p) => p.key === "focusWeakDimension"));
    assert.equal(opportunity, null);
  });
});

describe("computePriorities — urutan risiko (risk hierarchy)", () => {
  test("update overdue >14 hari MENGALAHKAN skor turun sebagai topRisk", () => {
    const { topRisk } = computePriorities(baseInput({ daysSinceUpdate: 20, periodDelta: -10 }));
    assert.equal(topRisk?.key, "riskUpdateOverdue");
  });

  test("tanpa update overdue, skor turun MENGALAHKAN dimensi lemah sebagai topRisk", () => {
    const { topRisk } = computePriorities(
      baseInput({ daysSinceUpdate: 1, periodDelta: -8, healthDimensions: { marketing: 20 } })
    );
    assert.equal(topRisk?.key, "riskScoreDown");
    assert.deepEqual(topRisk?.params, { points: 8 });
  });

  test("tidak ada sinyal negatif sama sekali -> topRisk null (jujur, tidak dipaksakan)", () => {
    const { topRisk } = computePriorities(
      baseInput({ daysSinceUpdate: 1, periodDelta: 0, healthDimensions: { marketing: 80, sales: 75 } })
    );
    assert.equal(topRisk, null);
  });
});

describe("computePriorities — milestone & fallback", () => {
  test("nextMilestone hampir tercapai (<30% tersisa) -> achievementNudge masuk", () => {
    const { priorities } = computePriorities(
      baseInput({
        nextMilestone: { remaining: 2, titleId: "Judul", titleEn: "Title", remainingRatio: 0.1 },
      })
    );
    assert.ok(priorities.some((p) => p.key === "achievementNudge"));
  });

  test("nextMilestone masih jauh (>=30% tersisa) -> achievementNudge TIDAK masuk", () => {
    const { priorities } = computePriorities(
      baseInput({
        nextMilestone: { remaining: 20, titleId: "Judul", titleEn: "Title", remainingRatio: 0.8 },
      })
    );
    assert.ok(!priorities.some((p) => p.key === "achievementNudge"));
  });

  test("tidak ada satupun kondisi terpenuhi -> fallback keepGoing supaya tidak pernah kosong", () => {
    const { priorities } = computePriorities(
      baseInput({ daysSinceUpdate: 1, periodDelta: 0, healthDimensions: null, nextMilestone: null })
    );
    assert.deepEqual(priorities, [{ key: "keepGoing", whyKey: "whyKeepGoing" }]);
  });

  test("maksimal 5 prioritas walau lebih banyak kondisi terpenuhi sekaligus", () => {
    const { priorities } = computePriorities(
      baseInput({
        daysSinceUpdate: 8, // fillBusinessUpdate
        pendingFollowUpQuestion: "Soal ekspansi cabang baru?", // decisionFollowUp
        targetStalled: true, // targetStalled
        newCompetitorName: "Kompetitor X", // newCompetitorDetected
        healthDimensions: { marketing: 30, sales: 90 }, // focusWeakDimension
        nextMilestone: { remaining: 1, titleId: "A", titleEn: "A", remainingRatio: 0.05 }, // achievementNudge
      })
    );
    assert.equal(priorities.length, 5);
  });
});

describe("computePriorities — setiap item punya whyKey yang bisa dijelaskan (transparansi ranking)", () => {
  test("semua kunci prioritas yang dikenal Rule Engine punya penjelasan whyKey", () => {
    const knownKeys = [
      "startFirstUpdate",
      "fillBusinessUpdate",
      "inactivityWarning",
      "neverUpdatedYet",
      "focusWeakDimension",
      "achievementNudge",
      "keepGoing",
      "decisionFollowUp",
      "celebrateAchievement",
      "targetStalled",
      "newCompetitorDetected",
    ];
    // Skenario yang memicu SEMUA prioritas sekaligus (kecuali cap 5 -- cek
    // whyKey harus tetap ada untuk yang tampil).
    const { priorities } = computePriorities(
      baseInput({
        daysSinceUpdate: 8,
        latestUpdatePencapaian: "Omzet naik signifikan minggu ini",
        pendingFollowUpQuestion: "Soal ekspansi?",
        targetStalled: true,
        newCompetitorName: "Kompetitor X",
        healthDimensions: { marketing: 30, sales: 90 },
        nextMilestone: { remaining: 1, titleId: "A", titleEn: "A", remainingRatio: 0.05 },
      })
    );
    for (const p of priorities) {
      assert.ok(knownKeys.includes(p.key), `key tidak dikenal: ${p.key}`);
      assert.ok(p.whyKey, `prioritas '${p.key}' tidak punya whyKey -- Mission Today tidak akan bisa jelaskan alasannya ke user`);
    }
  });
});
