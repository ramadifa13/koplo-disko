import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const testUserId = "11111111-1111-4111-8111-111111111111";

async function signInWithMockedSupabase(page: import("@playwright/test").Page) {
  const jwtPart = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const accessToken = `${jwtPart({ alg: "none", typ: "JWT" })}.${jwtPart({
    sub: testUserId,
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.signature`;
  const user = {
    id: testUserId,
    aud: "authenticated",
    role: "authenticated",
    email: "responsive-test@example.com",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };

  await page.route("**/auth/v1/token?grant_type=password", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: accessToken,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "responsive-test-refresh-token",
        user,
      }),
    }),
  );
  // Daftarkan fallback lebih awal karena Playwright mengevaluasi route
  // yang terakhir didaftarkan terlebih dahulu.
  await page.route("**/rest/v1/**", (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-range": "0-0/0" },
      contentType: "application/json",
      body: "[]",
    }),
  );
  await page.route("**/rest/v1/rpc/get_my_profile", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: testUserId,
        full_name: "Responsive Test",
        email: user.email,
        is_active: true,
        role: "owner",
      }),
    }),
  );
  await page.route("**/rest/v1/rpc/get_my_capabilities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        management: true,
        manage_owner: true,
        manage_members: true,
        manage_finance: true,
        manage_documents: true,
        manage_settings: true,
        view_audit: true,
      }),
    }),
  );
  await page.route("**/rest/v1/rpc/get_management_dashboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        events_count: 0,
        upcoming_count: 0,
        contract_total: 0,
        received_total: 0,
        receivable_total: 0,
        unpaid_fees: 0,
        cash_balance: 0,
      }),
    }),
  );
  await page.route("**/rest/v1/rpc/get_management_finance_summary", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        contract: 0,
        received: 0,
        receivable: 0,
        settled: 0,
        active_events: 0,
        cash_balance: 0,
      }),
    }),
  );
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Kata sandi").fill("responsive-test-password");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByText("Halo, Responsive.")).toBeVisible();
}

async function expectNoPageOverflow(page: import("@playwright/test").Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}
test("menampilkan halaman masuk tanpa data palsu", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Selamat datang" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Logo Koplo Disko" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Logo Koplo Disko" }),
  ).toHaveAttribute("src", "/logo.png");
  await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(true);
});

test("route internal mengarahkan pengguna anonim ke halaman masuk", async ({
  page,
}) => {
  await page.goto("/jadwal");
  await expect(page).toHaveURL(/\/masuk$/);
  await expect(
    page.getByRole("heading", { name: "Selamat datang" }),
  ).toBeVisible();
});

test("menampilkan pesan Indonesia ketika kredensial tidak benar", async ({
  page,
}) => {
  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "invalid_grant" }),
    });
  });
  await page.goto("/masuk");
  await page.getByLabel("Email").fill("tidak-ada@example.com");
  await page.getByLabel("Kata sandi").fill("kata-sandi-salah");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(
    page.getByText("Email atau kata sandi tidak benar."),
  ).toBeVisible();
});

test("halaman masuk tidak memiliki pelanggaran accessibility serius", async ({
  page,
}) => {
  await page.goto("/masuk");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});

test("seluruh halaman setelah login tidak meluber secara horizontal", async ({
  page,
}) => {
  await signInWithMockedSupabase(page);

  const routes = [
    { path: "/", landmark: "Halo, Responsive." },
    { path: "/jadwal", landmark: "Jadwal Manggung" },
    { path: "/keuangan", landmark: "Keuangan" },
    { path: "/anggota", landmark: "Anggota" },
    { path: "/dokumen", landmark: "Dokumen" },
    { path: "/laporan", landmark: "Laporan" },
    { path: "/pengaturan", landmark: "Pengaturan" },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { name: route.landmark }).first(),
    ).toBeVisible();
    await expectNoPageOverflow(page);
  }
});
