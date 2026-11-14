import { describe, expect, it } from "vitest";
import { calculateFee } from "./calculator";
describe("calculateFee", () => {
  it("menghasilkan contoh pembagian Rp1.600.000 dengan tepat", () => {
    const r = calculateFee({
      contractValue: 1600000,
      managerBps: 1500,
      hunterBps: 500,
      cashBps: 500,
      dj: 300000,
      mc2: 250000,
      soundman: 150000,
    });
    expect(r).toMatchObject({
      manager: 240000,
      hunter: 80000,
      cash: 80000,
      mc1: 500000,
      total: 1600000,
      difference: 0,
      valid: true,
    });
  });
  it("mengalokasikan nol untuk hunter bila persentase nol", () => {
    const r = calculateFee({
      contractValue: 1600000,
      managerBps: 1500,
      hunterBps: 0,
      cashBps: 500,
      dj: 300000,
      mc2: 250000,
      soundman: 150000,
    });
    expect(r.hunter).toBe(0);
    expect(r.mc1).toBe(580000);
    expect(r.valid).toBe(true);
  });
  it("menolak pembagian yang melampaui kontrak", () => {
    const r = calculateFee({
      contractValue: 500000,
      managerBps: 1500,
      hunterBps: 500,
      cashBps: 500,
      dj: 300000,
      mc2: 250000,
      soundman: 150000,
    });
    expect(r.mc1).toBeLessThan(0);
    expect(r.valid).toBe(false);
  });
  it("membulatkan persentase ke Rupiah terdekat", () => {
    const r = calculateFee({
      contractValue: 1001,
      managerBps: 1500,
      hunterBps: 0,
      cashBps: 0,
      dj: 0,
      mc2: 0,
      soundman: 0,
    });
    expect(r.manager).toBe(150);
    expect(r.total).toBe(1001);
  });
  it("mendukung anggota yang merangkap hunter tanpa mengubah total", () => {
    const r = calculateFee({
      contractValue: 1600000,
      managerBps: 1500,
      hunterBps: 500,
      cashBps: 500,
      dj: 300000,
      mc2: 250000,
      soundman: 150000,
    });
    expect(r.mc2 + r.hunter).toBe(330000);
    expect(r.total).toBe(1600000);
  });
  it("menjaga semua nominal sebagai integer", () => {
    const r = calculateFee({
      contractValue: 1234567,
      managerBps: 1333,
      hunterBps: 477,
      cashBps: 511,
      dj: 123456,
      mc2: 234567,
      soundman: 111111,
    });
    for (const amount of Object.values(r))
      if (typeof amount === "number")
        expect(Number.isInteger(amount)).toBe(true);
  });
  it("menghasilkan sisa otomatis yang lebih besar saat fee tetap turun", () => {
    const normal = calculateFee({
      contractValue: 1600000,
      managerBps: 1500,
      hunterBps: 500,
      cashBps: 500,
      dj: 300000,
      mc2: 250000,
      soundman: 150000,
    });
    const lower = calculateFee({
      contractValue: 1600000,
      managerBps: 1500,
      hunterBps: 500,
      cashBps: 500,
      dj: 200000,
      mc2: 200000,
      soundman: 100000,
    });
    expect(lower.mc1).toBeGreaterThan(normal.mc1);
    expect(lower.valid).toBe(true);
  });
  it("valid untuk kontrak nol jika semua komponen nol", () => {
    const r = calculateFee({
      contractValue: 0,
      managerBps: 0,
      hunterBps: 0,
      cashBps: 0,
      dj: 0,
      mc2: 0,
      soundman: 0,
    });
    expect(r).toMatchObject({ total: 0, difference: 0, mc1: 0, valid: true });
  });
  it("menolak saat komponen tetap melebihi kontrak meskipun persentase nol", () => {
    const r = calculateFee({
      contractValue: 100000,
      managerBps: 0,
      hunterBps: 0,
      cashBps: 0,
      dj: 100001,
      mc2: 0,
      soundman: 0,
    });
    expect(r.valid).toBe(false);
    expect(r.mc1).toBe(-1);
  });
  it("menunjukkan selisih kurang pada nominal MC 1 manual", () => {
    const r = calculateFee({
      contractValue: 1600000,
      managerBps: 1500,
      hunterBps: 500,
      cashBps: 500,
      dj: 300000,
      mc2: 250000,
      soundman: 150000,
      mc1: 400000,
    });
    expect(r).toMatchObject({
      total: 1500000,
      difference: 100000,
      valid: false,
    });
  });
  it("menolak nominal MC 1 manual yang membuat total berlebihan", () => {
    const r = calculateFee({
      contractValue: 1600000,
      managerBps: 1500,
      hunterBps: 500,
      cashBps: 500,
      dj: 300000,
      mc2: 250000,
      soundman: 150000,
      mc1: 600000,
    });
    expect(r).toMatchObject({
      total: 1700000,
      difference: -100000,
      valid: false,
    });
  });
});
