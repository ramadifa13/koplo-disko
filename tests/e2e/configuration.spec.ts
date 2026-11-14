import { expect, test } from "@playwright/test";
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
