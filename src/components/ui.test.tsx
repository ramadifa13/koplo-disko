import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { ConfirmAction } from "./ConfirmAction";
import { LoadingState } from "./ui";

describe("LoadingState", () => {
  it("menampilkan loader dan logo resmi Koplo Disko", () => {
    const { container } = render(<LoadingState label="Memuat jadwal" />);

    expect(screen.getByRole("status", { name: "Memuat jadwal" })).toBeVisible();
    expect(container.querySelector("img")).toHaveAttribute("src", "/logo.png");
  });

  it("meminta konfirmasi sebelum menjalankan aksi kritis", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmAction
        title="Arsipkan dokumen?"
        description="Dokumen akan disembunyikan."
        confirmLabel="Arsipkan"
        onConfirm={onConfirm}
        trigger={<button>Arsipkan dokumen</button>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Arsipkan dokumen" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Arsipkan" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
